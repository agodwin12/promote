import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    output: 'standalone',

    allowedDevOrigins: ['169.254.123.59'],

    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.r2.dev',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: '**.cloudflarestorage.com',
                pathname: '/**',
            },
            {
                protocol: 'http',
                hostname: 'localhost',
                pathname: '/**',
            },
        ],
    },

    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options',  value: 'nosniff'       },
                    { key: 'X-Frame-Options',         value: 'DENY'          },
                    { key: 'X-XSS-Protection',        value: '1; mode=block' },
                    { key: 'Referrer-Policy',         value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy',      value: 'geolocation=(self), camera=()' },
                ],
            },
        ];
    },
};

export default nextConfig;