'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { Bus, SlidersHorizontal, X, Menu } from 'lucide-react';
import { Company } from '@/lib/types';

interface SidebarProps {
    companies:         Company[];
    activeCompanyIds:  Set<number>;
    busCountByCompany: Map<number, number>;
    onToggleCompany:   (id: number) => void;
    totalActiveBuses:  number;
}

export function Sidebar({
                            companies,
                            activeCompanyIds,
                            busCountByCompany,
                            onToggleCompany,
                            totalActiveBuses,
                        }: SidebarProps) {
    const [open, setOpen] = useState(false);

    const allActive = companies.every((c) => activeCompanyIds.has(c.id));

    const toggleAll = useCallback(() => {
        companies.forEach((c) => {
            const isActive = activeCompanyIds.has(c.id);
            if (allActive && isActive)   onToggleCompany(c.id);
            if (!allActive && !isActive) onToggleCompany(c.id);
        });
    }, [allActive, companies, activeCompanyIds, onToggleCompany]);

    return (
        <>
            {/* ── HAMBURGER BUTTON — always visible on desktop ── */}
            <button
                onClick={() => setOpen((v) => !v)}
                style={{
                    position:       'fixed',
                    top:            'max(14px, env(safe-area-inset-top))',
                    left:           open ? 296 : 16,
                    zIndex:         200,
                    width:          40,
                    height:         40,
                    borderRadius:   12,
                    background:     'rgba(255,255,255,0.95)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border:         '1px solid rgba(255,255,255,0.8)',
                    boxShadow:      '0 2px 12px rgba(0,0,0,0.13)',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    cursor:         'pointer',
                    transition:     'left 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                }}
                aria-label={open ? 'Close sidebar' : 'Open sidebar'}
            >
                {open
                    ? <X    size={18} color="#1A1A1A" strokeWidth={2.5} />
                    : <Menu size={18} color="#1A1A1A" strokeWidth={2.5} />
                }
            </button>

            {/* ── SIDEBAR PANEL ── */}
            <div
                style={{
                    position:       'fixed',
                    top:            0,
                    left:           0,
                    height:         '100%',
                    width:          280,
                    zIndex:         100,
                    background:     '#FFFFFF',
                    boxShadow:      open ? '4px 0 32px rgba(0,0,0,0.12)' : 'none',
                    display:        'flex',
                    flexDirection:  'column',
                    transform:      open ? 'translateX(0)' : 'translateX(-100%)',
                    transition:     'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.35s ease',
                    willChange:     'transform',
                    overflow:       'hidden',
                }}
            >
                {/* ── HEADER ── */}
                <div style={{
                    flexShrink:   0,
                    padding:      '24px 20px 16px',
                    borderBottom: '1px solid #F1F3F4',
                    paddingTop:   'max(24px, env(safe-area-inset-top))',
                }}>
                    {/* Logo row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        <Image
                            src="/logo.jpg"
                            alt="Fleetra"
                            width={36}
                            height={36}
                            style={{ borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div>
                            <p style={{
                                margin:        0,
                                fontSize:      18,
                                fontWeight:    700,
                                color:         '#1A1A1A',
                                letterSpacing: '-0.02em',
                                fontFamily:    'var(--font)',
                            }}>
                                Fleetra
                            </p>
                            <p style={{ margin: 0, fontSize: 11, color: '#8A8D91', fontFamily: 'var(--font)' }}>
                                Live tracking
                            </p>
                        </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <p style={{
                                margin:      0,
                                fontSize:    11,
                                fontWeight:  600,
                                color:       '#1A1A1A',
                                letterSpacing: '0.06em',
                                textTransform: 'uppercase',
                                fontFamily:  'var(--font)',
                            }}>
                                Available Rides
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#8A8D91', fontFamily: 'var(--font)' }}>
                                Select services to display
                            </p>
                        </div>
                        <div style={{
                            display:      'flex',
                            alignItems:   'center',
                            gap:          5,
                            background:   '#FFF0EB',
                            padding:      '4px 10px 4px 6px',
                            borderRadius: 9999,
                            border:       '1px solid rgba(232,69,10,0.15)',
                        }}>
                            <Image src="/miniLogo.jpg" alt="" width={16} height={16} style={{ objectFit: 'contain' }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#E8450A', fontFamily: 'var(--font)' }}>
                {totalActiveBuses}
              </span>
                        </div>
                    </div>
                </div>

                {/* ── COMPANY LIST ── */}
                <div
                    style={{ flex: 1, overflowY: 'auto', padding: '4px 0 24px' }}
                    className="no-scrollbar"
                >
                    {/* Select all */}
                    {companies.length > 1 && (
                        <button
                            onClick={toggleAll}
                            style={{
                                width:         '100%',
                                display:       'flex',
                                alignItems:    'center',
                                gap:           8,
                                padding:       '10px 20px',
                                background:    'none',
                                border:        'none',
                                borderBottom:  '1px solid #F1F3F4',
                                cursor:        'pointer',
                                fontFamily:    'var(--font)',
                            }}
                        >
                            <SlidersHorizontal size={13} color="#E8450A" />
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#E8450A' }}>
                {allActive ? 'Deselect all' : 'Select all'}
              </span>
                        </button>
                    )}

                    {/* Rows */}
                    {companies.map((company) => {
                        const isActive = activeCompanyIds.has(company.id);
                        const busCount = busCountByCompany.get(company.id) ?? 0;

                        return (
                            <button
                                key={company.id}
                                onClick={() => onToggleCompany(company.id)}
                                style={{
                                    width:        '100%',
                                    display:      'flex',
                                    alignItems:   'center',
                                    gap:          12,
                                    padding:      '13px 20px',
                                    background:   'none',
                                    border:       'none',
                                    borderBottom: '1px solid #F1F3F4',
                                    cursor:       'pointer',
                                    textAlign:    'left',
                                    fontFamily:   'var(--font)',
                                    transition:   'background 0.1s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#FFF8F6')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                                {/* Checkbox */}
                                <div style={{
                                    width:          18,
                                    height:         18,
                                    borderRadius:   5,
                                    border:         `2px solid ${isActive ? '#E8450A' : '#DADCE0'}`,
                                    background:     isActive ? '#E8450A' : '#fff',
                                    display:        'flex',
                                    alignItems:     'center',
                                    justifyContent: 'center',
                                    flexShrink:     0,
                                    transition:     'all 0.15s',
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
                                    width:          36,
                                    height:         36,
                                    borderRadius:   10,
                                    background:     '#F8F9FA',
                                    border:         '1px solid #E8EAED',
                                    display:        'flex',
                                    alignItems:     'center',
                                    justifyContent: 'center',
                                    overflow:       'hidden',
                                    flexShrink:     0,
                                    opacity:        isActive ? 1 : 0.35,
                                    transition:     'opacity 0.15s',
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

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{
                                        margin:       0,
                                        fontSize:     14,
                                        fontWeight:   600,
                                        color:        isActive ? '#1A1A1A' : '#9AA0A6',
                                        overflow:     'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace:   'nowrap',
                                        transition:   'color 0.15s',
                                        fontFamily:   'var(--font)',
                                    }}>
                                        {company.name}
                                    </p>
                                    <p style={{
                                        margin:     '2px 0 0',
                                        fontSize:   11,
                                        color:      '#8A8D91',
                                        fontFamily: 'var(--font)',
                                    }}>
                                        {busCount} {busCount === 1 ? 'vehicle' : 'vehicles'} active
                                    </p>
                                </div>

                                {/* Active indicator */}
                                <div style={{
                                    width:          8,
                                    height:         8,
                                    borderRadius:   '50%',
                                    background:     isActive && busCount > 0 ? '#34A853' : 'transparent',
                                    flexShrink:     0,
                                    transition:     'background 0.2s',
                                }}/>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── BACKDROP — tap to close on desktop ── */}
            {open && (
                <div
                    onClick={() => setOpen(false)}
                    style={{
                        position:   'fixed',
                        inset:      0,
                        zIndex:     90,
                        background: 'rgba(0,0,0,0.18)',
                        backdropFilter: 'blur(2px)',
                        WebkitBackdropFilter: 'blur(2px)',
                    }}
                />
            )}
        </>
    );
}