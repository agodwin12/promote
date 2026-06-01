'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API_URL    = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const TOKEN_KEY  = 'fleetra_admin_token';

export interface AdminState {
    token:      string | null;
    isLoading:  boolean;
    error:      string | null;
}

export function useAdmin() {
    const router = useRouter();

    const [state, setState] = useState<AdminState>({
        token:     null,
        isLoading: true,
        error:     null,
    });

    // ── On mount: verify stored token ──────────────────────────────────────────
    useEffect(() => {
        const stored = localStorage.getItem(TOKEN_KEY);
        if (!stored) {
            setState({ token: null, isLoading: false, error: null });
            return;
        }

        // Verify token is still valid with the backend
        fetch(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${stored}` },
        })
            .then((r) => {
                if (r.ok) {
                    setState({ token: stored, isLoading: false, error: null });
                } else {
                    localStorage.removeItem(TOKEN_KEY);
                    setState({ token: null, isLoading: false, error: null });
                }
            })
            .catch(() => {
                // Network error — keep token, assume valid
                setState({ token: stored, isLoading: false, error: null });
            });
    }, []);

    // ── Login ──────────────────────────────────────────────────────────────────
    const login = useCallback(async (username: string, password: string): Promise<boolean> => {
        setState(s => ({ ...s, isLoading: true, error: null }));

        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ username, password }),
            });

            const json = await res.json();

            if (!res.ok) {
                setState({ token: null, isLoading: false, error: json.error || 'Login failed' });
                return false;
            }

            const token = json.data.token;
            localStorage.setItem(TOKEN_KEY, token);
            setState({ token, isLoading: false, error: null });
            return true;

        } catch {
            setState({ token: null, isLoading: false, error: 'Network error — is the server running?' });
            return false;
        }
    }, []);

    // ── Logout ─────────────────────────────────────────────────────────────────
    const logout = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        setState({ token: null, isLoading: false, error: null });
        router.push('/admin/login');
    }, [router]);

    // ── Authenticated fetch helper ─────────────────────────────────────────────
    // Wraps fetch with the Authorization header. Redirects to login on 401.
    const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
        const token = localStorage.getItem(TOKEN_KEY);
        const res   = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });

        if (res.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            setState({ token: null, isLoading: false, error: null });
            router.push('/admin/login');
        }

        return res;
    }, [router]);

    return {
        token:      state.token,
        isLoading:  state.isLoading,
        error:      state.error,
        isLoggedIn: !!state.token,
        login,
        logout,
        authFetch,
    };
}