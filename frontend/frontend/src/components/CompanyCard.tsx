'use client';

import { motion, Variants } from 'framer-motion';
import Image from 'next/image';
import { Bus } from 'lucide-react';
import { Company } from '@/lib/types';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────
const cardVariants: Variants = {
    hidden: {
        opacity: 0,
        y:       20,
        scale:   0.95,
    },
    visible: {
        opacity: 1,
        y:       0,
        scale:   1,
        transition: {
            duration: 0.35,
            ease:     'easeOut',
        },
    },
};

// ─────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────
interface CompanyCardProps {
    company:  Company;
    index:    number;
    onSelect: (company: Company) => void;
}

// ─────────────────────────────────────────
// COMPANY CARD
// ─────────────────────────────────────────
export function CompanyCard({ company, index, onSelect }: CompanyCardProps) {
    return (
        <motion.button
            variants={cardVariants}
            whileHover={{
                y:     -3,
                scale: 1.02,
                transition: { duration: 0.2, ease: 'easeOut' },
            }}
            whileTap={{
                scale: 0.96,
                transition: { duration: 0.1 },
            }}
            onClick={() => onSelect(company)}
            className={cn(
                'relative w-full flex flex-col items-center justify-center',
                'bg-white rounded-2xl p-5',
                'border border-[#e8eaed]',
                'shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]',
                'hover:shadow-[0_8px_24px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.06)]',
                'hover:border-[#1a73e8]/20',
                'transition-shadow transition-border duration-200',
                'cursor-pointer select-none outline-none',
                'focus-visible:ring-2 focus-visible:ring-[#1a73e8] focus-visible:ring-offset-2',
                'min-h-[140px]',
            )}
            aria-label={`Track ${company.name}`}
        >
            {/* Live indicator dot */}
            <div className="absolute top-3 right-3 flex items-center gap-1">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34a853] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#34a853]" />
        </span>
            </div>

            {/* Logo */}
            <div className="w-16 h-16 rounded-2xl bg-[#f8f9fa] border border-[#e8eaed] flex items-center justify-center overflow-hidden mb-3 flex-shrink-0">
                {company.logo_url ? (
                    <Image
                        src={company.logo_url}
                        alt={`${company.name} logo`}
                        width={56}
                        height={56}
                        className="w-full h-full object-contain p-1"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                    />
                ) : null}
                <Bus
                    className={cn(
                        'w-7 h-7 text-[#1a73e8]',
                        company.logo_url ? 'hidden' : 'block'
                    )}
                    strokeWidth={1.5}
                />
            </div>

            {/* Company name */}
            <p className="text-[13px] font-bold text-[#202124] text-center leading-tight line-clamp-2 w-full px-1">
                {company.name}
            </p>

            {/* Track label */}
            <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#1a73e8]">
                <span>Track now</span>
                <svg
                    className="w-3 h-3"
                    viewBox="0 0 12 12"
                    fill="none"
                    strokeWidth="2"
                    stroke="currentColor"
                >
                    <path d="M2 6h8M6 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
        </motion.button>
    );
}