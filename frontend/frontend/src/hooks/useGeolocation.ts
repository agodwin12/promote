import { useEffect, useRef, useCallback, useState } from 'react';
import { GeolocationState, GeolocationStatus, UserLocation } from '@/lib/types';
import { haversineKm } from '@/lib/utils';

// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────
const GEO_OPTIONS: PositionOptions = {
    enableHighAccuracy: true,   // use GPS chip when available
    timeout:            10000,  // 10s before error
    maximumAge:         5000,   // accept cached position up to 5s old
};

// Only emit a location update if the user has moved
// more than this many metres — prevents jitter from
// GPS noise causing unnecessary re-renders and ETA calls.
const MIN_MOVEMENT_METRES = 20;

// ─────────────────────────────────────────
// HOOK OPTIONS
// ─────────────────────────────────────────
interface UseGeolocationOptions {
    onLocationUpdate?: (location: UserLocation) => void;
    enabled?:          boolean; // allow parent to pause watching
}

// ─────────────────────────────────────────
// useGeolocation
// Watches the user's position using the browser
// Geolocation API. Handles all permission states,
// filters GPS jitter, and exposes a manual
// re-request function for the "retry" button.
// ─────────────────────────────────────────
export function useGeolocation({
                                   onLocationUpdate,
                                   enabled = true,
                               }: UseGeolocationOptions = {}): GeolocationState & {
    requestLocation: () => void;
    isWatching:      boolean;
} {
    const [state, setState] = useState<GeolocationState>({
        status:   'idle',
        location: null,
        error:    null,
    });

    const watchIdRef       = useRef<number | null>(null);
    const lastLocationRef  = useRef<UserLocation | null>(null);
    const onUpdateRef      = useRef(onLocationUpdate);

    // Keep callback ref in sync
    useEffect(() => {
        onUpdateRef.current = onLocationUpdate;
    }, [onLocationUpdate]);

    // ── HANDLE SUCCESS ──────────────────────
    const handleSuccess = useCallback((position: GeolocationPosition) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newLocation: UserLocation = { lat: latitude, lng: longitude, accuracy };

        // Filter out GPS jitter — only update if moved >= MIN_MOVEMENT_METRES
        if (lastLocationRef.current) {
            const movedKm = haversineKm(
                lastLocationRef.current.lat,
                lastLocationRef.current.lng,
                latitude,
                longitude
            );
            const movedMetres = movedKm * 1000;

            if (movedMetres < MIN_MOVEMENT_METRES) {
                return; // ignore tiny jitter
            }
        }

        lastLocationRef.current = newLocation;

        setState({
            status:   'granted',
            location: newLocation,
            error:    null,
        });

        onUpdateRef.current?.(newLocation);
    }, []);

    // ── HANDLE ERROR ────────────────────────
    const handleError = useCallback((error: GeolocationPositionError) => {
        let status: GeolocationStatus = 'error';
        let message: string;

        switch (error.code) {
            case GeolocationPositionError.PERMISSION_DENIED:
                status  = 'denied';
                message = 'Location permission denied. Please enable it in your browser settings.';
                break;
            case GeolocationPositionError.POSITION_UNAVAILABLE:
                status  = 'unavailable';
                message = 'Location unavailable. Please check your device GPS.';
                break;
            case GeolocationPositionError.TIMEOUT:
                status  = 'error';
                message = 'Location request timed out. Retrying...';
                break;
            default:
                message = 'An unknown location error occurred.';
        }

        console.warn(`[Geolocation] Error (${error.code}): ${message}`);

        setState((prev) => ({
            ...prev,
            status,
            error: message,
        }));
    }, []);

    // ── START WATCHING ──────────────────────
    const startWatching = useCallback(() => {
        if (!navigator.geolocation) {
            setState({
                status:   'unavailable',
                location: null,
                error:    'Geolocation is not supported by your browser.',
            });
            return;
        }

        // Clear any existing watcher
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
        }

        setState((prev) => ({
            ...prev,
            status: 'requesting',
            error:  null,
        }));

        watchIdRef.current = navigator.geolocation.watchPosition(
            handleSuccess,
            handleError,
            GEO_OPTIONS
        );

        console.info('[Geolocation] Started watching position');
    }, [handleSuccess, handleError]);

    // ── STOP WATCHING ───────────────────────
    const stopWatching = useCallback(() => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
            console.info('[Geolocation] Stopped watching position');
        }
    }, []);

    // ── REQUEST LOCATION (manual trigger) ───
    // Used by the "retry" or "locate me" button.
    const requestLocation = useCallback(() => {
        lastLocationRef.current = null; // reset jitter filter
        startWatching();
    }, [startWatching]);

    // ── LIFECYCLE ───────────────────────────
    useEffect(() => {
        if (!enabled) {
            stopWatching();
            return;
        }

        startWatching();

        return () => {
            stopWatching();
        };
    }, [enabled, startWatching, stopWatching]);

    return {
        ...state,
        requestLocation,
        isWatching: watchIdRef.current !== null,
    };
}