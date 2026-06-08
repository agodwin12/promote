export type LatLng = { lat: number; lng: number };

export interface Venue {
    name: string;
    lat: number;
    lng: number;
    geofenceRadius: number;
    defaultZoom: number;
    geofencePolygon: LatLng[];
}

export const PROMOTE_VENUE: Venue = {
    name: "Palais des Congrès – Yaoundé",
    lat: 3.89106,
    lng: 11.50057,
    geofenceRadius: 230,
    defaultZoom: 18,

    // Tight PROMOTE venue geofence: Palais building + immediate internal access zone only
    geofencePolygon: [
        { lat: 3.89295, lng: 11.49945 },
        { lat: 3.89275, lng: 11.50045 },
        { lat: 3.89230, lng: 11.50135 },
        { lat: 3.89155, lng: 11.50195 },
        { lat: 3.89065, lng: 11.50205 },
        { lat: 3.88975, lng: 11.50170 },
        { lat: 3.88920, lng: 11.50090 },
        { lat: 3.88910, lng: 11.49995 },
        { lat: 3.88945, lng: 11.49910 },
        { lat: 3.89020, lng: 11.49855 },
        { lat: 3.89115, lng: 11.49835 },
        { lat: 3.89210, lng: 11.49865 },
        { lat: 3.89295, lng: 11.49945 }, // close polygon
    ],
};

export const LOGPOM_VENUE: Venue = {
    name: "Logpom – Douala",
    lat: 4.0785,
    lng: 9.7620,
    geofenceRadius: 2200,
    defaultZoom: 14,

    // Approximation of the Google Maps Logpom neighborhood boundary
    geofencePolygon: [
        { lat: 4.0935, lng: 9.7490 },
        { lat: 4.0926, lng: 9.7512 },
        { lat: 4.0908, lng: 9.7545 },
        { lat: 4.0918, lng: 9.7588 },
        { lat: 4.0931, lng: 9.7622 },
        { lat: 4.0915, lng: 9.7657 },
        { lat: 4.0885, lng: 9.7690 },
        { lat: 4.0875, lng: 9.7735 },
        { lat: 4.0850, lng: 9.7765 },

        { lat: 4.0790, lng: 9.7765 },
        { lat: 4.0730, lng: 9.7762 },
        { lat: 4.0680, lng: 9.7755 },
        { lat: 4.0674, lng: 9.7700 },
        { lat: 4.0675, lng: 9.7645 },
        { lat: 4.0676, lng: 9.7595 },
        { lat: 4.0676, lng: 9.7548 },

        { lat: 4.0648, lng: 9.7530 },
        { lat: 4.0620, lng: 9.7510 },
        { lat: 4.0593, lng: 9.7485 },
        { lat: 4.0578, lng: 9.7455 },

        { lat: 4.0605, lng: 9.7440 },
        { lat: 4.0645, lng: 9.7432 },
        { lat: 4.0688, lng: 9.7430 },
        { lat: 4.0735, lng: 9.7435 },
        { lat: 4.0785, lng: 9.7442 },
        { lat: 4.0835, lng: 9.7452 },
        { lat: 4.0885, lng: 9.7468 },
        { lat: 4.0935, lng: 9.7490 }, // close polygon
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
//  ACTIVE VENUE — only change this line to switch
// ─────────────────────────────────────────────────────────────────────────────
 export const ACTIVE_VENUE: Venue = PROMOTE_VENUE;  // ← Yaoundé Palais des Congrès
//export const ACTIVE_VENUE: Venue = LOGPOM_VENUE;      // ← Douala Logpom (active)

// ─────────────────────────────────────────────────────────────────────────────
//  RAY-CASTING helper
// ─────────────────────────────────────────────────────────────────────────────
export function isInsideGeofence(point: LatLng, polygon: LatLng[]): boolean {
    const { lat: px, lng: py } = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lat, yi = polygon[i].lng;
        const xj = polygon[j].lat, yj = polygon[j].lng;
        const intersect =
            yi > py !== yj > py &&
            px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}