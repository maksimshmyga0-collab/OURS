import React from 'react';
import { LovelyScreen, LovelyScreenProps } from './LovelyScreen';

export type TariffType = 'month' | 'year';

export interface PremiumScreenProps extends LovelyScreenProps {}

export const PremiumScreen: React.FC<PremiumScreenProps> = (props) => {
  return <LovelyScreen {...props} />;
};
