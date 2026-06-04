'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader }                                    from '@googlemaps/js-api-loader';
import { BusMarkerState }                            from '@/lib/types';
import { ACTIVE_VENUE }                              from '@/constants/venue';

export type MapType = 'roadmap' | 'satellite' | 'hybrid' | 'terrain';

interface MapViewProps {
    busMarkers:         BusMarkerState[];
    apiKey?:            string;
    focusCompanyId?:    number;
    userLocation?:      unknown;
    geoStatus?:         unknown;
    onRequestLocation?: unknown;
    isConnected?:       unknown;
    companies?:         unknown;
}

interface LiveMarker {
    markerEl:    HTMLDivElement;
    overlay:     MoveableOverlay;
    pillEl:      HTMLDivElement | null;
    pillOver:    MoveableOverlay | null;
    arrowEl:     HTMLDivElement | null;
    arrowOver:   MoveableOverlay | null;
    animPos:     google.maps.LatLng;
    target:      google.maps.LatLng;
    bearing:     number | null;
    prevLatLng:  { lat: number; lng: number } | null;
}

interface MoveableOverlay extends google.maps.OverlayView {
    moveTo(pos: google.maps.LatLng): void;
}

const DEFAULT_ZOOM    = ACTIVE_VENUE.defaultZoom;
const ANIM_DURATION   = 1800;
const MIN_MOVE_METRES = 10;

const MAP_TYPES: Array<{ id: MapType; label: string; emoji: string }> = [
    { id: 'roadmap',   label: 'Map',       emoji: '🗺️' },
    { id: 'satellite', label: 'Satellite', emoji: '🛰️' },
    { id: 'hybrid',    label: 'Hybrid',    emoji: '🌍' },
    { id: 'terrain',   label: 'Terrain',   emoji: '⛰️' },
];

const MAP_STYLES: google.maps.MapTypeStyle[] = [
    { featureType: 'poi',                         elementType: 'all',             stylers: [{ visibility: 'off' }] },
    { featureType: 'transit',                     elementType: 'all',             stylers: [{ visibility: 'off' }] },
    { featureType: 'road',                        elementType: 'geometry',        stylers: [{ color: '#ffffff'  }] },
    { featureType: 'road.arterial',               elementType: 'geometry',        stylers: [{ color: '#f5f5f5'  }] },
    { featureType: 'road.highway',                elementType: 'geometry',        stylers: [{ color: '#e9e9e9'  }] },
    { featureType: 'road.highway',                elementType: 'geometry.stroke', stylers: [{ color: '#d6d6d6'  }] },
    { featureType: 'landscape',                   elementType: 'geometry',        stylers: [{ color: '#f5f5f5'  }] },
    { featureType: 'water',                       elementType: 'geometry',        stylers: [{ color: '#c9e8f7'  }] },
    { featureType: 'administrative',              elementType: 'labels.text.fill',stylers: [{ color: '#9aa0a6'  }] },
    { featureType: 'road',                        elementType: 'labels.text.fill',stylers: [{ color: '#757575'  }] },
    { featureType: 'landscape.natural.landcover', elementType: 'all',             stylers: [{ visibility: 'on'  }, { color: '#e8f5e9' }] },
];

// ─── Bearing & direction math ─────────────────────────────────────────────────

