'use client';

import { useEffect, useRef, useState } from 'react';
import { OverlayView } from '@react-google-maps/api';
import { BusMarkerState } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BusMarkerProps {
    marker:     BusMarkerState;
    isSelected: boolean;
    onClick:    (busId: number) => void;
    logoUrl?:   string | null;
}

export function BusMarker({ marker, isSelected, onClick, logoUrl }: BusMarkerProps) {
    const prevPositionRef = useRef({ lat: marker.latitude, lng: marker.longitude });
    const [bouncing, setBouncing] = useState(false);

    useEffect(() => {
        const prev = prevPositionRef.current;
        const moved =
            Math.abs(prev.lat - marker.latitude) > 0.00001 ||
            Math.abs(prev.lng - marker.longitude) > 0.00001;
        if (moved) {
            prevPositionRef.current = { lat: marker.latitude, lng: marker.longitude };
            setBouncing(true);
            const t = setTimeout(() => setBouncing(false), 450);
            return () => clearTimeout(t);
        }
    }, [marker.latitude, marker.longitude]);

    const rotation  = marker.direction ?? 0;
    const hasETA    = !!marker.eta || !!marker.distance_text;
    const ringColor = isSelected ? '#E8450A' : '#34A853';
    const SIZE      = isSelected ? 48 : 42;

    return (
        <OverlayView
            position={{ lat: marker.latitude, lng: marker.longitude }}
            mapPaneName={OverlayView.FLOAT_PANE}
            getPixelPositionOffset={() => ({ x: -(SIZE / 2), y: -(SIZE / 2) })}
        >
            <div
                onClick={() => onClick(marker.busId)}
                style={{
                    position: 'relative',
                    width:    SIZE,
                    height:   SIZE,
                    cursor:   'pointer',
                    overflow: 'visible',
                    zIndex:   isSelected ? 1000 : 100,
                }}
            >
                {/* ── ETA PILL — above marker ── */}
                {hasETA && (
                    <div style={{
                        position:       'absolute',
                        bottom:         '110%',
                        left:           '50%',
                        transform:      'translateX(-50%)',
                        whiteSpace:     'nowrap',
                        display:        'inline-flex',
                        alignItems:     'center',
                        gap:            4,
                        padding:        '3px 9px',
                        borderRadius:   9999,
                        fontSize:       11,
                        fontWeight:     700,
                        background:     isSelected ? '#E8450A' : '#ffffff',
                        color:          isSelected ? '#ffffff' : '#1A1A1A',
                        border:         `1px solid ${isSelected ? '#C23A08' : '#E8EAED'}`,
                        boxShadow:      '0 2px 10px rgba(0,0,0,0.18)',
                        fontFamily:     'var(--font-mono, monospace)',
                        pointerEvents:  'none',
                        zIndex:         9999,
                        marginBottom:   4,
                    }}>
                        {/* Clock */}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                             stroke={isSelected ? 'rgba(255,255,255,0.85)' : '#E8450A'}
                             strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        {marker.eta && <span>{marker.eta}</span>}
                        {marker.eta && marker.distance_text && (
                            <span style={{
                                width: 3, height: 3, borderRadius: '50%',
                                background: isSelected ? 'rgba(255,255,255,0.6)' : '#9AA0A6',
                                display: 'inline-block', flexShrink: 0,
                            }}/>
                        )}
                        {marker.distance_text && (
                            <span style={{ color: isSelected ? 'rgba(255,255,255,0.9)' : '#5F6368' }}>
                {marker.distance_text}
              </span>
                        )}
                    </div>
                )}

                {/* ── SELECTED PULSE RING ── */}
                {isSelected && (
                    <div style={{
                        position:     'absolute',
                        top:          '50%',
                        left:         '50%',
                        transform:    'translate(-50%, -50%)',
                        width:        SIZE + 20,
                        height:       SIZE + 20,
                        borderRadius: '50%',
                        background:   'rgba(232,69,10,0.18)',
                        animation:    'location-pulse 1.5s ease-out infinite',
                        zIndex:       -1,
                        pointerEvents:'none',
                    }}/>
                )}

                {/* ── BUS CIRCLE WITH COMPANY LOGO ── */}
                <div
                    className={cn(bouncing && 'animate-marker-bounce')}
                    style={{
                        width:          SIZE,
                        height:         SIZE,
                        borderRadius:   '50%',
                        background:     '#FFFFFF',
                        border:         `3px solid ${ringColor}`,
                        boxShadow:      isSelected
                            ? `0 4px 16px rgba(232,69,10,0.45)`
                            : `0 3px 10px rgba(0,0,0,0.22)`,
                        display:        'flex',
                        alignItems:     'center',
                        justifyContent: 'center',
                        overflow:       'hidden',
                        transform:      `rotate(${rotation}deg)`,
                        transition:     'transform 0.3s ease, border-color 0.2s, box-shadow 0.2s',
                        position:       'relative',
                    }}
                >
                    {logoUrl ? (
                        /* Company logo */
                        <img
                            src={logoUrl}
                            alt="bus"
                            style={{
                                width:      '75%',
                                height:     '75%',
                                objectFit:  'contain',
                                borderRadius: '50%',
                            }}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    ) : (
                        /* Fallback bus SVG */
                        <svg width={SIZE * 0.5} height={SIZE * 0.5} viewBox="0 0 24 24" fill="none"
                             stroke={ringColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="1" y="3" width="15" height="13" rx="1"/>
                            <path d="M16 8h4l3 3v5h-7V8z"/>
                            <circle cx="5.5" cy="18.5" r="2.5"/>
                            <circle cx="18.5" cy="18.5" r="2.5"/>
                        </svg>
                    )}
                </div>
            </div>
        </OverlayView>
    );
}