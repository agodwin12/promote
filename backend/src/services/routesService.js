const axios  = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const API_KEY        = process.env.GOOGLE_MAPS_API_KEY;

// ─────────────────────────────────────────
// FORMAT DURATION
// Converts raw seconds into a human-readable
// "X min" or "X hr Y min" string for the pill.
// ─────────────────────────────────────────
function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return null;

    const totalMinutes = Math.round(seconds / 60);

    if (totalMinutes < 1)  return 'Less than 1 min';
    if (totalMinutes < 60) return `${totalMinutes} min`;

    const hours   = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (minutes === 0) return `${hours} hr`;
    return `${hours} hr ${minutes} min`;
}

// ─────────────────────────────────────────
// FORMAT DISTANCE
// Converts meters to "X.X km" or "X m".
// ─────────────────────────────────────────
function formatDistance(meters) {
    if (!meters || meters <= 0) return null;
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

// ─────────────────────────────────────────
// GET ETA
// Calls the Google Maps Routes API to get
// the real road-based travel time from the
// bus current position to the user position.
//
// Returns:
// {
//   eta:              '8 min',
//   duration_seconds: 480,
//   distance_meters:  2300,
//   distance_text:    '2.3 km',
// }
// Returns null on any failure — the frontend
// should degrade gracefully (hide the pill).
// ─────────────────────────────────────────
async function getETA({ busLat, busLng, userLat, userLng }) {
    if (!API_KEY) {
        logger.warn('⚠️ GOOGLE_MAPS_API_KEY not set — ETA unavailable');
        return null;
    }

    // Skip if coordinates are invalid
    if (
        !Number.isFinite(busLat)  || !Number.isFinite(busLng) ||
        !Number.isFinite(userLat) || !Number.isFinite(userLng)
    ) {
        logger.warn('⚠️ getETA called with invalid coordinates');
        return null;
    }

    // Skip if bus and user are at essentially the same point
    const approxDistanceDeg = Math.abs(busLat - userLat) + Math.abs(busLng - userLng);
    if (approxDistanceDeg < 0.00001) {
        return {
            eta:              'Less than 1 min',
            duration_seconds: 0,
            distance_meters:  0,
            distance_text:    '0 m',
        };
    }

    try {
        const response = await axios.post(
            ROUTES_API_URL,
            {
                origin: {
                    location: {
                        latLng: { latitude: busLat, longitude: busLng },
                    },
                },
                destination: {
                    location: {
                        latLng: { latitude: userLat, longitude: userLng },
                    },
                },
                travelMode:             'DRIVE',
                routingPreference:      'TRAFFIC_AWARE',   // uses live traffic for accurate ETA
                computeAlternativeRoutes: false,            // fastest route only
                languageCode:           'en-US',
                units:                  'METRIC',
            },
            {
                headers: {
                    'Content-Type':             'application/json',
                    'X-Goog-Api-Key':           API_KEY,
                    // Only request the fields we need — reduces response size and cost
                    'X-Goog-FieldMask':         'routes.duration,routes.distanceMeters',
                },
                timeout: 5000, // 5s timeout — don't block GPS cycle on slow API
            }
        );

        const route = response.data?.routes?.[0];

        if (!route) {
            logger.warn('⚠️ Routes API returned no routes');
            return null;
        }

        // duration comes as "Xs" string e.g. "483s"
        const rawDuration     = route.duration || '0s';
        const durationSeconds = parseInt(rawDuration.replace('s', ''), 10);
        const distanceMeters  = route.distanceMeters || 0;

        const result = {
            eta:              formatDuration(durationSeconds),
            duration_seconds: durationSeconds,
            distance_meters:  distanceMeters,
            distance_text:    formatDistance(distanceMeters),
        };

        logger.debug(
            `🗺️  ETA calculated: ${result.eta} | ` +
            `${result.distance_text} | ` +
            `bus=(${busLat},${busLng}) → user=(${userLat},${userLng})`
        );

        return result;

    } catch (error) {
        if (error.response) {
            logger.error(
                `🔥 Routes API error [${error.response.status}]:`,
                error.response.data?.error?.message || error.message
            );
        } else if (error.code === 'ECONNABORTED') {
            logger.warn('⚠️ Routes API timeout — ETA skipped for this tick');
        } else {
            logger.error('🔥 Routes API error:', error.message);
        }
        return null;
    }
}

module.exports = {
    getETA,
    formatDuration,
    formatDistance,
};