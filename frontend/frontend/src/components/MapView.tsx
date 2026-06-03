'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader }                                    from '@googlemaps/js-api-loader';
import { BusMarkerState }                            from '@/lib/types';
import { ACTIVE_VENUE }                              from '@/constants/venue';   // ← single source of truth

export type MapType = 'roadmap' | 'satellite' | 'hybrid' | 'terrain';

interface MapViewProps {
    busMarkers:         BusMarkerState[];
    apiKey?:            string;
    focusCompanyId?:    number;
    // Legacy props — accepted and silently ignored
    userLocation?:      unknown;
    geoStatus?:         unknown;
    onRequestLocation?: unknown;
    isConnected?:       unknown;
    companies?:         unknown;
}

interface LiveMarker {
    markerEl:  HTMLDivElement;
    overlay:   MoveableOverlay;
    pillEl:    HTMLDivElement | null;
    pillOver:  MoveableOverlay | null;
    animPos:   google.maps.LatLng;
    target:    google.maps.LatLng;
}

interface MoveableOverlay extends google.maps.OverlayView {
    moveTo(pos: google.maps.LatLng): void;
}

// ── Driven entirely by ACTIVE_VENUE — swap the export in venue.ts to switch ──
const DEFAULT_ZOOM  = ACTIVE_VENUE.defaultZoom;
const ANIM_DURATION = 1800;

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

// ─── Typed OverlayView factory ────────────────────────────────────────────────

function makeMoveableOverlay(
    map:  google.maps.Map,
    el:   HTMLElement,
    pos:  google.maps.LatLng,
    pane: keyof google.maps.MapPanes = 'floatPane',
): MoveableOverlay {
    class MovingOverlay extends google.maps.OverlayView implements MoveableOverlay {
        private _pos: google.maps.LatLng;

        constructor(p: google.maps.LatLng) {
            super();
            this._pos = p;
        }

        onAdd() {
            this.getPanes()![pane].appendChild(el);
        }

        draw() {
            const pt = this.getProjection()?.fromLatLngToDivPixel(this._pos);
            if (pt) {
                el.style.left = `${pt.x}px`;
                el.style.top  = `${pt.y}px`;
            }
        }

        onRemove() {
            el.parentNode?.removeChild(el);
        }

        moveTo(newPos: google.maps.LatLng) {
            this._pos = newPos;
            this.draw();
        }
    }

    const ov = new MovingOverlay(pos);
    ov.setMap(map);
    return ov;
}

// ─── Bus marker DOM ───────────────────────────────────────────────────────────

function createBusEl(logoUrl?: string | null): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
        position:absolute;
        width:48px; height:48px;
        transform:translate(-50%,-50%);
        cursor:pointer;
        z-index:100;
    `;

    const ring = document.createElement('div');
    ring.style.cssText = `
        width:48px; height:48px;
        border-radius:50%;
        background:#ffffff;
        border:3px solid #34A853;
        box-shadow:0 4px 14px rgba(0,0,0,0.22), 0 0 0 0 rgba(52,168,83,0.4);
        display:flex; align-items:center; justify-content:center;
        overflow:hidden;
        transition:border-color 0.2s, box-shadow 0.2s;
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
    svg.setAttribute('width', '26');
    svg.setAttribute('height', '26');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');

    const body = document.createElementNS(ns, 'rect');
    body.setAttribute('x', '2'); body.setAttribute('y', '4');
    body.setAttribute('width', '20'); body.setAttribute('height', '14');
    body.setAttribute('rx', '3'); body.setAttribute('fill', '#34A853');

    const windshield = document.createElementNS(ns, 'rect');
    windshield.setAttribute('x', '4'); windshield.setAttribute('y', '6');
    windshield.setAttribute('width', '16'); windshield.setAttribute('height', '5');
    windshield.setAttribute('rx', '2'); windshield.setAttribute('fill', '#B6E9C4');

    const wheelL = document.createElementNS(ns, 'circle');
    wheelL.setAttribute('cx', '6.5'); wheelL.setAttribute('cy', '19'); wheelL.setAttribute('r', '2.2'); wheelL.setAttribute('fill', '#1a1a1a');

    const wheelR = document.createElementNS(ns, 'circle');
    wheelR.setAttribute('cx', '17.5'); wheelR.setAttribute('cy', '19'); wheelR.setAttribute('r', '2.2'); wheelR.setAttribute('fill', '#1a1a1a');

    const hubL = document.createElementNS(ns, 'circle');
    hubL.setAttribute('cx', '6.5'); hubL.setAttribute('cy', '19'); hubL.setAttribute('r', '0.9'); hubL.setAttribute('fill', '#888');

    const hubR = document.createElementNS(ns, 'circle');
    hubR.setAttribute('cx', '17.5'); hubR.setAttribute('cy', '19'); hubR.setAttribute('r', '0.9'); hubR.setAttribute('fill', '#888');

    const door = document.createElementNS(ns, 'rect');
    door.setAttribute('x', '10'); door.setAttribute('y', '12');
    door.setAttribute('width', '4'); door.setAttribute('height', '5');
    door.setAttribute('rx', '1'); door.setAttribute('fill', '#B6E9C4');

    [body, windshield, door, wheelL, wheelR, hubL, hubR].forEach(n => svg.appendChild(n));
    return svg;
}

