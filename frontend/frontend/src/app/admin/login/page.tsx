'use client';

import { useState, useEffect } from 'react';
import { useRouter }           from 'next/navigation';
import { useAdmin }            from '@/hooks/useAdmin';

export default function AdminLoginPage() {
    const router              = useRouter();
    const { login, isLoading, error, isLoggedIn } = useAdmin();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Already logged in → go straight to dashboard
    useEffect(() => {
        if (!isLoading && isLoggedIn) router.replace('/admin/dashboard');
    }, [isLoading, isLoggedIn, router]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        const ok = await login(username, password);
        if (ok) router.replace('/admin/dashboard');
        setSubmitting(false);
    }

    if (isLoading) return null; // avoid flash before redirect check

    return (
        <div style={{
            minHeight:       '100vh',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            background:      '#F8F9FA',
            fontFamily:      'Google Sans, sans-serif',
        }}>
            <div style={{
                background:   '#fff',
                borderRadius: 20,
                padding:      '48px 40px',
                width:        '100%',
                maxWidth:     420,
                boxShadow:    '0 4px 40px rgba(0,0,0,0.10)',
            }}>
                {/* Logo + title */}
                <div style={{ textAlign: 'center', marginBottom: 36 }}>
                    <div style={{
                        width:        56,
                        height:       56,
                        borderRadius: '50%',
                        background:   '#FF6B00',
                        display:      'flex',
                        alignItems:   'center',
                        justifyContent: 'center',
                        margin:       '0 auto 16px',
                    }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <rect x="2" y="4" width="20" height="14" rx="3" fill="white"/>
                            <rect x="4" y="6" width="16" height="5" rx="2" fill="rgba(255,107,0,0.4)"/>
                            <circle cx="6.5" cy="19" r="2.2" fill="white"/>
                            <circle cx="17.5" cy="19" r="2.2" fill="white"/>
                        </svg>
                    </div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                        Fleetra Admin
                    </h1>
                    <p style={{ fontSize: 14, color: '#6B7280', marginTop: 6 }}>
                        Sign in to manage your fleet
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Error banner */}
                    {error && (
                        <div style={{
                            background:   '#FEF2F2',
                            border:       '1px solid #FECACA',
                            borderRadius: 10,
                            padding:      '12px 16px',
                            marginBottom: 20,
                            fontSize:     14,
                            color:        '#DC2626',
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Username */}
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="admin"
                            autoComplete="username"
                            required
                            style={{
                                width:        '100%',
                                padding:      '12px 14px',
                                borderRadius: 10,
                                border:       '1.5px solid #E5E7EB',
                                fontSize:     15,
                                outline:      'none',
                                boxSizing:    'border-box',
                                transition:   'border-color 0.2s',
                            }}
                            onFocus={e  => e.target.style.borderColor = '#FF6B00'}
                            onBlur={e   => e.target.style.borderColor = '#E5E7EB'}
                        />
                    </div>

                    {/* Password */}
                    <div style={{ marginBottom: 28 }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            required
                            style={{
                                width:        '100%',
                                padding:      '12px 14px',
                                borderRadius: 10,
                                border:       '1.5px solid #E5E7EB',
                                fontSize:     15,
                                outline:      'none',
                                boxSizing:    'border-box',
                                transition:   'border-color 0.2s',
                            }}
                            onFocus={e  => e.target.style.borderColor = '#FF6B00'}
                            onBlur={e   => e.target.style.borderColor = '#E5E7EB'}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || !username || !password}
                        style={{
                            width:        '100%',
                            padding:      '14px',
                            borderRadius: 10,
                            border:       'none',
                            background:   submitting || !username || !password ? '#D1D5DB' : '#FF6B00',
                            color:        '#fff',
                            fontSize:     15,
                            fontWeight:   700,
                            cursor:       submitting || !username || !password ? 'not-allowed' : 'pointer',
                            transition:   'background 0.2s',
                            fontFamily:   'Google Sans, sans-serif',
                        }}
                    >
                        {submitting ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>
            </div>
        </div>
    );
}