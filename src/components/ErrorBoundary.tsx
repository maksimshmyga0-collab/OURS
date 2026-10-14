import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[OURS ErrorBoundary] Uncaught runtime exception:', error, errorInfo);
  }

  handleReload = () => {
    try {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    } catch {
      // fallback
    }
  };

  handleClearCacheAndReload = () => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('ours_app_state_v2');
        window.location.reload();
      }
    } catch {
      this.handleReload();
    }
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'Неизвестная ошибка';

      return (
        <div
          className="fixed inset-0 z-[99999] bg-[#000000] text-white flex flex-col items-center justify-center p-6 text-center select-none"
          style={{
            paddingTop: 'env(safe-area-inset-top, 24px)',
            paddingBottom: 'env(safe-area-inset-bottom, 24px)',
          }}
        >
          <div className="w-16 h-16 rounded-3xl bg-[#1C1417] border border-[#352126] flex items-center justify-center text-[#E98787] mb-5 shadow-lg">
            <span className="text-2xl font-serif">♡</span>
          </div>

          <h1 className="font-display text-xl font-bold tracking-tight text-white mb-2">
            OURS
          </h1>

          <p className="text-xs text-[#B8B2B5] max-w-xs mb-3 leading-relaxed">
            Произошла небольшая заминка при открытии. Перезапустите приложение или сбросьте локальный кэш.
          </p>

          <p className="text-[10px] text-[#E98787]/80 max-w-xs mb-6 font-mono break-all px-2 py-1 rounded bg-[#1C1417] border border-[#352126]">
            {errorMsg}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-6 py-3 rounded-full bg-[#E98787] hover:bg-[#DE7777] active:scale-95 text-white text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-md"
            >
              Перезапустить
            </button>

            <button
              type="button"
              onClick={this.handleClearCacheAndReload}
              className="px-5 py-2.5 rounded-full bg-[#1F181B] hover:bg-[#2A1F24] border border-[#3A262E] text-[#E98787] text-xs font-medium transition-all cursor-pointer"
            >
              Сбросить кэш и войти
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
