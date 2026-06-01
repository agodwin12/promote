'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery }                                   from '@tanstack/react-query';
import Image                                          from 'next/image';
import { companiesApi }                               from '@/lib/api';
import { Company, BusWithLocation }                   from '@/lib/types';
import { useSocket, SeedBus }                         from '@/hooks/useSocket';
import { useGeolocation }                             from '@/hooks/useGeolocation';
import { MapView }                                    from '@/components/MapView';
import { BottomSheet }                                from '@/components/BottomSheet';
import { Sidebar }                                    from '@/components/Sidebar';
import { ConnectionBadge }                            from '@/components/ConnectionBadge';
import { LocationPermissionScreen }                   from '@/components/LocationPermissionScreen';

type BusWithCompany = BusWithLocation & { company_id: number };

export default function HomePage() {
    const [activeCompanyIds, setActiveCompanyIds] = useState<Set<number>>(new Set());
    const [hasInitialised,   setHasInitialised]   = useState(false);
    const [hasSeeded,        setHasSeeded]         = useState(false);

    // ── FETCH COMPANIES ──────────────────────────────────────────────────────
    const { data: companies = [] } = useQuery<Company[]>({
        queryKey:  ['companies'],
        queryFn:   companiesApi.getAll,
        staleTime: 60_000,
    });

    // Build a fast companyId → logo_url lookup so we can attach logos to seeds
    const companyLogoMap = useMemo(() => {
        const map = new Map<number, string | null>();
        companies.forEach((c) => map.set(c.id, c.logo_url));
        return map;
    }, [companies]);

    // ── FETCH BUSES ──────────────────────────────────────────────────────────
    const { data: allBuses } = useQuery<BusWithCompany[]>({
        queryKey: ['all-buses', companies.map((c) => c.id).join(',')],
        queryFn:  async (): Promise<BusWithCompany[]> => {
            const results = await Promise.allSettled(
                companies.map((c: Company) =>
                    companiesApi.getBuses(c.id).then((buses: BusWithLocation[]) =>
                        buses.map((b: BusWithLocation): BusWithCompany => ({
                            ...b,
                            company_id: c.id,
                        }))
                    )
                )
            );
            return results
                .filter((r): r is PromiseFulfilledResult<BusWithCompany[]> => r.status === 'fulfilled')
                .flatMap((r) => r.value);
        },
        enabled:   companies.length > 0,
        staleTime: 30_000,
    });

    const busList: BusWithCompany[] = allBuses ?? [];

    // ── GEOLOCATION ──────────────────────────────────────────────────────────
    const { location: userLocation, status: geoStatus, requestLocation } = useGeolocation();

    // ── SOCKET ───────────────────────────────────────────────────────────────
    const allCompanyIds = useMemo(() => companies.map((c) => c.id), [companies]);
    const {
        status:             socketStatus,
        busMarkers,
        isConnected,
        updateUserLocation,
        seedMarkers,
    } = useSocket({ companyIds: allCompanyIds, userLocation });

    // ── SEED MARKERS ─────────────────────────────────────────────────────────
    // Pre-populate the map from the REST response so buses are visible
    // immediately — before the first 10-second GPS tick arrives.
    // logoUrl is resolved from the companyLogoMap so markers show company logos
    // from the start rather than the generic bus SVG.
    useEffect(() => {
        if (busList.length === 0 || hasSeeded) return;
        // Wait until companyLogoMap is populated before seeding
        if (companyLogoMap.size === 0) return;

        const seeds: SeedBus[] = busList
            .filter((b) => b.location !== null)
            .map((b): SeedBus => ({
                id:        b.id,
                plate:     b.plate,
                model:     b.model,
                companyId: b.company_id,
                // ✅ Attach logo so the marker ring shows the company image
                logoUrl:   companyLogoMap.get(b.company_id) ?? null,
                location:  b.location ? {
                    latitude:  parseFloat(String(b.location.latitude)),
                    longitude: parseFloat(String(b.location.longitude)),
                    speed:     parseFloat(String(b.location.speed ?? 0)),
                    direction: b.location.direction,
                } : null,
            }));

        seedMarkers(seeds);
        setHasSeeded(true);

        console.info(`[Page] Seeded ${seeds.length} bus marker(s) from REST API`);
    }, [busList, companyLogoMap, seedMarkers, hasSeeded]);

    // ── INIT FILTER ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (companies.length > 0 && !hasInitialised) {
            setActiveCompanyIds(new Set(companies.map((c) => c.id)));
            setHasInitialised(true);
        }
    }, [companies, hasInitialised]);

    // ── LOCATION SYNC ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (userLocation) updateUserLocation(userLocation);
    }, [userLocation, updateUserLocation]);

    // ── FILTER ────────────────────────────────────────────────────────────────
    const toggleCompany = useCallback((companyId: number) => {
        setActiveCompanyIds((prev) => {
            const next = new Set(prev);
            next.has(companyId) ? next.delete(companyId) : next.add(companyId);
            return next;
        });
    }, []);

    const filteredMarkers = useMemo(
        () => Array.from(busMarkers.values()).filter((m) => activeCompanyIds.has(m.companyId)),
        [busMarkers, activeCompanyIds]
    );

    const busCountByCompany = useMemo(() => {
        const counts = new Map<number, number>();
        busMarkers.forEach((m) => counts.set(m.companyId, (counts.get(m.companyId) ?? 0) + 1));
        return counts;
    }, [busMarkers]);

    // ── PERMISSION GATE ───────────────────────────────────────────────────────
    if (geoStatus === 'denied' || geoStatus === 'unavailable') {
        return <LocationPermissionScreen status={geoStatus} onRetry={requestLocation} />;
    }

    // ── SHARED PROPS ──────────────────────────────────────────────────────────
    const sharedProps = {
        companies,
        activeCompanyIds,
        busCountByCompany,
        onToggleCompany:  toggleCompany,
        totalActiveBuses: filteredMarkers.length,
        busMarkers:       filteredMarkers,
    };

    return (
        <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>

            {/* ── MAP — full-screen base layer ── */}
            <div style={{ position: 'absolute', inset: 0 }}>
                <MapView
                    busMarkers={filteredMarkers}
                    isConnected={isConnected}
                    companies={companies}
                />
            </div>

            {/* ── HEADER — floats above map ── */}
            <header style={{
                position:       'absolute',
                top:            0,
                left:           0,
                right:          0,
                zIndex:         50,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                padding:        '10px 16px',
                paddingTop:     'max(10px, env(safe-area-inset-top))',
                pointerEvents:  'none',
            }}>
                {/* Logo pill — mobile only; desktop has the sidebar */}
                <div id="header-logo" style={{ pointerEvents: 'auto' }}>
                    <div style={{
                        display:             'flex',
                        alignItems:          'center',
                        background:          'rgba(255,255,255,0.95)',
                        backdropFilter:      'blur(20px)',
                        WebkitBackdropFilter:'blur(20px)',
                        borderRadius:        9999,
                        padding:             '5px 14px 5px 5px',
                        boxShadow:           '0 2px 16px rgba(0,0,0,0.13)',
                        border:              '1px solid rgba(255,255,255,0.8)',
                        gap:                 2,
                    }}>
                        <Image
                            src="/logo.jpg"
                            alt="Fleetra"
                            width={32}
                            height={32}
                            style={{ borderRadius: '50%', objectFit: 'cover' }}
                            priority
                        />
                        <span style={{
                            fontSize:      17,
                            fontWeight:    700,
                            color:         '#1A1A1A',
                            letterSpacing: '-0.02em',
                            fontFamily:    'var(--font)',
                            paddingLeft:   6,
                        }}>
                            Fleetra
                        </span>
                    </div>
                </div>

                <div style={{ pointerEvents: 'auto' }}>
                    <ConnectionBadge status={socketStatus} />
                </div>
            </header>

            <style>{`
                @media (min-width: 768px) {
                    #header-logo { display: none !important; }
                }
            `}</style>

            {/* ── MOBILE: bottom sheet ── */}
            <div id="mobile-layout">
                <BottomSheet {...sharedProps} />
            </div>

            {/* ── DESKTOP: sidebar ── */}
            <div id="desktop-layout" style={{ display: 'none' }}>
                <Sidebar {...sharedProps} />
            </div>

            <style>{`
                @media (min-width: 768px) {
                    #mobile-layout  { display: none !important; }
                    #desktop-layout { display: block !important; }
                }
            `}</style>
        </div>
    );
}