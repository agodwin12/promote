'use strict';

const axios = require('axios');
const logger = require('../utils/logger');
const socketService = require('./socketService');
const { models } = require('../config/database');
const { getETA } = require('./routesService');

const GPS_ACCOUNTS = [
    {
        name: 'tracking',
        loginName: process.env.GPS_LOGIN_NAME_1 || 'Proxym_tracking',
        loginPassword: process.env.GPS_LOGIN_PASSWORD_1 || 'proxym123',
    },
    {
        name: 'mobility',
        loginName: process.env.GPS_LOGIN_NAME_2 || 'PROXYM',
        loginPassword: process.env.GPS_LOGIN_PASSWORD_2 || 'Proxym2024.',
    },
];

const GPS_CONFIG = {
    fetchInterval: parseInt(process.env.GPS_FETCH_INTERVAL_MS || '10000', 10),
    requestTimeout: parseInt(process.env.GPS_REQUEST_TIMEOUT_MS || '10000', 10),
    maxConcurrent: 20,
    loginUrl: process.env.GPS_LOGIN_URL || 'http://appzzl.18gps.net/',
    apiUrl: process.env.GPS_API_URL || 'http://apitest.18gps.net/GetDateServices.asmx',
    loginType: process.env.GPS_LOGIN_TYPE || 'ENTERPRISE',
    language: process.env.GPS_LANGUAGE || 'en',
    timeZone: parseInt(process.env.GPS_TIMEZONE || '8', 10),
    mapType: process.env.GPS_MAP_TYPE || 'WGS84',
};

const GPS_BOUNDS = {
    minLat: parseFloat(process.env.GPS_MIN_LAT || '1.5'),
    maxLat: parseFloat(process.env.GPS_MAX_LAT || '13.5'),
    minLng: parseFloat(process.env.GPS_MIN_LNG || '8.0'),
    maxLng: parseFloat(process.env.GPS_MAX_LNG || '16.5'),
};

const gpsSessions = new Map();

let fetchInterval = null;
let isFetchingGPS = false;

function normalizeMac(value) {
    return String(value || '').trim();
}

function parseNumberOrNull(value) {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
}

function getRecordTimestampMs(rawTimestamp) {
    const raw = Number(rawTimestamp);

    if (Number.isFinite(raw) && raw > 0) {
        return raw < 10000000000 ? raw * 1000 : raw;
    }

    return Date.now();
}

function isValidCoordinate(lat, lng) {
    return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180 &&
        !(lat === 0 && lng === 0)
    );
}

function isInsideOperationalBounds(lat, lng) {
    return (
        lat >= GPS_BOUNDS.minLat &&
        lat <= GPS_BOUNDS.maxLat &&
        lng >= GPS_BOUNDS.minLng &&
        lng <= GPS_BOUNDS.maxLng
    );
}

function gcj02ToWgs84(lat, lng) {
    const a = 6378245.0;
    const ee = 0.00669342162296594323;

    function transformLat(x, y) {
        let ret =
            -100.0 +
            2.0 * x +
            3.0 * y +
            0.2 * y * y +
            0.1 * x * y +
            0.2 * Math.sqrt(Math.abs(x));

        ret +=
            ((20.0 * Math.sin(6.0 * x * Math.PI) +
                    20.0 * Math.sin(2.0 * x * Math.PI)) *
                2.0) /
            3.0;

        ret +=
            ((20.0 * Math.sin(y * Math.PI) +
                    40.0 * Math.sin((y / 3.0) * Math.PI)) *
                2.0) /
            3.0;

        ret +=
            ((160.0 * Math.sin((y / 12.0) * Math.PI) +
                    320.0 * Math.sin((y * Math.PI) / 30.0)) *
                2.0) /
            3.0;

        return ret;
    }

    function transformLng(x, y) {
        let ret =
            300.0 +
            x +
            2.0 * y +
            0.1 * x * x +
            0.1 * x * y +
            0.1 * Math.sqrt(Math.abs(x));

        ret +=
            ((20.0 * Math.sin(6.0 * x * Math.PI) +
                    20.0 * Math.sin(2.0 * x * Math.PI)) *
                2.0) /
            3.0;

        ret +=
            ((20.0 * Math.sin(x * Math.PI) +
                    40.0 * Math.sin((x / 3.0) * Math.PI)) *
                2.0) /
            3.0;

        ret +=
            ((150.0 * Math.sin((x / 12.0) * Math.PI) +
                    300.0 * Math.sin((x / 30.0) * Math.PI)) *
                2.0) /
            3.0;

        return ret;
    }

    let dLat = transformLat(lng - 105.0, lat - 35.0);
    let dLng = transformLng(lng - 105.0, lat - 35.0);

    const radLat = (lat / 180.0) * Math.PI;
    let magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;

    const sqrtMagic = Math.sqrt(magic);

    dLat =
        (dLat * 180.0) /
        (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI);

    dLng =
        (dLng * 180.0) /
        ((a / sqrtMagic) * Math.cos(radLat) * Math.PI);

    return {
        lat: lat - dLat,
        lng: lng - dLng,
    };
}

