import React, { useState } from 'react';
import { PrimaryButton } from './PrimaryButton';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Lock,
  Sparkles,
  Link as LinkIcon,
  Heart,
  Coffee,
} from 'lucide-react';
import { copyToClipboard } from '../services/device/clipboard';
import { playSoftChime, triggerHaptic } from '../services/feedback';
import { PRESET_PHOTOS } from '../services/samplePhotos';

interface OnboardingFlowProps {
  onComplete: (
    userName: string,
    options?: { isJoin?: boolean; inviteCode?: string }
  ) => void;
  defaultInviteCode?: string;
}

type OnboardingView = 'slide-1' | 'slide-2' | 'slide-3' | 'slide-4' | 'hub' | 'create' | 'join';

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  defaultInviteCode = 'OURS-4821',
}) => {
  const [view, setView] = useState<OnboardingView>('slide-1');
  const [userName, setUserName] = useState<string>('');
  const [joinName, setJoinName] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
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

  // Copy code handler
  const handleCopyCode = async () => {
    triggerHaptic(true);
    playSoftChime('tap', true);
    await copyToClipboard(defaultInviteCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
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
  const handleCreateSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = userName.trim();
    if (!trimmed) {
      triggerShake('create-name');
      showToast('Напиши, как тебя зовут');
      return;
    }
    triggerHaptic(true);
    playSoftChime('match', true);
    onComplete(trimmed, { isJoin: false, inviteCode: defaultInviteCode });
  };

  // Join couple submission
  const handleJoinSubmit = (e?: React.FormEvent) => {
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

    triggerHaptic(true);
    playSoftChime('match', true);
    onComplete(trimmedName, { isJoin: true, inviteCode: trimmedCode });
  };

  return (
    <div className="min-h-screen bg-[#FFF9FA] text-[#343033] flex flex-col justify-between selection:bg-[#F6DCE1] relative font-sans overflow-x-hidden">
      {/* Toast message alert */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-[#343033] text-white text-xs font-semibold shadow-[0_8px_24px_rgba(52,48,51,0.18)] flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-none max-w-[90vw]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#E98787] shrink-0" />
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
            {/* Top Bar: Skip right */}
            <div className="flex items-center justify-end h-10">
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs font-medium text-[#777277] hover:text-[#343033] px-2 py-1 rounded-full transition-colors cursor-pointer"
              >
                Пропустить
              </button>
            </div>

            {/* Center Motif: OURS two soft overlapping spheres */}
            <div className="my-auto py-8 flex flex-col items-center text-center">
              <div className="relative mb-8 w-44 h-44 flex items-center justify-center animate-gentle-float">
                {/* Background ambient warm aura */}
                <div className="absolute w-40 h-40 rounded-full bg-gradient-to-tr from-[#F6DCE1]/50 via-[#F7D8D0]/30 to-[#DDEAF7]/50 blur-2xl pointer-events-none" />

                {/* Overlapping spheres (Pink + Blue) */}
                <div className="relative flex items-center justify-center -space-x-8">
                  {/* Left Pink Sphere */}
                  <div
                    style={{
                      background:
                        'radial-gradient(circle at 35% 32%, #FFC1CC 0%, #F6DCE1 55%, #EFC1CB 100%)',
                      boxShadow: '0 10px 24px -4px rgba(233, 135, 135, 0.28)',
                    }}
                    className="w-22 h-22 rounded-full shrink-0 border border-white/80"
                  />
                  {/* Right Blue Sphere */}
                  <div
                    style={{
                      background:
                        'radial-gradient(circle at 35% 32%, #E8F2FD 0%, #DDEAF7 55%, #BCD6EE 100%)',
                      boxShadow: '0 10px 24px -4px rgba(188, 214, 238, 0.35)',
                    }}
                    className="w-22 h-22 rounded-full shrink-0 border border-white/80 mix-blend-multiply opacity-90"
                  />
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-3 max-w-[310px]">
                <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] tracking-tight leading-snug">
                  Ежедневный ритуал для двоих.
                </h1>
                <p className="text-sm text-[#777277] leading-relaxed">
                  Маленькие моменты, которые становятся вашей общей историей.
                </p>
              </div>
            </div>

            {/* Bottom Progress & CTA */}
            <div className="pb-4 pt-6 space-y-6">
              {/* 4 Indicators */}
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-7 h-2 rounded-full bg-[#E98787] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] transition-all duration-300" />
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
                className="w-9 h-9 rounded-full bg-white border border-[#EBE3E5] flex items-center justify-center text-[#343033] transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="Назад"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs font-medium text-[#777277] hover:text-[#343033] px-2 py-1 rounded-full transition-colors cursor-pointer"
              >
                Пропустить
              </button>
            </div>

            {/* Center Motif: «Момент дня» card */}
            <div className="my-auto py-8 flex flex-col items-center text-center">
              <div className="relative mb-8 animate-gentle-float">
                {/* Background aura */}
                <div className="absolute inset-0 rounded-[32px] bg-gradient-to-tr from-[#DDEAF7]/50 via-white to-[#F6DCE1]/40 blur-xl pointer-events-none" />

                {/* Card Container */}
                <div className="relative w-56 rounded-[28px] bg-white soft-card-shadow border border-[#F0E6E8] p-4 flex flex-col items-center gap-3">
                  {/* Badge */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF9FA] border border-[#F6DCE1] text-[#E98787] text-[11px] font-semibold tracking-wide">
                    <Sparkles size={12} />
                    <span>Момент дня</span>
                  </span>

                  {/* Visual card content: cozy prompt */}
                  <div className="w-full rounded-[22px] bg-gradient-to-br from-[#FFF5F7] via-[#FFF9FA] to-[#F7D8D0]/40 p-4 border border-[#F0E6E8]/70 flex flex-col items-center text-center gap-2">
                    <div className="w-11 h-11 rounded-2xl bg-white soft-card-shadow flex items-center justify-center text-[#E98787] border border-[#F0E6E8]">
                      <Coffee size={20} />
                    </div>
                    <div>
                      <p className="font-display font-semibold text-xs text-[#343033]">
                        Утренний кофе вместе
                      </p>
                      <p className="text-[10px] text-[#777277] mt-0.5">
                        Покажи чашку или вид из окна
                      </p>
                    </div>
                  </div>

                  {/* Footnote */}
                  <div className="flex items-center justify-between w-full px-1 text-[10px] text-[#777277] font-medium">
                    <span>09:00</span>
                    <span className="text-[#E98787] font-semibold">1 из 3 сегодня</span>
                  </div>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-3 max-w-[310px]">
                <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] tracking-tight leading-snug">
                  Получайте небольшой повод быть ближе.
                </h1>
                <p className="text-sm text-[#777277] leading-relaxed">
                  Каждый день — новый момент только для вас двоих.
                </p>
              </div>
            </div>

            {/* Bottom Progress & CTA */}
            <div className="pb-4 pt-6 space-y-6">
              {/* 4 Indicators */}
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] transition-all duration-300" />
                <span className="w-7 h-2 rounded-full bg-[#E98787] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] transition-all duration-300" />
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
                className="w-9 h-9 rounded-full bg-white border border-[#EBE3E5] flex items-center justify-center text-[#343033] transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="Назад"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs font-medium text-[#777277] hover:text-[#343033] px-2 py-1 rounded-full transition-colors cursor-pointer"
              >
                Пропустить
              </button>
            </div>

            {/* Center Motif: Two slots (one filled, second locked) */}
            <div className="my-auto py-8 flex flex-col items-center text-center">
              <div className="relative mb-8 animate-gentle-float">
                {/* Background aura */}
                <div className="absolute inset-0 rounded-[36px] bg-gradient-to-tr from-[#F6DCE1]/30 via-white to-[#DDEAF7]/30 blur-lg pointer-events-none" />

                {/* Slots Stage */}
                <div className="relative flex items-center justify-center gap-3 p-3.5 rounded-[26px] bg-white border border-[#EBE3E5] shadow-2xs">
                  {/* Slot 1: Filled Photo */}
                  <div className="w-24 h-32 rounded-[20px] overflow-hidden relative border border-[#EBE3E5] shadow-2xs bg-[#FAF1F3]">
                    <img
                      src={PRESET_PHOTOS[0]?.url}
                      alt="Твой снимок"
                      className="w-full h-full object-cover"
                    />
                    {/* Badge: Ready */}
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-white/95 text-[9px] font-bold text-[#343033] shadow-2xs">
                      Ты
                    </div>
                    <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-[#E98787] text-white flex items-center justify-center shadow-xs">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  </div>

                  {/* Center connector */}
                  <div className="w-6 h-6 rounded-full bg-white border border-[#EBE3E5] flex items-center justify-center text-[#E98787] shadow-2xs shrink-0">
                    <Heart size={10} className="fill-[#E98787]" />
                  </div>

                  {/* Slot 2: Hidden / Locked */}
                  <div className="w-24 h-32 rounded-[20px] bg-[#FAF5F7] border border-dashed border-[#E9C3CB] flex flex-col items-center justify-center gap-1.5 relative p-2 shadow-2xs">
                    {/* Badge */}
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-white/95 text-[9px] font-bold text-[#777277] shadow-2xs">
                      Партнёр
                    </div>

                    <div className="w-9 h-9 rounded-full bg-white shadow-2xs flex items-center justify-center text-[#E98787] border border-[#EBE3E5]">
                      <Lock size={15} />
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-[#343033]">Скрыто</p>
                      <p className="text-[8px] text-[#777277]">до MATCH</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-3 max-w-[310px]">
                <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] tracking-tight leading-snug">
                  Сделайте фото.
                </h1>
                <p className="text-sm text-[#777277] leading-relaxed">
                  Ваши фотографии остаются скрытыми до тех пор, пока не будут готовы оба.
                </p>
              </div>
            </div>

            {/* Bottom Progress & CTA */}
            <div className="pb-4 pt-6 space-y-6">
              {/* 4 Indicators */}
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] transition-all duration-300" />
                <span className="w-7 h-2 rounded-full bg-[#E98787] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] transition-all duration-300" />
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
                className="w-9 h-9 rounded-full bg-white border border-[#EBE3E5] flex items-center justify-center text-[#343033] transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="Назад"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs font-medium text-[#777277] hover:text-[#343033] px-2 py-1 rounded-full transition-colors cursor-pointer"
              >
                Пропустить
              </button>
            </div>

            {/* Center Motif: Converging Spheres + MATCH Effect */}
            <div className="my-auto py-8 flex flex-col items-center text-center">
              <div className="relative mb-8 w-52 h-44 flex items-center justify-center">
                {/* Expanding Match wave aura */}
                <div className="absolute w-36 h-36 rounded-full bg-gradient-to-tr from-[#F6DCE1] via-[#F7D8D0] to-[#DDEAF7] pointer-events-none animate-match-wave opacity-60" />

                {/* Left pink sphere converging */}
                <div
                  style={{
                    background:
                      'radial-gradient(circle at 35% 32%, #FFB6C1 0%, #F6DCE1 55%, #EFC1CB 100%)',
                    boxShadow: '0 12px 28px -6px rgba(233, 135, 135, 0.32)',
                  }}
                  className="w-20 h-20 rounded-full shrink-0 border border-white/90 animate-sphere-left z-10"
                />

                {/* Right blue sphere converging */}
                <div
                  style={{
                    background:
                      'radial-gradient(circle at 35% 32%, #E3F0FC 0%, #DDEAF7 55%, #BCD6EE 100%)',
                    boxShadow: '0 12px 28px -6px rgba(188, 214, 238, 0.38)',
                  }}
                  className="w-20 h-20 rounded-full shrink-0 border border-white/90 mix-blend-multiply opacity-90 animate-sphere-right z-10"
                />

                {/* Floating MATCH badge that emerges when spheres meet */}
                <div className="absolute z-20 pointer-events-none animate-match-pill flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white shadow-xs border border-[#EBE3E5]">
                  <span className="w-2 h-2 rounded-full bg-[#E98787] animate-ping" />
                  <span className="font-display text-xs font-bold tracking-widest text-[#343033]">
                    MATCH
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-3 max-w-[310px]">
                <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] tracking-tight leading-snug">
                  Откройте его вместе.
                </h1>
                <p className="text-sm text-[#777277] leading-relaxed">
                  Когда готовы оба — происходит MATCH.
                </p>
              </div>
            </div>

            {/* Bottom Progress & CTA */}
            <div className="pb-4 pt-6 space-y-6">
              {/* 4 Indicators */}
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] transition-all duration-300" />
                <span className="w-2 h-2 rounded-full bg-[#F0E6E8] transition-all duration-300" />
                <span className="w-7 h-2 rounded-full bg-[#E98787] transition-all duration-300" />
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
            {/* Header branding */}
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-8">
                {/* OURS mini spheres mark */}
                <div className="flex items-center -space-x-1.5">
                  <span className="w-4 h-4 rounded-full bg-[#F6DCE1] border border-white" />
                  <span className="w-4 h-4 rounded-full bg-[#DDEAF7] border border-white mix-blend-multiply opacity-90" />
                </div>
                <span className="font-display font-bold tracking-wider text-sm text-[#343033]">
                  OURS
                </span>
              </div>

              {/* Title & Description */}
              <div className="space-y-2 mb-8">
                <h1 className="font-display text-2xl sm:text-[28px] font-bold text-[#343033] tracking-tight">
                  Ваша пара
                </h1>
                <p className="text-sm text-[#777277] leading-relaxed">
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
                  className="w-full text-left p-5 rounded-[22px] bg-white shadow-2xs border border-[#EBE3E5] flex items-center justify-between gap-4 transition-all duration-150 active:scale-[0.98] hover:border-[#E98787]/60 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    {/* Pink Icon Area */}
                    <div className="w-12 h-12 rounded-[16px] bg-[#FAF0F2] border border-[#EED7DC] flex items-center justify-center shrink-0 text-[#E98787]">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base text-[#343033]">
                        Создать пару
                      </h3>
                      <p className="text-xs text-[#777277] mt-0.5">
                        Новая пара, приглашение по коду
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-[#CEC5C8] shrink-0" />
                </button>

                {/* Card 2: Присоединиться */}
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(true);
                    playSoftChime('tap', true);
                    setView('join');
                  }}
                  className="w-full text-left p-5 rounded-[22px] bg-white shadow-2xs border border-[#EBE3E5] flex items-center justify-between gap-4 transition-all duration-150 active:scale-[0.98] hover:border-[#5B89AC]/60 cursor-pointer"
                >
                  <div className="flex items-center gap-4">
                    {/* Blue Icon Area */}
                    <div className="w-12 h-12 rounded-[16px] bg-[#EDF4FB] border border-[#D5E3F0] flex items-center justify-center shrink-0 text-[#4A6B82]">
                      <LinkIcon size={20} />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-base text-[#343033]">
                        Присоединиться
                      </h3>
                      <p className="text-xs text-[#777277] mt-0.5">
                        У тебя уже есть код приглашения
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-[#CEC5C8] shrink-0" />
                </button>
              </div>
            </div>

            {/* Back to intro button at bottom */}
            <div className="pb-4 pt-8 text-center">
              <button
                type="button"
                onClick={() => setView('slide-4')}
                className="text-xs font-medium text-[#777277] hover:text-[#343033] transition-colors cursor-pointer"
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
                  className="w-9 h-9 rounded-full bg-white border border-[#EBE3E5] flex items-center justify-center text-[#343033] transition-all active:scale-95 cursor-pointer shadow-2xs"
                  title="Назад к выбору"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>

              {/* Title */}
              <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] tracking-tight mb-5">
                Как тебя зовут?
              </h1>

              {/* Name Input Field with Shake validation */}
              <div className="mb-6">
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Например, Аня"
                  autoFocus
                  className={`w-full h-[52px] px-4 rounded-[18px] bg-white border ${
                    shakeField === 'create-name'
                      ? 'border-[#E98787] animate-shake ring-2 ring-[#E98787]/25'
                      : 'border-[#EBE3E5]'
                  } text-sm text-[#343033] placeholder:text-[#A69FA3] font-medium focus:outline-none focus:border-[#E98787] focus:ring-2 focus:ring-[#E98787]/15 transition-all shadow-2xs`}
                />
              </div>

              {/* Pink Information Card */}
              <div className="p-5 rounded-[22px] bg-[#FAF0F2] border border-[#EED7DC] space-y-3">
                <div>
                  <h3 className="font-display text-sm font-bold text-[#343033]">
                    Пригласи партнёра
                  </h3>
                  <p className="text-xs text-[#777277] mt-0.5 leading-relaxed">
                    Отправь код — по нему партнёр присоединится к твоей паре.
                  </p>
                </div>

                {/* Code Pill + Copy button */}
                <div className="flex items-center justify-between p-3 pl-4 rounded-[16px] bg-white border border-[#EBE3E5] shadow-2xs">
                  <span className="font-mono text-base font-bold tracking-widest text-[#343033]">
                    {defaultInviteCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF0F2] hover:bg-[#F6E2E6] text-[#343033] text-xs font-semibold border border-[#EED7DC] transition-all active:scale-95 cursor-pointer shadow-2xs"
                  >
                    {isCopied ? (
                      <>
                        <Check size={14} className="text-[#E98787]" />
                        <span>Скопировано</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} className="text-[#E98787]" />
                        <span>Копировать</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Button */}
            <div className="pb-4 pt-8">
              <PrimaryButton variant="coral" type="submit">
                Готово
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
                  className="w-9 h-9 rounded-full bg-white border border-[#EBE3E5] flex items-center justify-center text-[#343033] transition-all active:scale-95 cursor-pointer shadow-2xs"
                  title="Назад к выбору"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>

              {/* Title */}
              <h1 className="font-display text-2xl sm:text-[26px] font-bold text-[#343033] tracking-tight mb-6">
                Присоединиться
              </h1>

              <div className="space-y-4">
                {/* Field 1: Name */}
                <div>
                  <label className="block text-xs font-semibold text-[#777277] mb-2 uppercase tracking-wider">
                    Как тебя зовут?
                  </label>
                  <input
                    type="text"
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    placeholder="Например, Макс"
                    autoFocus
                    className={`w-full h-[52px] px-4 rounded-[18px] bg-white border ${
                      shakeField === 'join-name'
                        ? 'border-[#E98787] animate-shake ring-2 ring-[#E98787]/25'
                        : 'border-[#EBE3E5]'
                    } text-sm text-[#343033] placeholder:text-[#A69FA3] font-medium focus:outline-none focus:border-[#E98787] focus:ring-2 focus:ring-[#E98787]/15 transition-all shadow-2xs`}
                  />
                </div>

                {/* Field 2: Invite Code */}
                <div>
                  <label className="block text-xs font-semibold text-[#777277] mb-2 uppercase tracking-wider">
                    Код приглашения
                  </label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="OURS-4821"
                    className={`w-full h-[52px] px-4 rounded-[18px] bg-white border ${
                      shakeField === 'join-code'
                        ? 'border-[#E98787] animate-shake ring-2 ring-[#E98787]/25'
                        : 'border-[#EBE3E5]'
                    } text-sm font-mono tracking-wider text-[#343033] placeholder:text-[#A69FA3] font-semibold focus:outline-none focus:border-[#E98787] focus:ring-2 focus:ring-[#E98787]/15 transition-all shadow-2xs`}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Button */}
            <div className="pb-4 pt-8">
              <PrimaryButton variant="coral" type="submit">
                Готово
              </PrimaryButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
