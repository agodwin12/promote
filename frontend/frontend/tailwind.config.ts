import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
        './src/hooks/**/*.{js,ts,jsx,tsx,mdx}',
        './src/lib/**/*.{js,ts,jsx,tsx,mdx}',
    ],

    theme: {
        extend: {
            // ── FONTS ──────────────────────────
            fontFamily: {
                jakarta: ['var(--font-jakarta)', 'sans-serif'],
                mono:    ['var(--font-mono)', 'monospace'],
            },

            // ── COLORS ─────────────────────────
            colors: {
                primary: {
                    DEFAULT: '#1a73e8',
                    dark:    '#1557b0',
                    light:   '#e8f0fe',
                },
                bus: {
                    green: '#34a853',
                    blue:  '#1a73e8',
                    grey:  '#9aa0a6',
                },
                surface: {
                    1: '#ffffff',
                    2: '#f8f9fa',
                    3: '#f1f3f4',
                },
                text: {
                    primary:   '#202124',
                    secondary: '#5f6368',
                    tertiary:  '#9aa0a6',
                },
                border: {
                    DEFAULT: '#e8eaed',
                    strong:  '#dadce0',
                },
            },

            // ── BORDER RADIUS ──────────────────
            borderRadius: {
                '2xl': '16px',
                '3xl': '24px',
                '4xl': '32px',
            },

            // ── BOX SHADOWS ────────────────────
            boxShadow: {
                'card':    '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
                'card-lg': '0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
                'pill':    '0 2px 8px rgba(0,0,0,0.18)',
                'sheet':   '0 -4px 24px rgba(0,0,0,0.10), 0 -1px 4px rgba(0,0,0,0.06)',
            },

            // ── ANIMATIONS ─────────────────────
            keyframes: {
                'location-pulse': {
                    '0%':   { transform: 'scale(1)',   opacity: '0.6' },
                    '100%': { transform: 'scale(2.8)', opacity: '0'   },
                },
                'marker-bounce': {
                    '0%':   { transform: 'translateY(0) scale(1)'      },
                    '30%':  { transform: 'translateY(-6px) scale(1.1)' },
                    '60%':  { transform: 'translateY(-2px) scale(1.05)' },
                    '100%': { transform: 'translateY(0) scale(1)'      },
                },
                'slide-up': {
                    'from': { transform: 'translateY(8px)', opacity: '0' },
                    'to':   { transform: 'translateY(0)',   opacity: '1' },
                },
                'fade-in': {
                    'from': { opacity: '0' },
                    'to':   { opacity: '1' },
                },
                'scale-in': {
                    'from': { transform: 'scale(0.95)', opacity: '0' },
                    'to':   { transform: 'scale(1)',    opacity: '1' },
                },
                'sheet-up': {
                    'from': { transform: 'translateY(100%)' },
                    'to':   { transform: 'translateY(0)'    },
                },
                'shimmer': {
                    '0%':   { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition:  '200% 0' },
                },
                'spin-smooth': {
                    'from': { transform: 'rotate(0deg)'   },
                    'to':   { transform: 'rotate(360deg)' },
                },
            },

            animation: {
                'location-pulse': 'location-pulse 2s ease-out infinite',
                'marker-bounce':  'marker-bounce 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                'slide-up':       'slide-up 0.3s cubic-bezier(0,0,0.2,1) forwards',
                'fade-in':        'fade-in 0.25s cubic-bezier(0,0,0.2,1) forwards',
                'scale-in':       'scale-in 0.2s cubic-bezier(0.34,1.56,0.64,1) forwards',
                'sheet-up':       'sheet-up 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
                'shimmer':        'shimmer 1.4s ease infinite',
                'spin-smooth':    'spin-smooth 0.8s linear infinite',
            },

            // ── SPACING ─────────────────────────
            spacing: {
                'safe-bottom': 'env(safe-area-inset-bottom)',
                'safe-top':    'env(safe-area-inset-top)',
            },
        },
    },

    plugins: [],
};

export default config;