import React, { useState, useRef } from 'react';
import { PrimaryButton } from './PrimaryButton';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Lock,
  Sparkles,
  Link as LinkIcon,
  Heart,
  Coffee,
  Copy,
  KeyRound,
  Mail,
  Camera,
  RotateCcw,
  Clock,
  Calendar,
  Layers,
} from 'lucide-react';
import { playSoftChime, triggerHaptic } from '../services/feedback';
import { copyToClipboard } from '../services/device/clipboard';
import { OursLogo } from './OursLogo';

export interface OnboardingCompleteResult {
  success: boolean;
  inviteCode?: string;
  pairId?: string;
  error?: string;
}

interface OnboardingFlowProps {
  onComplete: (
    userName: string,
    options?: {
      isJoin?: boolean;
      inviteCode?: string;
      isRestore?: boolean;
      personalCode?: string;
    }
  ) => Promise<OnboardingCompleteResult | void> | void;
  onFinish?: () => void;
  onClose?: () => void;
  isPreview?: boolean;
}

type OnboardingView = 'slide-1' | 'slide-2' | 'slide-3' | 'slide-4' | 'hub' | 'create' | 'join' | 'restore' | 'created-code';

const ONBOARDING_SLIDES: OnboardingView[] = ['slide-1', 'slide-2', 'slide-3', 'slide-4'];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  onFinish,
  onClose,
  isPreview = false,
}) => {
  const [view, setView] = useState<OnboardingView>('slide-1');
  const [userName, setUserName] = useState<string>('');
  const [joinName, setJoinName] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [restoreCode, setRestoreCode] = useState<string>('');
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [shakeField, setShakeField] = useState<'create-name' | 'join-name' | 'join-code' | 'restore-code' | null>(null);

  // Touch gesture state for horizontal slide swipes
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Helper for toasts with auto-dismiss
  const showToast = (message: string) => {
    setToastMessage(message);
    triggerHaptic(true);
    playSoftChime('tap', true);
    setTimeout(() => {
      setToastMessage((cur) => (cur === message ? null : cur));
    }, 2400);
  };

  // Helper for shaking field
  const triggerShake = (field: 'create-name' | 'join-name' | 'join-code' | 'restore-code') => {
    setShakeField(field);
    setTimeout(() => setShakeField(null), 400);
  };

  // Skip onboarding entirely and open the couple selection hub
  const handleSkip = () => {
    triggerHaptic(true);
    playSoftChime('tap', true);
    setView('hub');
  };

  // Next slide navigation
  const handleNextSlide = (next: OnboardingView) => {
    triggerHaptic(true);
    playSoftChime('tap', true);
    setView(next);
  };

  // Prev slide navigation
  const handleBack = (prev: OnboardingView) => {
    triggerHaptic(true);
    playSoftChime('tap', true);
    setView(prev);
  };

  // Touch swipe gesture handlers for switching slides cleanly
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!ONBOARDING_SLIDES.includes(view) || e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!ONBOARDING_SLIDES.includes(view) || !touchStartRef.current) return;
    const start = touchStartRef.current;
    touchStartRef.current = null;

    if (e.changedTouches.length !== 1) return;
    const touch = e.changedTouches[0];

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const timeElapsed = Date.now() - start.time;

    // Thresholds: min 45px, horizontal dominance (> 1.25x vertical), max 800ms
    const MIN_DISTANCE = 45;
    const MAX_TIME = 800;

    if (absX >= MIN_DISTANCE && absX > absY * 1.25 && timeElapsed <= MAX_TIME) {
      const currentIdx = ONBOARDING_SLIDES.indexOf(view);
      if (currentIdx === -1) return;

      if (deltaX < 0) {
        // Swipe Left -> Next slide
        if (currentIdx < ONBOARDING_SLIDES.length - 1) {
          handleNextSlide(ONBOARDING_SLIDES[currentIdx + 1]);
        }
      } else {
        // Swipe Right -> Previous slide
        if (currentIdx > 0) {
          handleBack(ONBOARDING_SLIDES[currentIdx - 1]);
        }
      }
    }
  };

  // Create couple submission
  const handleCreateSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = userName.trim();
    if (!trimmed) {
      triggerShake('create-name');
      showToast('Напиши, как тебя зовут');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await onComplete(trimmed, { isJoin: false });
      if (result && result.inviteCode) {
        setCreatedInviteCode(result.inviteCode);
        triggerHaptic(true);
        playSoftChime('match', true);
        setView('created-code');
      } else if (result?.error) {
        showToast(result.error);
      }
    } catch (err: any) {
      showToast(err.message || 'Ошибка создания пары');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Join couple submission
  const handleJoinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = joinName.trim();
    const trimmedCode = joinCode.trim();

    if (!trimmedName) {
      triggerShake('join-name');
      showToast('Напиши, как тебя зовут');
      return;
    }

    if (!trimmedCode) {
      triggerShake('join-code');
      showToast('Введи код приглашения');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onComplete(trimmedName, { isJoin: true, inviteCode: trimmedCode });
      if (result?.error) {
        showToast(result.error);
      }
    } catch (err: any) {
      showToast(err.message || 'Ошибка подключения к паре');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Restore personal code submission
  const handleRestoreSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = restoreCode.trim();

    if (!trimmed) {
      triggerShake('restore-code');
      showToast('Введи твой код OURS');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await onComplete('', {
        isRestore: true,
        personalCode: trimmed,
      });

      if (result && result.success === false) {
        triggerShake('restore-code');
        showToast(result.error || 'Не удалось восстановить пару');
      }
    } catch (err: any) {
      triggerShake('restore-code');
      showToast(err?.message || 'Не удалось восстановить пару');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9FA] dark:bg-[#000000] text-[#343033] dark:text-white flex flex-col justify-between selection:bg-[#F6DCE1] relative font-sans overflow-x-hidden transition-colors duration-200">
      {/* Toast message alert */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-[#343033] dark:bg-[#1E1C1E] border border-[#000000]/10 dark:border-[#242024] text-white text-xs font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.25)] flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-none max-w-[90vw]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#E98787] dark:bg-[#F0B9C6] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Frame Container */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="w-full max-w-md mx-auto flex flex-col min-h-screen relative p-6 sm:px-8 justify-between touch-pan-y select-none"
      >
        {/* ========================================================= */}
        {/* ========================================================= */}
        {/* SLIDE 1 — «СВИДАНИЕ» 💌                                  */}
        {/* ========================================================= */}
        {view === 'slide-1' && (
          <div className="flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* Top Bar: Skip right or Close if preview */}
            <div className="flex items-center justify-end h-10">
              {isPreview && onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-[#FAF0F2] dark:bg-[#201518] text-[#E98787] dark:text-[#F0B9C6] border border-[#EED7DC] dark:border-[#382329] hover:bg-[#F6E2E6] dark:hover:bg-[#2A181E] transition-all cursor-pointer active:scale-95 shadow-2xs"
                >
                  Закрыть
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="text-xs font-medium text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white px-2 py-1 rounded-full transition-colors cursor-pointer"
                >
                  Пропустить
                </button>
              )}
            </div>

            {/* Center Motif: «Свидание» Envelope & Invitation Preview */}
            <div className="my-auto py-4 flex flex-col items-center text-center">
              <div className="relative mb-6 animate-gentle-float w-full max-w-[280px]">
                {/* Background aura */}
                <div className="absolute inset-0 rounded-[32px] bg-gradient-to-tr from-[#F6DCE1]/40 via-[#FAF0F2]/20 to-[#EDF4FB]/30 dark:from-[#25151A]/60 dark:via-transparent dark:to-[#151D26]/40 blur-xl pointer-events-none" />

                {/* Card Container mimicking DateScreen */}
                <div className="relative rounded-[28px] bg-white dark:bg-[#141214] soft-card-shadow border border-[#F0E6E8] dark:border-[#242024] p-4 flex flex-col items-center gap-3">
                  {/* Badge */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF0F2] dark:bg-[#201518] border border-[#EED7DC] dark:border-[#382329] text-[#E98787] dark:text-[#F0B9C6] text-[11px] font-semibold tracking-wide">
                    <Mail size={13} />
                    <span>Свидание</span>
                  </span>

                  {/* Envelope / Invitation Card Box */}
                  <div className="w-full rounded-[22px] bg-gradient-to-br from-[#FFF5F7] via-[#FFF9FA] to-[#FAF0F2] dark:from-[#1E1417] dark:via-[#181215] dark:to-[#151013] p-4 border border-[#F0E6E8] dark:border-[#352126] flex flex-col items-center text-center gap-2.5 relative overflow-hidden">
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#25181D] soft-card-shadow flex items-center justify-center text-[#E98787] dark:text-[#F0B9C6] border border-[#F0E6E8] dark:border-[#382329] shrink-0">
                      <Heart size={22} className="fill-[#E98787]/20 text-[#E98787] dark:text-[#F0B9C6]" />
                    </div>

                    <div>
                      <p className="font-display font-bold text-sm text-[#343033] dark:text-white leading-snug">
                        Романтический ужин ♡
                      </p>
                      <p className="text-[11px] font-medium text-[#777277] dark:text-[#B8B2B5] mt-1 flex items-center justify-center gap-1">
                        <Clock size={11} className="text-[#E98787]" />
                        <span>Завтра в 19:30</span>
                      </p>
                    </div>

                    {/* Interactive-looking buttons */}
                    <div className="flex items-center justify-center gap-2 pt-1 w-full">
                      <div className="flex-1 py-1.5 px-3 rounded-full bg-[#E98787] text-white font-semibold text-xs shadow-2xs">
                        Принять ♡
                      </div>
                      <div className="py-1.5 px-3 rounded-full bg-white dark:bg-[#201518] text-[#777277] dark:text-[#B8B2B5] font-medium text-xs border border-[#EBE3E5] dark:border-[#382329]">
                        Не смогу
                      </div>
                    </div>
                  </div>

                  {/* Footnote */}
                  <div className="flex items-center justify-between w-full px-1 text-[10px] text-[#777277] dark:text-[#B8B2B5] font-medium">
                    <span>Приглашение отправлено</span>
                    <span className="text-[#E98787] dark:text-[#F0B9C6] font-semibold">Ожидает ответа</span>
                  </div>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-3 max-w-[320px]">
                <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] dark:text-white tracking-tight leading-snug">
                  Находите поводы быть ближе
                </h1>
                <p className="text-sm text-[#777277] dark:text-[#B8B2B5] leading-relaxed">
                  Отправляйте друг другу приглашения на свидание прямо в OURS. Один предлагает провести время вместе, другой принимает приглашение или отказывает.
                </p>
              </div>
            </div>

            {/* Bottom Progress & CTA */}
            <div className="pb-4 pt-6 space-y-6">
              {/* 4 Indicators */}
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-7 h-2 rounded-full bg-[#E98787] dark:bg-[#F0B9C6] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] dark:bg-[#2A2428] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] dark:bg-[#2A2428] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] dark:bg-[#2A2428] transition-all duration-300" />
              </div>

              <PrimaryButton variant="coral" onClick={() => handleNextSlide('slide-2')}>
                Далее
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SLIDE 2 — «КАСАНИЕ» 🌙                                    */}
        {/* ========================================================= */}
        {view === 'slide-2' && (
          <div className="flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* Top Bar: Back on left, Skip on right */}
            <div className="flex items-center justify-between h-10">
              <button
                type="button"
                onClick={() => handleBack('slide-1')}
                className="w-9 h-9 rounded-full bg-white dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-center text-[#343033] dark:text-white transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="Назад"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs font-medium text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white px-2 py-1 rounded-full transition-colors cursor-pointer"
              >
                Пропустить
              </button>
            </div>

            {/* Center Motif: «Касание» Diptych Photo Slots */}
            <div className="my-auto py-4 flex flex-col items-center text-center">
              <div className="relative mb-6 animate-gentle-float w-full max-w-[310px]">
                {/* Background aura */}
                <div className="absolute inset-0 rounded-[36px] bg-gradient-to-tr from-[#F6DCE1]/40 via-white to-[#DDEAF7]/30 dark:from-[#221518]/50 dark:via-transparent dark:to-[#151D26]/30 blur-lg pointer-events-none" />

                {/* Diptych Container */}
                <div className="relative p-3.5 rounded-[28px] bg-white dark:bg-[#141214] border border-[#EBE3E5] dark:border-[#242024] shadow-2xs flex flex-col gap-2.5">
                  {/* Top Badge */}
                  <div className="flex items-center justify-between px-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FAF0F2] dark:bg-[#201518] border border-[#EED7DC] dark:border-[#382329] text-[#E98787] dark:text-[#F0B9C6] text-[10px] font-semibold tracking-wide uppercase">
                      <Sparkles size={11} />
                      <span>Касание</span>
                    </span>
                    <span className="text-[10px] font-semibold text-[#E98787] dark:text-[#F0B9C6] flex items-center gap-1">
                      <Sparkles size={11} />
                      <span>Оба готовы</span>
                    </span>
                  </div>

                  {/* Two Diptych Slots Stage */}
                  <div className="relative grid grid-cols-2 gap-2">
                    {/* User Slot */}
                    <div className="aspect-[4/4.8] rounded-[20px] bg-gradient-to-tr from-[#FAF0ED] via-[#F6DCE1] to-[#EED7DC] dark:from-[#201518] dark:via-[#2A181C] dark:to-[#1C1417] border border-[#EBE3E5] dark:border-[#352126] shadow-2xs flex flex-col items-center justify-center p-2 relative overflow-hidden">
                      <div className="w-8 h-8 rounded-xl bg-white/90 dark:bg-[#2A181E] flex items-center justify-center text-[#E98787] shadow-xs mb-1">
                        <Camera size={16} />
                      </div>
                      <span className="text-[10px] font-bold text-[#343033] dark:text-white">Твой кадр</span>
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#E98787] text-white flex items-center justify-center shadow-xs">
                        <Check size={11} strokeWidth={3} />
                      </div>
                    </div>

                    {/* Center connector seal */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-white dark:bg-[#1E1C1E] border border-[#F2DEE3] dark:border-[#382730] shadow-xs flex items-center justify-center text-[#E98787] dark:text-[#F2967F]">
                      <Heart size={12} fill="currentColor" />
                    </div>

                    {/* Partner Slot (Frosted Blur / Reveal preview) */}
                    <div className="aspect-[4/4.8] rounded-[20px] bg-[#FAF5F7] dark:bg-[#181416] border border-dashed border-[#E9C3CB] dark:border-[#382329] flex flex-col items-center justify-center p-2 relative overflow-hidden">
                      <div className="absolute inset-0 backdrop-blur-md bg-white/40 dark:bg-black/40" />
                      <div className="relative z-10 flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-xl bg-white/90 dark:bg-[#201518] shadow-xs flex items-center justify-center text-[#E98787] dark:text-[#F0B9C6] border border-[#EBE3E5] dark:border-[#382329]">
                          <Lock size={15} />
                        </div>
                        <span className="text-[10px] font-bold text-[#343033] dark:text-white">Кадр партнёра</span>
                        <span className="text-[8px] font-semibold text-[#E98787] dark:text-[#F0B9C6]">Скрыто до MATCH</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-3 max-w-[320px]">
                <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] dark:text-white tracking-tight leading-snug">
                  Один момент. На двоих
                </h1>
                <p className="text-sm text-[#777277] dark:text-[#B8B2B5] leading-relaxed">
                  Отправьте друг другу фотографии и откройте их вместе. Когда оба готовы, ваши моменты встречаются в одном касании.
                </p>
              </div>
            </div>

            {/* Bottom Progress & CTA */}
            <div className="pb-4 pt-6 space-y-6">
              {/* 4 Indicators */}
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] dark:bg-[#2A2428] transition-all duration-300" />
                <span className="w-7 h-2 rounded-full bg-[#E98787] dark:bg-[#F0B9C6] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] dark:bg-[#2A2428] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] dark:bg-[#2A2428] transition-all duration-300" />
              </div>

              <PrimaryButton variant="coral" onClick={() => handleNextSlide('slide-3')}>
                Далее
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SLIDE 3 — «НАШ ДЕНЬ» 📸                                   */}
        {/* ========================================================= */}
        {view === 'slide-3' && (
          <div className="flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* Top Bar: Back on left, Skip on right */}
            <div className="flex items-center justify-between h-10">
              <button
                type="button"
                onClick={() => handleBack('slide-2')}
                className="w-9 h-9 rounded-full bg-white dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-center text-[#343033] dark:text-white transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="Назад"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs font-medium text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white px-2 py-1 rounded-full transition-colors cursor-pointer"
              >
                Пропустить
              </button>
            </div>

            {/* Center Motif: «Наш день» Single Photo Card */}
            <div className="my-auto py-4 flex flex-col items-center text-center">
              <div className="relative mb-6 animate-gentle-float w-full max-w-[310px]">
                {/* Background aura */}
                <div className="absolute inset-0 rounded-[36px] bg-gradient-to-tr from-[#F6DCE1]/40 via-white to-[#F0E6E8]/30 dark:from-[#221518]/50 dark:via-transparent dark:to-[#1A1417]/30 blur-lg pointer-events-none" />

                {/* Shared Panel Container mimicking OurDayScreen */}
                <div className="relative rounded-[28px] bg-white dark:bg-[#141214] border border-[#EBE3E5] dark:border-[#242024] shadow-2xs p-4 flex flex-col gap-3">
                  {/* Top Badge Header */}
                  <div className="flex items-center justify-between px-0.5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF0F2] dark:bg-[#201518] border border-[#EED7DC] dark:border-[#382329] text-[#E98787] dark:text-[#F0B9C6] text-[11px] font-semibold tracking-wide">
                      <Camera size={13} />
                      <span>Наш день</span>
                    </span>
                    <span className="text-[10px] text-[#777277] dark:text-[#B8B2B5] font-medium">16 октября</span>
                  </div>

                  {/* SINGLE Photo Frame Stage */}
                  <div className="relative w-full aspect-[16/10.5] rounded-[22px] overflow-hidden bg-gradient-to-br from-[#FFF5F7] via-[#FFF9FA] to-[#FAF0F2] dark:from-[#1A1417] dark:via-[#161114] dark:to-[#130E11] border border-[#F0E6E8] dark:border-[#332227] shadow-2xs flex flex-col items-center justify-center p-3 select-none">
                    {/* Author Badge Top-Left */}
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[10px] font-medium text-white flex items-center gap-1 z-10">
                      <span>Ты</span>
                    </div>

                    {/* Central single photo presentation icon / graphics */}
                    <div className="w-11 h-11 rounded-2xl bg-white/90 dark:bg-[#201518] shadow-xs border border-[#F0E6E8] dark:border-[#382329] flex items-center justify-center text-[#E98787] dark:text-[#F0B9C6] mb-1.5">
                      <Camera size={20} />
                    </div>
                    <span className="font-display font-semibold text-xs text-[#343033] dark:text-white">
                      Мой момент дня
                    </span>
                    <span className="text-[10px] text-[#777277] dark:text-[#B8B2B5] mt-0.5">
                      Сохранено в общую историю
                    </span>

                    {/* Replaced photo mechanics notice button at bottom */}
                    <div className="absolute bottom-2.5 inset-x-3 flex justify-center">
                      <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-white/95 dark:bg-[#201518]/95 backdrop-blur-md border border-[#EED7DC] dark:border-[#382329] text-[10px] font-semibold text-[#343033] dark:text-white shadow-2xs">
                        <RotateCcw size={10} className="text-[#E98787] dark:text-[#F0B9C6]" />
                        <span>В течение дня можно заменить</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-3 max-w-[320px]">
                <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] dark:text-white tracking-tight leading-snug">
                  Сохраняйте то, из чего состоит жизнь
                </h1>
                <p className="text-sm text-[#777277] dark:text-[#B8B2B5] leading-relaxed">
                  Делитесь фотографиями своего дня — маленькими моментами, которые хочется сохранить. Со временем из них складывается история вашей обычной, настоящей жизни.
                </p>
              </div>
            </div>

            {/* Bottom Progress & CTA */}
            <div className="pb-4 pt-6 space-y-6">
              {/* 4 Indicators */}
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] dark:bg-[#2A2428] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] dark:bg-[#2A2428] transition-all duration-300" />
                <span className="w-7 h-2 rounded-full bg-[#E98787] dark:bg-[#F0B9C6] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] dark:bg-[#2A2428] transition-all duration-300" />
              </div>

              <PrimaryButton variant="coral" onClick={() => handleNextSlide('slide-4')}>
                Далее
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SLIDE 4 — «ИСТОРИЯ» ✨                                    */}
        {/* ========================================================= */}
        {view === 'slide-4' && (
          <div className="flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* Top Bar: Back on left, Skip on right */}
            <div className="flex items-center justify-between h-10">
              <button
                type="button"
                onClick={() => handleBack('slide-3')}
                className="w-9 h-9 rounded-full bg-white dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-center text-[#343033] dark:text-white transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="Назад"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs font-medium text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white px-2 py-1 rounded-full transition-colors cursor-pointer"
              >
                Пропустить
              </button>
            </div>

            {/* Center Motif: «История» Exact Replica of HistoryScreen */}
            <div className="my-auto py-4 flex flex-col items-center text-center">
              <div className="relative mb-6 animate-gentle-float w-full max-w-[310px]">
                {/* Background aura */}
                <div className="absolute inset-0 rounded-[36px] bg-gradient-to-tr from-[#F6DCE1]/40 via-white to-[#EDF4FB]/30 dark:from-[#221518]/50 dark:via-transparent dark:to-[#151D26]/30 blur-lg pointer-events-none" />

                {/* Main Card Container reproducing HistoryScreen */}
                <div className="relative rounded-[28px] bg-white dark:bg-[#141214] border border-[#EBE3E5] dark:border-[#242024] shadow-2xs p-4 flex flex-col gap-3">
                  {/* Top Bar matching HistoryScreen: Title & Segmented View Mode Toggle */}
                  <div className="flex items-center justify-between px-0.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={14} className="text-[#E98787]" />
                      <h2 className="font-display font-bold text-sm text-[#343033] dark:text-white">
                        История
                      </h2>
                    </div>

                    {/* Segmented View Mode Toggle from HistoryScreen */}
                    <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-[#F5EFF1] dark:bg-[#1E1A1D] border border-[#EBE3E5] dark:border-[#282126] shadow-2xs">
                      <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white dark:bg-[#282025] text-[#343033] dark:text-white text-[10px] font-semibold shadow-xs">
                        <Calendar size={10} />
                        <span>По дням</span>
                      </div>
                      <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[#777277] dark:text-[#A8A0A6] text-[10px] font-semibold">
                        <Layers size={10} />
                        <span>Лента</span>
                      </div>
                    </div>
                  </div>

                  {/* Day Entry Card from HistoryScreen */}
                  <div className="w-full rounded-[22px] bg-gradient-to-br from-[#FFF5F7] via-[#FFF9FA] to-[#FAF0F2] dark:from-[#1A1417] dark:via-[#161114] dark:to-[#130E11] p-3 border border-[#F0E6E8] dark:border-[#332227] flex flex-col gap-2 relative">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-[#343033] dark:text-white px-1">
                      <span>15 октября · Вчера</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#FAF0F2] dark:bg-[#201518] text-[9px] font-bold text-[#E98787] uppercase border border-[#F5D8DF] dark:border-[#382329]">
                        Свидание
                      </span>
                    </div>

                    {/* Full-width photo memory frame matching HistoryScreen single photo card */}
                    <div className="relative aspect-[16/9.5] w-full rounded-[18px] overflow-hidden bg-gradient-to-br from-[#FCE6EB] to-[#F5D8DF] dark:from-[#2A1820] dark:to-[#201217] border border-[#EBE3E5] dark:border-[#282024] flex items-center justify-center p-3">
                      <div className="flex flex-col items-center gap-1 text-center">
                        <Heart size={20} className="text-[#E98787] fill-[#E98787]/20" />
                        <span className="font-display font-semibold text-xs text-[#343033] dark:text-white">
                          Вечернее свидание
                        </span>
                      </div>
                      <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-black/45 backdrop-blur-md text-white text-[9px] font-semibold">
                        Совместное фото
                      </div>
                      <div className="absolute bottom-2 right-2 px-2.5 py-0.5 rounded-full bg-white/95 dark:bg-[#1E1C1E]/95 text-[9px] font-bold text-[#343033] dark:text-white shadow-xs border border-[#EBE3E5] dark:border-[#2D2024] flex items-center gap-1">
                        <Heart size={10} className="fill-[#E98787] text-[#E98787]" />
                        <span>MATCH ✨</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-3 max-w-[320px]">
                <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] dark:text-white tracking-tight leading-snug">
                  Ваша история — в каждом моменте
                </h1>
                <p className="text-sm text-[#777277] dark:text-[#B8B2B5] leading-relaxed">
                  Возвращайтесь к фотографиям и моментам, которые вы сохранили вместе. Это ваше личное пространство воспоминаний, которое наполняется вашей общей жизнью.
                </p>
              </div>
            </div>

            {/* Bottom Progress & CTA */}
            <div className="pb-4 pt-6 space-y-6">
              {/* 4 Indicators */}
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] dark:bg-[#2A2428] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] dark:bg-[#2A2428] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] dark:bg-[#2A2428] transition-all duration-300" />
                <span className="w-7 h-2 rounded-full bg-[#E98787] dark:bg-[#F0B9C6] transition-all duration-300" />
              </div>

              <PrimaryButton variant="coral" onClick={() => handleNextSlide('hub')}>
                Начать нашу историю
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SCREEN: «ВАША ПАРА» (Couple Hub)                          */}
        {/* ========================================================= */}
        {view === 'hub' && (
          <div className="flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* Header branding lockup */}
            <div className="pt-2">
              <div className="flex items-center gap-1.5 mb-8">
                <OursLogo size={120} className="shrink-0" />
                <span className="font-display font-semibold tracking-wider text-xl text-[#343033] dark:text-white leading-none select-none">
                  OURS
                </span>
              </div>

              {/* Title & Description */}
              <div className="space-y-2 mb-8">
                <h1 className="font-display text-2xl sm:text-[28px] font-bold text-[#343033] dark:text-white tracking-tight">
                  Ваша пара
                </h1>
                <p className="text-sm text-[#777277] dark:text-[#B8B2B5] leading-relaxed">
                  OURS — пространство только для двоих. Создай пару или войди по коду.
                </p>
              </div>

              {/* Three Action Cards */}
              <div className="space-y-3">
                {/* Card 1: Создать пару */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(true);
                    playSoftChime('tap', true);
                    setView('create');
                  }}
                  className="w-full text-left p-4 sm:p-5 rounded-[24px] bg-white dark:bg-[#141214] shadow-2xs border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-between gap-4 transition-all duration-150 active:scale-[0.98] hover:border-[#E98787]/60 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    {/* Pink Icon Area */}
                    <div className="w-12 h-12 rounded-[16px] bg-[#FAF0F2] dark:bg-[#201518] border border-[#EED7DC] dark:border-[#382329] flex items-center justify-center shrink-0 text-[#E98787] dark:text-[#F0B9C6]">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base text-[#343033] dark:text-white">
                        Создать пару
                      </h3>
                      <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-0.5">
                        Новая пара, приглашение по коду
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-[#CEC5C8] dark:text-[#6E676B] shrink-0" />
                </button>

                {/* Card 2: Присоединиться */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(true);
                    playSoftChime('tap', true);
                    setView('join');
                  }}
                  className="w-full text-left p-4 sm:p-5 rounded-[24px] bg-white dark:bg-[#141214] shadow-2xs border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-between gap-4 transition-all duration-150 active:scale-[0.98] hover:border-[#5B89AC]/60 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    {/* Blue Icon Area */}
                    <div className="w-12 h-12 rounded-[16px] bg-[#EDF4FB] dark:bg-[#151D26] border border-[#D5E3F0] dark:border-[#203040] flex items-center justify-center shrink-0 text-[#4A6B82] dark:text-[#7BAEE8]">
                      <LinkIcon size={20} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base text-[#343033] dark:text-white">
                        Присоединиться
                      </h3>
                      <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-0.5">
                        У тебя уже есть код приглашения
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-[#CEC5C8] dark:text-[#6E676B] shrink-0" />
                </button>

                {/* Card 3: У меня уже есть пара */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(true);
                    playSoftChime('tap', true);
                    setView('restore');
                  }}
                  className="w-full text-left p-4 sm:p-5 rounded-[24px] bg-white dark:bg-[#141214] shadow-2xs border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-between gap-4 transition-all duration-150 active:scale-[0.98] hover:border-[#8B6299]/60 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    {/* Violet/Lilac Icon Area */}
                    <div className="w-12 h-12 rounded-[16px] bg-[#F7F2F9] dark:bg-[#1D1722] border border-[#EBDFEE] dark:border-[#34243D] flex items-center justify-center shrink-0 text-[#8B6299] dark:text-[#D1A8E2]">
                      <KeyRound size={20} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base text-[#343033] dark:text-white">
                        У меня уже есть пара
                      </h3>
                      <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-0.5">
                        Войти в свою пару с нового устройства
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-[#CEC5C8] dark:text-[#6E676B] shrink-0" />
                </button>
              </div>
            </div>

            {/* Back to intro button at bottom */}
            <div className="pb-4 pt-8 text-center">
              <button
                type="button"
                onClick={() => setView('slide-4')}
                className="text-xs font-medium text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white transition-colors cursor-pointer"
              >
                Вернуться к описанию
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: СОЗДАНИЕ ПАРЫ                                  */}
        {/* ========================================================= */}
        {view === 'create' && (
          <form
            onSubmit={handleCreateSubmit}
            className="flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-3 duration-300"
          >
            <div className="pt-2">
              {/* Top Back Button */}
              <div className="flex items-center mb-6">
                <button
                  type="button"
                  onClick={() => setView('hub')}
                  className="w-9 h-9 rounded-full bg-white dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-center text-[#343033] dark:text-white transition-all active:scale-95 cursor-pointer shadow-2xs"
                  title="Назад к выбору"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>

              {/* Title */}
              <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] dark:text-white tracking-tight mb-5">
                Как тебя зовут?
              </h1>

              {/* Name Input Field with Shake validation */}
              <div className="mb-6">
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="например Максим"
                  autoFocus
                  className={`w-full h-[52px] px-4 rounded-[20px] bg-white dark:bg-[#141214] border ${
                    shakeField === 'create-name'
                      ? 'border-[#E98787] animate-shake ring-2 ring-[#E98787]/25'
                      : 'border-[#EBE3E5] dark:border-[#242024]'
                  } text-sm text-[#343033] dark:text-white placeholder:text-[#A69FA3] dark:placeholder:text-[#6E676B] font-medium focus:outline-none focus:border-[#E98787] focus:ring-2 focus:ring-[#E98787]/15 transition-all shadow-2xs`}
                />
              </div>

              {/* Pink Information Card */}
              <div className="p-5 rounded-[24px] bg-[#FAF0F2] dark:bg-[#181416] border border-[#EED7DC] dark:border-[#332227] space-y-2">
                <h3 className="font-display text-sm font-bold text-[#343033] dark:text-white">
                  Пригласи партнёра
                </h3>
                <p className="text-xs text-[#777277] dark:text-[#B8B2B5] leading-relaxed">
                  После создания пары ты получишь персональный уникальный код приглашения для своего партнёра.
                </p>
              </div>
            </div>

            {/* Bottom Button */}
            <div className="pb-4 pt-8">
              <PrimaryButton variant="coral" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Создание...' : 'Готово'}
              </PrimaryButton>
            </div>
          </form>
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: ПРИСОЕДИНИТЬСЯ                                */}
        {/* ========================================================= */}
        {view === 'join' && (
          <form
            onSubmit={handleJoinSubmit}
            className="flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-3 duration-300"
          >
            <div className="pt-2">
              {/* Top Back Button */}
              <div className="flex items-center mb-6">
                <button
                  type="button"
                  onClick={() => setView('hub')}
                  className="w-9 h-9 rounded-full bg-white dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-center text-[#343033] dark:text-white transition-all active:scale-95 cursor-pointer shadow-2xs"
                  title="Назад к выбору"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>

              {/* Title */}
              <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] dark:text-white tracking-tight mb-6">
                Присоединиться
              </h1>

              <div className="space-y-4">
                {/* Field 1: Name */}
                <div>
                  <label className="block text-xs font-semibold text-[#777277] dark:text-[#B8B2B5] mb-2 uppercase tracking-wider">
                    Как тебя зовут?
                  </label>
                  <input
                    type="text"
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="например Таня"
                    autoFocus
                    className={`w-full h-[52px] px-4 rounded-[20px] bg-white dark:bg-[#141214] border ${
                      shakeField === 'join-name'
                        ? 'border-[#E98787] animate-shake ring-2 ring-[#E98787]/25'
                        : 'border-[#EBE3E5] dark:border-[#242024]'
                    } text-sm text-[#343033] dark:text-white placeholder:text-[#A69FA3] dark:placeholder:text-[#6E676B] font-medium focus:outline-none focus:border-[#E98787] focus:ring-2 focus:ring-[#E98787]/15 transition-all shadow-2xs`}
                  />
                </div>

                {/* Field 2: Invite Code */}
                <div>
                  <label className="block text-xs font-semibold text-[#777277] dark:text-[#B8B2B5] mb-2 uppercase tracking-wider">
                    Код приглашения
                  </label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="OURS-7K4M"
                    className={`w-full h-[52px] px-4 rounded-[20px] bg-white dark:bg-[#141214] border ${
                      shakeField === 'join-code'
                        ? 'border-[#E98787] animate-shake ring-2 ring-[#E98787]/25'
                        : 'border-[#EBE3E5] dark:border-[#242024]'
                    } text-sm font-mono tracking-wider text-[#343033] dark:text-white placeholder:text-[#A69FA3] dark:placeholder:text-[#6E676B] font-semibold focus:outline-none focus:border-[#E98787] focus:ring-2 focus:ring-[#E98787]/15 transition-all shadow-2xs`}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Button */}
            <div className="pb-4 pt-8">
              <PrimaryButton variant="coral" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Подключение...' : 'Готово'}
              </PrimaryButton>
            </div>
          </form>
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: ВЕРНУТЬСЯ В OURS (Restore / Personal Code)     */}
        {/* ========================================================= */}
        {view === 'restore' && (
          <form
            onSubmit={handleRestoreSubmit}
            className="flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-3 duration-300"
          >
            <div className="pt-2">
              {/* Top Back Button */}
              <div className="flex items-center mb-6">
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(true);
                    playSoftChime('tap', true);
                    setView('hub');
                  }}
                  className="w-9 h-9 rounded-full bg-white dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-center text-[#343033] dark:text-white transition-all active:scale-95 cursor-pointer shadow-2xs"
                  title="Назад к выбору"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>

              {/* Title & Subtitle */}
              <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] dark:text-white tracking-tight mb-2">
                Вернуться в OURS
              </h1>
              <p className="text-sm text-[#777277] dark:text-[#B8B2B5] leading-relaxed mb-6">
                Введи свой личный код, чтобы открыть свою пару на этом устройстве.
              </p>

              {/* Field: Твой код OURS */}
              <div>
                <label className="block text-xs font-semibold text-[#777277] dark:text-[#B8B2B5] mb-2 uppercase tracking-wider">
                  Твой код OURS
                </label>
                <input
                  type="text"
                  value={restoreCode}
                  onChange={(e) => setRestoreCode(e.target.value.toUpperCase())}
                  placeholder="Твой код OURS"
                  autoFocus
                  className={`w-full h-[52px] px-4 rounded-[20px] bg-white dark:bg-[#141214] border ${
                    shakeField === 'restore-code'
                      ? 'border-[#E98787] animate-shake ring-2 ring-[#E98787]/25'
                      : 'border-[#EBE3E5] dark:border-[#242024]'
                  } text-sm font-mono tracking-wider text-[#343033] dark:text-white placeholder:text-[#A69FA3] dark:placeholder:text-[#6E676B] font-semibold focus:outline-none focus:border-[#E98787] focus:ring-2 focus:ring-[#E98787]/15 transition-all shadow-2xs`}
                />
              </div>

              {/* Note / Additional explanation under the field */}
              <div className="mt-4 p-4 rounded-[20px] bg-[#FAF0F2]/70 dark:bg-[#1A1417] border border-[#EED7DC]/80 dark:border-[#332227] flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-white dark:bg-[#221518] flex items-center justify-center text-[#E98787] dark:text-[#F0B9C6] shadow-2xs shrink-0 mt-0.5">
                  <Lock size={13} />
                </div>
                <p className="text-xs text-[#777277] dark:text-[#B8B2B5] leading-relaxed">
                  Этот код принадлежит только тебе. Не передавай его партнёру.
                </p>
              </div>
            </div>

            {/* Bottom Button */}
            <div className="pb-4 pt-8">
              <PrimaryButton variant="coral" type="submit" disabled={isSubmitting}>
                Продолжить
              </PrimaryButton>
            </div>
          </form>
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: КОД ПРИГЛАШЕНИЯ                              */}
        {/* ========================================================= */}
        {view === 'created-code' && (
          <div className="flex-1 flex flex-col justify-between animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="pt-2">
              {/* Header branding lockup */}
              <div className="flex items-center gap-1.5 mb-6">
                <OursLogo size={120} className="shrink-0" />
                <span className="font-display font-semibold tracking-wider text-xl text-[#343033] dark:text-white leading-none select-none">
                  OURS
                </span>
              </div>

              {/* Title & Description */}
              <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] dark:text-white tracking-tight mb-2">
                Код для партнёра
              </h1>
              <p className="text-sm text-[#777277] dark:text-[#B8B2B5] leading-relaxed mb-6">
                Отправь этот код своей второй половинке. Партнёр сможет ввести его при входе в OURS.
              </p>

              {/* Large Prominent Invite Code Card */}
              <div className="p-6 rounded-[24px] bg-gradient-to-br from-[#FAF0F2] via-white to-[#FAF0F2] dark:from-[#181416] dark:via-[#141214] dark:to-[#181416] border border-[#EED7DC] dark:border-[#332227] shadow-xs text-center space-y-4">
                <span className="text-[11px] font-bold tracking-wider text-[#777277] dark:text-[#B8B2B5] uppercase">
                  Код приглашения
                </span>

                <div className="font-mono text-3xl sm:text-4xl font-extrabold tracking-widest text-[#E98787] dark:text-[#F0B9C6] select-all py-1">
                  {createdInviteCode || 'OURS-XXXX'}
                </div>

                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      if (createdInviteCode) {
                        try {
                          await copyToClipboard(createdInviteCode);
                        } catch {}
                        showToast('Код скопирован в буфер ✨');
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-[#201518] text-xs font-bold text-[#343033] dark:text-white border border-[#EBE3E5] dark:border-[#382329] shadow-2xs hover:bg-[#FAF0F2] dark:hover:bg-[#2A181E] transition-all active:scale-95 cursor-pointer"
                  >
                    <Copy size={14} className="text-[#E98787] dark:text-[#F0B9C6]" />
                    <span>Скопировать код</span>
                  </button>
                </div>
              </div>

              {/* Note card */}
              <div className="mt-4 p-4 rounded-[18px] bg-white dark:bg-[#141214] border border-[#EBE3E5] dark:border-[#242024] flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#FAF0F2] dark:bg-[#201518] flex items-center justify-center text-[#E98787] dark:text-[#F0B9C6] shrink-0">
                  <Sparkles size={16} />
                </div>
                <p className="text-xs text-[#777277] dark:text-[#B8B2B5] leading-relaxed">
                  Код также всегда доступен в вашем профиле в настройках.
                </p>
              </div>
            </div>

            {/* Bottom Action */}
            <div className="pb-4 pt-8">
              <PrimaryButton
                variant="coral"
                onClick={() => {
                  triggerHaptic(true);
                  playSoftChime('tap', true);
                  if (onFinish) {
                    onFinish();
                  }
                }}
              >
                Продолжить
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