// ─── ETA pill DOM ─────────────────────────────────────────────────────────────

function createPillEl(eta: string | null, distText: string): HTMLDivElement {
    const pill = document.createElement('div');
    pill.style.cssText = `
        position:absolute;
        transform:translate(-50%, calc(-100% - 58px));
        background:#FF6B00;
        color:#fff;
        font-size:11px;
        font-weight:700;
        font-family:Google Sans,sans-serif;
        letter-spacing:0.3px;
        padding:4px 10px;
        border-radius:100px;
        box-shadow:0 2px 10px rgba(0,0,0,0.28);
        white-space:nowrap;
        pointer-events:none;
        display:flex;
        align-items:center;
        gap:4px;
        z-index:200;
    `;
    updatePillContent(pill, eta, distText);
    return pill;
}

function updatePillContent(pill: HTMLDivElement, eta: string | null, distText: string) {
    pill.innerHTML = '';

    if (eta) {
        const ns  = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('width', '10'); svg.setAttribute('height', '10');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'rgba(255,255,255,0.85)');
        svg.setAttribute('stroke-width', '2.5');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '10');
        const p = document.createElementNS(ns, 'polyline');
        p.setAttribute('points', '12 6 12 12 16 14');
        svg.appendChild(c); svg.appendChild(p);
        pill.appendChild(svg);
        const t       = document.createElement('span');
        t.textContent = eta;
        pill.appendChild(t);
    }

    if (eta && distText) {
        const dot         = document.createElement('span');
        dot.style.cssText = 'width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,0.6);display:inline-block;flex-shrink:0;';
        pill.appendChild(dot);
    }

    if (distText) {
        const d           = document.createElement('span');
        d.style.cssText   = 'color:rgba(255,255,255,0.9);';
        d.textContent     = distText;
        pill.appendChild(d);
    }
}

// ─── User marker DOM ──────────────────────────────────────────────────────────

