import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ─────────────────────────────────────────
// CN — Tailwind class merger
// Combines clsx (conditional classes) with
// tailwind-merge (deduplicates conflicting
// Tailwind classes e.g. p-2 + p-4 → p-4)
// ─────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// ─────────────────────────────────────────
// FORMAT ETA
// Converts raw seconds to human-readable string.
// Mirrors the backend formatDuration() so the
// frontend can also compute estimates locally.
// ─────────────────────────────────────────
export function formatETA(seconds: number | null | undefined): string | null {
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
// ─────────────────────────────────────────
export function formatDistance(meters: number | null | undefined): string | null {
    if (!meters || meters <= 0) return null;
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
}

// ─────────────────────────────────────────
// HAVERSINE DISTANCE
// Straight-line distance between two coordinates
// in kilometres. Used for client-side proximity
// checks (e.g. should we re-center the map?).
// ─────────────────────────────────────────
export function haversineKm(
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number {
    const R    = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─────────────────────────────────────────
// SLEEP — async delay helper
// ─────────────────────────────────────────
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────
// CLAMP — keep a value within a range
// ─────────────────────────────────────────
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

// ─────────────────────────────────────────
// IS VALID COORDINATE
// ─────────────────────────────────────────
export function isValidCoordinate(lat: number, lng: number): boolean {
    return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 &&
        lng >= -180 && lng <= 180 &&
        !(lat === 0 && lng === 0)
    );
}