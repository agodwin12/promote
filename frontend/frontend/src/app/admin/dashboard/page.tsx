'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter }  from 'next/navigation';
import Image          from 'next/image';
import { useAdmin }   from '@/hooks/useAdmin';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Company {
    id:         number;
    name:       string;
    slug:       string;
    logo_url:   string | null;
    created_at: string;
}

interface Bus {
    id:         number;
    company_id: number;
    plate:      string;
    model:      string | null;
    mac_id:     string;
    created_at: string;
}

type Modal =
    | { type: 'none' }
    | { type: 'add-company' }
    | { type: 'edit-company';  company: Company }
    | { type: 'delete-company';company: Company }
    | { type: 'add-bus';       companyId: number }
    | { type: 'edit-bus';      bus: Bus }
    | { type: 'delete-bus';    bus: Bus };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                {label}
            </label>
            <input
                {...props}
                style={{
                    width: '100%', padding: '10px 12px', borderRadius: 8,
                    border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none',
                    boxSizing: 'border-box', fontFamily: 'Google Sans, sans-serif',
                    ...props.style,
                }}
                onFocus={e  => { e.target.style.borderColor = '#FF6B00'; props.onFocus?.(e); }}
                onBlur={e   => { e.target.style.borderColor = '#E5E7EB'; props.onBlur?.(e); }}
            />
        </div>
    );
}

