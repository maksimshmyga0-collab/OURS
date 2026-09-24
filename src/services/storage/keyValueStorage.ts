/**
 * Key-Value Storage abstraction
 * Decouples business logic from browser-only localStorage.
 * Enables zero-refactor transition to Capacitor Preferences, SQLite, or server-backed state.
 */

export interface IKeyValueStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
  clear(): Promise<void> | void;
}

/**
 * In-memory storage adapter for non-browser, SSR, or sandboxed environments
 */
export class MemoryStorageAdapter implements IKeyValueStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Safe LocalStorage adapter that handles iframe security restrictions,
 * quota exceptions, or missing window gracefully.
 */
export class LocalStorageAdapter implements IKeyValueStorage {
  private fallback = new MemoryStorageAdapter();

  private isAvailable(): boolean {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return false;
    }
    try {
      const testKey = '__ours_storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  getItem(key: string): string | null {
    if (!this.isAvailable()) {
      return this.fallback.getItem(key);
    }
    try {
      return window.localStorage.getItem(key);
    } catch {
      return this.fallback.getItem(key);
    }
  }

  setItem(key: string, value: string): void {
    if (!this.isAvailable()) {
      this.fallback.setItem(key, value);
      return;
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      this.fallback.setItem(key, value);
    }
  }

  removeItem(key: string): void {
    if (!this.isAvailable()) {
      this.fallback.removeItem(key);
      return;
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      this.fallback.removeItem(key);
    }
  }

  clear(): void {
    if (!this.isAvailable()) {
      this.fallback.clear();
      return;
    }
    try {
      window.localStorage.clear();
    } catch {
      this.fallback.clear();
    }
  }
}

// Global default storage instance
export const appStorage: IKeyValueStorage = new LocalStorageAdapter();
