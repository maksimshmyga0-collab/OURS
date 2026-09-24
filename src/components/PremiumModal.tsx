import React from 'react';
import { PremiumScreen, TariffType } from '../screens/PremiumScreen';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: (tariff?: TariffType) => void;
  onResetSubscription?: () => void;
  isAlreadyPremium?: boolean;
  currentTariff?: TariffType;
}

export const PremiumModal: React.FC<PremiumModalProps> = ({
  isOpen,
  onClose,
  onUpgrade,
  onResetSubscription,
  isAlreadyPremium = false,
  currentTariff = 'year',
}) => {
  return (
    <PremiumScreen
      isOpen={isOpen}
      onClose={onClose}
      onUpgrade={(tariff) => onUpgrade(tariff)}
      onResetSubscription={onResetSubscription}
      isAlreadyPremium={isAlreadyPremium}
      currentTariff={currentTariff}
    />
  );
};
