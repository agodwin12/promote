'use client';

import { motion } from 'framer-motion';
import { MapPin, AlertCircle, RefreshCw } from 'lucide-react';
import { GeolocationStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

interface LocationPermissionScreenProps {
    status:   GeolocationStatus;
    onRetry:  () => void;
}

// ─────────────────────────────────────────
// BROWSER-SPECIFIC INSTRUCTIONS
// ─────────────────────────────────────────
function getInstructions(status: GeolocationStatus): {
    title:    string;
    subtitle: string;
    steps:    string[];
} {
    if (status === 'unavailable') {
        return {
            title:    'GPS not available',
            subtitle: 'Your device does not support location services.',
            steps:    [
                'Make sure you are on a device with GPS',
                'Try opening the app in a different browser',
            ],
        };
    }

    // Detect browser for specific instructions
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isChrome  = /Chrome/.test(ua) && !/Edg/.test(ua);
    const isFirefox = /Firefox/.test(ua);
    const isSafari  = /Safari/.test(ua) && !/Chrome/.test(ua);

    if (isChrome) {
        return {
            title:    'Location access blocked',
            subtitle: 'BusTrack needs your location to show arrival times.',
            steps: [
                'Tap the 🔒 lock icon in the address bar',
                'Select "Site settings"',
                'Set Location to "Allow"',
                'Refresh the page',
            ],
        };
    }

    if (isFirefox) {
        return {
            title:    'Location access blocked',
            subtitle: 'BusTrack needs your location to show arrival times.',
            steps: [
                'Tap the shield icon in the address bar',
                'Select "Connection secure"',
                'Click "More information"',
                'Under Permissions, set Location to "Allow"',
            ],
        };
    }

    if (isSafari) {
        return {
            title:    'Location access blocked',
            subtitle: 'BusTrack needs your location to show arrival times.',
            steps: [
                'Open Settings on your device',
                'Scroll to Safari → Location',
                'Set to "While Using the App"',
                'Return and refresh the page',
            ],
        };
    }

    return {
        title:    'Location access blocked',
        subtitle: 'BusTrack needs your location to show arrival times.',
        steps: [
            'Open your browser settings',
            'Find Site Permissions → Location',
            'Allow location for this site',
            'Refresh the page',
        ],
    };
}

// ─────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────
export function LocationPermissionScreen({
                                             status,
                                             onRetry,
                                         }: LocationPermissionScreenProps) {
    const { title, subtitle, steps } = getInstructions(status);

    return (
        <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center px-6">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0  }}
                transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                className="w-full max-w-sm"
            >
                {/* Icon */}
                <div className="flex justify-center mb-6">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-3xl bg-[#fce8e6] flex items-center justify-center">
                            <MapPin className="w-9 h-9 text-[#ea4335]" strokeWidth={1.5} />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center border border-[#e8eaed]">
                            <AlertCircle className="w-4 h-4 text-[#ea4335]" strokeWidth={2} />
                        </div>
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-[22px] font-bold text-[#202124] text-center leading-tight mb-2">
                    {title}
                </h1>

                {/* Subtitle */}
                <p className="text-[14px] text-[#5f6368] text-center leading-relaxed mb-8">
                    {subtitle}
                </p>

                {/* Steps */}
                <div className="bg-white rounded-2xl border border-[#e8eaed] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden mb-6">
                    {steps.map((step, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 + i * 0.07, duration: 0.3 }}
                            className={cn(
                                'flex items-start gap-3 px-4 py-3.5',
                                i < steps.length - 1 && 'border-b border-[#f1f3f4]'
                            )}
                        >
                            {/* Step number */}
                            <span className="w-5 h-5 rounded-full bg-[#e8f0fe] text-[#1a73e8] text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
                            <p className="text-[13px] text-[#202124] leading-relaxed">{step}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Retry button */}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onRetry}
                    className={cn(
                        'w-full h-12 rounded-2xl',
                        'bg-[#1a73e8] text-white',
                        'text-[15px] font-semibold',
                        'flex items-center justify-center gap-2',
                        'shadow-[0_2px_8px_rgba(26,115,232,0.35)]',
                        'hover:bg-[#1557b0] active:bg-[#0d47a1]',
                        'transition-colors duration-150',
                    )}
                >
                    <RefreshCw className="w-4 h-4" strokeWidth={2.5} />
                    Try again
                </motion.button>

                {/* Footer note */}
                <p className="text-[11px] text-[#9aa0a6] text-center mt-4 leading-relaxed">
                    Your location is only used to calculate bus arrival times
                    and is never stored or shared.
                </p>
            </motion.div>
        </div>
    );
}