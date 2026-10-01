import React, { useState, useEffect, useRef } from 'react';
import { Mail, Sparkles, Heart, RefreshCw, Send, Check, X, ChevronRight } from 'lucide-react';
import { DATE_IDEAS, DateIdea } from '../data/dateIdeas';
import { AtmosphericGlow } from '../components/AtmosphericGlow';
import { CoupleState } from '../types';
import {
  playEnvelopeOpenSound,
  playCardSlideSound,
  playInviteSentSound,
  playCardShuffleSound,
  playSoftChime,
  triggerHaptic,
} from '../services/feedback';
import {
  dateInvitationService,
  DateInvitation,
} from '../services/dates/dateInvitationService';

interface DateScreenProps {
  couple: CoupleState;
  soundEnabled?: boolean;
  hapticEnabled?: boolean;
}

export const DateScreen: React.FC<DateScreenProps> = ({
  couple,
  soundEnabled = true,
  hapticEnabled = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [currentIdeaIndex, setCurrentIdeaIndex] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);

  // Incoming / Active Date Invitation State
  const [invitation, setInvitation] = useState<DateInvitation | null>(() =>
    dateInvitationService.getInvitation(couple?.partner?.name || 'Партнёр', couple?.user?.name || 'Ты')
  );
  const [isIncomingModalOpen, setIsIncomingModalOpen] = useState(false);
  const [isIncomingClosing, setIsIncomingClosing] = useState(false);

  const timersRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    const unsub = dateInvitationService.subscribe((updated) => {
      setInvitation(updated);
    });
    return () => {
      unsub();
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  const addTimer = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  };

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  // Unified Continuous Motion Sequence (OURS Premium Motion System):
  // 1. 0ms: Soft tap response + flap begins physical unfold (cubic-bezier(0.28, 0.11, 0.32, 1), 540ms)
  // 2. 170ms: As flap clears vertical, letter seamlessly begins emerging from envelope pocket
  //    and continues upward into full card bloom in ONE unbroken physical gesture (520ms)
  // 3. ZERO pause, ZERO duplicate states, zero teleporting
  const handleOpenEnvelope = () => {
    if (isOpen || isModalOpen) return;

    clearTimers();
    setIsOpen(true);
    triggerHaptic(hapticEnabled);
    playEnvelopeOpenSound(soundEnabled);

    // Letter emerges directly from envelope pocket without pause
    addTimer(() => {
      setIsModalOpen(true);
      playCardSlideSound(soundEnabled);
      triggerHaptic(hapticEnabled);
    }, 170);
  };

  // Seamless Reverse Motion Sequence:
  // 1. Letter card glides downward toward the envelope pocket while shrinking (280ms)
  // 2. Overlapping at 120ms, flap starts folding back down over pocket (480ms)
  // 3. Wax seal softly locks into place as flap lands
  const handleCloseModal = () => {
    if (isClosingModal) return;
    clearTimers();
    setIsClosingModal(true);
    playCardSlideSound(soundEnabled);
    triggerHaptic(hapticEnabled);

    // Overlapping flap closure as card slides down
    addTimer(() => {
      setIsOpen(false);
    }, 120);

    // Unmount modal once card has fully returned to envelope
    addTimer(() => {
      setIsModalOpen(false);
      setIsClosingModal(false);
    }, 280);
  };

  // Shuffle to next idea
  const handleNextIdea = () => {
    if (isShuffling) return;
    setIsShuffling(true);
    playCardShuffleSound(soundEnabled);
    triggerHaptic(hapticEnabled);

    addTimer(() => {
      setCurrentIdeaIndex((prev) => {
        let next = Math.floor(Math.random() * DATE_IDEAS.length);
        if (next === prev) {
          next = (prev + 1) % DATE_IDEAS.length;
        }
        return next;
      });
      setIsShuffling(false);
      playSoftChime('tap', soundEnabled);
      triggerHaptic(hapticEnabled);
    }, 220);
  };

  // Send invitation from main envelope
  const handleInvitePartner = () => {
    playInviteSentSound(soundEnabled);
    triggerHaptic(hapticEnabled);
    const sent = dateInvitationService.sendInvitation(
      {
        id: currentIdea.id,
        title: currentIdea.title,
        description: currentIdea.description,
        tag: currentIdea.tag,
      },
      couple?.user?.name || 'Ты',
      couple?.partner?.name || 'Партнёр',
      couple?.id
    );
    setInvitation(sent);
    handleCloseModal();
  };

  // Open incoming invitation modal with atmospheric soft mist & radiance reveal
  const handleOpenIncomingInvitation = () => {
    if (!invitation) return;
    clearTimers();
    // Mark as read upon actually opening the invitation to clear the tab notification dot
    dateInvitationService.markAsRead(invitation.id);
    setIsIncomingClosing(false);
    setIsIncomingModalOpen(true);
    playSoftChime('tap', soundEnabled);
    triggerHaptic(hapticEnabled);
  };

  // Close incoming invitation modal
  const handleCloseIncomingModal = () => {
    if (isIncomingClosing) return;
    clearTimers();
    playCardSlideSound(soundEnabled);
    triggerHaptic(hapticEnabled);
    setIsIncomingClosing(true);
    addTimer(() => {
      setIsIncomingModalOpen(false);
      setIsIncomingClosing(false);
    }, 260);
  };

  // Accept incoming invitation: "Согласна"
  const handleAcceptIncomingInvitation = () => {
    if (!invitation) return;
    playSoftChime('tap', soundEnabled);
    triggerHaptic(hapticEnabled);
    const updated = dateInvitationService.acceptInvitation(invitation.id);
    if (updated) {
      setInvitation(updated);
    }
    handleCloseIncomingModal();
  };

  // Decline incoming invitation: "Отказ"
  const handleDeclineIncomingInvitation = () => {
    if (!invitation) return;
    triggerHaptic(hapticEnabled);
    const updated = dateInvitationService.declineInvitation(invitation.id);
    if (updated) {
      setInvitation(updated);
    }
    handleCloseIncomingModal();
  };

  const getStatusLabel = () => {
    if (!invitation) return '';
    switch (invitation.status) {
      case 'pending':
        return 'Ожидание';
      case 'accepted':
        return 'Согласна';
      case 'declined':
        return 'Отказ';
      default:
        return '';
    }
  };

  const currentIdea: DateIdea = DATE_IDEAS[currentIdeaIndex] || DATE_IDEAS[0];
  const partnerName = couple?.partner?.name || 'партнёра';
  const partnerDisplayName = couple?.partner?.name || 'Партнёр';
  const isClosed = !isOpen && !isModalOpen && !isClosingModal;

  return (
    <div className="flex-1 w-full max-w-md mx-auto flex flex-col justify-start items-center select-none relative h-full overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-3 py-3 overflow-x-visible">
      {/* Top Header */}
      <header className="w-full text-center shrink-0 pt-2.5 xs:pt-3.5 pb-1 relative z-10 flex flex-col items-center space-y-1">
        <h1 className="font-display text-2xl font-bold text-[#343033] dark:text-white tracking-tight">
          Свидание для двоих
        </h1>
        <p className="text-xs xs:text-sm font-medium text-[#777277] dark:text-[#B8B2B5] max-w-xs px-2">
          Найдём идеальную идею для вас двоих?
        </p>
      </header>

      {/* Main Center Stage with Envelope — Centered with balanced vertical breathing room */}
      <div className="w-full flex-1 flex flex-col items-center justify-center relative z-20 min-h-0 overflow-visible px-2 pt-1 pb-4 xs:pb-5">
        {/* Master Envelope Container with 16:10 ratio & balanced placement */}
        <div
          className="relative w-full max-w-[270px] xs:max-w-[295px] sm:max-w-[315px] aspect-[16/10] mx-auto translate-y-1 xs:translate-y-1.5 sm:translate-y-2 overflow-visible"
          style={{ perspective: '1200px' }}
        >
          {/* Organic chaotic luminous Atmospheric Glow centered on the envelope */}
          <AtmosphericGlow variant="prominent" />

          {/* Main Envelope Body — Organic floating in air when closed, stable when opening */}
          <div
            onClick={isClosed ? handleOpenEnvelope : undefined}
            className={`relative w-full h-full will-change-transform ${
              isClosed
                ? 'cursor-pointer animate-[float-cozy_7.8s_ease-in-out_infinite] hover:scale-[1.01] active:scale-[0.985] transition-transform duration-150 ease-out'
                : ''
            }`}
          >
            {/* 1. BACK PLATE & INTERIOR POCKET CAVITY */}
            <div
              className="absolute inset-0 rounded-[20px] bg-gradient-to-b from-[#FFF5F7] via-[#FDF3F6] to-[#F5E2E8] dark:from-[#2A2127] dark:via-[#21191F] dark:to-[#191317] border border-[#ECD4DC] dark:border-[#3D3039] shadow-[0_16px_36px_-8px_rgba(233,135,135,0.22),0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-[0_16px_36px_-8px_rgba(0,0,0,0.7)] overflow-hidden"
              style={{ zIndex: 1 }}
            >
              {/* Internal depth shading inside pocket cavity */}
              <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/12 via-black/3 to-transparent pointer-events-none" />
              {/* Warm interior amber glow when open */}
              <div
                className={`absolute inset-0 bg-gradient-to-t from-rose-300/35 via-amber-200/25 to-transparent transition-opacity duration-500 pointer-events-none ${
                  isOpen ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </div>

            {/* 1.5. MAGICAL MIST & WARM RADIANT GLOW (Emerges gently from pocket when opened) */}
            {isOpen && (
              <div
                className="absolute inset-x-0 -top-6 h-36 pointer-events-none overflow-visible"
                style={{ zIndex: 8 }}
              >
                {/* Core warm radiant glow aura */}
                <div className="absolute left-1/2 -translate-x-1/2 top-4 w-44 h-28 rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(252,211,77,0.45)_0%,_rgba(244,114,182,0.35)_45%,_transparent_75%)] blur-xl animate-[aura-glow_0.75s_ease-out_forwards]" />

                {/* Secondary expansive soft warm light */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-2 w-60 h-36 rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(254,205,211,0.5)_0%,_rgba(253,230,138,0.25)_50%,_transparent_75%)] blur-2xl animate-[aura-glow_0.9s_ease-out_forwards]" />

                {/* Left ethereal mist wisp */}
                <div className="absolute left-[16%] top-6 w-24 h-24 rounded-full bg-[radial-gradient(circle,_rgba(255,228,235,0.7)_0%,_rgba(254,205,211,0.35)_40%,_transparent_70%)] blur-lg animate-[mist-rise-left_0.8s_cubic-bezier(0.2,0.8,0.3,1)_forwards]" />

                {/* Right ethereal mist wisp */}
                <div className="absolute right-[16%] top-6 w-28 h-28 rounded-full bg-[radial-gradient(circle,_rgba(254,243,199,0.7)_0%,_rgba(254,205,211,0.35)_40%,_transparent_70%)] blur-lg animate-[mist-rise-right_0.85s_cubic-bezier(0.2,0.8,0.3,1)_forwards]" />

                {/* Center ethereal mist column */}
                <div className="absolute left-1/2 -translate-x-1/2 top-8 w-32 h-32 rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.8)_0%,_rgba(254,226,236,0.45)_45%,_transparent_70%)] blur-xl animate-[mist-rise-center_0.9s_cubic-bezier(0.2,0.8,0.3,1)_forwards]" />

                {/* Subtle soft sparkles escaping with the mist */}
                <span
                  className="absolute left-[28%] top-7 text-amber-300 text-xs animate-[sparkle-float_0.8s_ease-out_forwards] select-none pointer-events-none drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]"
                  style={{ animationDelay: '60ms' }}
                >
                  ✦
                </span>
                <span
                  className="absolute right-[26%] top-5 text-rose-300 text-[10px] animate-[sparkle-float_0.85s_ease-out_forwards] select-none pointer-events-none drop-shadow-[0_0_4px_rgba(244,114,182,0.6)]"
                  style={{ animationDelay: '120ms' }}
                >
                  ✦
                </span>
                <span
                  className="absolute left-[48%] top-3 text-amber-200 text-sm animate-[sparkle-float_0.85s_ease-out_forwards] select-none pointer-events-none drop-shadow-[0_0_5px_rgba(253,230,138,0.7)]"
                  style={{ animationDelay: '90ms' }}
                >
                  ✦
                </span>
              </div>
            )}

            {/* 
              2. LETTER PREVIEW
              - Positioned lower and centered in the envelope frame
              - Never sticks out awkwardly into empty space
              - Perfectly proportioned (w-[82%], h-28) with centered content
            */}
            <div
              className="absolute inset-x-0 mx-auto w-[82%] pointer-events-none"
              style={{
                top: '24px',
                zIndex: 10,
                opacity: isOpen && !isModalOpen ? 1 : 0,
                transform: isOpen ? 'translateY(-14px)' : 'translateY(16px)',
                transition: isOpen
                  ? 'transform 450ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms ease-out'
                  : 'transform 420ms cubic-bezier(0.25, 1, 0.35, 1), opacity 180ms ease-in 100ms',
                willChange: 'transform',
                clipPath: 'polygon(-25% -400px, 125% -400px, 125% 100%, -25% 100%)',
              }}
            >
              <div className="w-full h-28 xs:h-30 rounded-xl bg-gradient-to-b from-[#FFFDFB] via-[#FFFFFF] to-[#FAF6F3] dark:from-[#211A1F] dark:via-[#1D171C] dark:to-[#171216] border border-[#EBD6DC] dark:border-[#3E3039] p-3 pt-3.5 pb-2 shadow-md flex flex-col items-center justify-start">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-widest uppercase text-[#E98787] mb-1">
                  <span>✦ ИДЕЯ ДЛЯ ВАС ✦</span>
                </div>
                <div className="text-xs xs:text-sm font-bold text-[#343033] dark:text-[#FAF5F7] text-center line-clamp-2 px-1">
                  {currentIdea.title}
                </div>
              </div>
            </div>

            {/* 3. FRONT POCKET (Clipped by rounded-[20px] container) */}
            <div
              className="absolute inset-0 rounded-[20px] overflow-hidden pointer-events-none"
              style={{ zIndex: 15 }}
            >
              <svg viewBox="0 0 320 200" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="pocketGradLuxury" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFF9FB" />
                    <stop offset="45%" stopColor="#FCECF1" />
                    <stop offset="100%" stopColor="#F2DCE3" />
                  </linearGradient>
                  <linearGradient id="pocketFoldShadowL" x1="0" y1="1" x2="0.8" y2="0.3">
                    <stop offset="0%" stopColor="rgba(0,0,0,0.035)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                  </linearGradient>
                  <linearGradient id="pocketFoldShadowR" x1="1" y1="1" x2="0.2" y2="0.3">
                    <stop offset="0%" stopColor="rgba(0,0,0,0.045)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                  </linearGradient>
                </defs>

                {/* Pocket Body: gentle curved V-dip at top, covers bottom & sides */}
                <path
                  d="
                    M 0 20
                    C 55 42, 110 96, 160 96
                    C 210 96, 265 42, 320 20
                    L 320 200
                    L 0 200
                    Z
                  "
                  fill="url(#pocketGradLuxury)"
                  stroke="#ECD4DC"
                  strokeWidth="1"
                />

                {/* Left diagonal fold shadow */}
                <path
                  d="M 0 200 L 160 120 L 0 20 Z"
                  fill="url(#pocketFoldShadowL)"
                />

                {/* Right diagonal fold shadow */}
                <path
                  d="M 320 200 L 160 120 L 320 20 Z"
                  fill="url(#pocketFoldShadowR)"
                />

                {/* Delicate fold crease lines */}
                <path
                  d="M 0 200 L 160 120"
                  stroke="rgba(235, 205, 215, 0.35)"
                  strokeWidth="0.75"
                />
                <path
                  d="M 320 200 L 160 120"
                  stroke="rgba(235, 205, 215, 0.35)"
                  strokeWidth="0.75"
                />

                {/* Crisp top rim paper highlight */}
                <path
                  d="
                    M 0 20
                    C 55 42, 110 96, 160 96
                    C 210 96, 265 42, 320 20
                  "
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.85)"
                  strokeWidth="1.2"
                />
              </svg>
            </div>

            {/* 4. TOP FLAP WITH WAX SEAL (Anchored to y=0 with zero gap!) */}
            <div
              className="absolute top-0 inset-x-0 h-[56%] pointer-events-none"
              style={{
                transformOrigin: 'top center',
                transform: isOpen ? 'rotateX(180deg)' : 'rotateX(0deg)',
                zIndex: 25,
                backfaceVisibility: 'visible',
                WebkitBackfaceVisibility: 'visible',
                transition: isOpen
                  ? 'transform 540ms cubic-bezier(0.28, 0.11, 0.32, 1)'
                  : 'transform 480ms cubic-bezier(0.28, 0.11, 0.32, 1) 60ms',
              }}
            >
              <svg
                viewBox="0 0 320 114"
                className="w-full h-full drop-shadow-[0_4px_10px_rgba(233,135,135,0.18)] dark:drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="flapGradLuxury" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFFDFE" />
                    <stop offset="50%" stopColor="#FAF1F4" />
                    <stop offset="100%" stopColor="#F2DCE3" />
                  </linearGradient>
                </defs>

                {/* Continuous top edge along y=0 with rounded corners */}
                <path
                  d="
                    M 20 0
                    L 300 0
                    A 20 20 0 0 1 320 20
                    L 172 107
                    Q 160 113 148 107
                    L 0 20
                    A 20 20 0 0 1 20 0
                    Z
                  "
                  fill="url(#flapGradLuxury)"
                  stroke="#ECD4DC"
                  strokeWidth="1"
                />

                {/* Subtle paper fold highlight on flap */}
                <path
                  d="M 20 0 L 160 110 L 300 0"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.45)"
                  strokeWidth="0.8"
                />
              </svg>

              {/* Handcrafted Wax Seal Medallion */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 bottom-[-18px] w-11 h-11 xs:w-12 xs:h-12 rounded-full flex items-center justify-center drop-shadow-[0_4px_12px_rgba(215,85,105,0.48)] pointer-events-auto transition-all ${
                  isOpen
                    ? 'opacity-0 scale-95 duration-200 ease-out pointer-events-none'
                    : 'opacity-100 scale-100 duration-300 ease-out delay-160 hover:scale-105 active:scale-95'
                }`}
              >
                <div className="w-full h-full rounded-full bg-gradient-to-br from-[#F1939A] via-[#D85E6E] to-[#AB3547] p-0.5 shadow-[inset_0_1px_2px_rgba(255,255,255,0.45)] flex items-center justify-center relative border border-[#F8B6C3]/60">
                  <div className="w-[74%] h-[74%] rounded-full border border-rose-200/55 flex items-center justify-center bg-gradient-to-br from-[#D95F70] to-[#A33345] shadow-inner">
                    <Heart
                      size={14}
                      className="text-white fill-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
                    />
                  </div>
                  <div className="absolute top-1 left-2 w-2.5 h-1 bg-white/50 rounded-full blur-[0.4px] -rotate-30" />
                </div>
              </div>
            </div>
          </div>

          {/* Ambient Ground Shadow with synchronized soft pulse */}
          <div
            className={`absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-[85%] h-3 xs:h-3.5 rounded-full bg-black/10 dark:bg-black/40 blur-md pointer-events-none transition-all duration-700 will-change-[transform,opacity] ${
              isClosed
                ? 'scale-100 opacity-60 animate-[shadow-pulse_7.8s_ease-in-out_infinite]'
                : 'scale-95 opacity-40'
            }`}
          />
        </div>
      </div>

      {/* Bottom Action Area (Open Button & Incoming Invitation) */}
      <footer className="w-full shrink-0 flex flex-col items-center z-20 pt-1.5 pb-3">
        <div className="select-none flex justify-center w-full">
          <button
            type="button"
            disabled={!isClosed}
            onClick={handleOpenEnvelope}
            className="group relative h-[50px] xs:h-[52px] sm:h-[54px] px-7 xs:px-8 rounded-full select-none overflow-hidden cursor-pointer transition-all duration-300 ease-out active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8BFC7] bg-[#FAF0F2] dark:bg-[#150F13] border border-[#E98787]/20 dark:border-[#E8BFC7]/15 shadow-[0_4px_20px_-4px_rgba(233,135,135,0.18)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] hover:border-[#E98787]/35 text-center flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100"
            aria-label="Открыть свидание"
          >
            {/* Ambient Background Aura & Delicate Floating Gleam (exact SVG Layer from «Касание готово») */}
            <svg
              viewBox="0 0 360 65"
              preserveAspectRatio="xMidYMid slice"
              className="absolute inset-0 w-full h-full pointer-events-none block"
              aria-hidden="true"
            >
              <defs>
                <radialGradient id="dateOpenPillGlow" cx="45%" cy="40%" r="65%">
                  <stop offset="0%" stopColor="#E98787" stopOpacity="0.09" />
                  <stop offset="50%" stopColor="#FFDEE7" stopOpacity="0.03" />
                  <stop offset="100%" stopColor="#FAF0F2" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width="100%" height="100%" fill="url(#dateOpenPillGlow)" />

              {/* Faint Romantic Gleam Particles */}
              <g opacity="0.25">
                <circle cx="42" cy="42" r="1.1" fill="#E98787" />
                <circle cx="135" cy="18" r="0.8" fill="#E98787" />
                <circle cx="235" cy="45" r="0.9" fill="#E98787" />
                <circle cx="315" cy="20" r="1.0" fill="#E98787" />
              </g>
            </svg>

            {/* Content Overlay */}
            <div className="relative z-10 flex items-center justify-center gap-2 pointer-events-none">
              <Mail
                size={16}
                className="shrink-0 text-[#E98787] dark:text-[#F0B9C6] transition-transform duration-300 group-hover:scale-110"
              />
              <span className="font-display font-semibold text-[14.5px] xs:text-[15px] sm:text-[15.5px] tracking-tight text-[#343033] dark:text-white drop-shadow-xs whitespace-nowrap">
                Открыть свидание
              </span>
            </div>
          </button>
        </div>

        {/* =========================================================================
            COMPACT STATUS PLATE (КОМПАКТНАЯ ПЛАШКА СОСТОЯНИЯ ПРИГЛАШЕНИЯ)
            ========================================================================= */}
        {invitation && (
          <div className="w-full max-w-[280px] xs:max-w-[305px] mx-auto mt-2.5 xs:mt-3 px-3.5 py-2.5 rounded-2xl bg-gradient-to-b from-[#FFFDFB] via-[#FFFFFF] to-[#FAF6F3] dark:from-[#211A1F] dark:via-[#1D171C] dark:to-[#171216] border border-[#ECD4DC] dark:border-[#3D3039] shadow-[0_4px_16px_-4px_rgba(233,135,135,0.18)] dark:shadow-none transition-all duration-300 animate-[card-enter_280ms_cubic-bezier(0.22,1,0.36,1)]">
            {/* Row 1: Header / Title */}
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E98787] dark:text-[#F0B9C6] truncate">
                <span>💌</span>
                <span className="truncate">
                  {invitation.status === 'pending' && invitation.senderId === 'partner'
                    ? `${invitation.senderName || partnerDisplayName} приглашает тебя`
                    : 'Свидание'}
                </span>
              </div>

              {invitation.status !== 'pending' && (
                <button
                  type="button"
                  onClick={() => dateInvitationService.clearInvitation()}
                  title="Закрыть"
                  className="text-[#A8A1A4] hover:text-[#343033] dark:hover:text-white transition-colors cursor-pointer shrink-0 p-0.5"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Row 2: Date idea title */}
            <p className="text-xs xs:text-sm font-semibold text-[#343033] dark:text-[#FAF5F7] truncate mb-2">
              «{invitation.idea.title}»
            </p>

            {/* Row 3: Action (Open) or Status */}
            {invitation.status === 'pending' && invitation.senderId === 'partner' ? (
              <button
                type="button"
                onClick={handleOpenIncomingInvitation}
                className="w-full h-[36px] rounded-full bg-gradient-to-r from-[#F0B9C6] via-[#E98787] to-[#E27A7A] dark:from-[#C95B6F] dark:via-[#B84E5B] dark:to-[#A3404D] border border-white/35 dark:border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_4px_14px_-3px_rgba(233,135,135,0.3)] text-white font-display font-semibold text-xs tracking-tight flex items-center justify-center gap-1.5 hover:opacity-95 active:scale-[0.985] transition-all duration-200 cursor-pointer"
              >
                <span>Открыть</span>
                <span className="text-[13px] leading-none">→</span>
              </button>
            ) : (
              <div className="flex items-center justify-between text-xs font-medium">
                <div
                  className={`inline-flex items-center gap-1.5 font-semibold ${
                    invitation.status === 'pending'
                      ? 'text-amber-600 dark:text-amber-400'
                      : invitation.status === 'accepted'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-stone-500 dark:text-stone-400'
                  }`}
                >
                  {invitation.status === 'pending' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  )}
                  {invitation.status === 'accepted' && (
                    <Check size={13} strokeWidth={2.5} className="shrink-0" />
                  )}
                  {invitation.status === 'declined' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-400 shrink-0" />
                  )}
                  <span>
                    {partnerDisplayName}: {getStatusLabel()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </footer>

      {/* =========================================================================
          FULL-SCREEN DEDICATED WINDOW (ОТДЕЛЬНОЕ ОКНО С КАРТОЧКОЙ)
          Luxurious, completely spacious, with smooth bloom & shrink-out exit
          ========================================================================= */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 ${
            isClosingModal
              ? 'animate-[modal-backdrop-exit_260ms_cubic-bezier(0.25,1,0.5,1)_forwards]'
              : 'animate-[modal-backdrop-enter_460ms_cubic-bezier(0.22,1,0.36,1)]'
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          <div
            className={`w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#FFFDFB] via-[#FFFFFF] to-[#FAF6F3] dark:from-[#211A1F] dark:via-[#1D171C] dark:to-[#171216] border border-[#EBD6DC] dark:border-[#3E3039] p-6 xs:p-7 shadow-2xl relative overflow-hidden will-change-transform ${
              isClosingModal
                ? 'animate-[letter-continuous-close_260ms_cubic-bezier(0.25,1,0.5,1)_forwards]'
                : 'animate-[letter-continuous-bloom_520ms_cubic-bezier(0.22,1,0.36,1)]'
            }`}
          >
            {/* Delicate inner hairline border */}
            <div className="absolute inset-3 rounded-2xl border border-[#F2E1E6]/80 dark:border-[#362A32] pointer-events-none" />

            {/* Corner accent flourishes */}
            <div className="absolute top-4 left-4 text-[#E98787]/40 text-xs pointer-events-none select-none">
              ✦
            </div>
            <div className="absolute top-4 right-12 text-[#E98787]/40 text-xs pointer-events-none select-none">
              ✦
            </div>

            {/* Close Button at top right */}
            <button
              type="button"
              onClick={handleCloseModal}
              title="Закрыть"
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-[#777277] dark:text-[#A8A1A4] hover:text-[#343033] dark:hover:text-white transition-colors cursor-pointer z-20"
            >
              <X size={16} />
            </button>

            {/* Date Card Content */}
            <div
              className={`relative z-10 flex flex-col items-center text-center transition-all duration-200 ${
                isShuffling ? 'opacity-30 scale-98' : 'opacity-100 scale-100'
              }`}
            >
              {/* Upper Ribbon */}
              <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-[#E98787] dark:text-[#F0B9C6] mb-3">
                <span className="w-5 h-px bg-[#E98787]/40" />
                <span>Идея для вас</span>
                <span className="w-5 h-px bg-[#E98787]/40" />
              </div>

              {/* Tag Badge */}
              <div className="inline-block px-3 py-1 rounded-full bg-[#FAF0F2] dark:bg-[#2A2026] text-[#777277] dark:text-[#B8B0B4] text-xs font-medium mb-3.5">
                {currentIdea.tag}
              </div>

              {/* Date Title */}
              <h2 className="text-xl xs:text-2xl font-bold tracking-tight text-[#343033] dark:text-[#FAF5F7] mb-3 leading-snug px-1">
                {currentIdea.title}
              </h2>

              {/* Description */}
              <p className="text-sm text-[#554F54] dark:text-[#C5BEC2] leading-relaxed mb-6 max-w-[280px]">
                {currentIdea.description}
              </p>

              {/* Action Buttons: 'Пригласить на свидание' + refresh button */}
              <div className="flex items-center gap-2.5 w-full">
                <button
                  type="button"
                  onClick={handleInvitePartner}
                  className="flex-1 h-[52px] xs:h-[54px] px-5 rounded-full bg-gradient-to-r from-[#F0B9C6] via-[#E98787] to-[#E27A7A] dark:from-[#C95B6F] dark:via-[#B84E5F] dark:to-[#A3404D] border border-white/35 dark:border-white/20 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.45),0_8px_24px_-6px_rgba(233,135,135,0.32)] dark:shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.2),0_8px_24px_-6px_rgba(0,0,0,0.5)] text-white font-display font-semibold text-[14px] xs:text-[15px] tracking-tight hover:opacity-95 active:scale-[0.985] active:opacity-90 transition-all duration-200 ease-out flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send size={16} className="shrink-0" />
                  <span>Пригласить на свидание</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextIdea}
                  disabled={isShuffling}
                  title="Сменить свидание"
                  aria-label="Сменить свидание"
                  className="w-[52px] h-[52px] xs:w-[54px] xs:h-[54px] shrink-0 rounded-full border border-[#F2D1D8] dark:border-white/14 bg-white/80 dark:bg-white/10 backdrop-blur-md hover:bg-white dark:hover:bg-white/15 text-[#6E676D] dark:text-[#C5BEC2] hover:text-[#E98787] dark:hover:text-[#F0B9C6] hover:border-[#E98787]/40 active:scale-[0.985] transition-all duration-200 flex items-center justify-center cursor-pointer disabled:opacity-40 shadow-2xs"
                >
                  <RefreshCw
                    size={18}
                    className={`shrink-0 transition-transform duration-400 ${
                      isShuffling ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          2. INCOMING INVITATION DEDICATED SCENE (АТМОСФЕРНАЯ ДЫМКА И СВЕЧЕНИЕ)
          ========================================================================= */}
      {isIncomingModalOpen && invitation && (
        <div
          role="dialog"
          aria-modal="true"
          className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-hidden select-none ${
            isIncomingClosing
              ? 'animate-[modal-backdrop-exit_260ms_cubic-bezier(0.25,1,0.5,1)_forwards]'
              : 'animate-[modal-backdrop-enter_460ms_cubic-bezier(0.22,1,0.36,1)]'
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseIncomingModal();
          }}
        >
          {/* Close Button top-right */}
          <button
            type="button"
            onClick={handleCloseIncomingModal}
            title="Закрыть"
            className="absolute top-4 right-4 sm:top-6 sm:right-6 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md flex items-center justify-center text-white transition-colors cursor-pointer z-30 shadow-md"
          >
            <X size={18} />
          </button>

          {/* 1. Atmospheric Soft Radiant Glow: static blur-2xl, hardware-accelerated transform + opacity only */}
          <div
            className="absolute w-72 xs:w-80 aspect-square rounded-full pointer-events-none -z-10 inset-0 m-auto bg-[radial-gradient(ellipse_at_center,_rgba(254,205,211,0.5)_0%,_rgba(253,230,138,0.22)_45%,_transparent_70%)] blur-2xl will-change-[transform,opacity] animate-[incoming-glow-bloom_800ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
          />

          {/* 2. Soft Floating Mist Veil: single lightweight layer that gently expands and fades out */}
          <div
            className="absolute w-80 xs:w-96 h-64 rounded-full pointer-events-none -z-10 inset-0 m-auto bg-[radial-gradient(circle,_rgba(255,255,255,0.7)_0%,_rgba(254,226,236,0.35)_45%,_transparent_70%)] blur-2xl will-change-[transform,opacity] animate-[incoming-mist-veil_750ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
          />

          {/* Main Incoming Invitation Card — Emerges smoothly and seamlessly through the mist with transform + opacity */}
          <div
            className={`w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#FFFDFB] via-[#FFFFFF] to-[#FAF6F3] dark:from-[#211A1F] dark:via-[#1D171C] dark:to-[#171216] border border-[#EBD6DC] dark:border-[#3E3039] p-6 xs:p-7 shadow-2xl relative overflow-hidden will-change-[transform,opacity] z-10 ${
              isIncomingClosing
                ? 'animate-[letter-continuous-close_260ms_cubic-bezier(0.25,1,0.5,1)_forwards]'
                : 'animate-[incoming-card-reveal_650ms_cubic-bezier(0.22,1,0.36,1)]'
            }`}
          >
            {/* Delicate inner hairline border */}
            <div className="absolute inset-3 rounded-2xl border border-[#F2E1E6]/80 dark:border-[#362A32] pointer-events-none" />

            {/* Corner accent flourishes */}
            <div className="absolute top-4 left-4 text-[#E98787]/40 text-xs pointer-events-none select-none">
              ✦
            </div>
            <div className="absolute top-4 right-12 text-[#E98787]/40 text-xs pointer-events-none select-none">
              ✦
            </div>

            {/* Close Button at top right of the card */}
            <button
              type="button"
              onClick={handleCloseIncomingModal}
              title="Закрыть"
              className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-[#777277] dark:text-[#A8A1A4] hover:text-[#343033] dark:hover:text-white transition-colors cursor-pointer z-20"
            >
              <X size={16} />
            </button>

            {/* Incoming Date Card Content */}
            <div className="relative z-10 flex flex-col items-center text-center">
              {/* Upper Ribbon */}
              <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-[#E98787] dark:text-[#F0B9C6] mb-3">
                <span className="w-5 h-px bg-[#E98787]/40" />
                <span>Входящее приглашение 💌</span>
                <span className="w-5 h-px bg-[#E98787]/40" />
              </div>

              {/* Partner invite heading */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FAF0F2] dark:bg-[#2A2026] text-[#E17282] dark:text-[#F3AEBF] text-xs font-semibold mb-3">
                <Heart size={13} fill="currentColor" />
                <span>{invitation.senderName || partnerDisplayName} приглашает тебя</span>
              </div>

              {/* Tag Badge */}
              <div className="inline-block px-3 py-1 rounded-full bg-[#FAF0F2] dark:bg-[#2A2026] text-[#777277] dark:text-[#B8B0B4] text-xs font-medium mb-3">
                {invitation.idea.tag}
              </div>

              {/* Date Title */}
              <h2 className="text-xl xs:text-2xl font-bold tracking-tight text-[#343033] dark:text-[#FAF5F7] mb-3 leading-snug px-1">
                {invitation.idea.title}
              </h2>

              {/* Description */}
              <p className="text-sm text-[#554F54] dark:text-[#C5BEC2] leading-relaxed mb-6 max-w-[280px]">
                {invitation.idea.description}
              </p>

              {/* Action Buttons: 'Согласна' / 'Отказ' */}
              <div className="flex flex-col gap-2.5 w-full">
                <button
                  type="button"
                  onClick={handleAcceptIncomingInvitation}
                  className="w-full h-[52px] xs:h-[54px] rounded-full bg-gradient-to-r from-[#F0B9C6] via-[#E98787] to-[#E27A7A] dark:from-[#C95B6F] dark:via-[#B84E5F] dark:to-[#A3404D] border border-white/35 dark:border-white/20 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.45),0_8px_24px_-6px_rgba(233,135,135,0.32)] dark:shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.2),0_8px_24px_-6px_rgba(0,0,0,0.5)] text-white font-display font-semibold text-[15px] sm:text-[15.5px] tracking-tight hover:opacity-95 active:scale-[0.985] active:opacity-90 transition-all duration-200 ease-out flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check size={18} strokeWidth={2.4} />
                  <span>Согласна</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeclineIncomingInvitation}
                  className="w-full py-2.5 px-4 rounded-full text-[#8A8488] dark:text-[#9E969B] hover:text-[#343033] dark:hover:text-white font-medium text-xs active:scale-[0.985] transition-colors cursor-pointer"
                >
                  Отказ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS Keyframe animations */}
      <style>{`
        @keyframes float-cozy {
          0%, 100% {
            transform: translateY(-2.5px) rotate(-0.5deg);
          }
          50% {
            transform: translateY(1.5px) rotate(0.4deg);
          }
        }
        @keyframes shadow-pulse {
          0%, 100% {
            transform: scale(0.96);
            opacity: 0.52;
          }
          50% {
            transform: scale(1.02);
            opacity: 0.62;
          }
        }
        @keyframes ambient-glow-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.72;
          }
          50% {
            transform: scale(1.06);
            opacity: 0.90;
          }
        }
        @keyframes contour-halo-breathe {
          0%, 100% {
            transform: scale(1) translate3d(0, 0, 0);
            opacity: 0.65;
          }
          50% {
            transform: scale(1.04) translate3d(0, -3px, 0);
            opacity: 0.82;
          }
        }
        @keyframes mist-drift-left {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.50;
          }
          50% {
            transform: translate3d(6px, -4px, 0) scale(1.05);
            opacity: 0.72;
          }
        }
        @keyframes mist-drift-right {
          0%, 100% {
            transform: translate3d(0, 0, 0) scale(1);
            opacity: 0.45;
          }
          50% {
            transform: translate3d(-6px, 5px, 0) scale(1.06);
            opacity: 0.68;
          }
        }
        @keyframes letter-continuous-bloom {
          0% {
            opacity: 0;
            transform: translate3d(0, 72px, 0) scale(0.72);
          }
          15% {
            opacity: 1;
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes letter-continuous-close {
          0% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
          65% {
            opacity: 0.85;
          }
          100% {
            opacity: 0;
            transform: translate3d(0, 60px, 0) scale(0.72);
          }
        }
        @keyframes modal-backdrop-enter {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
        @keyframes modal-backdrop-exit {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        @keyframes fade-in {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
        @keyframes mist-rise-left {
          0% {
            opacity: 0;
            transform: translate(-10px, 12px) scale(0.6);
          }
          30% {
            opacity: 0.75;
          }
          100% {
            opacity: 0;
            transform: translate(-28px, -45px) scale(1.35);
          }
        }
        @keyframes mist-rise-right {
          0% {
            opacity: 0;
            transform: translate(10px, 12px) scale(0.6);
          }
          35% {
            opacity: 0.7;
          }
          100% {
            opacity: 0;
            transform: translate(32px, -48px) scale(1.4);
          }
        }
        @keyframes mist-rise-center {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.5);
          }
          28% {
            opacity: 0.85;
          }
          100% {
            opacity: 0;
            transform: translateY(-56px) scale(1.5);
          }
        }
        @keyframes aura-glow {
          0% {
            opacity: 0;
            transform: scale(0.7) translateY(8px);
          }
          40% {
            opacity: 0.95;
            transform: scale(1.15) translateY(-8px);
          }
          100% {
            opacity: 0.75;
            transform: scale(1.05) translateY(-4px);
          }
        }
        @keyframes sparkle-float {
          0% {
            opacity: 0;
            transform: translateY(8px) scale(0.3) rotate(0deg);
          }
          35% {
            opacity: 1;
            transform: translateY(-18px) scale(1) rotate(45deg);
          }
          100% {
            opacity: 0;
            transform: translateY(-46px) scale(0.5) rotate(90deg);
          }
        }
        @keyframes incoming-glow-bloom {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) scale(0.72);
          }
          40% {
            opacity: 0.85;
            transform: translate3d(0, 0, 0) scale(1.08);
          }
          100% {
            opacity: 0.42;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes incoming-mist-veil {
          0% {
            opacity: 0;
            transform: translate3d(0, 8px, 0) scale(0.85);
          }
          32% {
            opacity: 0.75;
            transform: translate3d(0, 0, 0) scale(1.04);
          }
          100% {
            opacity: 0;
            transform: translate3d(0, -12px, 0) scale(1.22);
          }
        }
        @keyframes incoming-card-reveal {
          0% {
            opacity: 0;
            transform: translate3d(0, 20px, 0) scale(0.94);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
      `}</style>
    </div>
  );
};
