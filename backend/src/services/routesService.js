const logger = require('../utils/logger');

// ─────────────────────────────────────────
// CONSTANTS
// Average city bus speed in Yaoundé/Douala.
// Used to estimate ETA from straight-line
// distance. Adjust if real-world feels off.
// ─────────────────────────────────────────
const AVG_SPEED_KMH    = 30;
const AVG_SPEED_MS     = (AVG_SPEED_KMH * 1000) / 3600; // metres per second

// Straight-line → road distance correction.
// Roads are never straight — multiply haversine
// by this factor to get a closer real-world estimate.
const ROAD_FACTOR      = 1.3;

// ─────────────────────────────────────────
// HAVERSINE DISTANCE
// Returns straight-line distance in metres
// between two lat/lng coordinates.
// ─────────────────────────────────────────
function haversineMetres(lat1, lng1, lat2, lng2) {
    const R    = 6_371_000; // Earth radius in metres
    const toR  = (d) => (d * Math.PI) / 180;
    const dLat = toR(lat2 - lat1);
    const dLng = toR(lng2 - lng1);
    const a    =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────
// FORMAT DURATION
// Converts seconds into a human-readable
// "X min" or "X hr Y min" string for the pill.
// ─────────────────────────────────────────
function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return 'Less than 1 min';

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
// Converts metres to "X.X km" or "X m".
// ─────────────────────────────────────────
function formatDistance(meters) {
    if (!meters || meters <= 0) return '0 m';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

// ─────────────────────────────────────────
// GET ETA
// Pure local calculation — no API call.
// Uses haversine distance × road correction
// factor ÷ average city speed.
//
// Returns:
// {
//   eta:              '8 min',
//   duration_seconds: 480,
//   distance_meters:  2300,
//   distance_text:    '2.3 km',
// }
// Returns null on invalid coordinates.
// ─────────────────────────────────────────
function getETA({ busLat, busLng, userLat, userLng }) {
    if (
        !Number.isFinite(busLat)  || !Number.isFinite(busLng) ||
        !Number.isFinite(userLat) || !Number.isFinite(userLng)
    ) {
        logger.warn('⚠️  getETA called with invalid coordinates');
        return null;
    }

    // Straight-line distance
    const straightLine = haversineMetres(busLat, busLng, userLat, userLng);

    // Already at the same point
    if (straightLine < 5) {
        return {
            eta:              'Less than 1 min',
            duration_seconds: 0,
            distance_meters:  0,
            distance_text:    '0 m',
        };
    }

    // Apply road correction for a more realistic distance
    const roadDistance     = straightLine * ROAD_FACTOR;
    const durationSeconds  = Math.round(roadDistance / AVG_SPEED_MS);

    const result = {
        eta:              formatDuration(durationSeconds),
        duration_seconds: durationSeconds,
        distance_meters:  Math.round(roadDistance),
        distance_text:    formatDistance(Math.round(roadDistance)),
    };

    logger.debug(
        `📍 ETA (local): ${result.eta} | ${result.distance_text} | ` +
        `straight=${Math.round(straightLine)}m road≈${Math.round(roadDistance)}m`
    );

    return result;
}

module.exports = {
    getETA,
    formatDuration,
    formatDistance,
};