function Btn({ children, variant = 'primary', ...props }: { variant?: 'primary' | 'danger' | 'ghost' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
    const bg = props.disabled ? '#D1D5DB' : variant === 'primary' ? '#FF6B00' : variant === 'danger' ? '#DC2626' : 'transparent';
    const color = variant === 'ghost' ? '#6B7280' : '#fff';
    return (
        <button {...props} style={{
            padding: '9px 18px', borderRadius: 8, border: variant === 'ghost' ? '1.5px solid #E5E7EB' : 'none',
            background: bg, color, fontSize: 14, fontWeight: 600, cursor: props.disabled ? 'not-allowed' : 'pointer',
            fontFamily: 'Google Sans, sans-serif', transition: 'background 0.15s', ...props.style,
        }}>
            {children}
        </button>
    );
}

// ─── Modal shell ─────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={onClose}>
            <div style={{
                background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 460,
                boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto',
            }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1A1A1A' }}>{title}</h3>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#9CA3AF', lineHeight: 1 }}>×</button>
                </div>
                {children}
            </div>
        </div>
    );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
    const router                = useRouter();
    const { isLoading, isLoggedIn, logout, authFetch } = useAdmin();

    const [companies, setCompanies] = useState<Company[]>([]);
    const [buses,     setBuses]     = useState<Bus[]>([]);
    const [modal,     setModal]     = useState<Modal>({ type: 'none' });
    const [saving,    setSaving]    = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [toast,     setToast]     = useState<string | null>(null);

    // Redirect if not logged in
    useEffect(() => {
        if (!isLoading && !isLoggedIn) router.replace('/admin/login');
    }, [isLoading, isLoggedIn, router]);

    // ── Load data ──────────────────────────────────────────────────────────────

    const loadCompanies = useCallback(async () => {
        const res  = await authFetch(`${API_URL}/api/companies`);
        const json = await res.json();
        if (json.success) setCompanies(json.data);
    }, [authFetch]);

    const loadBuses = useCallback(async () => {
        const res  = await authFetch(`${API_URL}/api/buses`);
        const json = await res.json();
        if (json.success) setBuses(json.data);
    }, [authFetch]);

    useEffect(() => {
        if (isLoggedIn) { loadCompanies(); loadBuses(); }
    }, [isLoggedIn, loadCompanies, loadBuses]);

    // ── Toast ──────────────────────────────────────────────────────────────────

    function showToast(msg: string) {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    }

    function closeModal() { setModal({ type: 'none' }); setFormError(null); }

    // ─────────────────────────────────────────────────────────────────────────
    // COMPANY FORMS
    // ─────────────────────────────────────────────────────────────────────────

    function CompanyForm({ existing }: { existing?: Company }) {
        const [name,    setName]    = useState(existing?.name    ?? '');
        const [logoFile, setLogoFile] = useState<File | null>(null);
        const fileRef = useRef<HTMLInputElement>(null);

        async function submit(e: React.FormEvent) {
            e.preventDefault();
            setFormError(null);
            setSaving(true);

            const fd = new FormData();
            fd.append('name', name);
            if (logoFile) fd.append('logo', logoFile);

            const url    = existing ? `${API_URL}/api/companies/${existing.id}` : `${API_URL}/api/companies`;
            const method = existing ? 'PUT' : 'POST';

            try {
                const res  = await authFetch(url, { method, body: fd });
                const json = await res.json();

                if (!res.ok) { setFormError(json.error || 'Failed'); setSaving(false); return; }

                await loadCompanies();
                closeModal();
                showToast(existing ? 'Company updated' : 'Company created');
            } catch {
                setFormError('Network error');
            } finally {
                setSaving(false);
            }
        }

        return (
            <form onSubmit={submit}>
                {formError && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#DC2626' }}>{formError}</div>}
                <Input label="Company name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Comfort Bus" required />

                {/* Logo upload */}
                <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                        Logo {existing && <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(leave empty to keep current)</span>}
                    </label>
                    <div
                        onClick={() => fileRef.current?.click()}
                        style={{
                            border: '2px dashed #E5E7EB', borderRadius: 10, padding: '20px',
                            textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = '#FF6B00')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
                    >
                        {logoFile
                            ? <span style={{ fontSize: 13, color: '#374151' }}>📎 {logoFile.name}</span>
                            : existing?.logo_url
                                ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                                    <Image src={existing.logo_url} alt="" width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover' }} />
                                    <span style={{ fontSize: 13, color: '#6B7280' }}>Click to replace</span>
                                </div>
                                : <span style={{ fontSize: 13, color: '#9CA3AF' }}>Click to upload logo (JPEG, PNG, WebP, SVG · max 5 MB)</span>
                        }
                        <input
                            ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => setLogoFile(e.target.files?.[0] ?? null)}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <Btn variant="ghost" type="button" onClick={closeModal}>Cancel</Btn>
                    <Btn type="submit" disabled={saving || !name}>{saving ? 'Saving…' : existing ? 'Update' : 'Create'}</Btn>
                </div>
            </form>
        );
    }

    async function deleteCompany(company: Company) {
        setSaving(true);
        try {
            const res = await authFetch(`${API_URL}/api/companies/${company.id}`, { method: 'DELETE' });
            if (res.ok) { await loadCompanies(); await loadBuses(); closeModal(); showToast(`"${company.name}" deleted`); }
            else { const j = await res.json(); setFormError(j.error || 'Failed'); }
        } finally { setSaving(false); }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BUS FORMS
    // ─────────────────────────────────────────────────────────────────────────

    function BusForm({ existing, defaultCompanyId }: { existing?: Bus; defaultCompanyId?: number }) {
        const [companyId, setCompanyId] = useState<string>(String(existing?.company_id ?? defaultCompanyId ?? ''));
        const [plate,  setPlate]  = useState(existing?.plate  ?? '');
        const [model,  setModel]  = useState(existing?.model  ?? '');
        const [macId,  setMacId]  = useState(existing?.mac_id ?? '');

        async function submit(e: React.FormEvent) {
            e.preventDefault();
            setFormError(null);
            setSaving(true);

            const body   = JSON.stringify({ company_id: Number(companyId), plate, model: model || null, mac_id: macId });
            const url    = existing ? `${API_URL}/api/buses/${existing.id}` : `${API_URL}/api/buses`;
            const method = existing ? 'PUT' : 'POST';

            try {
                const res  = await authFetch(url, { method, body, headers: { 'Content-Type': 'application/json' } });
                const json = await res.json();

                if (!res.ok) { setFormError(json.error || 'Failed'); setSaving(false); return; }

                await loadBuses();
                closeModal();
                showToast(existing ? 'Bus updated' : 'Bus registered');
            } catch {
                setFormError('Network error');
            } finally {
                setSaving(false);
            }
        }

        return (
            <form onSubmit={submit}>
                {formError && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#DC2626' }}>{formError}</div>}

                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Company</label>
                    <select
                        value={companyId}
                        onChange={e => setCompanyId(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff', fontFamily: 'Google Sans, sans-serif' }}
                    >
                        <option value="">Select company…</option>
                        {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <Input label="Plate number" value={plate} onChange={e => setPlate(e.target.value)} placeholder="e.g. LT 1234 A" required />
                <Input label="Model (optional)" value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. Toyota Coaster" />
                <Input label="GPS Device MAC ID" value={macId} onChange={e => setMacId(e.target.value)} placeholder="e.g. 0867123456AB" required />

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                    <Btn variant="ghost" type="button" onClick={closeModal}>Cancel</Btn>
                    <Btn type="submit" disabled={saving || !plate || !macId || !companyId}>
                        {saving ? 'Saving…' : existing ? 'Update' : 'Register'}
                    </Btn>
                </div>
            </form>
        );
    }

    async function deleteBus(bus: Bus) {
        setSaving(true);
        try {
            const res = await authFetch(`${API_URL}/api/buses/${bus.id}`, { method: 'DELETE' });
            if (res.ok) { await loadBuses(); closeModal(); showToast(`Bus "${bus.plate}" deleted`); }
            else { const j = await res.json(); setFormError(j.error || 'Failed'); }
        } finally { setSaving(false); }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    if (isLoading || !isLoggedIn) return null;

    return (
        <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: 'Google Sans, sans-serif' }}>

            {/* Header */}
            <header style={{
                background: '#fff', borderBottom: '1px solid #E5E7EB',
                padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                position: 'sticky', top: 0, zIndex: 10,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#FF6B00', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <rect x="2" y="4" width="20" height="14" rx="3" fill="white"/>
                            <circle cx="6.5" cy="19" r="2.2" fill="white"/>
                            <circle cx="17.5" cy="19" r="2.2" fill="white"/>
                        </svg>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 17, color: '#1A1A1A' }}>Fleetra Admin</span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <a href="/" style={{ fontSize: 13, color: '#6B7280', textDecoration: 'none' }}>← Back to map</a>
                    <Btn variant="ghost" onClick={logout} style={{ padding: '7px 14px', fontSize: 13 }}>Sign out</Btn>
                </div>
            </header>

            <main style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>

                {/* ── COMPANIES ─────────────────────────────────────────── */}
                <section style={{ marginBottom: 48 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1A1A1A' }}>Companies</h2>
                            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>{companies.length} registered</p>
                        </div>
                        <Btn onClick={() => setModal({ type: 'add-company' })}>+ Add Company</Btn>
                    </div>

                    {companies.length === 0
                        ? <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', color: '#9CA3AF', fontSize: 14 }}>
                            No companies yet — add your first one above
                        </div>
                        : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                            {companies.map(company => {
                                const busCount = buses.filter(b => b.company_id === company.id).length;
                                return (
                                    <div key={company.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            {company.logo_url
                                                ? <Image src={company.logo_url} alt={company.name} width={44} height={44} style={{ borderRadius: '50%', objectFit: 'cover', border: '1px solid #E5E7EB' }} />
                                                : <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏢</div>
                                            }
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: 15, color: '#1A1A1A' }}>{company.name}</div>
                                                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{busCount} bus{busCount !== 1 ? 'es' : ''}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <Btn variant="ghost" onClick={() => setModal({ type: 'add-bus', companyId: company.id })} style={{ fontSize: 12, padding: '6px 12px', flex: 1 }}>+ Bus</Btn>
                                            <Btn variant="ghost" onClick={() => setModal({ type: 'edit-company', company })} style={{ fontSize: 12, padding: '6px 12px' }}>Edit</Btn>
                                            <Btn variant="danger"  onClick={() => setModal({ type: 'delete-company', company })} style={{ fontSize: 12, padding: '6px 12px' }}>Delete</Btn>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    }
                </section>

                {/* ── BUSES ─────────────────────────────────────────────── */}
                <section>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1A1A1A' }}>All Buses</h2>
                            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>{buses.length} registered</p>
                        </div>
                        <Btn onClick={() => setModal({ type: 'add-bus', companyId: 0 })}>+ Add Bus</Btn>
                    </div>

                    {buses.length === 0
                        ? <div style={{ textAlign: 'center', padding: '40px', background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', color: '#9CA3AF', fontSize: 14 }}>
                            No buses yet — add one from a company above
                        </div>
                        : <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                                <thead>
                                <tr style={{ background: '#F8F9FA', borderBottom: '1px solid #E5E7EB' }}>
                                    {['Plate', 'Model', 'MAC ID', 'Company', 'Actions'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#6B7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                    ))}
                                </tr>
                                </thead>
                                <tbody>
                                {buses.map((bus, i) => {
                                    const company = companies.find(c => c.id === bus.company_id);
                                    return (
                                        <tr key={bus.id} style={{ borderBottom: i < buses.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                                            <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1A1A1A' }}>{bus.plate}</td>
                                            <td style={{ padding: '12px 16px', color: '#6B7280' }}>{bus.model || '—'}</td>
                                            <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, color: '#374151' }}>{bus.mac_id}</td>
                                            <td style={{ padding: '12px 16px', color: '#374151' }}>{company?.name ?? '—'}</td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <Btn variant="ghost" onClick={() => setModal({ type: 'edit-bus', bus })} style={{ fontSize: 12, padding: '5px 12px' }}>Edit</Btn>
                                                    <Btn variant="danger" onClick={() => setModal({ type: 'delete-bus', bus })} style={{ fontSize: 12, padding: '5px 12px' }}>Delete</Btn>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    }
                </section>
            </main>

            {/* ── MODALS ────────────────────────────────────────────────── */}

            {modal.type === 'add-company' && (
                <Modal title="Add Company" onClose={closeModal}><CompanyForm /></Modal>
            )}
            {modal.type === 'edit-company' && (
                <Modal title="Edit Company" onClose={closeModal}><CompanyForm existing={modal.company} /></Modal>
            )}
            {modal.type === 'delete-company' && (
                <Modal title="Delete Company" onClose={closeModal}>
                    {formError && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#DC2626' }}>{formError}</div>}
                    <p style={{ fontSize: 14, color: '#374151', marginTop: 0 }}>
                        Are you sure you want to delete <strong>{modal.company.name}</strong>?
                        This will also delete all its buses and location history. This action cannot be undone.
                    </p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <Btn variant="ghost" onClick={closeModal}>Cancel</Btn>
                        <Btn variant="danger" disabled={saving} onClick={() => deleteCompany(modal.company)}>
                            {saving ? 'Deleting…' : 'Delete permanently'}
                        </Btn>
                    </div>
                </Modal>
            )}
            {modal.type === 'add-bus' && (
                <Modal title="Register Bus" onClose={closeModal}>
                    <BusForm defaultCompanyId={modal.companyId || undefined} />
                </Modal>
            )}
            {modal.type === 'edit-bus' && (
                <Modal title="Edit Bus" onClose={closeModal}><BusForm existing={modal.bus} /></Modal>
            )}
            {modal.type === 'delete-bus' && (
                <Modal title="Delete Bus" onClose={closeModal}>
                    {formError && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#DC2626' }}>{formError}</div>}
                    <p style={{ fontSize: 14, color: '#374151', marginTop: 0 }}>
                        Delete bus <strong>{modal.bus.plate}</strong>? All its location history will also be removed.
                    </p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <Btn variant="ghost" onClick={closeModal}>Cancel</Btn>
                        <Btn variant="danger" disabled={saving} onClick={() => deleteBus(modal.bus)}>
                            {saving ? 'Deleting…' : 'Delete permanently'}
                        </Btn>
                    </div>
                </Modal>
            )}

            {/* ── TOAST ─────────────────────────────────────────────────── */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                    background: '#1A1A1A', color: '#fff', padding: '12px 24px', borderRadius: 10,
                    fontSize: 14, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 2000,
                }}>
                    ✓ {toast}
                </div>
            )}
        </div>
    );
}