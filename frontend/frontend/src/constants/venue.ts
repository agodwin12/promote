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
    geofenceRadius: 420,
    defaultZoom: 17,

    // Practical PROMOTE geofence around Palais des Congrès / Mont Nkol-Nyada area
    geofencePolygon: [
        { lat: 3.89405, lng: 11.49910 },
        { lat: 3.89365, lng: 11.50085 },
        { lat: 3.89305, lng: 11.50215 },
        { lat: 3.89215, lng: 11.50310 },
        { lat: 3.89105, lng: 11.50345 },
        { lat: 3.88985, lng: 11.50315 },
        { lat: 3.88880, lng: 11.50235 },
        { lat: 3.88815, lng: 11.50110 },
        { lat: 3.88805, lng: 11.49970 },
        { lat: 3.88855, lng: 11.49845 },
        { lat: 3.88945, lng: 11.49765 },
        { lat: 3.89065, lng: 11.49735 },
        { lat: 3.89190, lng: 11.49755 },
        { lat: 3.89305, lng: 11.49815 },
        { lat: 3.89405, lng: 11.49910 }, // close polygon
    ],
};


export const LOGPOM_VENUE: Venue = {
    name: "Carrefour Logpom – Douala",
    lat: 4.08611,
    lng: 9.76706,
    geofenceRadius: 650,
    defaultZoom: 16,

    // Operational geofence around Carrefour Market Logpom / Marché Logpom area
    geofencePolygon: [
        { lat: 4.09180, lng: 9.76420 },
        { lat: 4.09120, lng: 9.76720 },
        { lat: 4.09010, lng: 9.76980 },
        { lat: 4.08830, lng: 9.77160 },
        { lat: 4.08610, lng: 9.77210 },
        { lat: 4.08380, lng: 9.77150 },
        { lat: 4.08190, lng: 9.76980 },
        { lat: 4.08080, lng: 9.76720 },
        { lat: 4.08070, lng: 9.76440 },
        { lat: 4.08180, lng: 9.76190 },
        { lat: 4.08370, lng: 9.76030 },
        { lat: 4.08600, lng: 9.75980 },
        { lat: 4.08840, lng: 9.76040 },
        { lat: 4.09030, lng: 9.76210 },
        { lat: 4.09180, lng: 9.76420 }, // close polygon
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
//  ACTIVE VENUE — only change this line to switch
// ─────────────────────────────────────────────────────────────────────────────

// export const ACTIVE_VENUE: Venue = PROMOTE_VENUE;  // ← Yaoundé Palais des Congrès
export const ACTIVE_VENUE: Venue = LOGPOM_VENUE;      // ← Douala Logpom (active)

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