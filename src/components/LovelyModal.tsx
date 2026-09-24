import React from 'react';
import { LovelyScreen } from '../screens/LovelyScreen';

export interface LovelyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchase: () => void;
  isLovely?: boolean;
  onResetLovely?: () => void;
  partnerAName?: string;
  partnerBName?: string;
  /** Backward-compatibility aliases */
  onUpgrade?: (tariff?: any) => void;
  onResetSubscription?: () => void;
  isAlreadyPremium?: boolean;
  currentTariff?: string;
}

export const LovelyModal: React.FC<LovelyModalProps> = ({
  isOpen,
  onClose,
  onPurchase,
  isLovely = false,
  onResetLovely,
  partnerAName,
  partnerBName,
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
      onResetLovely={onResetLovely || onResetSubscription}
      partnerAName={partnerAName}
      partnerBName={partnerBName}
    />
  );
};
