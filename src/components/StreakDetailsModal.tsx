import React from 'react';
import { CoupleStreakInfo } from '../types';
import { OurSkyModal } from './OurSkyModal';
import { FingerprintDayInput } from '../services/fingerprint/fingerprintGenerator';

export interface StreakDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  streakInfo: CoupleStreakInfo;
  partnerAName: string;
  partnerBName: string;
  pairSeed?: string;
  days?: FingerprintDayInput[];
}

export const StreakDetailsModal: React.FC<StreakDetailsModalProps> = ({
  isOpen,
  onClose,
  streakInfo,
  partnerAName,
  partnerBName,
  pairSeed = 'ours-couple-seed',
  days,
}) => {
  const matchedDates = days
    ? days.filter((d) => d.status === 'matched').map((d) => d.date)
    : streakInfo.activeDates;

  return (
    <OurSkyModal
      isOpen={isOpen}
      onClose={onClose}
      couple={{
        pairSeed,
        user: { name: partnerAName, avatarColor: 'peach' },
        partner: { name: partnerBName, avatarColor: 'blue' },
        inviteCode: 'OURS-4821',
        connected: true,
        startDate: '12 сентября 2026',
        daysTogether: streakInfo.totalActiveDays,
        isLovely: false,
        subscription: 'free',
      }}
      pairSeed={pairSeed}
      matchedDates={matchedDates}
      partnerAName={partnerAName}
      partnerBName={partnerBName}
    />
  );
};
