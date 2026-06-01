'use client';

import { useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { Bus, ChevronDown } from 'lucide-react';
import { Company } from '@/lib/types';
import { BusMarkerState } from '@/lib/types';

interface BottomSheetProps {
    companies:          Company[];
    activeCompanyIds:   Set<number>;
    busCountByCompany:  Map<number, number>;
    onToggleCompany:    (id: number) => void;
    totalActiveBuses:   number;
    busMarkers?:        BusMarkerState[];
}

const SNAP = { collapsed: 80, half: 320, full: 580 };

export function BottomSheet({
                                companies,
                                activeCompanyIds,
                                busCountByCompany,
                                onToggleCompany,
                                totalActiveBuses,
                                busMarkers = [],
                            }: BottomSheetProps) {
    const [height, setHeight]           = useState(SNAP.half);
    const [expandedCompany, setExpanded]= useState<number | null>(null);
    const dragStartY                    = useRef(0);
    const dragStartHeight               = useRef(SNAP.half);
    const isDragging                    = useRef(false);

    // ── DRAG ────────────────────────────────
    const snapToNearest = useCallback((h: number) => {
        const snaps   = Object.values(SNAP);
        const closest = snaps.reduce((a, b) => Math.abs(b - h) < Math.abs(a - h) ? b : a);
        setHeight(closest);
    }, []);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        dragStartY.current      = e.touches[0].clientY;
        dragStartHeight.current = height;
        isDragging.current      = true;
    }, [height]);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isDragging.current) return;
        const delta = dragStartY.current - e.touches[0].clientY;
        setHeight(Math.max(SNAP.collapsed, Math.min(SNAP.full, dragStartHeight.current + delta)));
    }, []);

    const onTouchEnd = useCallback((e: React.TouchEvent) => {
        isDragging.current = false;
        const delta = dragStartY.current - e.changedTouches[0].clientY;
        snapToNearest(Math.max(SNAP.collapsed, Math.min(SNAP.full, dragStartHeight.current + delta)));
    }, [snapToNearest]);

    // ── HELPERS ─────────────────────────────
    const allActive = companies.every((c) => activeCompanyIds.has(c.id));

    const toggleAll = useCallback(() => {
        companies.forEach((c) => {
            const isActive = activeCompanyIds.has(c.id);
            if (allActive && isActive)   onToggleCompany(c.id);
            if (!allActive && !isActive) onToggleCompany(c.id);
        });
    }, [allActive, companies, activeCompanyIds, onToggleCompany]);

    // Buses grouped by company
    const busesByCompany = useCallback((companyId: number) =>
            busMarkers.filter((m) => m.companyId === companyId),
        [busMarkers]);

    return (
        <div
            style={{
                position:      'fixed',
                bottom:        0,
                left:          0,
                right:         0,
                height:        height,
                background:    '#FFFFFF',
                borderRadius:  '20px 20px 0 0',
                boxShadow:     '0 -4px 32px rgba(0,0,0,0.12)',
                display:       'flex',
                flexDirection: 'column',
                zIndex:        1000,
                transition:    isDragging.current ? 'none' : 'height 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                touchAction:   'none',
            }}
        >
            {/* ── DRAG HANDLE ── */}
            <div
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{ flexShrink: 0, padding: '12px 16px 8px', cursor: 'grab' }}
            >
                <div style={{
                    width: 36, height: 4, borderRadius: 9999,
                    background: '#DADCE0', margin: '0 auto 12px',
                }}/>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{
                            fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: 0,
                            letterSpacing: '0.05em', textTransform: 'uppercase',
                            fontFamily: 'var(--font)',
                        }}>
                            Available Rides
                        </p>
                        <p style={{ fontSize: 12, color: '#8A8D91', margin: '2px 0 0', fontFamily: 'var(--font)' }}>
                            {totalActiveBuses} vehicles nearby
                        </p>
                    </div>

                    {/* Mini logo badge */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: '#FFF0EB', padding: '5px 10px 5px 6px',
                        borderRadius: 9999, border: '1px solid rgba(232,69,10,0.15)',
                    }}>
                        <Image src="/miniLogo.jpg" alt="Fleetra" width={18} height={18}
                               style={{ objectFit: 'contain' }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#E8450A', fontFamily: 'var(--font)' }}>
              {totalActiveBuses}
            </span>
                    </div>
                </div>
            </div>

            {/* ── DIVIDER ── */}
            <div style={{ height: 1, background: '#F1F3F4', flexShrink: 0, margin: '0 16px' }}/>

            {/* ── SCROLLABLE LIST ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 24px' }}
                 className="no-scrollbar">

                {/* Select all */}
                {companies.length > 1 && (
                    <button onClick={toggleAll} style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', padding: '10px 16px',
                        background: 'none', border: 'none', borderBottom: '1px solid #F1F3F4',
                        cursor: 'pointer', marginBottom: 2,
                    }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#E8450A', fontFamily: 'var(--font)' }}>
              {allActive ? 'Deselect all' : 'Select all'}
            </span>
                    </button>
                )}

                {/* Company rows */}
                {companies.map((company) => {
                    const isActive  = activeCompanyIds.has(company.id);
                    const buses     = busesByCompany(company.id);
                    const isExpanded = expandedCompany === company.id;

                    return (
                        <div key={company.id} style={{ borderBottom: '1px solid #F1F3F4' }}>

                            {/* ── COMPANY ROW ── */}
                            <div style={{ display: 'flex', alignItems: 'center' }}>

                                {/* Checkbox + logo + name — tappable to toggle */}
                                <button
                                    onClick={() => onToggleCompany(company.id)}
                                    style={{
                                        flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '13px 0 13px 16px',
                                        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                                    }}
                                >
                                    {/* Checkbox */}
                                    <div style={{
                                        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                                        border: `2px solid ${isActive ? '#E8450A' : '#DADCE0'}`,
                                        background: isActive ? '#E8450A' : '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'all 0.15s',
                                    }}>
                                        {isActive && (
                                            <svg width="10" height="8" viewBox="0 0 12 10" fill="none">
                                                <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2.2"
                                                      strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        )}
                                    </div>

                                    {/* Logo */}
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                        background: '#F8F9FA', border: '1px solid #E8EAED',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        overflow: 'hidden', opacity: isActive ? 1 : 0.35,
                                        transition: 'opacity 0.15s',
                                    }}>
                                        {company.logo_url ? (
                                            <Image src={company.logo_url} alt={company.name}
                                                   width={32} height={32}
                                                   style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 2 }}
                                            />
                                        ) : (
                                            <Bus size={14} color="#8A8D91" />
                                        )}
                                    </div>

                                    {/* Name */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{
                                            margin: 0, fontSize: 14, fontWeight: 600,
                                            color: isActive ? '#1A1A1A' : '#9AA0A6',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            fontFamily: 'var(--font)', transition: 'color 0.15s',
                                        }}>
                                            {company.name}
                                        </p>
                                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#8A8D91', fontFamily: 'var(--font)' }}>
                                            {buses.length} {buses.length === 1 ? 'vehicle' : 'vehicles'} active
                                        </p>
                                    </div>
                                </button>

                                {/* Expand / collapse chevron */}
                                {buses.length > 0 && (
                                    <button
                                        onClick={() => setExpanded(isExpanded ? null : company.id)}
                                        style={{
                                            padding: '13px 16px', background: 'none', border: 'none',
                                            cursor: 'pointer', flexShrink: 0,
                                        }}
                                    >
                                        <ChevronDown
                                            size={16}
                                            color="#8A8D91"
                                            style={{
                                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.25s ease',
                                            }}
                                        />
                                    </button>
                                )}
                            </div>

                            {/* ── EXPANDED: individual bus rows ── */}
                            {isExpanded && buses.length > 0 && (
                                <div style={{ background: '#FAFAFA', padding: '4px 0 8px' }}>
                                    {buses.map((bus) => (
                                        <div
                                            key={bus.busId}
                                            style={{
                                                display:     'flex',
                                                alignItems:  'center',
                                                padding:     '8px 16px 8px 52px',
                                                gap:         10,
                                            }}
                                        >
                                            {/* Bus dot */}
                                            <div style={{
                                                width: 8, height: 8, borderRadius: '50%',
                                                background: '#34A853', flexShrink: 0,
                                            }}/>

                                            {/* Bus info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{
                                                    margin: 0, fontSize: 13, fontWeight: 600,
                                                    color: '#1A1A1A', fontFamily: 'var(--font)',
                                                }}>
                                                    {bus.plate || `Bus #${bus.busId}`}
                                                </p>
                                                {bus.model && (
                                                    <p style={{ margin: '1px 0 0', fontSize: 11, color: '#8A8D91', fontFamily: 'var(--font)' }}>
                                                        {bus.model}
                                                    </p>
                                                )}
                                            </div>

                                            {/* ETA pill */}
                                            {(bus.eta || bus.distance_text) && (
                                                <div style={{
                                                    display:      'inline-flex',
                                                    alignItems:   'center',
                                                    gap:          4,
                                                    padding:      '3px 9px',
                                                    borderRadius: 9999,
                                                    background:   '#FFF0EB',
                                                    border:       '1px solid rgba(232,69,10,0.2)',
                                                    flexShrink:   0,
                                                }}>
                                                    {/* Clock icon */}
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                                                         stroke="#E8450A" strokeWidth="2.5"
                                                         strokeLinecap="round" strokeLinejoin="round">
                                                        <circle cx="12" cy="12" r="10"/>
                                                        <polyline points="12 6 12 12 16 14"/>
                                                    </svg>
                                                    {bus.eta && (
                                                        <span style={{
                                                            fontSize: 11, fontWeight: 700,
                                                            color: '#E8450A', fontFamily: 'var(--font-mono, monospace)',
                                                        }}>
                              {bus.eta}
                            </span>
                                                    )}
                                                    {bus.eta && bus.distance_text && (
                                                        <span style={{
                                                            width: 3, height: 3, borderRadius: '50%',
                                                            background: 'rgba(232,69,10,0.4)',
                                                            display: 'inline-block',
                                                        }}/>
                                                    )}
                                                    {bus.distance_text && (
                                                        <span style={{
                                                            fontSize: 11, fontWeight: 600,
                                                            color: '#C23A08', fontFamily: 'var(--font-mono, monospace)',
                                                        }}>
                              {bus.distance_text}
                            </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* No ETA yet */}
                                            {!bus.eta && !bus.distance_text && (
                                                <span style={{
                                                    fontSize: 11, color: '#9AA0A6',
                                                    fontFamily: 'var(--font)',
                                                }}>
                          Locating…
                        </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {companies.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Bus size={32} color="#DADCE0" />
                        <p style={{ fontSize: 13, color: '#9AA0A6', marginTop: 8, fontFamily: 'var(--font)' }}>
                            No companies available
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}