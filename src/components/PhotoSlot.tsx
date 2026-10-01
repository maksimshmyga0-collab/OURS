import React, { useRef, useState } from 'react';
import { Camera, Lock, Check, Sparkles, Heart } from 'lucide-react';
import { ReactionEmoji } from '../types';
import { ReactionIcon } from './ReactionIcon';
import { optimizePhotoForUpload } from '../services/storage/imageOptimizer';
import { FullscreenPhotoViewer } from './FullscreenPhotoViewer';
import { triggerHaptic, playSoftChime } from '../services/feedback';

interface PhotoSlotProps {
  type: 'user' | 'partner';
  title: string;
  photoUrl: string | null;
  isRevealed: boolean;
  isPartnerUploaded?: boolean;
  isUserUploaded?: boolean;
  onAddPhoto?: () => void;
  onPhotoSelected?: (photoDataUrl: string) => void;
  onOpenFullscreen?: (photoUrl: string, title?: string) => void;
  reaction?: ReactionEmoji | null;
  className?: string;
}

export const PhotoSlot: React.FC<PhotoSlotProps> = ({
  type,
  title,
  photoUrl,
  isRevealed,
  isPartnerUploaded = false,
  isUserUploaded = false,
  onAddPhoto,
  onPhotoSelected,
  onOpenFullscreen,
  reaction,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<{ url: string; title: string } | null>(null);

  const handleOpenViewer = (url: string, photoTitle: string) => {
    triggerHaptic(true);
    playSoftChime('tap', true);
    if (onOpenFullscreen) {
      onOpenFullscreen(url, photoTitle);
    } else {
      setViewerPhoto({ url, title: photoTitle });
      setIsViewerOpen(true);
    }
  };

  const handleCloseViewer = () => {
    setIsViewerOpen(false);
    setViewerPhoto(null);
  };

  const handleSlotClick = () => {
    if (type !== 'user') return;
    if (onAddPhoto) {
      onAddPhoto();
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // Provide instant local preview for zero-lag UI feedback
    const fastPreview = URL.createObjectURL(file);
    if (onPhotoSelected) {
      onPhotoSelected(fastPreview);
    } else if (onAddPhoto) {
      onAddPhoto();
    }

    try {
      const optimized = await optimizePhotoForUpload(file);
      if (optimized && optimized !== fastPreview) {
        if (onPhotoSelected) {
          onPhotoSelected(optimized);
        }
      }
    } catch (err) {
      console.warn('[PhotoSlot] Optimization fallback:', err);
    }
  };

  // =========================================================================
  // 1. USER SLOT
  // =========================================================================
  if (type === 'user') {
    if (photoUrl) {
      return (
        <div className={`w-full flex-1 flex flex-col items-center ${className} animate-photo-enter`}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Photo Frame Container */}
          <div
            onClick={() => handleOpenViewer(photoUrl, 'Твоё фото')}
            className="group relative w-full aspect-[4/5] rounded-[24px] sm:rounded-[26px] overflow-hidden bg-[#FAF1F3] dark:bg-[#181215] border border-[#F0D5DC] dark:border-[#3D252E] shadow-[0_10px_28px_-6px_rgba(215,130,145,0.2),0_2px_8px_rgba(0,0,0,0.03)] dark:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.7)] cursor-pointer transition-all duration-200 ease-out active:scale-[0.98] hover:shadow-[0_14px_32px_-6px_rgba(215,130,145,0.3)] select-none"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleOpenViewer(photoUrl, 'Твоё фото');
              }
            }}
            aria-label="Открыть твоё фото на весь экран"
          >
            {/* Top glass luster sheen */}
            <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/30 via-white/5 to-transparent dark:from-white/10 dark:to-transparent pointer-events-none z-10" />

            {/* Inner subtle frame hairline */}
            <div className="absolute inset-0 rounded-[24px] sm:rounded-[26px] border border-white/60 dark:border-white/10 pointer-events-none z-10" />

            {/* Actual photo image */}
            <img
              src={photoUrl}
              alt="Твоё фото"
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-103"
            />

            {/* State Overlay: Revealed (Partner reaction) vs Unrevealed (Check badge + Replace button) */}
            {isRevealed ? (
              reaction && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-2.5 right-2.5 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 dark:bg-[#1E1C1E]/95 backdrop-blur-md border border-[#EBE3E5] dark:border-[#2D2024] shadow-[0_4px_12px_rgba(0,0,0,0.12)] flex items-center justify-center animate-in zoom-in-75 fade-in duration-250 ease-out pointer-events-auto z-20"
                >
                  <ReactionIcon reaction={reaction} size={20} />
                </div>
              )
            ) : (
              <>
                {/* Floating Ready Checkmark at top-right */}
                <div className="absolute top-2.5 right-2.5 bg-black/40 backdrop-blur-md rounded-full w-6 h-6 border border-white/20 text-white flex items-center justify-center shadow-sm pointer-events-none z-10">
                  <Check size={13} strokeWidth={2.5} className="text-emerald-300" />
                </div>

                {/* Floating Replace Button at bottom (frosted glass pill that doesn't obstruct photo) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSlotClick();
                  }}
                  className="absolute inset-x-3.5 bottom-2.5 bg-black/45 hover:bg-black/60 backdrop-blur-md border border-white/25 shadow-md py-1.5 rounded-full text-[11px] font-medium tracking-wide text-white text-center transition-all duration-180 ease-out active:scale-[0.96] cursor-pointer z-10 flex items-center justify-center gap-1.5"
                >
                  <span>Заменить</span>
                </button>
              </>
            )}
          </div>

          {/* Clean metadata title & status below card */}
          <div className="flex flex-col items-center mt-2 text-center max-w-full">
            <span className="font-display font-semibold text-xs sm:text-[13px] text-[#343033] dark:text-[#FAF5F7] tracking-tight truncate max-w-full">
              {title}
            </span>
            <span className="text-[10px] text-[#8A8488] dark:text-[#A8A1A4] font-medium mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              {isRevealed ? 'Момент открыт' : 'Кадр отправлен'}
            </span>
          </div>

          {/* Local fallback Fullscreen Viewer if not handled by parent */}
          {!onOpenFullscreen && (
            <FullscreenPhotoViewer
              isOpen={isViewerOpen}
              onClose={handleCloseViewer}
              photoUrl={viewerPhoto?.url || null}
              title={viewerPhoto?.title}
            />
          )}
        </div>
      );
    }

    // User Slot: Empty / Touch to Add
    return (
      <div className={`w-full flex-1 flex flex-col items-center ${className}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Empty Upload Slot Button */}
        <button
          type="button"
          onClick={handleSlotClick}
          className={`group relative w-full aspect-[4/5] rounded-[24px] sm:rounded-[26px] bg-gradient-to-b from-[#FFFFFF] via-[#FFF8F9] to-[#FDF4F6] dark:from-[#1A1417] dark:via-[#161114] dark:to-[#130E11] border-2 border-dashed ${
            isPartnerUploaded
              ? 'border-[#E98787] shadow-[0_6px_22px_-2px_rgba(233,135,135,0.32)] animate-pulse'
              : 'border-[#F0D5DC] dark:border-[#3D252E] hover:border-[#E98787] dark:hover:border-[#E98787] shadow-[0_4px_16px_-4px_rgba(233,135,135,0.12)] hover:shadow-[0_8px_24px_-4px_rgba(233,135,135,0.22)]'
          } flex flex-col items-center justify-center p-3 text-center transition-all duration-200 ease-out active:scale-[0.98] cursor-pointer select-none`}
        >
          {/* Subtle inner ambient glow */}
          <div className="absolute inset-0 rounded-[24px] sm:rounded-[26px] bg-radial from-[#FFF0F3]/50 to-transparent dark:from-[#2A161E]/30 pointer-events-none" />

          {/* Central Camera Medallion */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FFF0F3] to-[#FCE6EB] dark:from-[#2A1820] dark:to-[#201217] border border-[#F5D8DF] dark:border-[#422632] flex items-center justify-center text-[#E17282] dark:text-[#F2967F] mb-2.5 shadow-xs transition-transform duration-250 ease-out group-hover:scale-108 group-active:scale-95">
            <Camera size={22} strokeWidth={2.1} />
          </div>

          <span className="font-display font-semibold text-xs text-[#343033] dark:text-white tracking-tight">
            {isPartnerUploaded ? 'Ответить своим кадром' : 'Добавить фото'}
          </span>
          <span className="text-[10px] text-[#A69FA3] dark:text-[#8A8186] mt-0.5 font-medium">
            {isPartnerUploaded ? 'Партнёр уже ждёт тебя ♡' : 'Поделись моментом'}
          </span>
        </button>

        {/* Quiet Label */}
        <div className="flex flex-col items-center mt-2 text-center max-w-full">
          <span className="font-display font-semibold text-xs sm:text-[13px] text-[#343033] dark:text-[#FAF5F7] tracking-tight truncate max-w-full">
            {title}
          </span>
          <span className="text-[10px] text-[#A69FA3] dark:text-[#8A8186] font-medium mt-0.5">
            Твой черёд
          </span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. PARTNER SLOT
  // =========================================================================
  if (photoUrl) {
    const isBlurred = !isRevealed;

    return (
      <div className={`w-full flex-1 flex flex-col items-center select-none ${className} animate-photo-enter`}>
        {/* Photo Card Container */}
        <div
          onClick={!isBlurred ? () => handleOpenViewer(photoUrl, title) : undefined}
          className={`group relative w-full aspect-[4/5] rounded-[24px] sm:rounded-[26px] overflow-hidden bg-[#FAF1F3] dark:bg-[#181215] border border-[#F0D5DC] dark:border-[#3D252E] shadow-[0_10px_28px_-6px_rgba(215,130,145,0.2),0_2px_8px_rgba(0,0,0,0.03)] dark:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.7)] select-none ${
            !isBlurred
              ? 'cursor-pointer active:scale-[0.98] transition-all duration-200 ease-out hover:shadow-[0_14px_32px_-6px_rgba(215,130,145,0.3)]'
              : 'pointer-events-none'
          }`}
          role={!isBlurred ? 'button' : undefined}
          tabIndex={!isBlurred ? 0 : -1}
          onKeyDown={(e) => {
            if (!isBlurred && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              handleOpenViewer(photoUrl, title);
            }
          }}
          aria-label={!isBlurred ? `Открыть фото ${title} на весь экран` : undefined}
        >
          {/* Top glass luster sheen */}
          <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/30 via-white/5 to-transparent dark:from-white/10 dark:to-transparent pointer-events-none z-10" />

          {/* Inner subtle frame hairline */}
          <div className="absolute inset-0 rounded-[24px] sm:rounded-[26px] border border-white/60 dark:border-white/10 pointer-events-none z-10" />

          {/* Partner Photo: Gaussian blur + gentle chromatic dispersion before MATCH */}
          <img
            src={photoUrl}
            alt={title}
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            style={{
              filter: isBlurred ? 'blur(38px) saturate(145%) brightness(0.98)' : 'none',
              transform: isBlurred ? 'scale(1.35)' : 'scale(1)',
              opacity: isBlurred ? 0.95 : 1,
              willChange: 'filter, transform, opacity',
            }}
            className={`w-full h-full object-cover transition-[filter,transform,opacity] duration-500 ease-out ${
              isBlurred ? 'select-none pointer-events-none partner-blurred-photo' : 'group-hover:scale-103'
            }`}
          />

          {/* Atmospheric Frosted Glass Veil before MATCH */}
          {isBlurred && (
            <div className="absolute inset-0 backdrop-blur-[24px] bg-gradient-to-b from-white/35 via-rose-50/20 to-white/45 dark:from-black/45 dark:via-[#1D1418]/30 dark:to-black/55 pointer-events-none" />
          )}

          {/* Dreamy Frosted Seal Medallion before MATCH */}
          {isBlurred && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center pointer-events-none z-10">
              {/* Soft breathing glow behind medallion */}
              <div className="absolute w-20 h-20 rounded-full bg-rose-300/30 dark:bg-rose-500/20 blur-xl animate-[pulse_4s_ease-in-out_infinite]" />

              {/* Medallion badge */}
              <div className="relative w-12 h-12 rounded-2xl bg-white/90 dark:bg-[#1E1C1E]/95 backdrop-blur-md border border-white/80 dark:border-white/15 shadow-[0_4px_16px_rgba(215,85,105,0.22)] flex items-center justify-center text-[#E17282] dark:text-[#F2967F] mb-2">
                <Sparkles size={20} className="animate-pulse" />
              </div>

              {/* Enigmatic text */}
              <span className="font-display font-semibold text-xs text-[#343033] dark:text-white tracking-tight">
                Кадр {title} сохранён
              </span>
              <span className="text-[10px] text-[#8A8488] dark:text-[#C5BEC2] font-medium mt-0.5">
                Откроется при MATCH ✨
              </span>
            </div>
          )}

          {/* Partner Reaction Badge after MATCH */}
          {isRevealed && reaction && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-2.5 right-2.5 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 dark:bg-[#1E1C1E]/95 backdrop-blur-md border border-[#EBE3E5] dark:border-[#2D2024] shadow-[0_4px_12px_rgba(0,0,0,0.12)] flex items-center justify-center animate-in zoom-in-75 fade-in duration-250 ease-out pointer-events-auto z-20"
            >
              <ReactionIcon reaction={reaction} size={20} />
            </div>
          )}
        </div>

        {/* Clean metadata title & status below card */}
        <div className="flex flex-col items-center mt-2 text-center max-w-full">
          <span className="font-display font-semibold text-xs sm:text-[13px] text-[#343033] dark:text-[#FAF5F7] tracking-tight truncate max-w-full">
            {title}
          </span>
          <span className="text-[10px] text-[#8A8488] dark:text-[#A8A1A4] font-medium mt-0.5 flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isRevealed ? 'bg-emerald-500' : 'bg-rose-400 animate-pulse'
              }`}
            />
            {isRevealed ? 'Момент открыт' : 'Кадр добавлен'}
          </span>
        </div>

        {/* Local fallback Fullscreen Viewer if not handled by parent (only when revealed) */}
        {!onOpenFullscreen && !isBlurred && (
          <FullscreenPhotoViewer
            isOpen={isViewerOpen}
            onClose={handleCloseViewer}
            photoUrl={viewerPhoto?.url || null}
            title={viewerPhoto?.title}
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // 3. PARTNER SLOT: WAITING FOR UPLOAD (Before partner sends photo)
  // =========================================================================
  // Notice: If the user has already uploaded their photo, this slot represents an intentional, romantic "Awaiting Your Partner" state!
  return (
    <div className={`w-full flex-1 flex flex-col items-center select-none ${className} pointer-events-none`}>
      <div
        className={`relative w-full aspect-[4/5] rounded-[24px] sm:rounded-[26px] ${
          isUserUploaded
            ? 'bg-gradient-to-b from-[#FFFDFE] via-[#FAF1F4] to-[#F6E6ED] dark:from-[#1D1418] dark:via-[#191115] dark:to-[#140D11] border border-dashed border-[#E8CCD5] dark:border-[#3D252E] shadow-[0_4px_16px_rgba(215,85,105,0.08)]'
            : 'bg-gradient-to-b from-[#FDF9FA] via-[#FAF3F5] to-[#F7EEF1] dark:from-[#171316] dark:via-[#151114] dark:to-[#120E11] border border-dashed border-[#ECD9DE] dark:border-[#35252C] shadow-[0_2px_10px_rgba(0,0,0,0.02)]'
        } flex flex-col items-center justify-center p-3 text-center select-none overflow-hidden transition-all duration-300`}
      >
        {/* Soft breathing aura when user is waiting for partner */}
        {isUserUploaded && (
          <div className="absolute inset-0 rounded-[24px] sm:rounded-[26px] bg-radial from-rose-200/30 to-transparent dark:from-rose-900/20 animate-pulse pointer-events-none" />
        )}

        {/* Soft centered icon */}
        <div
          className={`w-12 h-12 rounded-2xl ${
            isUserUploaded
              ? 'bg-white/95 dark:bg-[#28181F] border border-[#F2D6DD] dark:border-[#422530] text-[#E17282] dark:text-[#F2967F] shadow-xs'
              : 'bg-white/80 dark:bg-white/5 border border-[#F2DEE3] dark:border-[#2F1F26] text-[#C0A8AF] dark:text-[#7A6B72] shadow-xs'
          } flex items-center justify-center mb-2.5 transition-all duration-300`}
        >
          {isUserUploaded ? (
            <Heart size={20} className="animate-pulse fill-rose-100 dark:fill-rose-950/40 text-[#E17282] dark:text-[#F2967F]" />
          ) : (
            <Lock size={19} strokeWidth={2} />
          )}
        </div>

        <span className="font-display font-semibold text-xs text-[#5A5458] dark:text-[#D4CBD0] tracking-tight">
          Взгляд {title}
        </span>
        <span className="text-[10px] text-[#A89FA3] dark:text-[#7D757A] mt-0.5 font-medium">
          {isUserUploaded ? `Ждём кадр от ${title} ♡` : `Ждём ${title}`}
        </span>
      </div>

      {/* Quiet Label */}
      <div className="flex flex-col items-center mt-2 text-center max-w-full">
        <span className="font-display font-semibold text-xs sm:text-[13px] text-[#5A5458] dark:text-[#D4CBD0] tracking-tight truncate max-w-full">
          {title}
        </span>
        <span className="text-[10px] text-[#A89FA3] dark:text-[#7D757A] font-medium mt-0.5">
          {isUserUploaded ? 'Касание в пути...' : 'Ожидание'}
        </span>
      </div>
    </div>
  );
};
