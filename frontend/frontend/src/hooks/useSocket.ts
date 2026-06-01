'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
    GPSUpdatePayload,
    BusMarkerState,
    SocketStatus,
    UserLocation,
} from '@/lib/types';

// ─────────────────────────────────────────
// SOCKET URL
// ─────────────────────────────────────────
const SOCKET_URL =
    process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

// ─────────────────────────────────────────
// EVENTS — must match socketService.js
// ─────────────────────────────────────────
const Events = {
    GPS_UPDATE:      'gps:update',
    ERROR:           'error',
    JOIN_COMPANY:    'join:company',
    LEAVE_COMPANY:   'leave:company',
    UPDATE_LOCATION: 'update:location',
} as const;

// ─────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────
interface UseSocketOptions {
    companyIds:   number[];
    userLocation: UserLocation | null;
    onGPSUpdate?: (payload: GPSUpdatePayload) => void;
}

interface UseSocketReturn {
    status:             SocketStatus;
    busMarkers:         Map<number, BusMarkerState>;
    isConnected:        boolean;
    updateUserLocation: (location: UserLocation) => void;
    seedMarkers:        (buses: SeedBus[]) => void;
}

export interface SeedBus {
    id:        number;
    plate:     string;
    model:     string | null;
    companyId: number;
    logoUrl:   string | null;
    location: {
        latitude:  number;
        longitude: number;
        speed:     number;
        direction: number | null;
    } | null;
}

