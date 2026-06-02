import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
    title:       'Fleetra x Promote - Suivi Bus',
    description: 'Track your bus in real time. Know exactly when it arrives.',
    icons: { icon: '/favicon.ico' },
};

export const viewport: Viewport = {
    width:        'device-width',
    initialScale: 1,
    maximumScale: 1,
    themeColor:   '#E8450A',
    viewportFit:  'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
        <head>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
                href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap"
                rel="stylesheet"
            />
        </head>
        <body suppressHydrationWarning>
        <Providers>{children}</Providers>
        </body>
        </html>
    );
}