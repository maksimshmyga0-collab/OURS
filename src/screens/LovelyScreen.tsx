import React, { useState } from 'react';
import { PrimaryButton } from '../components/PrimaryButton';
import { OursLogo } from '../components/OursLogo';
import { X, Heart, Clock, Sparkles, Shield, Check, Loader2 } from 'lucide-react';
import { triggerHaptic, playSoftChime } from '../services/feedback';
import { apiClient } from '../services/api/apiClient';

export interface LovelyScreenProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseLovely?: () => void;
  onPurchase?: () => void;
  onSubscribe?: () => void; // backwards compat alias
  isLovely?: boolean;
  pairId?: string;
  partnerAName?: string;
  partnerBName?: string;
  onOpenTerms?: () => void;
  onResetLovely?: () => void;
  onResetSubscription?: () => void; // backwards compat
}

export const LovelyScreen: React.FC<LovelyScreenProps> = ({
  isOpen,
  onClose,
  onPurchaseLovely,
  onPurchase,
  onSubscribe,
  isLovely = false,
  pairId,
  partnerAName = '',
  partnerBName = '',
  onOpenTerms,
  onResetLovely,
  onResetSubscription,
}) => {
  const [justPurchased, setJustPurchased] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Check pending payment status on open / mount
  React.useEffect(() => {
    if (!isOpen) return;

    const checkPendingPayment = async () => {
      try {
        const pendingPaymentId = sessionStorage.getItem('ours_pending_payment_id');
        if (pendingPaymentId) {
          setIsProcessingPayment(true);
          const statusRes = await apiClient.checkPaymentStatus(pendingPaymentId);
          setIsProcessingPayment(false);

          if (statusRes.success && (statusRes.isLovely || statusRes.status === 'succeeded')) {
            sessionStorage.removeItem('ours_pending_payment_id');
            setJustPurchased(true);
            if (onPurchaseLovely) onPurchaseLovely();
            else if (onPurchase) onPurchase();
          } else if (statusRes.status === 'canceled') {
            sessionStorage.removeItem('ours_pending_payment_id');
            setPaymentError('Платеж был отменен.');
          }
        }
      } catch (err) {
        console.error('[OURS LOVELY] Error checking pending payment:', err);
        setIsProcessingPayment(false);
      }
    };

    checkPendingPayment();
  }, [isOpen, onPurchaseLovely, onPurchase]);

  if (!isOpen) return null;

  const handleBuy = () => {
    triggerHaptic(true);
    playSoftChime('tap', true);
    setShowComingSoon(true);
  };

  const handleReset = () => {
    if (onResetLovely) onResetLovely();
    else if (onResetSubscription) onResetSubscription();
    setJustPurchased(false);
  };

  const isAlreadyLovely = isLovely || justPurchased;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#000000]/60 backdrop-blur-[6px] animate-sheet-backdrop"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#FFF9FA] dark:bg-[#111111] border border-[#EBE3E5] dark:border-[#242024] rounded-t-[32px] sm:rounded-[28px] p-6 pb-8 shadow-[0_-4px_32px_rgba(0,0,0,0.12)] min-h-[580px] max-h-[92vh] flex flex-col justify-between overflow-y-auto no-scrollbar animate-sheet-enter transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Bar with dismiss button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <OursLogo size={57} className="shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#777277] dark:text-[#B8B2B5]">
              OURS · Для двоих
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F5EFF1] dark:bg-[#1E1C1E] border border-transparent dark:border-[#242024] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white transition-all active:scale-95 cursor-pointer shadow-2xs"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* State A: ALREADY LOVELY (One-time status active) */}
        {isAlreadyLovely ? (
          <div className="my-auto py-6 sm:py-8 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-250">
            {/* Soft Coral/Blush Heart Icon Emblem */}
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full bg-[#FAF0F2] dark:bg-[#26151A] border border-[#F2D1D8] dark:border-[#42222B] text-[#E98787] flex items-center justify-center shadow-2xs">
                <Heart size={38} className="fill-[#E98787]" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-[#1A181A] border border-[#F2D1D8] dark:border-[#42222B] flex items-center justify-center text-[#649A6E] shadow-2xs">
                <Check size={16} strokeWidth={2.5} />
              </span>
            </div>

            {/* Title & Description */}
            <div className="space-y-2 mb-6 max-w-[300px]">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF0F2] dark:bg-[#26151A] border border-[#F2D1D8] dark:border-[#42222B] text-[#E98787] text-xs font-bold mb-1">
                <Heart size={12} className="fill-[#E98787]" />
                <span>LOVELY</span>
              </div>
              <h2 className="font-display text-2xl font-bold text-[#343033] dark:text-white tracking-tight">
                {justPurchased ? 'Теперь вы LOVELY' : 'Вы LOVELY'}
              </h2>
              <p className="text-sm text-[#777277] dark:text-[#B8B2B5] leading-relaxed">
                Полная история моментов и всё ваше звёздное небо доступны навсегда.
              </p>
            </div>

            {/* Confirmation Banner */}
            <div className="w-full rounded-[24px] p-4 bg-white dark:bg-[#181517] border border-[#EBE3E5] dark:border-[#242024] shadow-2xs text-left mb-6 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#343033] dark:text-white">
                  Одна покупка — для вас двоих
                </span>
                <span className="text-[10px] font-semibold text-[#649A6E] px-2 py-0.5 rounded-full bg-[#F0F8F2] dark:bg-[#152419] border border-[#D3EED8] dark:border-[#22452B]">
                  Активно
                </span>
              </div>
              <p className="text-xs text-[#777277] dark:text-[#B8B2B5] leading-relaxed">
                {partnerAName && partnerBName
                  ? `${partnerAName} и ${partnerBName} имеют неограниченный доступ навсегда без подписок и продлений.`
                  : 'Ваша пара имеет неограниченный доступ навсегда без подписок и продлений.'}
              </p>
            </div>

            {/* Actions: Continue button only */}
            <div className="w-full space-y-3 pt-2">
              <PrimaryButton variant="coral" onClick={onClose}>
                Продолжить
              </PrimaryButton>

              {(onResetLovely || onResetSubscription) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full py-2.5 text-xs font-semibold text-[#777277] dark:text-[#B8B2B5] hover:text-[#E98787] transition-colors cursor-pointer"
                >
                  Сбросить статус (для демо)
                </button>
              )}
            </div>
          </div>
        ) : (
          /* State B: ONE-TIME PURCHASE FLOW */
          <div className="flex-1 flex flex-col justify-between pt-2">
            <div>
              {/* Header Titles */}
              <div className="space-y-2 mb-5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF0F2] dark:bg-[#26151A] border border-[#F2D1D8] dark:border-[#42222B] text-[#E98787] text-xs font-bold">
                  <Heart size={12} className="fill-[#E98787]" />
                  <span>LOVELY</span>
                </div>
                <h1 className="font-display text-2xl sm:text-[28px] font-bold text-[#343033] dark:text-white tracking-tight leading-snug">
                  Не теряйте вашу историю
                </h1>
                <p className="text-sm font-medium text-[#E98787] dark:text-[#F0B9C6] leading-relaxed">
                  Одна покупка — для вас двоих (2 устройства).
                </p>
              </div>

              {/* 3 Real Benefits of OURS */}
              <div className="space-y-2.5 mb-5">
                {/* Benefit 1: Полная история */}
                <div className="flex items-start gap-3.5 p-3.5 rounded-[20px] bg-white dark:bg-[#181517] border border-[#EBE3E5] dark:border-[#242024] shadow-2xs">
                  <div className="w-10 h-10 rounded-[14px] bg-[#FAF0F2] dark:bg-[#26151A] border border-[#EED7DC] dark:border-[#42222B] flex items-center justify-center text-[#E98787] shrink-0 mt-0.5">
                    <Clock size={19} />
                  </div>
                  <div>
                    <h4 className="font-display text-sm font-bold text-[#343033] dark:text-white">
                      Вся история ваших моментов
                    </h4>
                    <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-0.5 leading-snug">
                      Возвращайтесь к вашим воспоминаниям старше 7 дней в любое время
                    </p>
                  </div>
                </div>

                {/* Benefit 2: Наше небо */}
                <div className="flex items-start gap-3.5 p-3.5 rounded-[20px] bg-white dark:bg-[#181517] border border-[#EBE3E5] dark:border-[#242024] shadow-2xs">
                  <div className="w-10 h-10 rounded-[14px] bg-[#FAF2E8] dark:bg-[#261E16] border border-[#F2DECF] dark:border-[#423122] flex items-center justify-center text-[#E2925A] shrink-0 mt-0.5">
                    <Sparkles size={19} />
                  </div>
                  <div>
                    <h4 className="font-display text-sm font-bold text-[#343033] dark:text-white">
                      Всё ваше звёздное небо
                    </h4>
                    <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-0.5 leading-snug">
                      Все созвездия и предыдущие месяцы с самого начала создания пары
                    </p>
                  </div>
                </div>

                {/* Benefit 3: Приватность */}
                <div className="flex items-start gap-3.5 p-3.5 rounded-[20px] bg-white dark:bg-[#181517] border border-[#EBE3E5] dark:border-[#242024] shadow-2xs">
                  <div className="w-10 h-10 rounded-[14px] bg-[#EDF4FB] dark:bg-[#151E28] border border-[#D5E3F0] dark:border-[#233547] flex items-center justify-center text-[#4A6B82] shrink-0 mt-0.5">
                    <Shield size={19} />
                  </div>
                  <div>
                    <h4 className="font-display text-sm font-bold text-[#343033] dark:text-white">
                      Для вас двоих
                    </h4>
                    <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-0.5 leading-snug">
                      1 покупка действует сразу на 2 устройства навсегда
                    </p>
                  </div>
                </div>
              </div>

              {/* Single Clear One-Time Purchase Card */}
              <div className="p-4 rounded-[24px] bg-white dark:bg-[#181517] border-2 border-[#F0B9C6] dark:border-[#522934] shadow-2xs mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-[#FFF0F3] dark:bg-[#2B171E] flex items-center justify-center text-[#E98787] shrink-0">
                    <Heart size={18} className="fill-[#E98787]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-bold text-[#343033] dark:text-white">
                        Разовая покупка для пары
                      </span>
                    </div>
                    <p className="text-[11px] text-[#777277] dark:text-[#B8B2B5] mt-0.5">
                      Подписка распространяется на пару — 2 устройства.
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-display text-lg font-bold text-[#343033] dark:text-white">
                    199 ₽
                  </span>
                  <span className="block text-[10px] font-medium text-[#777277] dark:text-[#B8B2B5]">
                    разово
                  </span>
                </div>
              </div>

              {/* Error notice if payment failed */}
              {paymentError && (
                <div className="p-3 mb-3 rounded-[16px] bg-[#FAF0F2] dark:bg-[#2A151B] border border-[#F2D1D8] dark:border-[#4A202A] text-xs text-[#E98787] text-center">
                  {paymentError}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2 pt-2">
              <PrimaryButton
                variant="coral"
                onClick={handleBuy}
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Подключение к оплате...</span>
                  </span>
                ) : (
                  'Купить LOVELY'
                )}
              </PrimaryButton>

              <button
                type="button"
                onClick={onClose}
                disabled={isProcessingPayment}
                className="w-full py-2 text-center text-xs font-semibold text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                Не сейчас
              </button>

              <p className="text-center text-[11px] text-[#8A8488] dark:text-[#A8A2A5] pt-0.5 leading-snug">
                Продолжая, вы принимаете{' '}
                <button
                  type="button"
                  onClick={() => onOpenTerms?.()}
                  className="text-[#E98787] dark:text-[#F0B9C6] underline hover:opacity-80 transition-opacity cursor-pointer inline font-medium"
                >
                  Пользовательское соглашение
                </button>
                .
              </p>
            </div>
          </div>
        )}

        {/* «Скоро появится» Modal Dialog */}
        {showComingSoon && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[3px] rounded-t-[32px] sm:rounded-[28px] animate-in fade-in duration-200"
            onClick={() => setShowComingSoon(false)}
          >
            <div
              className="w-full max-w-[320px] bg-white dark:bg-[#181517] border border-[#F2D6DC] dark:border-[#352127] rounded-[26px] p-6 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close icon button */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(true);
                  setShowComingSoon(false);
                }}
                className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-[#FAF5F7] dark:bg-[#221C20] border border-transparent dark:border-[#2C242A] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="Закрыть"
              >
                <X size={15} />
              </button>

              {/* Sparkle Emblem */}
              <div className="w-12 h-12 rounded-full bg-[#FAF0F2] dark:bg-[#2A161E] border border-[#F2D1D8] dark:border-[#42222B] text-[#E98787] flex items-center justify-center mb-3.5 mt-1 shadow-2xs">
                <Sparkles size={22} className="text-[#E98787]" />
              </div>

              {/* Title */}
              <h3 className="font-display text-lg font-bold text-[#343033] dark:text-white tracking-tight mb-1.5">
                Скоро появится
              </h3>

              {/* Description */}
              <p className="text-xs text-[#777277] dark:text-[#B8B2B5] leading-relaxed mb-5 max-w-[240px]">
                Возможность покупки LOVELY станет доступна в ближайшее время.
              </p>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(true);
                  setShowComingSoon(false);
                }}
                className="w-full py-2.5 px-4 rounded-[18px] bg-[#FAF0F2] dark:bg-[#26151A] hover:bg-[#F4E1E6] dark:hover:bg-[#341A22] border border-[#F2D1D8] dark:border-[#42222B] text-[#E98787] dark:text-[#F0B9C6] text-xs font-bold transition-all active:scale-[0.98] cursor-pointer shadow-2xs"
              >
                Понятно
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