function createUserEl(): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
        position:absolute;
        transform:translate(-50%,-50%);
        width:80px; height:80px;
        pointer-events:none;
    `;

    const ring = document.createElement('div');
    ring.style.cssText = `
        position:absolute; top:50%; left:50%;
        transform:translate(-50%,-50%);
        width:56px; height:56px; border-radius:50%;
        background:rgba(26,115,232,0.12);
        border:1.5px solid rgba(26,115,232,0.25);
    `;

    const pulse = document.createElement('div');
    pulse.style.cssText = `
        position:absolute; top:50%; left:50%;
        transform:translate(-50%,-50%);
        width:56px; height:56px; border-radius:50%;
        background:rgba(26,115,232,0.15);
        animation:userPulse 2s ease-out infinite;
    `;

    const dot = document.createElement('div');
    dot.style.cssText = `
        position:absolute; top:50%; left:50%;
        transform:translate(-50%,-50%);
        width:18px; height:18px; border-radius:50%;
        background:#fff;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
        display:flex; align-items:center; justify-content:center;
        z-index:2;
    `;
    const inner = document.createElement('div');
    inner.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#1A73E8;';
    dot.appendChild(inner);

    const humanWrap = document.createElement('div');
    humanWrap.style.cssText = `
        position:absolute; top:50%; left:50%;
        transform:translate(-50%,-95%);
        z-index:4;
        filter:drop-shadow(0 2px 5px rgba(0,0,0,0.3));
    `;
    const ns  = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '32'); svg.setAttribute('height', '40'); svg.setAttribute('viewBox', '0 0 32 40');

    const shadow = document.createElementNS(ns, 'ellipse');
    shadow.setAttribute('cx','16'); shadow.setAttribute('cy','38'); shadow.setAttribute('rx','8'); shadow.setAttribute('ry','2'); shadow.setAttribute('fill','rgba(0,0,0,0.18)');
    const head = document.createElementNS(ns, 'circle');
    head.setAttribute('cx','16'); head.setAttribute('cy','7'); head.setAttribute('r','5'); head.setAttribute('fill','#1A73E8');
    const body = document.createElementNS(ns, 'path');
    body.setAttribute('d','M10 14 Q16 12 22 14 L21 26 H11 Z'); body.setAttribute('fill','#1A73E8');
    const armL = document.createElementNS(ns, 'path');
    armL.setAttribute('d','M10 15 L6 23'); armL.setAttribute('stroke','#1A73E8'); armL.setAttribute('stroke-width','3'); armL.setAttribute('stroke-linecap','round'); armL.setAttribute('fill','none');
    const armR = document.createElementNS(ns, 'path');
    armR.setAttribute('d','M22 15 L26 23'); armR.setAttribute('stroke','#1A73E8'); armR.setAttribute('stroke-width','3'); armR.setAttribute('stroke-linecap','round'); armR.setAttribute('fill','none');
    const legL = document.createElementNS(ns, 'path');
    legL.setAttribute('d','M13 26 L10 36'); legL.setAttribute('stroke','#1565C0'); legL.setAttribute('stroke-width','3.5'); legL.setAttribute('stroke-linecap','round'); legL.setAttribute('fill','none');
    const legR = document.createElementNS(ns, 'path');
    legR.setAttribute('d','M19 26 L22 36'); legR.setAttribute('stroke','#1565C0'); legR.setAttribute('stroke-width','3.5'); legR.setAttribute('stroke-linecap','round'); legR.setAttribute('fill','none');
    const highlight = document.createElementNS(ns, 'circle');
    highlight.setAttribute('cx','14'); highlight.setAttribute('cy','5.5'); highlight.setAttribute('r','1.5'); highlight.setAttribute('fill','rgba(255,255,255,0.35)');

    [shadow, body, armL, armR, legL, legR, head, highlight].forEach(n => svg.appendChild(n));
    humanWrap.appendChild(svg);

    const labelWrap = document.createElement('div');
    labelWrap.style.cssText = `
        position:absolute; bottom:calc(100% + 46px); left:50%;
        transform:translateX(-50%); z-index:5; pointer-events:none;
    `;
    const label = document.createElement('div');
    label.style.cssText = `
        background:#fff; border-radius:8px; padding:4px 10px;
        font-size:11px; font-weight:700; color:#1A1A1A;
        box-shadow:0 2px 10px rgba(0,0,0,0.18);
        font-family:Google Sans,sans-serif; letter-spacing:0.01em;
        border:1px solid rgba(0,0,0,0.06); white-space:nowrap;
    `;
    label.textContent = 'Your Location';
    const triangle = document.createElement('div');
    triangle.style.cssText = `
        width:0; height:0;
        border-left:5px solid transparent; border-right:5px solid transparent;
        border-top:5px solid #fff; margin:0 auto;
        filter:drop-shadow(0 1px 1px rgba(0,0,0,0.08));
    `;
    labelWrap.appendChild(label);
    labelWrap.appendChild(triangle);

    wrap.appendChild(ring);
    wrap.appendChild(pulse);
    wrap.appendChild(dot);
    wrap.appendChild(humanWrap);
    wrap.appendChild(labelWrap);
    return wrap;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }

function getDistText(bus: BusMarkerState): string {
    if (bus.distance_text) return bus.distance_text;
    if (bus.distance_meters != null) {
        return bus.distance_meters >= 1000
            ? `${(bus.distance_meters / 1000).toFixed(1)} km`
            : `${Math.round(bus.distance_meters)} m`;
    }
    return '';
}

function getMarkerId(bus: BusMarkerState): number {
    return bus.busId;
}

function getLogoUrl(bus: BusMarkerState): string | null {
    return (bus as BusMarkerState & { logoUrl?: string | null }).logoUrl ?? null;
}

function parseCoord(v: unknown): number {
    return typeof v === 'string' ? parseFloat(v as string) : (v as number);
}

// ─── Geofence check — uses ACTIVE_VENUE polygon (ray-casting) ────────────────
// Falls back to the radius circle when the polygon has fewer than 3 points.
function isInsideVenue(lat: number, lng: number): boolean {
    const poly = ACTIVE_VENUE.geofencePolygon;

    if (poly && poly.length >= 3) {
        // Ray-casting algorithm
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].lat, yi = poly[i].lng;
            const xj = poly[j].lat, yj = poly[j].lng;
            const intersect =
                yi > lng !== yj > lng &&
                lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // Fallback: Haversine circle
    const R    = 6_371_000;
    const dLat = ((lat - ACTIVE_VENUE.lat) * Math.PI) / 180;
    const dLng = ((lng - ACTIVE_VENUE.lng) * Math.PI) / 180;
    const a    =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((ACTIVE_VENUE.lat * Math.PI) / 180) *
        Math.cos((lat             * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const distanceMetres = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return distanceMetres <= ACTIVE_VENUE.geofenceRadius;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MapView({ busMarkers, apiKey, focusCompanyId }: MapViewProps) {

    const resolvedKey = apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

    const mapDivRef          = useRef<HTMLDivElement>(null);
    const mapRef             = useRef<google.maps.Map | null>(null);
    const liveMarkersRef     = useRef<Map<number, LiveMarker>>(new Map());
    const userOverlayRef     = useRef<MoveableOverlay | null>(null);
    const userElRef          = useRef<HTMLDivElement | null>(null);
    const userPosRef         = useRef<{ lat: number; lng: number } | null>(null);
    const isInitRef          = useRef(false);
    const hasFocusedRef      = useRef(false);
    const animRafsRef        = useRef<Map<number, number>>(new Map());
    const geofenceLineRef    = useRef<google.maps.Polyline | null>(null);

    const [mapType,     setMapType]     = useState<MapType>('hybrid');
    const [mapTypeOpen, setMapTypeOpen] = useState(false);
    const [isLocating,  setIsLocating]  = useState(false);
    const [locationErr, setLocationErr] = useState<string | null>(null);

    // ── Init map ──────────────────────────────────────────────────────────────

    useEffect(() => {
        if (isInitRef.current || !mapDivRef.current) return;
        isInitRef.current = true;

        if (!resolvedKey) {
            console.error('[MapView] No Google Maps API key — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
            return;
        }

        const loader = new Loader({
            apiKey:    resolvedKey,
            version:   'weekly',
            libraries: ['geometry'],
        });

        loader.load().then(() => {
            // Map centres on whichever venue is active in venue.ts
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

            // ── Draw geofence — dense coral dashes matching Google Maps style ──
            // M -1,-1  L 1,-1  L 1,1  L -1,1  Z  draws a tiny filled square.
            // scale:2  → ~4×4 px square at zoom 16
            // strokeOpacity:0 hides the underlying line; only the icons show.
            // repeat:'8px' packs them tightly so they look like a continuous
            // dashed border identical to the reference image.
            geofenceLineRef.current = new google.maps.Polyline({
                path:          ACTIVE_VENUE.geofencePolygon.map(p => ({ lat: p.lat, lng: p.lng })),
                geodesic:      true,
                strokeOpacity: 0,
                icons: [{
                    icon: {
                        path:         'M -1,-1  L 1,-1  L 1,1  L -1,1  Z',
                        fillColor:    '#F4756B',   // coral — matches Google Maps exactly
                        fillOpacity:  1,
                        strokeColor:  '#F4756B',
                        strokeWeight: 0,
                        scale:        2,           // 4 × 4 px square
                    },
                    offset: '0',
                    repeat: '8px',                 // very tight — almost touching
                }],
                map,
            });

            // ── Geolocation ───────────────────────────────────────────────────
            if (!('geolocation' in navigator)) {
                setLocationErr('Geolocation is not supported by your browser');
                return;
            }

            navigator.geolocation.watchPosition(
                ({ coords: { latitude: lat, longitude: lng } }) => {
                    userPosRef.current = { lat, lng };
                    setLocationErr(null);

                    // Only show the user dot when inside the active venue boundary
                    const insideVenue = isInsideVenue(lat, lng);

                    if (insideVenue) {
                        const pos = new google.maps.LatLng(lat, lng);

                        if (!userElRef.current) {
                            const el               = createUserEl();
                            userElRef.current      = el;
                            userOverlayRef.current = makeMoveableOverlay(map, el, pos, 'overlayMouseTarget');
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
                const markerEl = createBusEl(getLogoUrl(bus));
                const overlay  = makeMoveableOverlay(map, markerEl, target, 'floatPane');

                let pillEl:   HTMLDivElement | null = null;
                let pillOver: MoveableOverlay | null = null;

                if (eta || distText) {
                    pillEl   = createPillEl(eta, distText);
                    pillOver = makeMoveableOverlay(map, pillEl, target, 'floatPane');
                }

                liveMarkersRef.current.set(key, {
                    markerEl, overlay, pillEl, pillOver,
                    animPos: target,
                    target,
                });

            } else {
                const from   = existing.animPos;
                const oldRaf = animRafsRef.current.get(key);
                if (oldRaf) cancelAnimationFrame(oldRaf);

                existing.target = target;
                const startTime = performance.now();

                const animate = (now: number) => {
                    const elapsed = now - startTime;
                    const t       = Math.min(elapsed / ANIM_DURATION, 1);
                    const ease    = easeOutCubic(t);

                    const pos = new google.maps.LatLng(
                        lerp(from.lat(), target.lat(), ease),
                        lerp(from.lng(), target.lng(), ease),
                    );

                    existing.animPos = pos;
                    existing.overlay.moveTo(pos);
                    existing.pillOver?.moveTo(pos);

                    if (t < 1) {
                        animRafsRef.current.set(key, requestAnimationFrame(animate));
                    } else {
                        animRafsRef.current.delete(key);
                    }
                };

                animRafsRef.current.set(key, requestAnimationFrame(animate));

                if (eta || distText) {
                    if (existing.pillEl) {
                        updatePillContent(existing.pillEl, eta, distText);
                    } else {
                        existing.pillEl   = createPillEl(eta, distText);
                        existing.pillOver = makeMoveableOverlay(map, existing.pillEl, existing.animPos, 'floatPane');
                    }
                } else if (existing.pillEl && existing.pillOver) {
                    existing.pillOver.setMap(null);
                    existing.pillEl   = null;
                    existing.pillOver = null;
                }
            }
        }

        for (const [key, lm] of liveMarkersRef.current) {
            if (!seen.has(key)) {
                lm.overlay.setMap(null);
                lm.pillOver?.setMap(null);
                const raf = animRafsRef.current.get(key);
                if (raf) { cancelAnimationFrame(raf); animRafsRef.current.delete(key); }
                liveMarkersRef.current.delete(key);
            }
        }

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

    // ── Sync map type ─────────────────────────────────────────────────────────
    useEffect(() => { mapRef.current?.setMapTypeId(mapType); }, [mapType]);

    // ── Recenter button ───────────────────────────────────────────────────────
    const handleRecenter = useCallback(() => {
        const map = mapRef.current;
        const pos = userPosRef.current;
        if (!map) return;

        setIsLocating(true);

        // Pan to the user if they're inside the venue, otherwise back to venue center
        if (pos && isInsideVenue(pos.lat, pos.lng)) {
            map.panTo(pos);
            map.setZoom(ACTIVE_VENUE.defaultZoom);
        } else {
            map.panTo({ lat: ACTIVE_VENUE.lat, lng: ACTIVE_VENUE.lng });
            map.setZoom(ACTIVE_VENUE.defaultZoom);
        }

        setIsLocating(false);
    }, []);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />

            {/* Map type picker */}
            <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 20 }}>
                <button
                    onClick={() => setMapTypeOpen(o => !o)}
                    style={{
                        display:'flex', alignItems:'center', gap:6,
                        background:'#fff', border:'none', borderRadius:12,
                        padding:'8px 12px', boxShadow:'0 2px 10px rgba(0,0,0,0.18)',
                        cursor:'pointer', fontSize:13, fontWeight:600,
                        fontFamily:'Google Sans,sans-serif', color:'#202124',
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
                        position:'absolute', top:'calc(100% + 6px)', right:0,
                        background:'#fff', borderRadius:12, overflow:'hidden',
                        boxShadow:'0 4px 20px rgba(0,0,0,0.18)', minWidth:140,
                    }}>
                        {MAP_TYPES.map(({ id, label, emoji }) => (
                            <button
                                key={id}
                                onClick={() => { setMapType(id); setMapTypeOpen(false); }}
                                style={{
                                    display:'flex', alignItems:'center', gap:10,
                                    width:'100%', padding:'10px 16px', border:'none',
                                    background: mapType === id ? '#FFF3E8' : '#fff',
                                    cursor:'pointer', fontSize:13,
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

            {/* Recenter button */}
            <button
                onClick={handleRecenter}
                aria-label="Re-center map"
                style={{
                    position:'absolute', bottom:200, right:16,
                    width:44, height:44, borderRadius:'50%',
                    background:'#fff', border:'none',
                    boxShadow:'0 2px 10px rgba(0,0,0,0.18)',
                    cursor:'pointer', display:'flex',
                    alignItems:'center', justifyContent:'center', zIndex:20,
                }}
            >
                {isLocating
                    ? <svg width="20" height="20" viewBox="0 0 24 24" fill="#4285F4"
                           style={{ animation:'mapSpin 1s linear infinite' }}>
                        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                    </svg>
                    : <svg width="20" height="20" viewBox="0 0 24 24" fill="#4285F4">
                        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                    </svg>
                }
            </button>

            {locationErr && (
                <div style={{
                    position:'absolute', bottom:260, left:'50%', transform:'translateX(-50%)',
                    background:'#323232', color:'#fff', fontSize:13, fontWeight:500,
                    fontFamily:'Google Sans,sans-serif', padding:'10px 20px', borderRadius:8,
                    boxShadow:'0 4px 12px rgba(0,0,0,0.28)', zIndex:30, whiteSpace:'nowrap',
                }}>
                    📍 {locationErr}
                </div>
            )}

            {mapTypeOpen && (
                <div
                    onClick={() => setMapTypeOpen(false)}
                    style={{ position:'fixed', inset:0, zIndex:15 }}
                />
            )}

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