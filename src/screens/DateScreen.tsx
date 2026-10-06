import React, { useState, useEffect, useRef } from 'react';
import { Mail, Sparkles, Heart, RefreshCw, Check, X, ChevronRight } from 'lucide-react';
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
import { apiClient } from '../services/api/apiClient';

interface DateScreenProps {
  couple: CoupleState;
  soundEnabled?: boolean;
  hapticEnabled?: boolean;
}

function getRandomDateIdeaIndex(currentIndex = -1): number {
  if (DATE_IDEAS.length <= 1) return 0;
  let next = Math.floor(Math.random() * DATE_IDEAS.length);
  while (next === currentIndex) {
    next = Math.floor(Math.random() * DATE_IDEAS.length);
  }
  return next;
}

export const DateScreen: React.FC<DateScreenProps> = ({
  couple,
  soundEnabled = true,
  hapticEnabled = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [currentIdeaIndex, setCurrentIdeaIndex] = useState<number>(() => getRandomDateIdeaIndex());
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

  // Sync latest invitation from server on mount / when couple changes
  useEffect(() => {
    if (couple?.id) {
      apiClient.fetchDateInvitation(couple.id).then((srvInv) => {
        if (srvInv) {
          const synced = dateInvitationService.syncFromServer(
            srvInv,
            couple.user?.id || apiClient.getCurrentUserId(),
            couple.user?.name,
            couple.partner?.name
          );
          if (synced) {
            setInvitation(synced);
          }
        }
      }).catch(() => {});
    }
  }, [couple?.id]);

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

  // Shuffle to random idea
  const handleNextIdea = () => {
    if (isShuffling) return;
    setIsShuffling(true);
    playCardShuffleSound(soundEnabled);
    triggerHaptic(hapticEnabled);

    addTimer(() => {
      setCurrentIdeaIndex((prev) => getRandomDateIdeaIndex(prev));
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
      couple?.id,
      couple?.user?.id || apiClient.getCurrentUserId() || undefined,
      couple?.partner?.id || undefined
    );
    setInvitation(sent);
    handleCloseModal();
  };

  // Open incoming invitation modal with atmospheric soft mist & radiance reveal
  const handleOpenIncomingInvitation = () => {
    if (!invitation) return;
    clearTimers();
    // Mark as read upon actually opening the invitation to clear the tab notification dot
    dateInvitationService.markAsRead(invitation.id, couple?.id);
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

  // Accept incoming invitation: "Свидание принято"
  const handleAcceptIncomingInvitation = () => {
    if (!invitation) return;
    playSoftChime('tap', soundEnabled);
    triggerHaptic(hapticEnabled);
    const updated = dateInvitationService.acceptInvitation(invitation.id, couple?.id);
    if (updated) {
      setInvitation(updated);
    }
    handleCloseIncomingModal();
  };

  // Decline incoming invitation: "Отказ"
  const handleDeclineIncomingInvitation = () => {
    if (!invitation) return;
    triggerHaptic(hapticEnabled);
    const updated = dateInvitationService.declineInvitation(invitation.id, couple?.id);
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
        return 'Свидание принято';
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
              className="absolute inset-0 rounded-[20px] bg-gradient-to-b from-[#F6E8EB] via-[#E5C9D3] to-[#D4ABBA] border border-[#B17A8E]/75 shadow-[0_12px_28px_-6px_rgba(110,28,48,0.16),0_4px_12px_rgba(0,0,0,0.06)] overflow-hidden"
              style={{ zIndex: 1 }}
            >
              {/* Internal depth shading inside pocket cavity */}
              <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/10 via-black/3 to-transparent pointer-events-none" />

              {/* Warm interior intimate glow when open */}
              <div
                className={`absolute inset-0 bg-gradient-to-t from-rose-400/25 via-amber-300/15 to-transparent transition-opacity duration-500 pointer-events-none ${
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
                <div className="absolute left-1/2 -translate-x-1/2 top-4 w-44 h-28 rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(252,211,77,0.35)_0%,_rgba(244,114,182,0.25)_45%,_transparent_75%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(240,185,198,0.25)_0%,_rgba(201,91,111,0.18)_45%,_transparent_75%)] blur-xl animate-[aura-glow_0.75s_ease-out_forwards]" />

                {/* Secondary expansive soft warm light */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-2 w-60 h-36 rounded-full bg-[radial-gradient(ellipse_at_center,_rgba(254,205,211,0.38)_0%,_rgba(253,230,138,0.18)_50%,_transparent_75%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(224,115,148,0.20)_0%,_rgba(188,62,95,0.10)_50%,_transparent_75%)] blur-2xl animate-[aura-glow_0.9s_ease-out_forwards]" />

                {/* Left ethereal mist wisp */}
                <div className="absolute left-[16%] top-6 w-24 h-24 rounded-full bg-[radial-gradient(circle,_rgba(255,228,235,0.5)_0%,_rgba(254,205,211,0.25)_40%,_transparent_70%)] dark:bg-[radial-gradient(circle,_rgba(240,185,198,0.18)_0%,_rgba(201,91,111,0.08)_40%,_transparent_70%)] blur-lg animate-[mist-rise-left_0.8s_cubic-bezier(0.2,0.8,0.3,1)_forwards]" />

                {/* Right ethereal mist wisp */}
                <div className="absolute right-[16%] top-6 w-28 h-28 rounded-full bg-[radial-gradient(circle,_rgba(254,243,199,0.5)_0%,_rgba(254,205,211,0.25)_40%,_transparent_70%)] dark:bg-[radial-gradient(circle,_rgba(248,205,225,0.18)_0%,_rgba(201,91,111,0.08)_40%,_transparent_70%)] blur-lg animate-[mist-rise-right_0.85s_cubic-bezier(0.2,0.8,0.3,1)_forwards]" />

                {/* Center ethereal mist column */}
                <div className="absolute left-1/2 -translate-x-1/2 top-8 w-32 h-32 rounded-full bg-[radial-gradient(circle,_rgba(255,255,255,0.6)_0%,_rgba(254,226,236,0.3)_45%,_transparent_70%)] dark:bg-[radial-gradient(circle,_rgba(255,255,255,0.15)_0%,_rgba(240,185,198,0.08)_45%,_transparent_70%)] blur-xl animate-[mist-rise-center_0.9s_cubic-bezier(0.2,0.8,0.3,1)_forwards]" />

                {/* Subtle soft sparkles escaping with the mist */}
                <span
                  className="absolute left-[28%] top-7 text-amber-300/80 dark:text-[#F0B9C6]/70 animate-[sparkle-float_0.8s_ease-out_forwards] select-none pointer-events-none drop-shadow-[0_0_4px_rgba(251,191,36,0.4)]"
                  style={{ animationDelay: '60ms' }}
                >
                  <Sparkles size={11} />
                </span>
                <span
                  className="absolute right-[26%] top-5 text-rose-300/80 dark:text-[#E98787]/70 animate-[sparkle-float_0.85s_ease-out_forwards] select-none pointer-events-none drop-shadow-[0_0_4px_rgba(244,114,182,0.4)]"
                  style={{ animationDelay: '120ms' }}
                >
                  <Sparkles size={9} />
                </span>
                <span
                  className="absolute left-[48%] top-3 text-amber-200/80 dark:text-[#F3AEBF]/70 animate-[sparkle-float_0.85s_ease-out_forwards] select-none pointer-events-none drop-shadow-[0_0_5px_rgba(253,230,138,0.5)]"
                  style={{ animationDelay: '90ms' }}
                >
                  <Sparkles size={13} />
                </span>
              </div>
            )}

            {/* 
              2. LETTER PREVIEW
              - Positioned lower and centered in the envelope frame
              - Matches the warm-dark cozy card palette of OURS
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
              <div className="w-full h-28 xs:h-30 rounded-2xl bg-gradient-to-b from-[#FFFDFB] via-[#FFFFFF] to-[#FAF6F3] dark:from-[#1D161C] dark:via-[#181116] dark:to-[#130D11] border border-[#ECD4DC] dark:border-[#30222B] p-3 pt-3.5 pb-2 shadow-md flex flex-col items-center justify-start">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FAF0F2] dark:bg-[#2A2026] text-[#E17282] dark:text-[#F3AEBF] text-[11px] font-semibold tracking-wide uppercase mb-1.5">
                  <Sparkles size={11} className="text-[#E17282] dark:text-[#F3AEBF] shrink-0" />
                  <span>Идея для вас</span>
                </div>
                <div className="text-xs xs:text-sm font-bold text-[#343033] dark:text-[#FAF5F7] text-center line-clamp-2 px-1">
                  {currentIdea.title}
                </div>
              </div>
            </div>

            {/* 3. FRONT POCKET SVG (Bottom & Side Flaps) */}
            <div
              className="absolute inset-0 rounded-[20px] overflow-hidden pointer-events-none"
              style={{ zIndex: 15 }}
            >
              <svg viewBox="0 0 320 200" className="w-full h-full block" preserveAspectRatio="none">
                <defs>
                  {/* Pocket Side Flap Gradients */}
                  <linearGradient id="pocketLeftGradient" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#F6E8EB" />
                    <stop offset="100%" stopColor="#D9AEBD" />
                  </linearGradient>
                  <linearGradient id="pocketRightGradient" x1="1" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F6E8EB" />
                    <stop offset="100%" stopColor="#D9AEBD" />
                  </linearGradient>
                  {/* Pocket Bottom Flap Gradient */}
                  <linearGradient id="pocketBottomGradient" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="#CE9FB1" />
                    <stop offset="100%" stopColor="#EACFD9" />
                  </linearGradient>

                  {/* Soft Fold Shadows */}
                  <linearGradient id="foldShadowLeft" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="rgba(78,22,38,0.10)" />
                    <stop offset="100%" stopColor="rgba(78,22,38,0)" />
                  </linearGradient>
                  <linearGradient id="foldShadowRight" x1="1" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(78,22,38,0.10)" />
                    <stop offset="100%" stopColor="rgba(78,22,38,0)" />
                  </linearGradient>
                </defs>

                {/* Left Side Triangle */}
                <path
                  d="M 0 0 L 160 115 L 0 200 Z"
                  fill="url(#pocketLeftGradient)"
                  stroke="#AF778B"
                  strokeWidth="0.5"
                />

                {/* Right Side Triangle */}
                <path
                  d="M 320 0 L 160 115 L 320 200 Z"
                  fill="url(#pocketRightGradient)"
                  stroke="#AF778B"
                  strokeWidth="0.5"
                />

                {/* Left fold shadow */}
                <path d="M 0 0 L 160 115 L 0 200 Z" fill="url(#foldShadowLeft)" />
                {/* Right fold shadow */}
                <path d="M 320 0 L 160 115 L 320 200 Z" fill="url(#foldShadowRight)" />

                {/* Bottom Triangle Flap */}
                <path
                  d="M 0 200 L 160 95 L 320 200 Z"
                  fill="url(#pocketBottomGradient)"
                  stroke="#AF778B"
                  strokeWidth="0.5"
                />
              </svg>
            </div>

            {/* 4. TOP FLAP WITH WAX SEAL */}
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
                viewBox="0 0 320 112"
                className="w-full h-full drop-shadow-[0_4px_12px_rgba(110,28,48,0.14)] block"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="flapGradientOriginal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F7E8EB" />
                    <stop offset="50%" stopColor="#E5C9D3" />
                    <stop offset="100%" stopColor="#D4ABBA" />
                  </linearGradient>
                </defs>

                <path
                  d="
                    M 20 0
                    L 300 0
                    A 20 20 0 0 1 320 20
                    L 160 112
                    L 0 20
                    A 20 20 0 0 1 20 0
                    Z
                  "
                  fill="url(#flapGradientOriginal)"
                  stroke="#AF778B"
                  strokeWidth="0.5"
                />
              </svg>

              {/* Wax Seal */}
              <div
                className={`absolute left-1/2 -translate-x-1/2 bottom-[-16px] w-10 h-10 xs:w-11 xs:h-11 rounded-full flex items-center justify-center drop-shadow-[0_3px_8px_rgba(110,28,48,0.28)] pointer-events-auto transition-all ${
                  isOpen
                    ? 'opacity-0 scale-95 duration-200 ease-out pointer-events-none'
                    : 'opacity-100 scale-100 duration-300 ease-out delay-160 hover:scale-105 active:scale-95'
                }`}
              >
                {/* Wax Seal outer rim */}
                <div className="w-full h-full rounded-full bg-gradient-to-br from-[#D96B82] via-[#A8324E] to-[#751B32] p-[2px] shadow-inner flex items-center justify-center relative">
                  {/* Inner disc */}
                  <div className="w-full h-full rounded-full border border-white/40 flex items-center justify-center bg-gradient-to-br from-[#CC5872] via-[#9B2A44] to-[#6A162B] shadow-sm">
                    <Heart
                      size={14}
                      className="text-white fill-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ambient Ground Shadow with synchronized soft pulse */}
          <div
            className={`absolute -bottom-3 left-1/2 -translate-x-1/2 w-[85%] h-3 xs:h-3.5 rounded-full bg-black/8 dark:bg-black/50 blur-md pointer-events-none transition-all duration-700 will-change-[transform,opacity] ${
              isClosed
                ? 'scale-100 opacity-60 animate-[shadow-pulse_7.8s_ease-in-out_infinite]'
                : 'scale-95 opacity-35'
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
            className="group relative h-[50px] xs:h-[52px] sm:h-[54px] px-7 xs:px-8 rounded-full select-none overflow-hidden cursor-pointer transition-all duration-100 ease-out active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8BFC7] bg-[#FAF0F2] dark:bg-[#150F13] border border-[#E98787]/20 dark:border-[#E8BFC7]/15 shadow-[0_4px_20px_-4px_rgba(233,135,135,0.18)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] hover:border-[#E98787]/35 text-center flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100"
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
            COMPACT STATUS / INVITATION PLATE (КОМПАКТНАЯ ПЛАШКА ПРИГЛАШЕНИЯ)
            ========================================================================= */}
        {invitation && (
          <>
            {/* STATE A: Incoming Pending Invitation from Partner */}
            {invitation.status === 'pending' && invitation.senderId === 'partner' ? (
              <div className="w-full max-w-[360px] xs:max-w-[392px] sm:max-w-[416px] mx-auto mt-4.5 relative group">
                {/* Soft ambient mist UNDER the compact card */}
                <div
                  className="absolute -inset-3.5 rounded-[34px] bg-gradient-to-b from-[#FAD4DF]/35 via-[#F7CAD6]/20 to-transparent dark:from-[#3D222E]/40 dark:via-[#2F1A24]/20 dark:to-transparent blur-xl pointer-events-none -z-10"
                  aria-hidden="true"
                />

                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleOpenIncomingInvitation}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenIncomingInvitation();
                    }
                  }}
                  className="w-full p-5.5 xs:p-6.5 sm:p-7 rounded-[28px] bg-gradient-to-b from-[#FFFDFB]/95 via-[#FFFFFF]/90 to-[#FAF6F3]/95 dark:from-[#1D161C]/95 dark:via-[#181116]/95 dark:to-[#130D11]/95 backdrop-blur-md border border-[#ECD4DC] dark:border-[#30222B] shadow-[0_10px_32px_-6px_rgba(233,135,135,0.18)] dark:shadow-[0_14px_36px_-8px_rgba(0,0,0,0.6)] hover:border-[#E98787]/50 dark:hover:border-[#E98787]/40 active:scale-[0.988] transition-all duration-200 cursor-pointer text-left relative overflow-hidden select-none animate-card-enter"
                >
                  {/* Header row: Badge */}
                  <div className="relative z-10 flex items-center justify-between gap-2 mb-3.5">
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FAF0F2] dark:bg-[#2A2026] text-[#E17282] dark:text-[#F3AEBF] text-xs font-semibold tracking-wide">
                      <Mail size={13} className="text-[#E17282] dark:text-[#F3AEBF] shrink-0" />
                      <span>Входящее приглашение</span>
                      {!invitation.read && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-[#E98787] shrink-0 animate-pulse shadow-[0_0_6px_rgba(233,135,135,0.8)] ml-0.5"
                          title="Новое приглашение"
                        />
                      )}
                    </div>
                  </div>

                  {/* Sender subtitle */}
                  <div className="relative z-10 text-[13px] xs:text-[14px] text-[#777277] dark:text-[#B5ADB1] font-medium flex items-center gap-1.5 mb-2.5">
                    <Heart size={13} className="text-[#E98787] dark:text-[#F0B9C6] fill-[#E98787] dark:fill-[#F0B9C6] shrink-0" />
                    <span className="truncate">
                      <strong className="font-semibold text-[#343033] dark:text-[#FAF5F7]">
                        {invitation.senderName || partnerDisplayName}
                      </strong>{' '}
                      зовёт тебя на свидание
                    </span>
                  </div>

                  {/* Date Title */}
                  <h3 className="relative z-10 font-display font-bold text-[18px] xs:text-[20px] sm:text-[21.5px] leading-snug text-[#343033] dark:text-[#FAF5F7] tracking-tight mb-2.5">
                    «{invitation.idea.title}»
                  </h3>

                  {/* Brief 2-line snippet */}
                  {invitation.idea.description && (
                    <p className="relative z-10 text-[13px] xs:text-[14px] text-[#635D62] dark:text-[#C5BEC2] leading-relaxed line-clamp-2 mb-5 font-normal">
                      {invitation.idea.description}
                    </p>
                  )}

                  {/* Primary Action Button: «Открыть» */}
                  <div className="relative z-10 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenIncomingInvitation();
                      }}
                      className="w-full h-[50px] xs:h-[52px] sm:h-[54px] rounded-full bg-gradient-to-r from-[#F0B9C6] via-[#E98787] to-[#E27A7A] dark:from-[#C95B6F] dark:via-[#B84E5F] dark:to-[#A3404D] border border-white/40 dark:border-white/20 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.45),0_6px_20px_-4px_rgba(233,135,135,0.32)] dark:shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.2),0_6px_20px_-4px_rgba(0,0,0,0.5)] text-white font-display font-semibold text-[14.5px] xs:text-[15.5px] tracking-tight hover:opacity-95 active:scale-[0.985] active:opacity-90 transition-all duration-200 ease-out flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Mail size={17} strokeWidth={2.2} />
                      <span>Открыть</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* STATE B: Sent invitation or resolved invitation (accepted/declined) */
              <div className="w-full max-w-[360px] xs:max-w-[392px] sm:max-w-[416px] mx-auto mt-4.5 relative group">
                {/* Soft ambient mist UNDER the card */}
                <div
                  className="absolute -inset-3 rounded-[32px] bg-gradient-to-b from-[#FAD4DF]/25 via-[#F7CAD6]/15 to-transparent dark:from-[#3D222E]/30 dark:via-[#2F1A24]/15 dark:to-transparent blur-xl pointer-events-none -z-10"
                  aria-hidden="true"
                />

                <div className="w-full px-5.5 py-4.5 xs:px-6.5 xs:py-5.5 sm:px-7 sm:py-6 rounded-[26px] bg-gradient-to-b from-[#FFFDFB]/95 via-[#FFFFFF]/90 to-[#FAF6F3]/95 dark:from-[#1D161C]/95 dark:via-[#181116]/95 dark:to-[#130D11]/95 backdrop-blur-md border border-[#ECD4DC] dark:border-[#30222B] shadow-[0_8px_26px_-6px_rgba(233,135,135,0.16)] dark:shadow-[0_12px_30px_-8px_rgba(0,0,0,0.6)] transition-all duration-300 animate-card-enter relative overflow-hidden">
                  {/* Row 1: Header / Title */}
                  <div className="relative z-10 flex items-center justify-between gap-2 mb-2.5">
                    <div className="inline-flex items-center gap-1.5 text-xs xs:text-[13px] font-semibold text-[#E98787] dark:text-[#F0B9C6] truncate">
                      <Mail size={13} className="text-[#E98787] dark:text-[#F0B9C6] shrink-0" />
                      <span className="truncate">Свидание</span>
                    </div>

                    {invitation.status !== 'pending' && (
                      <button
                        type="button"
                        onClick={() => dateInvitationService.clearInvitation(couple?.id)}
                        title="Закрыть"
                        className="text-[#A8A1A4] hover:text-[#343033] dark:hover:text-white transition-colors cursor-pointer shrink-0 p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  {/* Row 2: Date idea title */}
                  <div
                    onClick={handleOpenIncomingInvitation}
                    className="relative z-10 text-[15.5px] xs:text-[16.5px] sm:text-[17px] font-semibold text-[#343033] dark:text-[#FAF5F7] truncate mb-3 cursor-pointer hover:text-[#E98787] dark:hover:text-[#F0B9C6] transition-colors"
                  >
                    «{invitation.idea.title}»
                  </div>

                  {/* Row 3: Status line */}
                  <div className="relative z-10 flex flex-col gap-1.5 text-xs xs:text-[13.5px] font-medium pt-2.5 border-t border-[#F2E1E6]/70 dark:border-[#261B23]">
                    {invitation.status === 'pending' && (
                      <div className="inline-flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                        <span>{partnerDisplayName}: Ожидание</span>
                      </div>
                    )}
                    {invitation.status === 'accepted' && (
                      <div className="inline-flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
                        <Check size={16} strokeWidth={2.5} className="shrink-0" />
                        <span>Свидание принято</span>
                      </div>
                    )}
                    {invitation.status === 'declined' && (
                      <div className="inline-flex items-center gap-2 font-semibold text-stone-500 dark:text-stone-400">
                        <span className="w-2 h-2 rounded-full bg-stone-400 shrink-0" />
                        <span>Приглашение отклонено</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </footer>

      {/* =========================================================================
          FULL-SCREEN DEDICATED WINDOW (ОТДЕЛЬНОЕ ОКНО С КАРТОЧКОЙ)
          Clean OURS card system matching partner invitation card
          ========================================================================= */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-3.5 xs:p-4 sm:p-6 ${
            isClosingModal
              ? 'animate-[modal-backdrop-exit_260ms_cubic-bezier(0.25,1,0.5,1)_forwards]'
              : 'animate-[modal-backdrop-enter_460ms_cubic-bezier(0.22,1,0.36,1)]'
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseModal();
          }}
        >
          {/* Ambient soft card glow behind modal */}
          <div
            className="absolute w-80 xs:w-96 aspect-square rounded-full pointer-events-none -z-10 inset-0 m-auto bg-[radial-gradient(ellipse_at_center,_rgba(254,205,211,0.35)_0%,_rgba(253,230,138,0.15)_45%,_transparent_70%)] blur-2xl"
          />

          <div
            className={`w-full max-w-[360px] xs:max-w-[390px] sm:max-w-[412px] rounded-[28px] bg-gradient-to-b from-[#FFFDFB] via-[#FFFFFF] to-[#FAF6F3] dark:from-[#1D161C] dark:via-[#181116] dark:to-[#130D11] border border-[#ECD4DC] dark:border-[#30222B] p-6.5 xs:p-7.5 sm:p-8 shadow-[0_16px_40px_-8px_rgba(233,135,135,0.22)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.7)] relative overflow-hidden will-change-transform ${
              isClosingModal
                ? 'animate-[letter-continuous-close_260ms_cubic-bezier(0.25,1,0.5,1)_forwards]'
                : 'animate-[letter-continuous-bloom_520ms_cubic-bezier(0.22,1,0.36,1)]'
            }`}
          >
            {/* Close Button at top right */}
            <button
              type="button"
              onClick={handleCloseModal}
              title="Закрыть"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-[#777277] dark:text-[#A8A1A4] hover:text-[#343033] dark:hover:text-white transition-colors cursor-pointer z-20"
            >
              <X size={16} />
            </button>

            {/* Date Card Content */}
            <div
              className={`relative z-10 flex flex-col items-center text-center transition-all duration-200 ${
                isShuffling ? 'opacity-30 scale-98' : 'opacity-100 scale-100'
              }`}
            >
              {/* Upper Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FAF0F2] dark:bg-[#2A2026] text-[#E17282] dark:text-[#F3AEBF] text-[13.5px] xs:text-[14px] font-semibold tracking-wide mb-3.5">
                <Sparkles size={14} className="text-[#E17282] dark:text-[#F3AEBF] shrink-0" />
                <span>Идея для вас</span>
              </div>

              {/* Date Title */}
              <h2 className="text-xl xs:text-2xl sm:text-[25px] font-bold tracking-tight text-[#343033] dark:text-[#FAF5F7] mb-3 leading-snug px-1">
                {currentIdea.title}
              </h2>

              {/* Description */}
              <p className="text-sm xs:text-[14.5px] text-[#554F54] dark:text-[#C5BEC2] leading-relaxed mb-6 max-w-[300px]">
                {currentIdea.description}
              </p>

              {/* Action Buttons: 'Пригласить' + refresh button */}
              <div className="flex items-center gap-2.5 w-full">
                <button
                  type="button"
                  onClick={handleInvitePartner}
                  className="group relative flex-1 h-[50px] xs:h-[52px] sm:h-[54px] px-6 rounded-full select-none overflow-hidden cursor-pointer transition-all duration-100 ease-out active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8BFC7] bg-[#FAF0F2] dark:bg-[#150F13] border border-[#E98787]/20 dark:border-[#E8BFC7]/15 shadow-[0_4px_20px_-4px_rgba(233,135,135,0.18)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] hover:border-[#E98787]/35 text-center flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100"
                  aria-label="Пригласить"
                >
                  {/* Ambient Background Aura & Delicate Floating Gleam (exact SVG Layer from «Открыть свидание») */}
                  <svg
                    viewBox="0 0 360 65"
                    preserveAspectRatio="xMidYMid slice"
                    className="absolute inset-0 w-full h-full pointer-events-none block"
                    aria-hidden="true"
                  >
                    <defs>
                      <radialGradient id="dateInvitePillGlow" cx="45%" cy="40%" r="65%">
                        <stop offset="0%" stopColor="#E98787" stopOpacity="0.09" />
                        <stop offset="50%" stopColor="#FFDEE7" stopOpacity="0.03" />
                        <stop offset="100%" stopColor="#FAF0F2" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#dateInvitePillGlow)" />

                    {/* Faint Romantic Gleam Particles */}
                    <g opacity="0.25">
                      <circle cx="42" cy="42" r="1.1" fill="#E98787" />
                      <circle cx="135" cy="18" r="0.8" fill="#E98787" />
                      <circle cx="235" cy="45" r="0.9" fill="#E98787" />
                      <circle cx="315" cy="20" r="1.0" fill="#E98787" />
                    </g>
                  </svg>

                  {/* Content Overlay */}
                  <div className="relative z-10 flex items-center justify-center pointer-events-none">
                    <span className="font-display font-semibold text-[14.5px] xs:text-[15px] sm:text-[15.5px] tracking-tight text-[#343033] dark:text-white drop-shadow-xs whitespace-nowrap">
                      Пригласить
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleNextIdea}
                  disabled={isShuffling}
                  title="Сменить свидание"
                  aria-label="Сменить свидание"
                  className="w-[50px] h-[50px] xs:w-[52px] xs:h-[52px] sm:w-[54px] sm:h-[54px] shrink-0 rounded-full border border-[#E98787]/20 dark:border-[#E8BFC7]/15 bg-[#FAF0F2] dark:bg-[#150F13] shadow-[0_4px_20px_-4px_rgba(233,135,135,0.18)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] hover:border-[#E98787]/35 text-[#6E676D] dark:text-[#C5BEC2] hover:text-[#E98787] dark:hover:text-[#F0B9C6] active:scale-[0.985] transition-all duration-200 flex items-center justify-center cursor-pointer disabled:opacity-40"
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
          Exact visual unity with Sender's Open Card
          ========================================================================= */}
      {isIncomingModalOpen && invitation && (
        <div
          role="dialog"
          aria-modal="true"
          className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-3.5 xs:p-4 sm:p-6 overflow-hidden select-none ${
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

          {/* 1. Atmospheric Soft Radiant Glow */}
          <div
            className="absolute w-80 xs:w-96 aspect-square rounded-full pointer-events-none -z-10 inset-0 m-auto bg-[radial-gradient(ellipse_at_center,_rgba(254,205,211,0.35)_0%,_rgba(253,230,138,0.15)_45%,_transparent_70%)] blur-2xl will-change-[transform,opacity] animate-[incoming-glow-bloom_800ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
          />

          {/* 2. Soft Floating Mist Veil */}
          <div
            className="absolute w-96 xs:w-[440px] h-72 rounded-full pointer-events-none -z-10 inset-0 m-auto bg-[radial-gradient(circle,_rgba(255,255,255,0.7)_0%,_rgba(254,226,236,0.35)_45%,_transparent_70%)] blur-2xl will-change-[transform,opacity] animate-[incoming-mist-veil_750ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
          />

          {/* Main Incoming Invitation Card — Exact same styling, radius, border, and depth */}
          <div
            className={`w-full max-w-[360px] xs:max-w-[390px] sm:max-w-[412px] rounded-[28px] bg-gradient-to-b from-[#FFFDFB] via-[#FFFFFF] to-[#FAF6F3] dark:from-[#1D161C] dark:via-[#181116] dark:to-[#130D11] border border-[#ECD4DC] dark:border-[#30222B] p-6.5 xs:p-7.5 sm:p-8 shadow-[0_16px_40px_-8px_rgba(233,135,135,0.22)] dark:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.7)] relative overflow-hidden will-change-[transform,opacity] z-10 ${
              isIncomingClosing
                ? 'animate-[letter-continuous-close_260ms_cubic-bezier(0.25,1,0.5,1)_forwards]'
                : 'animate-[incoming-card-reveal_650ms_cubic-bezier(0.22,1,0.36,1)]'
            }`}
          >
            {/* Close Button at top right of the card */}
            <button
              type="button"
              onClick={handleCloseIncomingModal}
              title="Закрыть"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 flex items-center justify-center text-[#777277] dark:text-[#A8A1A4] hover:text-[#343033] dark:hover:text-white transition-colors cursor-pointer z-20"
            >
              <X size={16} />
            </button>

            {/* Incoming Date Card Content */}
            <div className="relative z-10 flex flex-col items-center text-center">
              {/* Upper Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FAF0F2] dark:bg-[#2A2026] text-[#E17282] dark:text-[#F3AEBF] text-[13.5px] xs:text-[14px] font-semibold tracking-wide mb-3">
                <Mail size={14} className="text-[#E17282] dark:text-[#F3AEBF] shrink-0" />
                <span>{invitation.senderId === 'partner' ? 'Входящее приглашение' : 'Приглашение на свидание'}</span>
              </div>

              {/* Partner invite heading */}
              <div className="text-[13px] xs:text-[14px] text-[#777277] dark:text-[#B5ADB1] font-medium flex items-center gap-1.5 mb-2.5">
                <Heart size={13} className="text-[#E98787] dark:text-[#F0B9C6] fill-[#E98787] dark:fill-[#F0B9C6] shrink-0" />
                <span>
                  {invitation.senderId === 'partner'
                    ? `${invitation.senderName || partnerDisplayName} зовёт на свидание`
                    : `Ты зовёшь ${partnerDisplayName} на свидание`}
                </span>
              </div>

              {/* Date Title */}
              <h2 className="text-xl xs:text-2xl sm:text-[25px] font-bold tracking-tight text-[#343033] dark:text-[#FAF5F7] mb-3 leading-snug px-1">
                {invitation.idea.title}
              </h2>

              {/* Description */}
              <p className="text-sm xs:text-[14.5px] text-[#554F54] dark:text-[#C5BEC2] leading-relaxed mb-6 max-w-[300px]">
                {invitation.idea.description}
              </p>

              {/* Action Buttons: 'Принять' / 'Отклонить' only in expanded state when pending for recipient */}
              {invitation.status === 'pending' && invitation.senderId === 'partner' ? (
                <div className="flex flex-col gap-2.5 w-full">
                  <button
                    type="button"
                    onClick={handleAcceptIncomingInvitation}
                    className="w-full h-[52px] xs:h-[54px] rounded-full bg-gradient-to-r from-[#F0B9C6] via-[#E98787] to-[#E27A7A] dark:from-[#C95B6F] dark:via-[#B84E5F] dark:to-[#A3404D] border border-white/35 dark:border-white/20 shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.45),0_8px_24px_-6px_rgba(233,135,135,0.32)] dark:shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.2),0_8px_24px_-6px_rgba(0,0,0,0.5)] text-white font-display font-semibold text-[15px] sm:text-[15.5px] tracking-tight hover:opacity-95 active:scale-[0.985] active:opacity-90 transition-all duration-200 ease-out flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check size={18} strokeWidth={2.4} />
                    <span>Принять</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDeclineIncomingInvitation}
                    className="w-full py-2.5 px-4 rounded-full text-[#8A8488] dark:text-[#9E969B] hover:text-[#343033] dark:hover:text-white font-medium text-xs xs:text-sm active:scale-[0.985] transition-colors cursor-pointer"
                  >
                    Отклонить
                  </button>
                </div>
              ) : (
                <div className="w-full py-3.5 px-4 rounded-2xl bg-[#FAF0F2] dark:bg-[#2A2026] text-center border border-[#ECD4DC]/60 dark:border-[#3D3039]">
                  <span className="text-xs xs:text-sm font-semibold text-[#E98787] dark:text-[#F0B9C6] flex items-center justify-center gap-1.5">
                    {invitation.status === 'accepted' ? (
                      <>
                        <Check size={16} strokeWidth={2.4} />
                        <span>Свидание принято</span>
                      </>
                    ) : invitation.status === 'declined' ? (
                      <span>Приглашение отклонено</span>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span>Ожидаем ответ от {partnerDisplayName}...</span>
                      </>
                    )}
                  </span>
                </div>
              )}
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
