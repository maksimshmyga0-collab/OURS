import React, { useRef } from 'react';
import { Camera, Lock, CheckCircle2 } from 'lucide-react';
import { ReactionEmoji } from '../types';
import { ReactionIcon } from './ReactionIcon';
import { optimizePhotoForUpload } from '../services/storage/imageOptimizer';

interface PhotoSlotProps {
  type: 'user' | 'partner';
  title: string;
  photoUrl: string | null;
  isRevealed: boolean;
  isPartnerUploaded?: boolean;
  onAddPhoto?: () => void;
  onPhotoSelected?: (photoDataUrl: string) => void;
  reaction?: ReactionEmoji | null;
  className?: string;
}

export const PhotoSlot: React.FC<PhotoSlotProps> = ({
  type,
  title,
  photoUrl,
  isRevealed,
  isPartnerUploaded: _isPartnerUploaded = false,
  onAddPhoto,
  onPhotoSelected,
  reaction,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSlotClick = () => {
    if (type !== 'user') return;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else if (onAddPhoto) {
      onAddPhoto();
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

  // 1. USER SLOT
  if (type === 'user') {
    if (photoUrl) {
      return (
        <div className={`w-full flex-1 flex flex-col items-center ${className} animate-in fade-in duration-250 ease-out`}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="relative w-full aspect-square rounded-[22px] overflow-hidden bg-[#FAF1F3] dark:bg-[#181215] border border-[#E9C3CB] dark:border-[#42262E] soft-card-shadow group">
            <img
              src={photoUrl}
              alt="Твоё фото"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-102"
            />
            {isRevealed ? (
              reaction && (
                <div className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-white/95 dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#242024] shadow-xs flex items-center justify-center animate-in zoom-in-75 fade-in duration-200 ease-out">
                  <ReactionIcon reaction={reaction} size={18} />
                </div>
              )
            ) : (
              <>
                <div className="absolute top-2.5 right-2.5 bg-white/95 dark:bg-[#1E1C1E] rounded-full p-1 border border-[#EBE3E5] dark:border-[#352F35] text-[#E98787] shadow-xs animate-in zoom-in-75 duration-200 ease-out">
                  <CheckCircle2 size={17} />
                </div>
                <button
                  type="button"
                  onClick={handleSlotClick}
                  className="absolute inset-x-3 bottom-2.5 bg-white/95 dark:bg-[#1C1A1C] border border-[#EBE3E5] dark:border-[#352F35] shadow-xs py-1.5 rounded-xl text-[11px] font-semibold text-[#343033] dark:text-white text-center transition-all duration-200 ease-out hover:bg-white dark:hover:bg-[#252225] active:scale-97 cursor-pointer"
                >
                  Заменить
                </button>
              </>
            )}
          </div>
          <span className="text-xs font-semibold text-[#343033] dark:text-white mt-2 tracking-tight truncate max-w-full text-center transition-colors duration-200">
            {title}{isRevealed ? '' : ' · Фото отправлено'}
          </span>
        </div>
      );
    }

    return (
      <div className={`w-full flex-1 flex flex-col items-center ${className}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={handleSlotClick}
          className="w-full aspect-square rounded-[22px] bg-white dark:bg-[#141214] border-2 border-dashed border-[#E5D7DA] dark:border-[#35252A] hover:border-[#E98787] dark:hover:border-[#E98787] flex flex-col items-center justify-center p-3 text-center transition-all duration-200 ease-out active:scale-98 cursor-pointer group shadow-2xs"
        >
          <div className="w-11 h-11 rounded-2xl bg-[#FBF0F2] dark:bg-[#25161A] group-hover:bg-[#F6DCE1] dark:group-hover:bg-[#341B22] flex items-center justify-center text-[#E98787] mb-2 transition-colors duration-200 ease-out">
            <Camera size={20} />
          </div>
          <span className="text-xs font-semibold text-[#343033] dark:text-white">
            Добавить фото
          </span>
          <span className="text-[10px] text-[#777277] dark:text-[#B8B2B5] mt-0.5">
            Только ты
          </span>
        </button>
        <span className="text-xs font-medium text-[#777277] dark:text-[#B8B2B5] mt-2 tracking-tight truncate max-w-full text-center">
          {title}
        </span>
      </div>
    );
  }

  // 2. PARTNER SLOT
  // If photo is uploaded by partner
  if (photoUrl) {
    const isBlurred = !isRevealed;

    return (
      <div className={`w-full flex-1 flex flex-col items-center select-none ${className} animate-in fade-in duration-250 ease-out pointer-events-none`}>
        <div
          className="relative w-full aspect-square rounded-[22px] overflow-hidden bg-[#FAF1F3] dark:bg-[#181215] border border-[#E9C3CB]/70 dark:border-[#42262E]/80 soft-card-shadow group"
          style={{
            isolation: 'isolate',
            transform: 'translateZ(0)',
            WebkitMaskImage: '-webkit-radial-gradient(white, black)',
          }}
        >
          {/* Partner Photo: deep abstract blur(64px) until MATCH is completed */}
          <img
            src={photoUrl}
            alt={title}
            referrerPolicy="no-referrer"
            style={{
              filter: isBlurred ? 'blur(64px)' : 'none',
              transform: isBlurred ? 'scale(1.28)' : 'scale(1)',
              willChange: 'filter, transform',
            }}
            className={`w-full h-full object-cover transition-[filter,transform] duration-500 ease-out ${
              isBlurred
                ? 'select-none pointer-events-none'
                : 'group-hover:scale-102'
            }`}
          />

          {/* Calm overlay before MATCH */}
          {isBlurred && (
            <>
              <div className="absolute inset-0 bg-white/20 dark:bg-black/25 flex flex-col items-center justify-center p-3 text-center pointer-events-none transition-opacity duration-300">
                <div className="w-10 h-10 rounded-2xl bg-white/85 dark:bg-[#1E1C1E]/90 backdrop-blur-md flex items-center justify-center text-[#E98787] shadow-xs mb-1.5 border border-white/60 dark:border-white/10">
                  <CheckCircle2 size={18} />
                </div>
                <span className="text-[11px] font-semibold text-[#343033] dark:text-white px-2 py-0.5 rounded-full bg-white/70 dark:bg-black/40 backdrop-blur-xs">
                  Взгляд добавлен
                </span>
                <span className="text-[9px] text-[#777277] dark:text-[#B8B2B5] mt-0.5">
                  Скрыто до MATCH
                </span>
              </div>

              <div className="absolute top-2.5 right-2.5 text-[#8A8488] dark:text-[#B8B2B5] pointer-events-none">
                <Lock size={14} />
              </div>
            </>
          )}

          {/* Reaction badge after MATCH */}
          {isRevealed && reaction && (
            <div className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-white/95 dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#242024] shadow-xs flex items-center justify-center animate-in zoom-in-75 fade-in duration-200 ease-out pointer-events-auto">
              <ReactionIcon reaction={reaction} size={18} />
            </div>
          )}
        </div>
        <span className="text-xs font-semibold text-[#343033] dark:text-white mt-2 tracking-tight truncate max-w-full text-center transition-colors duration-200">
          {title}{isRevealed ? '' : ' · Готово'}
        </span>
      </div>
    );
  }

  // Partner slot before upload -> clean, calm waiting state
  return (
    <div className={`w-full flex-1 flex flex-col items-center select-none ${className} pointer-events-none`}>
      <div className="w-full aspect-square rounded-[22px] bg-white/70 dark:bg-[#141214]/80 border border-[#EBE3E5] dark:border-[#242024] flex flex-col items-center justify-center p-3 text-center select-none shadow-2xs relative overflow-hidden pointer-events-none">
        <div className="w-11 h-11 rounded-2xl bg-[#FAF1F3] dark:bg-[#20181B] flex items-center justify-center text-[#8A8488] dark:text-[#B8B2B5] mb-2">
          <Lock size={18} />
        </div>
        <span className="text-xs font-medium text-[#777277] dark:text-[#B8B2B5]">
          Взгляд {title}
        </span>
        <span className="text-[10px] text-[#A69FA3] dark:text-[#807B7E] mt-0.5">
          Ждём {title}
        </span>
      </div>
      <span className="text-xs font-medium text-[#777277] dark:text-[#B8B2B5] mt-2 tracking-tight truncate max-w-full text-center">
        {title}
      </span>
    </div>
  );
};