function calcBearing(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLng  = toRad(toLng - fromLng);
    const fLat  = toRad(fromLat);
    const tLat  = toRad(toLat);
    const y     = Math.sin(dLng) * Math.cos(tLat);
    const x     = Math.cos(fLat) * Math.sin(tLat) - Math.sin(fLat) * Math.cos(tLat) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function angleDiff(a: number, b: number): number {
    let d = ((b - a) % 360 + 360) % 360;
    if (d > 180) d -= 360;
    return d;
}

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R   = 6_371_000;
    const toR = (d: number) => (d * Math.PI) / 180;
    const dLat = toR(lat2 - lat1);
    const dLng = toR(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── OverlayView factory ──────────────────────────────────────────────────────

function makeMoveableOverlay(
    map:  google.maps.Map,
    el:   HTMLElement,
    pos:  google.maps.LatLng,
    pane: keyof google.maps.MapPanes = 'floatPane',
): MoveableOverlay {
    class MovingOverlay extends google.maps.OverlayView implements MoveableOverlay {
        private _pos: google.maps.LatLng;
        constructor(p: google.maps.LatLng) { super(); this._pos = p; }
        onAdd()    { this.getPanes()![pane].appendChild(el); }
        draw() {
            const pt = this.getProjection()?.fromLatLngToDivPixel(this._pos);
            if (pt) { el.style.left = `${pt.x}px`; el.style.top = `${pt.y}px`; }
        }
        onRemove() { el.parentNode?.removeChild(el); }
        moveTo(newPos: google.maps.LatLng) { this._pos = newPos; this.draw(); }
    }
    const ov = new MovingOverlay(pos);
    ov.setMap(map);
    return ov;
}

// ─── Arrow element ────────────────────────────────────────────────────────────
//
// A compass-needle style indicator floating above the bus marker.
// The chevron points in the direction of travel.
// Green  = bus is approaching the user.
// Amber  = bus is moving away.
// Grey   = user location unknown, direction shown but state unknown.
// Hidden = not enough movement yet to determine heading.

function createArrowEl(): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
        position: absolute;
        width: 28px;
        height: 28px;
        transform: translate(-50%, calc(-50% - 30px)) rotate(0deg);
        pointer-events: none;
        z-index: 150;
        opacity: 0;
        will-change: transform, opacity;
    `;

    const ns  = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width',   '28');
    svg.setAttribute('height',  '28');
    svg.setAttribute('viewBox', '0 0 28 28');
    svg.style.cssText = 'display:block;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35));';

    // Animated glow ring
    const glow = document.createElementNS(ns, 'circle');
    glow.setAttribute('cx', '14'); glow.setAttribute('cy', '14'); glow.setAttribute('r', '13');
    glow.setAttribute('fill', 'rgba(52,168,83,0.18)');
    glow.setAttribute('class', 'arrow-glow');

    // White backing disc
    const disc = document.createElementNS(ns, 'circle');
    disc.setAttribute('cx', '14'); disc.setAttribute('cy', '14'); disc.setAttribute('r', '11');
    disc.setAttribute('fill', '#ffffff');

    // Chevron arrow pointing up (North = 0°). CSS rotation steers it.
    // Tip at (14,5), wings at (8,19) and (20,19), notch at (14,15).
    const arrow = document.createElementNS(ns, 'path');
    arrow.setAttribute('d', 'M14 5 L20 19 L14 15 L8 19 Z');
    arrow.setAttribute('fill', '#34A853');
    arrow.setAttribute('class', 'arrow-head');

    svg.appendChild(glow);
    svg.appendChild(disc);
    svg.appendChild(arrow);
    wrap.appendChild(svg);

    // Inject keyframes once
    if (!document.getElementById('wego-arrow-styles')) {
        const style       = document.createElement('style');
        style.id          = 'wego-arrow-styles';
        style.textContent = `
            @keyframes arrowPulse {
                0%   { opacity: 0.18; }
                50%  { opacity: 0.06; }
                100% { opacity: 0.18; }
            }
            .arrow-glow { animation: arrowPulse 2s ease-in-out infinite; }
        `;
        document.head.appendChild(style);
    }

    return wrap;
}

function updateArrowEl(
    el:          HTMLDivElement,
    bearingDeg:  number,
    approaching: boolean | null,
    animated:    boolean,
): void {
    const headEl = el.querySelector<SVGPathElement>('.arrow-head');
    const glowEl = el.querySelector<SVGCircleElement>('.arrow-glow');

    const color = approaching === null ? '#9AA0A6' : approaching ? '#34A853' : '#F9A825';
    const rgb   = approaching === null ? '154,160,166' : approaching ? '52,168,83' : '249,168,37';

    if (headEl) headEl.setAttribute('fill', color);
    if (glowEl) glowEl.setAttribute('fill', `rgba(${rgb},0.18)`);

    // CSS transition handles smooth rotation — no RAF needed.
    // On first appearance, skip transition so the arrow doesn't wind up from 0°.
    el.style.transition = animated
        ? `opacity 0.4s ease, transform ${Math.round(ANIM_DURATION * 0.9)}ms cubic-bezier(0.25,0.46,0.45,0.94)`
        : 'opacity 0.4s ease';

    el.style.transform = `translate(-50%, calc(-50% - 30px)) rotate(${bearingDeg}deg)`;
    el.style.opacity   = '1';
}

// ─── Bus marker DOM ───────────────────────────────────────────────────────────

function createBusEl(logoUrl?: string | null): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
        position:absolute; width:48px; height:48px;
        transform:translate(-50%,-50%); cursor:pointer; z-index:100;
    `;
    const ring = document.createElement('div');
    ring.style.cssText = `
        width:48px; height:48px; border-radius:50%;
        background:#ffffff; border:3px solid #34A853;
        box-shadow:0 4px 14px rgba(0,0,0,0.22);
        display:flex; align-items:center; justify-content:center;
        overflow:hidden; transition:border-color 0.2s;
    `;
    if (logoUrl) {
        const img         = document.createElement('img');
        img.src           = logoUrl;
        img.style.cssText = 'width:34px;height:34px;object-fit:contain;border-radius:50%;';
        img.onerror       = () => img.replaceWith(busSVG());
        ring.appendChild(img);
    } else {
        ring.appendChild(busSVG());
    }
    wrap.appendChild(ring);
    return wrap;
}

function busSVG(): SVGElement {
    const ns  = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width','26'); svg.setAttribute('height','26');
    svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('fill','none');

    const body = document.createElementNS(ns, 'rect');
    body.setAttribute('x','2'); body.setAttribute('y','4'); body.setAttribute('width','20');
    body.setAttribute('height','14'); body.setAttribute('rx','3'); body.setAttribute('fill','#34A853');

    const ws = document.createElementNS(ns, 'rect');
    ws.setAttribute('x','4'); ws.setAttribute('y','6'); ws.setAttribute('width','16');
    ws.setAttribute('height','5'); ws.setAttribute('rx','2'); ws.setAttribute('fill','#B6E9C4');

    const wL = document.createElementNS(ns, 'circle');
    wL.setAttribute('cx','6.5'); wL.setAttribute('cy','19'); wL.setAttribute('r','2.2'); wL.setAttribute('fill','#1a1a1a');

    const wR = document.createElementNS(ns, 'circle');
    wR.setAttribute('cx','17.5'); wR.setAttribute('cy','19'); wR.setAttribute('r','2.2'); wR.setAttribute('fill','#1a1a1a');

    const hL = document.createElementNS(ns, 'circle');
    hL.setAttribute('cx','6.5'); hL.setAttribute('cy','19'); hL.setAttribute('r','0.9'); hL.setAttribute('fill','#888');

    const hR = document.createElementNS(ns, 'circle');
    hR.setAttribute('cx','17.5'); hR.setAttribute('cy','19'); hR.setAttribute('r','0.9'); hR.setAttribute('fill','#888');

    const door = document.createElementNS(ns, 'rect');
    door.setAttribute('x','10'); door.setAttribute('y','12'); door.setAttribute('width','4');
    door.setAttribute('height','5'); door.setAttribute('rx','1'); door.setAttribute('fill','#B6E9C4');

    [body, ws, door, wL, wR, hL, hR].forEach(n => svg.appendChild(n));
    return svg;
}

// ─── Pill DOM ─────────────────────────────────────────────────────────────────

function createPillEl(eta: string | null, distText: string, approaching: boolean | null): HTMLDivElement {
    const pill = document.createElement('div');
    pill.style.cssText = `
        position:absolute;
        transform:translate(-50%, calc(-100% - 58px));
        background:#FF6B00; color:#fff;
        font-size:11px; font-weight:700;
        font-family:Google Sans,sans-serif; letter-spacing:0.3px;
        padding:4px 10px; border-radius:100px;
        box-shadow:0 2px 10px rgba(0,0,0,0.28);
        white-space:nowrap; pointer-events:none;
        display:flex; align-items:center; gap:4px; z-index:200;
    `;
    updatePillContent(pill, eta, distText, approaching);
    return pill;
}

function dot(): HTMLSpanElement {
    const d         = document.createElement('span');
    d.style.cssText = 'width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,0.55);display:inline-block;flex-shrink:0;';
    return d;
}

function updatePillContent(
    pill:        HTMLDivElement,
    eta:         string | null,
    distText:    string,
    approaching: boolean | null,
): void {
    pill.innerHTML = '';

    // Direction badge — only after bearing is established
    if (approaching !== null) {
        const ns    = 'http://www.w3.org/2000/svg';
        const badge = document.createElement('span');
        badge.style.cssText = 'display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:800;letter-spacing:0.4px;text-transform:uppercase;';

        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width','8'); svg.setAttribute('height','8'); svg.setAttribute('viewBox','0 0 8 8'); svg.setAttribute('fill','none');
        const path = document.createElementNS(ns, 'path');

        if (approaching) {
            path.setAttribute('d', 'M4 7 L7 1 L4 3.5 L1 1 Z');
            path.setAttribute('fill', '#AFFFCA');
            svg.appendChild(path); badge.appendChild(svg);
            const lbl = document.createElement('span');
            lbl.style.color = '#AFFFCA'; lbl.textContent = 'Approaching';
            badge.appendChild(lbl);
        } else {
            path.setAttribute('d', 'M4 1 L7 7 L4 4.5 L1 7 Z');
            path.setAttribute('fill', '#FFE082');
            svg.appendChild(path); badge.appendChild(svg);
            const lbl = document.createElement('span');
            lbl.style.color = '#FFE082'; lbl.textContent = 'Moving away';
            badge.appendChild(lbl);
        }
        pill.appendChild(badge);
    }

    if (approaching !== null && (eta || distText)) pill.appendChild(dot());

    if (eta) {
        const ns  = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width','10'); svg.setAttribute('height','10'); svg.setAttribute('viewBox','0 0 24 24');
        svg.setAttribute('fill','none'); svg.setAttribute('stroke','rgba(255,255,255,0.85)');
        svg.setAttribute('stroke-width','2.5'); svg.setAttribute('stroke-linecap','round'); svg.setAttribute('stroke-linejoin','round');
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx','12'); c.setAttribute('cy','12'); c.setAttribute('r','10');
        const p = document.createElementNS(ns, 'polyline');
        p.setAttribute('points','12 6 12 12 16 14');
        svg.appendChild(c); svg.appendChild(p);
        pill.appendChild(svg);
        const t = document.createElement('span');
        t.textContent = eta;
        pill.appendChild(t);
    }

    if (eta && distText) pill.appendChild(dot());

    if (distText) {
        const d = document.createElement('span');
        d.style.cssText = 'color:rgba(255,255,255,0.9);';
        d.textContent   = distText;
        pill.appendChild(d);
    }
}

// ─── User marker DOM ──────────────────────────────────────────────────────────

function createUserEl(): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;transform:translate(-50%,-50%);width:80px;height:80px;pointer-events:none;';

    const ring = document.createElement('div');
    ring.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:56px;height:56px;border-radius:50%;background:rgba(26,115,232,0.12);border:1.5px solid rgba(26,115,232,0.25);';

    const pulse = document.createElement('div');
    pulse.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:56px;height:56px;border-radius:50%;background:rgba(26,115,232,0.15);animation:userPulse 2s ease-out infinite;';

    const dot2 = document.createElement('div');
    dot2.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;z-index:2;';
    const inner = document.createElement('div');
    inner.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#1A73E8;';
    dot2.appendChild(inner);

    const humanWrap = document.createElement('div');
    humanWrap.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-95%);z-index:4;filter:drop-shadow(0 2px 5px rgba(0,0,0,0.3));';
    const ns  = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width','32'); svg.setAttribute('height','40'); svg.setAttribute('viewBox','0 0 32 40');

    const shadow = document.createElementNS(ns, 'ellipse');
    shadow.setAttribute('cx','16'); shadow.setAttribute('cy','38'); shadow.setAttribute('rx','8'); shadow.setAttribute('ry','2'); shadow.setAttribute('fill','rgba(0,0,0,0.18)');
    const head = document.createElementNS(ns, 'circle');
    head.setAttribute('cx','16'); head.setAttribute('cy','7'); head.setAttribute('r','5'); head.setAttribute('fill','#1A73E8');
    const bodyP = document.createElementNS(ns, 'path');
    bodyP.setAttribute('d','M10 14 Q16 12 22 14 L21 26 H11 Z'); bodyP.setAttribute('fill','#1A73E8');
    const aL = document.createElementNS(ns, 'path');
    aL.setAttribute('d','M10 15 L6 23'); aL.setAttribute('stroke','#1A73E8'); aL.setAttribute('stroke-width','3'); aL.setAttribute('stroke-linecap','round'); aL.setAttribute('fill','none');
    const aR = document.createElementNS(ns, 'path');
    aR.setAttribute('d','M22 15 L26 23'); aR.setAttribute('stroke','#1A73E8'); aR.setAttribute('stroke-width','3'); aR.setAttribute('stroke-linecap','round'); aR.setAttribute('fill','none');
    const lL = document.createElementNS(ns, 'path');
    lL.setAttribute('d','M13 26 L10 36'); lL.setAttribute('stroke','#1565C0'); lL.setAttribute('stroke-width','3.5'); lL.setAttribute('stroke-linecap','round'); lL.setAttribute('fill','none');
    const lR = document.createElementNS(ns, 'path');
    lR.setAttribute('d','M19 26 L22 36'); lR.setAttribute('stroke','#1565C0'); lR.setAttribute('stroke-width','3.5'); lR.setAttribute('stroke-linecap','round'); lR.setAttribute('fill','none');
    const hl = document.createElementNS(ns, 'circle');
    hl.setAttribute('cx','14'); hl.setAttribute('cy','5.5'); hl.setAttribute('r','1.5'); hl.setAttribute('fill','rgba(255,255,255,0.35)');

    [shadow, bodyP, aL, aR, lL, lR, head, hl].forEach(n => svg.appendChild(n));
    humanWrap.appendChild(svg);

    const labelWrap = document.createElement('div');
    labelWrap.style.cssText = 'position:absolute;bottom:calc(100% + 46px);left:50%;transform:translateX(-50%);z-index:5;pointer-events:none;';
    const label = document.createElement('div');
    label.style.cssText = 'background:#fff;border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;color:#1A1A1A;box-shadow:0 2px 10px rgba(0,0,0,0.18);font-family:Google Sans,sans-serif;letter-spacing:0.01em;border:1px solid rgba(0,0,0,0.06);white-space:nowrap;';
    label.textContent = 'Your Location';
    const tri = document.createElement('div');
    tri.style.cssText = 'width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid #fff;margin:0 auto;';
    labelWrap.appendChild(label); labelWrap.appendChild(tri);

    wrap.appendChild(ring); wrap.appendChild(pulse); wrap.appendChild(dot2);
    wrap.appendChild(humanWrap); wrap.appendChild(labelWrap);
    return wrap;
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function easeOutCubic(t: number)               { return 1 - Math.pow(1 - t, 3); }

