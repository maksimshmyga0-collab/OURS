import { useState, useCallback } from 'react';
import { AppSettings } from '../../types/models';
import { settingsService } from './settingsService';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => settingsService.getSettings());

  const updateSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    settingsService.saveSettings(newSettings);
  }, []);

  return {
    settings,
    updateSettings,
  };
}
