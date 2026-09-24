/**
 * Settings Service
 * Manages user preferences (notifications, sounds, haptics) via IKeyValueStorage.
 */

import { AppSettings } from '../../types/models';
import { appStorage, IKeyValueStorage } from '../storage/keyValueStorage';

const SETTINGS_KEY = 'ours_app_settings_v1';

const DEFAULT_SETTINGS: AppSettings = {
  notifications: true,
  sounds: true,
  haptic: true,
};

export class AppSettingsService {
  private storage: IKeyValueStorage;

  constructor(storage: IKeyValueStorage = appStorage) {
    this.storage = storage;
  }

  getSettings(): AppSettings {
    try {
      const stored = this.storage.getItem(SETTINGS_KEY);
      if (stored && typeof stored === 'string') {
        return JSON.parse(stored) as AppSettings;
      }
    } catch {
      // fallback
    }
    return DEFAULT_SETTINGS;
  }

  saveSettings(settings: AppSettings): void {
    try {
      this.storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }
}

export const settingsService = new AppSettingsService();
