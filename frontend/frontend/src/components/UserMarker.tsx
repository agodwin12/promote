'use client';

import { OverlayView } from '@react-google-maps/api';
import { UserLocation } from '@/lib/types';

interface UserMarkerProps {
    location: UserLocation;
}

export function UserMarker({ location }: UserMarkerProps) {
    return (
        <OverlayView
            position={{ lat: location.lat, lng: location.lng }}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            getPixelPositionOffset={() => ({ x: -32, y: -64 })}
        >
            <div style={{
                position: 'relative',
                width:    64,
                height:   80,
                display:  'flex',
                flexDirection: 'column',
                alignItems: 'center',
                overflow: 'visible',
            }}>

                {/* ── VOUS ÊTES ICI LABEL ── */}
                <div style={{
                    position:       'absolute',
                    bottom:         '100%',
                    left:           '50%',
                    transform:      'translateX(-50%)',
                    marginBottom:   6,
                    whiteSpace:     'nowrap',
                }}>
                    <div style={{
                        background:    '#FFFFFF',
                        borderRadius:  8,
                        padding:       '4px 10px',
                        fontSize:      11,
                        fontWeight:    700,
                        color:         '#1A1A1A',
                        boxShadow:     '0 2px 10px rgba(0,0,0,0.18)',
                        fontFamily:    'var(--font, sans-serif)',
                        letterSpacing: '0.01em',
                        border:        '1px solid rgba(0,0,0,0.06)',
                    }}>
                        Vous êtes ici
                    </div>
                    {/* Triangle pointer */}
                    <div style={{
                        width:        0,
                        height:       0,
                        borderLeft:   '5px solid transparent',
                        borderRight:  '5px solid transparent',
                        borderTop:    '5px solid white',
                        margin:       '0 auto',
                        filter:       'drop-shadow(0 1px 1px rgba(0,0,0,0.08))',
                    }}/>
                </div>

                {/* ── ACCURACY RING ── */}
                <div style={{
                    position:     'absolute',
                    top:          '50%',
                    left:         '50%',
                    transform:    'translate(-50%, -50%)',
                    width:        56,
                    height:       56,
                    borderRadius: '50%',
                    background:   'rgba(26,115,232,0.12)',
                    border:       '1px solid rgba(26,115,232,0.22)',
                }}/>

                {/* ── PULSE RING ── */}
                <div style={{
                    position:     'absolute',
                    top:          '50%',
                    left:         '50%',
                    transform:    'translate(-50%, -50%)',
                    width:        56,
                    height:       56,
                    borderRadius: '50%',
                    background:   'rgba(26,115,232,0.12)',
                    animation:    'location-pulse 2s ease-out infinite',
                }}/>

                {/* ── HUMAN.PNG ICON ── */}
                <div style={{
                    position:       'absolute',
                    top:            '50%',
                    left:           '50%',
                    transform:      'translate(-50%, -80%)',
                    zIndex:         4,
                    width:          32,
                    height:         32,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                }}>
                    <img
                        src="/human.png"
                        alt="You are here"
                        style={{
                            width:      32,
                            height:     32,
                            objectFit:  'contain',
                            filter:     'drop-shadow(0 2px 4px rgba(0,0,0,0.25))',
                        }}
                        onError={(e) => {
                            // Fallback to Google Maps style dot if human.png missing
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                        }}
                    />
                    {/* Fallback dot — hidden by default */}
                    <div style={{
                        display:        'none',
                        width:          22,
                        height:         22,
                        borderRadius:   '50%',
                        background:     'white',
                        boxShadow:      '0 2px 6px rgba(0,0,0,0.30)',
                        alignItems:     'center',
                        justifyContent: 'center',
                    }}>
                        <div style={{
                            width:        14,
                            height:       14,
                            borderRadius: '50%',
                            background:   '#1A73E8',
                        }}/>
                    </div>
                </div>

                {/* ── CENTER DOT ── */}
                <div style={{
                    position:       'absolute',
                    top:            '50%',
                    left:           '50%',
                    transform:      'translate(-50%, -50%)',
                    zIndex:         3,
                    width:          18,
                    height:         18,
                    borderRadius:   '50%',
                    background:     'white',
                    boxShadow:      '0 2px 6px rgba(0,0,0,0.28)',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                }}>
                    <div style={{
                        width:        11,
                        height:       11,
                        borderRadius: '50%',
                        background:   '#1A73E8',
                    }}/>
                </div>
            </div>
        </OverlayView>
    );
}