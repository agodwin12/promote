'use client';

import { motion } from 'framer-motion';

interface CompanyCardSkeletonProps {
    index: number;
}

export function CompanyCardSkeleton({ index }: CompanyCardSkeletonProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className="w-full flex flex-col items-center justify-center bg-white rounded-2xl p-5 border border-[#e8eaed] min-h-[140px]"
        >
            {/* Logo placeholder */}
            <div className="w-16 h-16 rounded-2xl animate-shimmer mb-3" />

            {/* Name placeholder */}
            <div className="w-20 h-3 rounded-full animate-shimmer mb-1.5" />
            <div className="w-14 h-3 rounded-full animate-shimmer" />

            {/* Track label placeholder */}
            <div className="w-16 h-2.5 rounded-full animate-shimmer mt-3" />
        </motion.div>
    );
}