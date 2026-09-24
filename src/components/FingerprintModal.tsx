import React from 'react';
import { OurSkyModal } from './OurSkyModal';
import { FingerprintDayInput } from '../services/fingerprint/fingerprintGenerator';
import { CoupleState, HistoryDay, Moment } from '../types';

export interface FingerprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  pairSeed: string;
  days?: FingerprintDayInput[];
  matchedDates?: string[];
  partnerAName: string;
  partnerBName: string;
  couple?: CoupleState;
  todayMoments?: Moment[];
  history?: HistoryDay[];
  totalMoments?: number;
  activeDaysCount?: number;
}

/**
 * Backward-compatible wrapper mapping to OurSkyModal («Наше небо»)
 */
export const FingerprintModal: React.FC<FingerprintModalProps> = ({
  isOpen,
  onClose,
  pairSeed,
  days = [],
  matchedDates,
  partnerAName,
  partnerBName,
  couple,
  todayMoments,
  history,
}) => {
  const fallbackCouple: CoupleState = couple || {
    pairSeed,
    user: { name: partnerAName, avatarColor: 'peach' },
    partner: { name: partnerBName, avatarColor: 'blue' },
    inviteCode: 'OURS-4821',
    connected: true,
    startDate: '12 сентября 2026',
    daysTogether: 12,
    isLovely: false,
    subscription: 'free',
  };

  const effectiveMatchedDates = matchedDates || days.filter((d) => d.status === 'matched').map((d) => d.date);

  return (
    <OurSkyModal
      isOpen={isOpen}
      onClose={onClose}
      couple={fallbackCouple}
      pairSeed={pairSeed}
      todayMoments={todayMoments}
      history={history}
      matchedDates={effectiveMatchedDates}
      partnerAName={partnerAName}
      partnerBName={partnerBName}
    />
  );
};

export { OurSkyModal };
