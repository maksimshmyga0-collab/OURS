import React, { useState, useEffect } from 'react';
import { X, Check, Clock, Sparkles, Shield } from 'lucide-react';
import { OursLogo } from '../components/OursLogo';
import { PrimaryButton } from '../components/PrimaryButton';
import { playSoftChime, triggerHaptic } from '../services/feedback';

export type TariffType = 'month' | 'year';

export interface PremiumScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: (tariff: TariffType) => void;
  onResetSubscription?: () => void;
  isAlreadyPremium?: boolean;
  currentTariff?: TariffType;
}

export const PremiumScreen: React.FC<PremiumScreenProps> = ({
  isOpen,
  onClose,
  onUpgrade,
  onResetSubscription,
  isAlreadyPremium = false,
  currentTariff = 'year',
}) => {
  const [selectedTariff, setSelectedTariff] = useState<TariffType>(currentTariff);
  const [showSuccess, setShowSuccess] = useState<boolean>(isAlreadyPremium);

  // Sync state if isAlreadyPremium changes
  useEffect(() => {
    if (isAlreadyPremium) {
      setShowSuccess(true);
    }
  }, [isAlreadyPremium]);

  if (!isOpen) return null;

  const handleSelectTariff = (tariff: TariffType) => {
    setSelectedTariff(tariff);
    triggerHaptic(true);
    playSoftChime('tap', true);
  };

  const handleSubscribe = () => {
    triggerHaptic(true);
    playSoftChime('success', true);
    onUpgrade(selectedTariff);
    setShowSuccess(true);
  };

  const handleReset = () => {
    if (onResetSubscription) {
      onResetSubscription();
    }
    setShowSuccess(false);
    setSelectedTariff('year');
    triggerHaptic(true);
    playSoftChime('tap', true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#343033]/30 backdrop-blur-[6px] p-0 sm:p-4 overflow-y-auto no-scrollbar animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md min-h-screen sm:min-h-0 sm:max-h-[92vh] sm:rounded-[32px] bg-[#FFF9FA] border border-[#EBE3E5] shadow-lg flex flex-col justify-between p-6 sm:p-7 relative overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header: Logo + Close button */}
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <OursLogo size={22} />
            <span className="font-display font-semibold tracking-wide text-lg text-[#343033]">
              OURS
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white border border-[#EBE3E5] flex items-center justify-center text-[#777277] hover:text-[#343033] transition-all active:scale-95 cursor-pointer shadow-2xs"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dynamic View: Success State vs Paywall Flow */}
        {showSuccess ? (
          /* ========================================================= */
          /* SUCCESS STATE                                             */
          /* ========================================================= */
          <div className="my-auto py-8 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
            {/* Big round coral element with check icon */}
            <div className="w-20 h-20 rounded-full bg-[#FAF0F2] border border-[#EED7DC] text-[#E98787] flex items-center justify-center mb-6 shadow-2xs">
              <Check size={38} strokeWidth={2.5} />
            </div>

            {/* Title & Description */}
            <div className="space-y-2.5 mb-6 max-w-[290px]">
              <h2 className="font-display text-2xl font-bold text-[#343033] tracking-tight">
                Премиум активен
              </h2>
              <p className="text-sm text-[#777277] leading-relaxed">
                Ваша история и наша нить теперь доступны полностью.
              </p>
            </div>

            {/* Chosen Tariff Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#EBE3E5] shadow-2xs text-xs font-semibold text-[#343033] mb-8">
              <Sparkles size={14} className="text-[#E98787]" />
              <span>
                Тариф:{' '}
                {selectedTariff === 'year'
                  ? 'Год (1990 ₽ / год)'
                  : 'Месяц (299 ₽ / месяц)'}
              </span>
            </div>

            {/* Actions */}
            <div className="w-full space-y-3 pt-2">
              <PrimaryButton variant="coral" onClick={onClose}>
                Продолжить
              </PrimaryButton>

              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2.5 text-xs font-semibold text-[#777277] hover:text-[#E98787] transition-colors cursor-pointer"
              >
                Сбросить демо-подписку
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* MAIN PAYWALL VIEW                                         */
          /* ========================================================= */
          <div className="flex-1 flex flex-col justify-between pt-2">
            <div>
              {/* Titles */}
              <div className="space-y-2 mb-6">
                <h1 className="font-display text-2xl sm:text-[28px] font-bold text-[#343033] tracking-tight leading-snug">
                  Полная история вашей пары
                </h1>
                <p className="text-sm text-[#777277] leading-relaxed">
                  Откройте все моменты, нашу нить и поддержите развитие OURS.
                </p>
              </div>

              {/* 3 Benefits Block */}
              <div className="space-y-3 mb-6">
                {/* Benefit 1: Полная история */}
                <div className="flex items-start gap-3.5 p-3.5 rounded-[20px] bg-white border border-[#EBE3E5] shadow-2xs">
                  <div className="w-10 h-10 rounded-[14px] bg-[#FAF0F2] border border-[#EED7DC] flex items-center justify-center text-[#E98787] shrink-0 mt-0.5">
                    <Clock size={19} />
                  </div>
                  <div>
                    <h4 className="font-display text-sm font-bold text-[#343033]">
                      Полная история
                    </h4>
                    <p className="text-xs text-[#777277] mt-0.5 leading-snug">
                      Все прошлые дни и моменты без ограничений
                    </p>
                  </div>
                </div>

                {/* Benefit 2: Наша нить */}
                <div className="flex items-start gap-3.5 p-3.5 rounded-[20px] bg-white border border-[#EBE3E5] shadow-2xs">
                  <div className="w-10 h-10 rounded-[14px] bg-[#FAF2E8] border border-[#F2DECF] flex items-center justify-center text-[#E2925A] shrink-0 mt-0.5">
                    <Sparkles size={19} />
                  </div>
                  <div>
                    <h4 className="font-display text-sm font-bold text-[#343033]">
                      Наша нить
                    </h4>
                    <p className="text-xs text-[#777277] mt-0.5 leading-snug">
                      Уникальный визуальный артефакт вашей пары
                    </p>
                  </div>
                </div>

                {/* Benefit 3: Приватность */}
                <div className="flex items-start gap-3.5 p-3.5 rounded-[20px] bg-white border border-[#EBE3E5] shadow-2xs">
                  <div className="w-10 h-10 rounded-[14px] bg-[#EDF4FB] border border-[#D5E3F0] flex items-center justify-center text-[#4A6B82] shrink-0 mt-0.5">
                    <Shield size={19} />
                  </div>
                  <div>
                    <h4 className="font-display text-sm font-bold text-[#343033]">
                      Приватность
                    </h4>
                    <p className="text-xs text-[#777277] mt-0.5 leading-snug">
                      История никогда не удаляется и видна только вам двоим
                    </p>
                  </div>
                </div>
              </div>

              {/* Tariffs Selection (Radio-style) */}
              <div className="space-y-2.5 mb-6">
                {/* Option 1: Год (Default) */}
                <div
                  onClick={() => handleSelectTariff('year')}
                  className={`p-3.5 sm:p-4 rounded-[20px] cursor-pointer transition-all duration-150 flex items-center justify-between ${
                    selectedTariff === 'year'
                      ? 'bg-white border-2 border-[#E98787] shadow-xs'
                      : 'bg-white/80 border border-[#EBE3E5] hover:border-[#D5CCD0]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Radio Button */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        selectedTariff === 'year'
                          ? 'border-[#E98787]'
                          : 'border-[#CEC5C8]'
                      }`}
                    >
                      {selectedTariff === 'year' && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#E98787]" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-[#343033]">
                          Год
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#FAF0F2] border border-[#EED7DC] text-[#E98787] text-[10px] font-bold">
                          Выгоднее на 45%
                        </span>
                      </div>
                      <p className="text-[11px] text-[#777277] mt-0.5">
                        165 ₽ / месяц при оплате за год
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-display text-base font-bold text-[#343033]">
                      1990 ₽
                    </span>
                    <span className="text-xs text-[#777277]"> / год</span>
                  </div>
                </div>

                {/* Option 2: Месяц */}
                <div
                  onClick={() => handleSelectTariff('month')}
                  className={`p-3.5 sm:p-4 rounded-[20px] cursor-pointer transition-all duration-150 flex items-center justify-between ${
                    selectedTariff === 'month'
                      ? 'bg-white border-2 border-[#E98787] shadow-xs'
                      : 'bg-white/80 border border-[#EBE3E5] hover:border-[#D5CCD0]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Radio Button */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        selectedTariff === 'month'
                          ? 'border-[#E98787]'
                          : 'border-[#CEC5C8]'
                      }`}
                    >
                      {selectedTariff === 'month' && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#E98787]" />
                      )}
                    </div>

                    <div>
                      <span className="font-display text-sm font-bold text-[#343033]">
                        Месяц
                      </span>
                      <p className="text-[11px] text-[#777277] mt-0.5">
                        С возможностью отмены в любой момент
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-display text-base font-bold text-[#343033]">
                      299 ₽
                    </span>
                    <span className="text-xs text-[#777277]"> / месяц</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2 pt-2">
              <PrimaryButton variant="coral" onClick={handleSubscribe}>
                Оформить подписку
              </PrimaryButton>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 text-center text-xs font-semibold text-[#777277] hover:text-[#343033] transition-colors cursor-pointer"
              >
                Не сейчас
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