function normalizeCoordinateByMapType(rawLat, rawLng) {
    const mapType = String(GPS_CONFIG.mapType || 'WGS84')
        .toUpperCase()
        .replace('_', '-');

    if (mapType === 'GCJ02' || mapType === 'GCJ-02') {
        return gcj02ToWgs84(rawLat, rawLng);
    }

    return {
        lat: rawLat,
        lng: rawLng,
    };
}

async function ensureSession(account) {
    const existing = gpsSessions.get(account.name);

    if (existing && existing.expiresAt > Date.now() + 5 * 60 * 1000) {
        return existing;
    }

    try {
        const { data } = await axios.get(`${GPS_CONFIG.apiUrl}/loginSystem`, {
            params: {
                LoginName: account.loginName,
                LoginPassword: account.loginPassword,
                LoginType: GPS_CONFIG.loginType,
                language: GPS_CONFIG.language,
                timeZone: GPS_CONFIG.timeZone,
                apply: 'APP',
                ISMD5: 0,
                loginUrl: GPS_CONFIG.loginUrl,
            },
            timeout: GPS_CONFIG.requestTimeout,
        });

        if (data.success !== 'true') {
            logger.warn(`[GPS] [${account.name}] Login failed: ${data.msg || 'unknown'}`);
            return null;
        }

        const session = {
            token: data.mds,
            userId: data.id,
            expiresAt: Date.now() + 30 * 60 * 1000,
        };

        gpsSessions.set(account.name, session);

        logger.info(`[GPS] [${account.name}] Session refreshed — userId=${session.userId}`);

        return session;
    } catch (err) {
        logger.warn(`[GPS] [${account.name}] Login error: ${err.message}`);
        return null;
    }
}

async function fetchPositionsForAccount(account, session) {
    try {
        const { data } = await axios.get(`${GPS_CONFIG.apiUrl}/GetDate`, {
            params: {
                method: 'getDeviceListByCustomId',
                id: session.userId,
                mds: session.token,
                mapType: GPS_CONFIG.mapType,
            },
            timeout: GPS_CONFIG.requestTimeout,
        });

        if (data.success !== 'true' || !Array.isArray(data.data)) {
            logger.debug(`[GPS] [${account.name}] No data: ${data.errorDescribe || 'unknown'}`);
            return new Map();
        }

        const result = new Map();

        for (const device of data.data) {
            if (!Array.isArray(device.records) || device.records.length === 0) {
                continue;
            }

            for (const record of device.records) {
                const macId             = normalizeMac(record[11]);
                const rawLng            = parseNumberOrNull(record[2]);
                const rawLat            = parseNumberOrNull(record[3]);
                const speed             = parseNumberOrNull(record[8]) || 0;
                const heading           = parseNumberOrNull(record[10]) || 0;
                const recordTimestampMs = getRecordTimestampMs(record[0]);
                const ts                = new Date(recordTimestampMs).toISOString();

                if (!macId) continue;

                if (rawLat === null || rawLng === null) {
                    logger.warn(
                        `[GPS] [${account.name}] Rejected invalid raw point: MAC=${macId}, lat=${record[3]}, lng=${record[2]}`
                    );
                    continue;
                }

                const corrected = normalizeCoordinateByMapType(rawLat, rawLng);

                if (!isValidCoordinate(corrected.lat, corrected.lng)) {
                    logger.warn(
                        `[GPS] [${account.name}] Rejected invalid point: MAC=${macId}, lat=${corrected.lat}, lng=${corrected.lng}`
                    );
                    continue;
                }

                if (!isInsideOperationalBounds(corrected.lat, corrected.lng)) {
                    logger.warn(
                        `[GPS] [${account.name}] Rejected out-of-bounds point: MAC=${macId}, lat=${corrected.lat}, lng=${corrected.lng}`
                    );
                    continue;
                }

                result.set(macId, {
                    mac_id:    macId,
                    latitude:  corrected.lat,
                    longitude: corrected.lng,
                    speed,
                    heading,
                    ts,
                    account:   account.name,
                    quality:   'VALID',
                });
            }
        }

        logger.debug(
            `[GPS] [${account.name}] ${result.size} device(s) — MACs: ${JSON.stringify([...result.keys()])}`
        );

        return result;
    } catch (err) {
        logger.warn(`[GPS] [${account.name}] Fetch error: ${err.message}`);
        return new Map();
    }
}