// ─────────────────────────────────────────
// useSocket
//
// KEY FIX: joining a company room requires BOTH:
//   1. socket.connected === true
//   2. userLocation !== null
//
// Previously, `socket.on('connect', ...)` fired before
// geolocation resolved — the early-return guard silently
// bailed and no rooms were ever joined, so no GPS events
// ever arrived and the map was permanently frozen.
//
// Solution: maintain a `pendingJoin` flag. When location
// arrives, if already connected, join immediately. When
// socket connects, if location already exists, join immediately.
// Either path guarantees we join exactly once per company.
// ─────────────────────────────────────────
export function useSocket({
                              companyIds,
                              userLocation,
                              onGPSUpdate,
                          }: UseSocketOptions): UseSocketReturn {
    const socketRef         = useRef<Socket | null>(null);
    const joinedRoomsRef    = useRef<Set<number>>(new Set());
    const userLocationRef   = useRef<UserLocation | null>(null);
    const isConnectedRef    = useRef(false);

    const [status,     setStatus]     = useState<SocketStatus>('connecting');
    const [busMarkers, setBusMarkers] = useState<Map<number, BusMarkerState>>(new Map());

    // ── Emit JOIN for a single company ──────
    // Only called when we are sure socket is connected AND location exists.
    const joinCompany = useCallback((socket: Socket, companyId: number, loc: UserLocation) => {
        socket.emit(Events.JOIN_COMPANY, {
            companyId,
            userLat: loc.lat,
            userLng: loc.lng,
        });
        joinedRoomsRef.current.add(companyId);
        console.info(`[Socket] ✅ Joined company:${companyId} | user=(${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})`);
    }, []);

    // ── Try to join all pending rooms ───────
    // Safe to call at any time — internally checks both preconditions.
    const tryJoinAll = useCallback((socket: Socket | null, ids: number[], loc: UserLocation | null) => {
        if (!socket || !socket.connected || !loc) {
            console.debug(
                `[Socket] tryJoinAll skipped — connected=${socket?.connected}, hasLoc=${!!loc}, ids=${ids.length}`
            );
            return;
        }
        let joined = 0;
        ids.forEach((id) => {
            if (!joinedRoomsRef.current.has(id)) {
                joinCompany(socket, id, loc);
                joined++;
            }
        });
        if (joined > 0) console.info(`[Socket] Joined ${joined} new room(s). Total: ${joinedRoomsRef.current.size}`);
    }, [joinCompany]);

    // ── Connect socket once on mount ────────
    useEffect(() => {
        const socket = io(SOCKET_URL, {
            transports:           ['websocket', 'polling'],
            reconnection:         true,
            reconnectionDelay:    1000,
            reconnectionDelayMax: 10000,
            reconnectionAttempts: Infinity,
            timeout:              10000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            isConnectedRef.current = true;
            setStatus('connected');
            console.info(`[Socket] Connected: ${socket.id}`);

            // Location may already be available by the time we connect
            // (user had previously granted permission, fast resolve).
            // In that case, join immediately without waiting for the
            // location effect to fire again.
            tryJoinAll(socket, companyIds, userLocationRef.current);
        });

        socket.on('disconnect', (reason) => {
            isConnectedRef.current = false;
            setStatus('disconnected');
            joinedRoomsRef.current.clear();
            // Intentionally keep busMarkers — don't blank the map on reconnect
            console.warn(`[Socket] Disconnected: ${reason}`);
        });

        socket.on('connect_error', (err) => {
            setStatus('error');
            console.error('[Socket] Connection error:', err.message);
        });

        // ── GPS UPDATE ────────────────────────
        socket.on(Events.GPS_UPDATE, (payload: GPSUpdatePayload) => {
            console.debug(
                `[GPS] vehicle=${payload.vehicleId} ` +
                `lat=${payload.latitude?.toFixed(5)} lng=${payload.longitude?.toFixed(5)} ` +
                `eta=${payload.eta ?? '—'} dist=${payload.distance_text ?? '—'}`
            );

            setBusMarkers((prev) => {
                const next     = new Map(prev);
                const existing = prev.get(payload.vehicleId);
                next.set(payload.vehicleId, {
                    // Preserve plate/model from seed if backend doesn't send them
                    busId:            payload.vehicleId,
                    companyId:        payload.companyId,
                    plate:            payload.plate            ?? existing?.plate      ?? '',
                    model:            payload.model            ?? existing?.model      ?? null,
                    logoUrl:          payload.logoUrl          ?? existing?.logoUrl    ?? null,
                    latitude:         payload.latitude,
                    longitude:        payload.longitude,
                    speed:            payload.speed,
                    direction:        payload.direction,
                    eta:              payload.eta,
                    duration_seconds: payload.duration_seconds,
                    distance_meters:  payload.distance_meters,
                    distance_text:    payload.distance_text,
                    lastUpdated:      Date.now(),
                });
                return next;
            });

            onGPSUpdate?.(payload);
        });

        socket.on(Events.ERROR, (err: { message: string }) => {
            console.error('[Socket] Server error:', err.message);
        });

        return () => {
            socket.disconnect();
            socketRef.current    = null;
            isConnectedRef.current = false;
            joinedRoomsRef.current.clear();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // mount-only — socket is created once

    // ── React when userLocation first arrives ─
    // This is the critical path: geolocation resolves AFTER
    // the socket connects in ~95% of cases. We must join rooms
    // here, not inside `connect`.
    useEffect(() => {
        if (!userLocation) return;
        userLocationRef.current = userLocation;

        // Join any rooms we haven't joined yet
        tryJoinAll(socketRef.current, companyIds, userLocation);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userLocation]); // intentionally excludes companyIds — handled below

    // ── React when companyIds list grows ─────
    // Companies load from HTTP after socket connects.
    // New ids that appeared since last join need to be joined now.
    useEffect(() => {
        tryJoinAll(socketRef.current, companyIds, userLocationRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyIds]);

    // ── Send user position to backend ────────
    // Called when the user walks — backend recalculates ETA
    const updateUserLocation = useCallback((location: UserLocation) => {
        const socket = socketRef.current;
        userLocationRef.current = location;

        if (!socket?.connected) return;

        // 1. Tell the backend the new position for ETA recalc
        socket.emit(Events.UPDATE_LOCATION, {
            userLat: location.lat,
            userLng: location.lng,
        });

        // 2. Re-emit JOIN_COMPANY for every joined room so the backend
        //    updates its userLocations map (some backends key ETA by room join)
        joinedRoomsRef.current.forEach((companyId) => {
            socket.emit(Events.JOIN_COMPANY, {
                companyId,
                userLat: location.lat,
                userLng: location.lng,
            });
        });
    }, []);

    // ── Seed markers from REST API response ──
    // Pre-populates the map before the first GPS tick (which may be 10s away)
    const seedMarkers = useCallback((buses: SeedBus[]) => {
        setBusMarkers((prev) => {
            const next = new Map(prev);
            buses.forEach((bus) => {
                if (!bus.location) return;
                // Don't overwrite a live GPS update with stale seed data
                const existing = prev.get(bus.id);
                if (existing?.lastUpdated && Date.now() - existing.lastUpdated < 30_000) return;

                next.set(bus.id, {
                    busId:            bus.id,
                    companyId:        bus.companyId,
                    plate:            bus.plate,
                    model:            bus.model,
                    logoUrl:          bus.logoUrl,
                    latitude:         bus.location.latitude,
                    longitude:        bus.location.longitude,
                    speed:            bus.location.speed,
                    direction:        bus.location.direction,
                    eta:              null,
                    duration_seconds: null,
                    distance_meters:  null,
                    distance_text:    null,
                    lastUpdated:      Date.now(),
                });
            });
            return next;
        });
    }, []);

    return {
        status,
        busMarkers,
        isConnected:        status === 'connected',
        updateUserLocation,
        seedMarkers,
    };
}