import React from 'react';
import { LovelyModal, LovelyModalProps } from './LovelyModal';

export interface PremiumModalProps extends LovelyModalProps {}

export const PremiumModal: React.FC<PremiumModalProps> = (props) => {
  return <LovelyModal {...props} />;
};
