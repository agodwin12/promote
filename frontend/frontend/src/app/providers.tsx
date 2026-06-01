'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
    // Create QueryClient inside useState so each request gets
    // a fresh client — prevents data sharing between users in SSR
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime:            60 * 1000, // 1 minute
                        gcTime:               5 * 60 * 1000, // 5 minutes
                        retry:                2,
                        retryDelay:           (attempt) => Math.min(300 * 2 ** attempt, 10000),
                        refetchOnWindowFocus: false,
                        refetchOnReconnect:   true,
                    },
                    mutations: {
                        retry: 0,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}