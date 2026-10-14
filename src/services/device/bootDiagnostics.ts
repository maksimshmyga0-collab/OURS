/**
 * OURS Startup Diagnostics Tracker
 * Tracks boot pipeline stages (APP_MOUNT -> AUTH_READY -> PAIR_RESOLVED -> STATE_LOADED -> UI_READY)
 * with zero tokens, secrets, or PII in logs.
 */

export type BootStage = 'APP_MOUNT' | 'AUTH_READY' | 'PAIR_RESOLVED' | 'STATE_LOADED' | 'UI_READY' | 'ERROR';

export interface BootDiagnosticsState {
  currentStage: BootStage;
  lastError: string | null;
  timestamp: number;
}

class BootDiagnostics {
  private currentStage: BootStage = 'APP_MOUNT';
  private lastError: string | null = null;
  private listeners: Set<(state: BootDiagnosticsState) => void> = new Set();

  logStage(stage: BootStage, message?: string) {
    this.currentStage = stage;
    const timeStr = new Date().toISOString().substring(11, 19);
    console.log(`[OURS Boot] [${timeStr}] Stage: ${stage}${message ? ` - ${message}` : ''}`);
    this.notify();
  }

  logError(stage: BootStage, error: unknown) {
    this.currentStage = 'ERROR';
    const errStr = error instanceof Error ? error.message : String(error);
    this.lastError = errStr;
    console.error(`[OURS Boot] Error at stage ${stage}:`, error);
    this.notify();
  }

  getState(): BootDiagnosticsState {
    return {
      currentStage: this.currentStage,
      lastError: this.lastError,
      timestamp: Date.now(),
    };
  }

  subscribe(listener: (state: BootDiagnosticsState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((fn) => {
      try { fn(state); } catch {}
    });
  }
}

export const bootDiagnostics = new BootDiagnostics();
