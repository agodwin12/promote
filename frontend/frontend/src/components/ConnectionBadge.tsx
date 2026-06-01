'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, Loader } from 'lucide-react';
import { SocketStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ConnectionBadgeProps {
    status: SocketStatus;
}

const CONFIG = {
    connected: {
        label: 'Live',
        icon:  Wifi,
        class: 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]',
        dot:   'bg-[#34a853]',
        ping:  true,
    },
    connecting: {
        label: 'Connecting',
        icon:  Loader,
        class: 'bg-[#fef7e0] text-[#b06000] border-[#fde293]',
        dot:   'bg-[#fbbc04]',
        ping:  false,
    },
    disconnected: {
        label: 'Offline',
        icon:  WifiOff,
        class: 'bg-[#fce8e6] text-[#c5221f] border-[#f5c6c2]',
        dot:   'bg-[#ea4335]',
        ping:  false,
    },
    error: {
        label: 'Error',
        icon:  WifiOff,
        class: 'bg-[#fce8e6] text-[#c5221f] border-[#f5c6c2]',
        dot:   'bg-[#ea4335]',
        ping:  false,
    },
} as const;

export function ConnectionBadge({ status }: ConnectionBadgeProps) {
    const config = CONFIG[status];
    const Icon   = config.icon;

    return (
        <div className="absolute top-4 right-4 z-[20] pointer-events-none">
            <AnimatePresence mode="wait">
                <motion.div
                    key={status}
                    initial={{ opacity: 0, y: -8, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0,  scale: 1   }}
                    exit={{    opacity: 0, y: -8, scale: 0.9 }}
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5',
                        'rounded-full border text-[11px] font-semibold',
                        'shadow-[0_1px_4px_rgba(0,0,0,0.12)]',
                        'glass',
                        config.class
                    )}
                >
                    {/* Dot indicator */}
                    <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
            {config.ping && (
                <span
                    className={cn(
                        'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                        config.dot
                    )}
                />
            )}
                        <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', config.dot)} />
          </span>

                    {/* Icon */}
                    <Icon
                        className={cn(
                            'w-3 h-3 flex-shrink-0',
                            status === 'connecting' && 'animate-spin-smooth'
                        )}
                        strokeWidth={2.5}
                    />

                    {/* Label */}
                    <span>{config.label}</span>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}