async function fetchAllLivePositions() {
    const merged = new Map();

    await Promise.allSettled(
        GPS_ACCOUNTS.map(async account => {
            const session = await ensureSession(account);
            if (!session) return;

            const positions = await fetchPositionsForAccount(account, session);
            for (const [macId, position] of positions) {
                merged.set(macId, position);
            }
        })
    );

    logger.debug(`[GPS] Live MACs across all accounts: ${JSON.stringify([...merged.keys()])}`);

    return merged;
}

async function fetchGPSData() {
    if (isFetchingGPS) {
        logger.warn('[GPS] Previous cycle still running — skipping this tick');
        return;
    }

    isFetchingGPS = true;

    try {
        const buses = await models.Bus.findAll({
            attributes: ['id', 'company_id', 'mac_id', 'plate', 'model'],
            raw: true,
        });

        if (!buses.length) {
            logger.debug('[GPS] No buses in DB — skipping tick');
            return;
        }

        logger.debug(`[GPS] ── tick ── ${buses.length} bus(es) | ${new Date().toISOString()}`);

        const livePositions = await fetchAllLivePositions();
        const chunks        = chunkArray(buses, GPS_CONFIG.maxConcurrent);

        for (const chunk of chunks) {
            await Promise.allSettled(chunk.map(bus => processOneBus(bus, livePositions)));
        }

        logger.debug('[GPS] ── tick complete ──');
    } catch (err) {
        logger.error(`[GPS] Cycle error: ${err.message}`);
        logger.debug(err.stack);
    } finally {
        isFetchingGPS = false;
    }
}

async function processOneBus(bus, livePositions) {
    const vehicleId = bus.id;
    const companyId = bus.company_id;
    const macId     = normalizeMac(bus.mac_id);

    if (!macId) {
        logger.warn(`[GPS] bus ${vehicleId} — SKIPPED: mac_id is null in DB`);
        return;
    }

    if (!livePositions.has(macId)) {
        logger.warn(`[GPS] bus ${vehicleId} — SKIPPED: mac_id="${macId}" not found in live data`);
        return;
    }

    const position = livePositions.get(macId);

    logger.debug(
        `[GPS] bus ${vehicleId} — live [${position.account}] ` +
        `lat=${position.latitude.toFixed(6)} lng=${position.longitude.toFixed(6)} speed=${position.speed}`
    );

    const locationPayload = {
        vehicleId,
        companyId,
        latitude:    position.latitude,
        longitude:   position.longitude,
        speed:       position.speed,
        heading:     position.heading,
        direction:   position.heading,
        timestamp:   position.ts,
        plate:       bus.plate,
        model:       bus.model,
        mac_id:      macId,
        gps_quality: 'VALID',
        account:     position.account,
    };

    const users = socketService.getUserLocationsForCompany(companyId);

    logger.debug(`[GPS] bus ${vehicleId} company=${companyId} watchers=${users.length}`);

    // No users watching — broadcast position only, no ETA needed
    if (users.length === 0) {
        socketService.emitGPSUpdate(companyId, vehicleId, locationPayload, null);
        return;
    }

    // Per-user ETA using local haversine math (no API call)
    await Promise.allSettled(
        users.map(async ({ socketId, lat: userLat, lng: userLng }) => {
            const etaData = getETA({
                busLat:  position.latitude,
                busLng:  position.longitude,
                userLat,
                userLng,
            });

            socketService.emitToSocket(socketId, 'gps:update', {
                ...locationPayload,
                eta:              etaData?.eta              ?? null,
                duration_seconds: etaData?.duration_seconds ?? null,
                distance_meters:  etaData?.distance_meters  ?? null,
                distance_text:    etaData?.distance_text    ?? null,
            });

            logger.info(
                `[GPS] ✅ bus ${vehicleId} → ${socketId} | ` +
                `account=${position.account} eta=${etaData?.eta ?? 'N/A'} dist=${etaData?.distance_text ?? 'N/A'}`
            );
        })
    );
}

function startGPSFetchCycle() {
    if (fetchInterval) {
        logger.warn('[GPS] Already running');
        return;
    }

    logger.info(
        `[GPS] 🛰 Starting — interval=${GPS_CONFIG.fetchInterval / 1000}s ` +
        `accounts=${GPS_ACCOUNTS.map(a => a.name).join(', ')}`
    );

    fetchGPSData();
    fetchInterval = setInterval(fetchGPSData, GPS_CONFIG.fetchInterval);
}

function stopGPSFetchCycle() {
    if (!fetchInterval) return;

    clearInterval(fetchInterval);
    fetchInterval = null;
    gpsSessions.clear();

    logger.info('[GPS] 🛑 Stopped');
}

function isRunning() {
    return fetchInterval !== null;
}

function chunkArray(array, size) {
    const output = [];
    for (let i = 0; i < array.length; i += size) {
        output.push(array.slice(i, i + size));
    }
    return output;
}

module.exports = {
    startGPSFetchCycle,
    stopGPSFetchCycle,
    fetchGPSData,
    isRunning,
};