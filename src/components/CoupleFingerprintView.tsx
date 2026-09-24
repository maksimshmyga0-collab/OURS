import React, { useMemo } from 'react';
import { CoupleSkyView } from './CoupleSkyView';
import { getSkyForMonth } from '../services/sky/skyService';
import { FingerprintDayInput } from '../services/fingerprint/fingerprintGenerator';

export interface CoupleFingerprintViewProps {
  pairSeed: string;
  days?: FingerprintDayInput[];
  compact?: boolean;
  className?: string;
  showAura?: boolean;
}

/**
 * Backward-compatible wrapper forwarding to CoupleSkyView («Наше небо»)
 */
export const CoupleFingerprintView: React.FC<CoupleFingerprintViewProps> = ({
  pairSeed,
  days = [],
  compact = false,
  className = '',
}) => {
  const now = useMemo(() => new Date(), []);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const matchedCount = useMemo(() => {
    return days.filter((d) => d.status === 'matched').length;
  }, [days]);

  const sky = useMemo(() => {
    return getSkyForMonth(pairSeed, year, month, matchedCount, true);
  }, [pairSeed, year, month, matchedCount]);

  return <CoupleSkyView sky={sky} compact={compact} className={className} />;
};

export { CoupleSkyView };
