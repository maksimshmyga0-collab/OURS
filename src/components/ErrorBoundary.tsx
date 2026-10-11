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

  render() {
    if (this.state.hasError) {
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

          <p className="text-xs text-[#B8B2B5] max-w-xs mb-6 leading-relaxed">
            Произошла небольшая заминка при открытии. Нажмите кнопку ниже, чтобы перезапустить приложение.
          </p>

          <button
            type="button"
            onClick={this.handleReload}
            className="px-6 py-3 rounded-full bg-[#E98787] hover:bg-[#DE7777] active:scale-95 text-white text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-md"
          >
            Перезапустить
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
