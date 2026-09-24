import React, { useState } from 'react';
import { SlidersHorizontal, RefreshCw, Sparkles, UserCheck, FastForward } from 'lucide-react';

interface DevControlsProps {
  onSimulatePartnerUpload: () => void;
  onResetDay: () => void;
  onRestartOnboarding: () => void;
  onOpenPremium?: () => void;
  onFastForward?: () => void;
  isPartnerUploaded: boolean;
  canSimulate: boolean;
}

export const DevControls: React.FC<DevControlsProps> = ({
  onSimulatePartnerUpload,
  onResetDay,
  onRestartOnboarding,
  onOpenPremium,
  onFastForward,
  isPartnerUploaded,
  canSimulate,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-20 right-4 z-50">
      {isOpen ? (
        <div className="liquid-glass-floating rounded-[22px] p-4 w-64 space-y-2.5 animate-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-[#F0E6E8]">
            <span className="text-xs font-semibold text-[#343033] flex items-center gap-1.5">
              <SlidersHorizontal size={13} className="text-[#E98787]" />
              Панель демо / Mock
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-[#777277] hover:text-[#343033] p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Open OURS Premium Screen */}
          {onOpenPremium && (
            <button
              type="button"
              onClick={() => {
                onOpenPremium();
                setIsOpen(false);
              }}
              className="w-full py-2 px-3 rounded-xl bg-[#FAF0F2] hover:bg-[#F6E2E6] text-[#E98787] text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer active:scale-98 border border-[#EED7DC]"
            >
              <Sparkles size={14} className="text-[#E98787]" />
              <span>Открыть OURS Premium</span>
            </button>
          )}

          {/* Simulate partner upload */}
          <button
            type="button"
            disabled={!canSimulate || isPartnerUploaded}
            onClick={onSimulatePartnerUpload}
            className={`w-full py-2 px-3 rounded-xl text-xs font-medium flex items-center gap-2 transition-all cursor-pointer ${
              isPartnerUploaded
                ? 'bg-[#F5ECE8] text-[#E98787]'
                : canSimulate
                ? 'liquid-glass-pill hover:bg-white text-[#343033]'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <UserCheck size={14} className="text-[#E98787]" />
            <span>
              {isPartnerUploaded ? 'Партнёр уже загрузил' : 'Загрузить за Макса'}
            </span>
          </button>

          {/* Fast forward 4 hours */}
          {onFastForward && (
            <button
              type="button"
              onClick={onFastForward}
              className="w-full py-2 px-3 rounded-xl bg-slate-50/80 hover:bg-slate-100 text-[#343033] text-xs font-medium flex items-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              <FastForward size={14} className="text-[#E2765A]" />
              <span>Промотать 4 часа (Разблокировать)</span>
            </button>
          )}

          {/* Reset today's moments */}
          <button
            type="button"
            onClick={onResetDay}
            className="w-full py-2 px-3 rounded-xl bg-slate-50/80 hover:bg-slate-100 text-[#343033] text-xs font-medium flex items-center gap-2 transition-all cursor-pointer active:scale-98"
          >
            <RefreshCw size={14} className="text-[#777277]" />
            <span>Сбросить день</span>
          </button>

          {/* Restart Onboarding */}
          <button
            type="button"
            onClick={onRestartOnboarding}
            className="w-full py-2 px-3 rounded-xl bg-slate-50/80 hover:bg-slate-100 text-[#343033] text-xs font-medium flex items-center gap-2 transition-all cursor-pointer active:scale-98"
          >
            <Sparkles size={14} className="text-[#E98787]" />
            <span>Пройти Onboarding заново</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="h-9 px-3.5 rounded-full liquid-glass-floating flex items-center gap-1.5 text-xs font-medium text-[#777277] hover:text-[#343033] transition-all cursor-pointer active:scale-95 active:opacity-90"
          title="Инструменты демонстрации партнёра"
        >
          <SlidersHorizontal size={13} className="text-[#E98787]" />
          <span>Demo</span>
        </button>
      )}
    </div>
  );
};
