import React, { useState, useEffect } from 'react';
import { bootDiagnostics, BootStage } from '../services/device/bootDiagnostics';

interface AppBootFallbackProps {
  onRetry?: () => void;
  onClearCache?: () => void;
}

export const AppBootFallback: React.FC<AppBootFallbackProps> = ({ onRetry, onClearCache }) => {
  const [stage, setStage] = useState<BootStage>('APP_MOUNT');
  const [lastError, setLastError] = useState<string | null>(null);
  const [showTimeoutControls, setShowTimeoutControls] = useState(false);

  useEffect(() => {
    const unsub = bootDiagnostics.subscribe((state) => {
      setStage(state.currentStage);
      setLastError(state.lastError);
    });

    const timer = setTimeout(() => {
      setShowTimeoutControls(true);
    }, 4500);

    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, []);

  const getStageLabel = (st: BootStage): string => {
    switch (st) {
      case 'APP_MOUNT':
        return 'Запуск приложения...';
      case 'AUTH_READY':
        return 'Авторизация доступа...';
      case 'PAIR_RESOLVED':
        return 'Загрузка профиля пары...';
      case 'STATE_LOADED':
        return 'Подготовка пространства...';
      case 'UI_READY':
        return 'Открытие интерфейса...';
      case 'ERROR':
        return 'Ошибка инициализации';
      default:
        return 'Загрузка...';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] bg-[#000000] text-white flex flex-col items-center justify-center p-6 text-center select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top, 24px)',
        paddingBottom: 'env(safe-area-inset-bottom, 24px)',
      }}
    >
      {/* Central OURS Emblem */}
      <div className="relative w-16 h-16 rounded-3xl bg-[#1C1417] border border-[#352126] flex items-center justify-center text-[#E98787] mb-5 shadow-lg">
        <span className="font-display font-bold text-xl tracking-tight">OURS</span>
        <div className="absolute -inset-1 rounded-[28px] border border-[#E98787]/20 animate-pulse pointer-events-none" />
      </div>

      <h1 className="font-display text-lg font-bold tracking-tight text-white mb-1.5">
        OURS
      </h1>

      <p className="text-xs text-[#B8B2B5] font-medium mb-3">
        {getStageLabel(stage)}
      </p>

      {/* Stage Breadcrumb Tag */}
      <div className="px-2.5 py-1 rounded-full bg-[#1A1417] border border-[#2D1F24] text-[10px] font-mono text-[#E98787]/80 mb-6">
        {stage}
      </div>

      {/* Display error message if stage is ERROR */}
      {stage === 'ERROR' && lastError && (
        <div className="p-3 rounded-2xl bg-[#1F1215] border border-[#3A1E24] max-w-xs mb-6 text-left">
          <p className="text-[11px] font-mono text-[#E98787] break-all leading-relaxed">
            {lastError}
          </p>
        </div>
      )}

      {/* Show retry / reload controls if loading takes longer than 4.5s or on error */}
      {(showTimeoutControls || stage === 'ERROR') && (
        <div className="flex flex-col sm:flex-row items-center gap-3 animate-in fade-in duration-300">
          <button
            type="button"
            onClick={() => {
              if (onRetry) {
                onRetry();
              } else if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
            className="px-6 py-2.5 rounded-full bg-[#E98787] hover:bg-[#DE7777] active:scale-95 text-white text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-md"
          >
            Повторить загрузку
          </button>

          {onClearCache && (
            <button
              type="button"
              onClick={onClearCache}
              className="px-4 py-2 rounded-full bg-[#191316] hover:bg-[#251B20] border border-[#302127] text-[#B8B2B5] text-xs font-medium transition-all cursor-pointer"
            >
              Сбросить кэш
            </button>
          )}
        </div>
      )}
    </div>
  );
};
