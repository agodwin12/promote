// ─────────────────────────────────────────
// COMPANY
// ─────────────────────────────────────────
export interface Company {
    id:         number;
    name:       string;
    slug:       string;
    logo_url:   string | null;
    created_at: string;
}

export interface CompanyWithBuses extends Company {
    buses: Bus[];
}

// ─────────────────────────────────────────
// BUS
// ─────────────────────────────────────────
export interface Bus {
    id:         number;
    company_id: number;
    mac_id:     string;
    plate:      string;
    model:      string | null;
    created_at: string;
}

export interface BusWithLocation extends Bus {
    location: BusLocation | null;
}

// ─────────────────────────────────────────
// LOCATION
// ─────────────────────────────────────────
export interface BusLocation {
    latitude:    number;
    longitude:   number;
    speed:       number;
    direction:   number | null;
    status:      string | null;
    gps_quality: 'VALID' | 'LOW_CONFIDENCE';
    sys_time:    string | null;
}

// ─────────────────────────────────────────
// SOCKET — GPS UPDATE EVENT
// Shape of the payload emitted by the backend
// on every GPS tick via Socket.IO.
// ─────────────────────────────────────────
export interface GPSUpdatePayload {
    vehicleId:        number;
    companyId:        number;
    latitude:         number;
    longitude:        number;
    speed:            number;
    direction:        number | null;
    status:           string | null;
    timestamp:        string;
    gps_quality:      'VALID' | 'LOW_CONFIDENCE';
    mac_id:           string;
    plate?:           string;
    model?:           string | null;
    logoUrl?:         string | null;   // company logo — set by backend if available

    // ETA fields — null when Routes API unavailable or user location not yet sent
    eta:              string | null;   // e.g. "8 min"
    duration_seconds: number | null;
    distance_meters:  number | null;
    distance_text:    string | null;   // e.g. "2.3 km"
}

// ─────────────────────────────────────────
// SOCKET — JOIN COMPANY PAYLOAD
// Sent by the client when opening the tracking page.
// ─────────────────────────────────────────
export interface JoinCompanyPayload {
    companyId: number;
    userLat:   number;
    userLng:   number;
}

// ─────────────────────────────────────────
// USER LOCATION
// ─────────────────────────────────────────
export interface UserLocation {
    lat:       number;
    lng:       number;
    accuracy?: number;  // metres — from Geolocation API
}

// ─────────────────────────────────────────
// MAP STATE
// Tracks what the map is currently showing.
// ─────────────────────────────────────────
export interface MapState {
    center:      google.maps.LatLngLiteral;
    zoom:        number;
    isFollowing: boolean;
}

// ─────────────────────────────────────────
// BUS MARKER STATE
// Live state of a single bus marker on the map.
// Updated on every GPS tick.
// ─────────────────────────────────────────
export interface BusMarkerState {
    busId:            number;
    companyId:        number;
    plate:            string;
    model:            string | null;
    // ✅ Added: company logo URL for the bus marker circle
    // Populated from Company.logo_url via the seed path or GPS payload
    logoUrl:          string | null;
    latitude:         number;
    longitude:        number;
    speed:            number;
    direction:        number | null;
    eta:              string | null;
    duration_seconds: number | null;
    distance_meters:  number | null;
    distance_text:    string | null;
    lastUpdated:      number;
}

// ─────────────────────────────────────────
// API RESPONSE WRAPPER
// ─────────────────────────────────────────
export interface ApiResponse<T> {
    success: boolean;
    data:    T;
    error?:  string;
}

// ─────────────────────────────────────────
// GEOLOCATION STATE
// ─────────────────────────────────────────
export type GeolocationStatus =
    | 'idle'
    | 'requesting'
    | 'granted'
    | 'denied'
    | 'unavailable'
    | 'error';

export interface GeolocationState {
    status:   GeolocationStatus;
    location: UserLocation | null;
    error:    string | null;
}

// ─────────────────────────────────────────
// SOCKET CONNECTION STATE
// ─────────────────────────────────────────
export type SocketStatus =
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'error';