import React, { useMemo } from 'react';
import { CoupleFingerprintView } from './CoupleFingerprintView';
import { FingerprintDayInput } from '../services/fingerprint/fingerprintGenerator';

export interface CoupleThreadViewProps {
  seed: string;
  totalActiveDays: number;
  currentStreak?: number;
  totalMoments?: number;
  duoMomentsCount?: number;
  partnerAName?: string;
  partnerBName?: string;
  compact?: boolean;
  className?: string;
  days?: FingerprintDayInput[];
}

/**
 * Backward-compatible wrapper pointing to CoupleFingerprintView
 */
export const CoupleThreadView: React.FC<CoupleThreadViewProps> = ({
  seed,
  totalActiveDays,
  compact = false,
  className = '',
  days,
}) => {
  const simulatedDays = useMemo(() => {
    if (days && days.length > 0) return days;
    const res: FingerprintDayInput[] = [];
    const count = Math.max(1, totalActiveDays);
    for (let i = 0; i < count; i++) {
      res.push({
        date: `2026-09-${String(i + 1).padStart(2, '0')}`,
        status: i % 4 === 2 ? 'missed' : 'matched',
      });
    }
    return res;
  }, [days, totalActiveDays]);

  return (
    <CoupleFingerprintView
      pairSeed={seed}
      days={simulatedDays}
      compact={compact}
      className={className}
    />
  );
};
