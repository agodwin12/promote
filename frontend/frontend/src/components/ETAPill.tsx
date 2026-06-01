'use client';

import { cn } from '@/lib/utils';

interface ETAPillProps {
    eta:          string | null;
    distanceText: string | null;
    isSelected?:  boolean;
}

export function ETAPill({ eta, distanceText, isSelected = false }: ETAPillProps) {
    const hasETA      = !!eta;
    const hasDistance = !!distanceText;
    const hasContent  = hasETA || hasDistance;

    if (!hasContent) return null;

    return (
        <div
            style={{
                display:       'inline-flex',
                alignItems:    'center',
                gap:           4,
                padding:       '3px 8px',
                borderRadius:  9999,
                fontSize:      11,
                fontWeight:    700,
                whiteSpace:    'nowrap',
                boxShadow:     '0 2px 8px rgba(0,0,0,0.20)',
                border:        `1px solid ${isSelected ? '#1557b0' : '#e8eaed'}`,
                background:    isSelected ? '#1a73e8' : '#ffffff',
                color:         isSelected ? '#ffffff' : '#202124',
                fontFamily:    'var(--font-jakarta), sans-serif',
                letterSpacing: '0.01em',
                lineHeight:    1,
            }}
        >
            {/* Clock icon */}
            {hasETA && (
                <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={isSelected ? 'rgba(255,255,255,0.8)' : '#5f6368'}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                </svg>
            )}

            {/* ETA text */}
            {hasETA && (
                <span>{eta}</span>
            )}

            {/* Separator */}
            {hasETA && hasDistance && (
                <span
                    style={{
                        width:        3,
                        height:       3,
                        borderRadius: '50%',
                        background:   isSelected ? 'rgba(255,255,255,0.6)' : '#9aa0a6',
                        display:      'inline-block',
                        flexShrink:   0,
                    }}
                />
            )}

            {/* Distance */}
            {hasDistance && (
                <span
                    style={{
                        color: isSelected ? 'rgba(255,255,255,0.9)' : '#5f6368',
                    }}
                >
          {distanceText}
        </span>
            )}
        </div>
    );
}