import React from 'react';
import { LovelyScreen } from '../screens/LovelyScreen';

export interface LovelyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase: () => void;
  isLovely?: boolean;
  pairId?: string;
  partnerAName?: string;
  partnerBName?: string;
  onOpenTerms?: () => void;
  /** Backward-compatibility aliases */
  onUpgrade?: (tariff?: any) => void;
  onResetSubscription?: () => void;
  onResetLovely?: () => void;
  isAlreadyPremium?: boolean;
  currentTariff?: string;
}

export const LovelyModal: React.FC<LovelyModalProps> = ({
  isOpen,
  onClose,
  onPurchase,
  isLovely = false,
  pairId,
  partnerAName,
  partnerBName,
  onOpenTerms,
  onResetLovely,
  onUpgrade,
  onResetSubscription,
  isAlreadyPremium,
}) => {
  return (
    <LovelyScreen
      isOpen={isOpen}
      onClose={onClose}
      onPurchase={onPurchase || (() => onUpgrade?.())}
      isLovely={isLovely || isAlreadyPremium}
      pairId={pairId}
      onOpenTerms={onOpenTerms}
      onResetLovely={onResetLovely || onResetSubscription}
      partnerAName={partnerAName}
      partnerBName={partnerBName}
    />
  );
};
