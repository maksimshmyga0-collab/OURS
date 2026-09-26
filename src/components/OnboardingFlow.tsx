import React, { useState } from 'react';
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
} from 'lucide-react';
import { playSoftChime, triggerHaptic } from '../services/feedback';
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
    options?: { isJoin?: boolean; inviteCode?: string }
  ) => Promise<OnboardingCompleteResult | void> | void;
  onFinish?: () => void;
  onClose?: () => void;
  isPreview?: boolean;
}

type OnboardingView = 'slide-1' | 'slide-2' | 'slide-3' | 'slide-4' | 'hub' | 'create' | 'join' | 'created-code';

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
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [shakeField, setShakeField] = useState<'create-name' | 'join-name' | 'join-code' | null>(null);

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
  const triggerShake = (field: 'create-name' | 'join-name' | 'join-code') => {
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
      <div className="w-full max-w-md mx-auto flex flex-col min-h-screen relative p-6 sm:px-8 justify-between">
        {/* ========================================================= */}
        {/* SLIDE 1                                                   */}
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

            {/* Center Motif: Official OURS hugging stars logo */}
            <div className="my-auto py-4 flex flex-col items-center text-center">
              <div className="relative mb-4 w-full max-w-[340px] h-72 sm:h-80 flex items-center justify-center">
                <OursLogo size={665} animate />
              </div>

              {/* Title & Description */}
              <div className="space-y-3 max-w-[310px]">
                <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] dark:text-white tracking-tight leading-snug">
                  Ежедневный ритуал для двоих.
                </h1>
                <p className="text-sm text-[#777277] dark:text-[#B8B2B5] leading-relaxed">
                  Маленькие моменты, которые становятся вашей общей историей.
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
                Начать
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SLIDE 2                                                   */}
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

            {/* Center Motif: «Касание дня» card */}
            <div className="my-auto py-8 flex flex-col items-center text-center">
              <div className="relative mb-8 animate-gentle-float">
                {/* Background aura */}
                <div className="absolute inset-0 rounded-[32px] bg-gradient-to-tr from-[#DDEAF7]/50 via-white to-[#F6DCE1]/40 dark:from-[#151D26]/40 dark:via-transparent dark:to-[#221518]/40 blur-xl pointer-events-none" />

                {/* Card Container */}
                <div className="relative w-56 rounded-[28px] bg-white dark:bg-[#141214] soft-card-shadow border border-[#F0E6E8] dark:border-[#242024] p-4 flex flex-col items-center gap-3">
                  {/* Badge */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF9FA] dark:!bg-[#201518] border border-[#F6DCE1] dark:border-[#382329] text-[#E98787] dark:text-[#F0B9C6] text-[11px] font-semibold tracking-wide">
                    <Sparkles size={12} />
                    <span>Касание дня</span>
                  </span>

                  {/* Visual card content: cozy prompt */}
                  <div className="w-full rounded-[22px] bg-gradient-to-br from-[#FFF5F7] via-[#FFF9FA] to-[#F7D8D0]/40 dark:from-[#1C1417] dark:via-[#191417] dark:to-[#171418] p-4 border border-[#F0E6E8]/70 dark:border-[#2D2024] flex flex-col items-center text-center gap-2">
                    <div className="w-11 h-11 rounded-2xl bg-white dark:!bg-[#201518] soft-card-shadow flex items-center justify-center text-[#E98787] dark:text-[#F0B9C6] border border-[#F0E6E8] dark:border-[#382329]">
                      <Coffee size={20} />
                    </div>
                    <div>
                      <p className="font-display font-semibold text-xs text-[#343033] dark:text-white">
                        Покажи, что сейчас рядом с тобой
                      </p>
                      <p className="text-[10px] text-[#777277] dark:text-[#B8B2B5] mt-0.5">
                        Тёплый кусочек твоего дня
                      </p>
                    </div>
                  </div>

                  {/* Footnote */}
                  <div className="flex items-center justify-between w-full px-1 text-[10px] text-[#777277] dark:text-[#B8B2B5] font-medium">
                    <span>Сейчас</span>
                    <span className="text-[#E98787] dark:text-[#F0B9C6] font-semibold">1 из 3 сегодня</span>
                  </div>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-3 max-w-[310px]">
                <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] dark:text-white tracking-tight leading-snug">
                  Получайте небольшой повод быть ближе.
                </h1>
                <p className="text-sm text-[#777277] dark:text-[#B8B2B5] leading-relaxed">
                  Каждый день — новое касание только для вас двоих.
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
        {/* SLIDE 3                                                   */}
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

            {/* Center Motif: Two slots (one filled, second locked) */}
            <div className="my-auto py-8 flex flex-col items-center text-center">
              <div className="relative mb-8 animate-gentle-float">
                {/* Background aura */}
                <div className="absolute inset-0 rounded-[36px] bg-gradient-to-tr from-[#F6DCE1]/30 via-white to-[#DDEAF7]/30 dark:from-[#221518]/30 dark:via-transparent dark:to-[#151D26]/30 blur-lg pointer-events-none" />

                {/* Slots Stage */}
                <div className="relative flex items-center justify-center gap-3 p-3.5 rounded-[26px] bg-white dark:bg-[#141214] border border-[#EBE3E5] dark:border-[#242024] shadow-2xs">
                  {/* Slot 1: Filled Photo */}
                  <div className="w-24 h-32 rounded-[20px] overflow-hidden relative border border-[#EBE3E5] dark:border-[#242024] shadow-2xs bg-gradient-to-tr from-[#FAF0ED] via-[#F6DCE1] to-[#EED7DC] dark:from-[#201518] dark:via-[#2A181C] dark:to-[#1C1417] flex items-center justify-center">
                    <Sparkles size={24} className="text-[#E98787] opacity-80" />
                    {/* Badge: Ready */}
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-white/95 dark:bg-[#1E1C1E]/95 text-[9px] font-bold text-[#343033] dark:text-white shadow-2xs">
                      Ты
                    </div>
                    <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-[#E98787] text-white flex items-center justify-center shadow-xs">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  </div>

                  {/* Center connector */}
                  <div className="w-6 h-6 rounded-full bg-white dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-center text-[#E98787] shadow-2xs shrink-0">
                    <Heart size={10} className="fill-[#E98787]" />
                  </div>

                  {/* Slot 2: Hidden / Locked */}
                  <div className="w-24 h-32 rounded-[20px] bg-[#FAF5F7] dark:bg-[#181416] border border-dashed border-[#E9C3CB] dark:border-[#382329] flex flex-col items-center justify-center gap-1.5 relative p-2 shadow-2xs">
                    {/* Badge */}
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-white/95 dark:bg-[#1E1C1E]/95 text-[9px] font-bold text-[#777277] dark:text-[#B8B2B5] shadow-2xs">
                      Партнёр
                    </div>

                    <div className="w-9 h-9 rounded-full bg-white dark:bg-[#201518] shadow-2xs flex items-center justify-center text-[#E98787] dark:text-[#F0B9C6] border border-[#EBE3E5] dark:border-[#382329]">
                      <Lock size={15} />
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-[#343033] dark:text-white">Скрыто</p>
                      <p className="text-[8px] text-[#777277] dark:text-[#B8B2B5]">до MATCH</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-3 max-w-[310px]">
                <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] dark:text-white tracking-tight leading-snug">
                  Сделайте фото.
                </h1>
                <p className="text-sm text-[#777277] dark:text-[#B8B2B5] leading-relaxed">
                  Ваши фотографии остаются скрытыми до тех пор, пока не будут готовы оба.
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
        {/* SLIDE 4                                                   */}
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

            {/* Center Motif: Official OURS hugging stars logo + MATCH Effect */}
            <div className="my-auto py-4 flex flex-col items-center text-center">
              <div className="relative mb-4 w-full max-w-[340px] h-72 sm:h-80 flex items-center justify-center">
                <OursLogo size={630} animate />

                {/* Floating MATCH badge that emerges with the logo */}
                <div className="absolute -bottom-1 z-20 pointer-events-none animate-match-pill flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#1E1C1E] shadow-xs border border-[#EBE3E5] dark:border-[#242024]">
                  <span className="w-2 h-2 rounded-full bg-[#E98787] dark:bg-[#F0B9C6] animate-ping" />
                  <span className="font-display text-xs font-bold tracking-widest text-[#343033] dark:text-white">
                    MATCH
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-3 max-w-[310px]">
                <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] dark:text-white tracking-tight leading-snug">
                  Откройте его вместе.
                </h1>
                <p className="text-sm text-[#777277] dark:text-[#B8B2B5] leading-relaxed">
                  Когда готовы оба — происходит MATCH.
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
                Создать пару
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

              {/* Two Big Action Cards */}
              <div className="space-y-3.5">
                {/* Card 1: Создать пару */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(true);
                    playSoftChime('tap', true);
                    setView('create');
                  }}
                  className="w-full text-left p-5 rounded-[24px] bg-white dark:bg-[#141214] shadow-2xs border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-between gap-4 transition-all duration-150 active:scale-[0.98] hover:border-[#E98787]/60 cursor-pointer"
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
                  className="w-full text-left p-5 rounded-[24px] bg-white dark:bg-[#141214] shadow-2xs border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-between gap-4 transition-all duration-150 active:scale-[0.98] hover:border-[#5B89AC]/60 cursor-pointer"
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
                    onClick={() => {
                      if (createdInviteCode) {
                        navigator.clipboard.writeText(createdInviteCode);
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