function getDistText(bus: BusMarkerState): string {
    if (bus.distance_text) return bus.distance_text;
    if (bus.distance_meters != null) {
        return bus.distance_meters >= 1000
            ? `${(bus.distance_meters / 1000).toFixed(1)} km`
            : `${Math.round(bus.distance_meters)} m`;
    }
    return '';
}

function getMarkerId(bus: BusMarkerState): number  { return bus.busId; }
function getLogoUrl(bus: BusMarkerState): string | null {
    return (bus as BusMarkerState & { logoUrl?: string | null }).logoUrl ?? null;
}
function parseCoord(v: unknown): number {
    return typeof v === 'string' ? parseFloat(v as string) : (v as number);
}

function isInsideVenue(lat: number, lng: number): boolean {
    const poly = ACTIVE_VENUE.geofencePolygon;
    if (poly && poly.length >= 3) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].lat, yi = poly[i].lng;
            const xj = poly[j].lat, yj = poly[j].lng;
            const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
            if (intersect) inside = !inside;
        }
        return inside;
    }
    const R    = 6_371_000;
    const dLat = ((lat - ACTIVE_VENUE.lat) * Math.PI) / 180;
    const dLng = ((lng - ACTIVE_VENUE.lng) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((ACTIVE_VENUE.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= ACTIVE_VENUE.geofenceRadius;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MapView({ busMarkers, apiKey, focusCompanyId }: MapViewProps) {
    const resolvedKey = apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

    const mapDivRef       = useRef<HTMLDivElement>(null);
    const mapRef          = useRef<google.maps.Map | null>(null);
    const liveMarkersRef  = useRef<Map<number, LiveMarker>>(new Map());
    const userOverlayRef  = useRef<MoveableOverlay | null>(null);
    const userElRef       = useRef<HTMLDivElement | null>(null);
    const userPosRef      = useRef<{ lat: number; lng: number } | null>(null);
    const isInitRef       = useRef(false);
    const hasFocusedRef   = useRef(false);
    const animRafsRef     = useRef<Map<number, number>>(new Map());
    const geofenceLineRef = useRef<google.maps.Polyline | null>(null);

    const [mapType,     setMapType]     = useState<MapType>('hybrid');
    const [mapTypeOpen, setMapTypeOpen] = useState(false);
    const [isLocating,  setIsLocating]  = useState(false);
    const [locationErr, setLocationErr] = useState<string | null>(null);

    // ── Init map ──────────────────────────────────────────────────────────────

    useEffect(() => {
        if (isInitRef.current || !mapDivRef.current) return;
        isInitRef.current = true;

        if (!resolvedKey) {
            console.error('[MapView] No Google Maps API key');
            return;
        }

        const loader = new Loader({ apiKey: resolvedKey, version: 'weekly', libraries: ['geometry'] });

        loader.load().then(() => {
            const map = new google.maps.Map(mapDivRef.current!, {
                center:           { lat: ACTIVE_VENUE.lat, lng: ACTIVE_VENUE.lng },
                zoom:             ACTIVE_VENUE.defaultZoom,
                mapTypeId:        'hybrid',
                disableDefaultUI: true,
                gestureHandling:  'greedy',
                clickableIcons:   false,
                styles:           MAP_STYLES,
            });
            mapRef.current = map;

            geofenceLineRef.current = new google.maps.Polyline({
                path:          ACTIVE_VENUE.geofencePolygon.map(p => ({ lat: p.lat, lng: p.lng })),
                geodesic:      true,
                strokeOpacity: 0,
                icons: [{
                    icon: {
                        path: 'M -1,-1  L 1,-1  L 1,1  L -1,1  Z',
                        fillColor: '#F4756B', fillOpacity: 1,
                        strokeColor: '#F4756B', strokeWeight: 0, scale: 2,
                    },
                    offset: '0', repeat: '8px',
                }],
                map,
            });

            if (!('geolocation' in navigator)) {
                setLocationErr('Geolocation is not supported by your browser');
                return;
            }

            navigator.geolocation.watchPosition(
                ({ coords: { latitude: lat, longitude: lng } }) => {
                    userPosRef.current = { lat, lng };
                    setLocationErr(null);
                    const inside = isInsideVenue(lat, lng);
                    if (inside) {
                        const pos = new google.maps.LatLng(lat, lng);
                        if (!userElRef.current) {
                            userElRef.current      = createUserEl();
                            userOverlayRef.current = makeMoveableOverlay(map, userElRef.current, pos, 'overlayMouseTarget');
                        } else {
                            userOverlayRef.current?.moveTo(pos);
                        }
                    } else {
                        if (userOverlayRef.current) {
                            userOverlayRef.current.setMap(null);
                            userOverlayRef.current = null;
                            userElRef.current      = null;
                        }
                    }
                },
                (err) => {
                    console.warn('[MapView] Geolocation error:', err.message);
                    setLocationErr('Allow location access and refresh to see your position');
                },
                { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
            );
        }).catch(e => console.error('[MapView] Failed to load Google Maps:', e));

        return () => {
            animRafsRef.current.forEach(id => cancelAnimationFrame(id));
            geofenceLineRef.current?.setMap(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Sync bus markers ──────────────────────────────────────────────────────

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const seen = new Set<number>();

        for (const bus of busMarkers) {
            const key = getMarkerId(bus);
            const lat = parseCoord(bus.latitude);
            const lng = parseCoord(bus.longitude);
            if (isNaN(lat) || isNaN(lng)) continue;

            const target   = new google.maps.LatLng(lat, lng);
            const eta      = bus.eta ?? null;
            const distText = getDistText(bus);
            seen.add(key);

            const existing = liveMarkersRef.current.get(key);

            if (!existing) {
                // First appearance — create all elements, arrow is invisible until bearing known
                const markerEl = createBusEl(getLogoUrl(bus));
                const overlay  = makeMoveableOverlay(map, markerEl, target, 'floatPane');
                const arrowEl  = createArrowEl();
                const arrowOv  = makeMoveableOverlay(map, arrowEl, target, 'floatPane');

                let pillEl:   HTMLDivElement | null = null;
                let pillOver: MoveableOverlay | null = null;
                if (eta || distText) {
                    pillEl   = createPillEl(eta, distText, null);
                    pillOver = makeMoveableOverlay(map, pillEl, target, 'floatPane');
                }

                liveMarkersRef.current.set(key, {
                    markerEl, overlay,
                    pillEl, pillOver,
                    arrowEl, arrowOver: arrowOv,
                    animPos: target, target,
                    bearing: null,
                    prevLatLng: { lat, lng },
                });

            } else {
                // ── Bearing + approaching calculation ─────────────────────────
                const prev = existing.prevLatLng;
                let newBearing   = existing.bearing;
                let approaching: boolean | null = null;

                if (prev) {
                    const moved = haversineMetres(prev.lat, prev.lng, lat, lng);

                    if (moved >= MIN_MOVE_METRES) {
                        // Real movement — recalculate bearing
                        newBearing = calcBearing(prev.lat, prev.lng, lat, lng);
                        existing.prevLatLng = { lat, lng };

                        const userPos = userPosRef.current;
                        if (userPos) {
                            const toUser = calcBearing(lat, lng, userPos.lat, userPos.lng);
                            approaching  = Math.abs(angleDiff(newBearing, toUser)) < 90;
                        }

                        // Arrow: smooth CSS rotation transition
                        if (existing.arrowEl) {
                            updateArrowEl(existing.arrowEl, newBearing, approaching, true);
                        }
                        existing.bearing = newBearing;
                    } else {
                        // Stationary — keep last bearing, recheck approaching with fresh user pos
                        if (existing.bearing !== null && userPosRef.current) {
                            const toUser = calcBearing(lat, lng, userPosRef.current.lat, userPosRef.current.lng);
                            approaching  = Math.abs(angleDiff(existing.bearing, toUser)) < 90;
                        }
                    }
                }

                // Always refresh pill text + direction badge
                if (existing.pillEl) {
                    updatePillContent(existing.pillEl, eta, distText, approaching);
                }

                // ── Animate position with RAF ─────────────────────────────────
                const from   = existing.animPos;
                const oldRaf = animRafsRef.current.get(key);
                if (oldRaf) cancelAnimationFrame(oldRaf);
                existing.target = target;

                const startTime = performance.now();
                const animate = (now: number) => {
                    const t    = Math.min((now - startTime) / ANIM_DURATION, 1);
                    const ease = easeOutCubic(t);
                    const pos  = new google.maps.LatLng(
                        lerp(from.lat(), target.lat(), ease),
                        lerp(from.lng(), target.lng(), ease),
                    );
                    existing.animPos = pos;
                    existing.overlay.moveTo(pos);
                    existing.pillOver?.moveTo(pos);
                    existing.arrowOver?.moveTo(pos);  // arrow tracks the bus in sync

                    if (t < 1) animRafsRef.current.set(key, requestAnimationFrame(animate));
                    else       animRafsRef.current.delete(key);
                };
                animRafsRef.current.set(key, requestAnimationFrame(animate));

                // Pill lifecycle
                if (eta || distText) {
                    if (!existing.pillEl) {
                        existing.pillEl   = createPillEl(eta, distText, approaching);
                        existing.pillOver = makeMoveableOverlay(map, existing.pillEl, existing.animPos, 'floatPane');
                    }
                } else if (existing.pillEl && existing.pillOver) {
                    existing.pillOver.setMap(null);
                    existing.pillEl   = null;
                    existing.pillOver = null;
                }
            }
        }

        // Remove departed buses
        for (const [key, lm] of liveMarkersRef.current) {
            if (!seen.has(key)) {
                lm.overlay.setMap(null);
                lm.pillOver?.setMap(null);
                lm.arrowOver?.setMap(null);
                const raf = animRafsRef.current.get(key);
                if (raf) { cancelAnimationFrame(raf); animRafsRef.current.delete(key); }
                liveMarkersRef.current.delete(key);
            }
        }

        // Initial pan to company
        if (focusCompanyId && busMarkers.length > 0 && !hasFocusedRef.current) {
            const first = busMarkers.find(b => b.companyId === focusCompanyId);
            if (first) {
                const lat = parseCoord(first.latitude);
                const lng = parseCoord(first.longitude);
                if (!isNaN(lat) && !isNaN(lng)) {
                    mapRef.current?.panTo({ lat, lng });
                    mapRef.current?.setZoom(DEFAULT_ZOOM);
                    hasFocusedRef.current = true;
                }
            }
        }
    }, [busMarkers, focusCompanyId]);

    useEffect(() => { mapRef.current?.setMapTypeId(mapType); }, [mapType]);

    const handleRecenter = useCallback(() => {
        const map = mapRef.current;
        const pos = userPosRef.current;
        if (!map) return;
        setIsLocating(true);
        if (pos && isInsideVenue(pos.lat, pos.lng)) {
            map.panTo(pos); map.setZoom(ACTIVE_VENUE.defaultZoom);
        } else {
            map.panTo({ lat: ACTIVE_VENUE.lat, lng: ACTIVE_VENUE.lng });
            map.setZoom(ACTIVE_VENUE.defaultZoom);
        }
        setIsLocating(false);
    }, []);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />

            {/* Map type picker */}
            <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 20 }}>
                <button
                    onClick={() => setMapTypeOpen(o => !o)}
                    style={{
                        display:'flex',alignItems:'center',gap:6,
                        background:'#fff',border:'none',borderRadius:12,
                        padding:'8px 12px',boxShadow:'0 2px 10px rgba(0,0,0,0.18)',
                        cursor:'pointer',fontSize:13,fontWeight:600,
                        fontFamily:'Google Sans,sans-serif',color:'#202124',
                    }}
                >
                    {MAP_TYPES.find(t => t.id === mapType)?.emoji}
                    <span>{MAP_TYPES.find(t => t.id === mapType)?.label}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#5f6368"
                         style={{ transform: mapTypeOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>
                        <path d="M7 10l5 5 5-5z"/>
                    </svg>
                </button>

                {mapTypeOpen && (
                    <div style={{
                        position:'absolute',top:'calc(100% + 6px)',right:0,
                        background:'#fff',borderRadius:12,overflow:'hidden',
                        boxShadow:'0 4px 20px rgba(0,0,0,0.18)',minWidth:140,
                    }}>
                        {MAP_TYPES.map(({ id, label, emoji }) => (
                            <button key={id}
                                    onClick={() => { setMapType(id); setMapTypeOpen(false); }}
                                    style={{
                                        display:'flex',alignItems:'center',gap:10,
                                        width:'100%',padding:'10px 16px',border:'none',
                                        background: mapType === id ? '#FFF3E8' : '#fff',
                                        cursor:'pointer',fontSize:13,
                                        fontWeight: mapType === id ? 700 : 400,
                                        fontFamily:'Google Sans,sans-serif',
                                        color: mapType === id ? '#FF6B00' : '#202124',
                                        textAlign:'left',
                                    }}
                            >
                                <span style={{ fontSize:16 }}>{emoji}</span>
                                {label}
                                {mapType === id && (
                                    <svg style={{ marginLeft:'auto' }} width="14" height="14" viewBox="0 0 24 24" fill="#FF6B00">
                                        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Recenter */}
            <button onClick={handleRecenter} aria-label="Re-center map"
                    style={{
                        position:'absolute',bottom:200,right:16,
                        width:44,height:44,borderRadius:'50%',
                        background:'#fff',border:'none',
                        boxShadow:'0 2px 10px rgba(0,0,0,0.18)',
                        cursor:'pointer',display:'flex',
                        alignItems:'center',justifyContent:'center',zIndex:20,
                    }}
            >
                {isLocating
                    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="#4285F4" style={{ animation:'mapSpin 1s linear infinite' }}>
                        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                    </svg>
                    : <svg width="20" height="20" viewBox="0 0 24 24" fill="#4285F4">
                        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                    </svg>
                }
            </button>

            {locationErr && (
                <div style={{
                    position:'absolute',bottom:260,left:'50%',transform:'translateX(-50%)',
                    background:'#323232',color:'#fff',fontSize:13,fontWeight:500,
                    fontFamily:'Google Sans,sans-serif',padding:'10px 20px',borderRadius:8,
                    boxShadow:'0 4px 12px rgba(0,0,0,0.28)',zIndex:30,whiteSpace:'nowrap',
                }}>
                    📍 {locationErr}
                </div>
            )}

            {mapTypeOpen && <div onClick={() => setMapTypeOpen(false)} style={{ position:'fixed',inset:0,zIndex:15 }} />}

            <style>{`
                @keyframes mapSpin {
                    from { transform: rotate(0deg); }
                    to   { transform: rotate(360deg); }
                }
                @keyframes userPulse {
                    0%   { transform: translate(-50%,-50%) scale(1);   opacity: 0.6; }
                    70%  { transform: translate(-50%,-50%) scale(1.8); opacity: 0;   }
                    100% { transform: translate(-50%,-50%) scale(1.8); opacity: 0;   }
                }
            `}</style>
        </div>
    );
}