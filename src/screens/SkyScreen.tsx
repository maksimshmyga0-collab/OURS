import React from 'react';
import { OurSkyModal, OurSkyModalProps } from '../components/OurSkyModal';

export interface SkyScreenProps extends Omit<OurSkyModalProps, 'isOpen' | 'variant'> {
  isActive?: boolean;
}

/**
 * Fullscreen tab presentation of the couple's shared night sky («Звёздное небо»).
 * Seamlessly reuses OurSkyModal with variant="screen" to eliminate code duplication.
 */
export const SkyScreen: React.FC<SkyScreenProps> = (props) => {
  return <OurSkyModal {...props} isOpen={true} variant="screen" />;
};
