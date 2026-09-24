import React from 'react';
import { Camera, Lock, CheckCircle2 } from 'lucide-react';
import { ReactionEmoji } from '../types';

interface PhotoSlotProps {
  type: 'user' | 'partner';
  title: string;
  photoUrl: string | null;
  isRevealed: boolean;
  isPartnerUploaded?: boolean;
  onAddPhoto?: () => void;
  reaction?: ReactionEmoji | null;
  className?: string;
}

export const PhotoSlot: React.FC<PhotoSlotProps> = ({
  type,
  title,
  photoUrl,
  isRevealed,
  isPartnerUploaded = false,
  onAddPhoto,
  reaction,
  className = '',
}) => {
  // If revealed, show the actual photo
  if (isRevealed && photoUrl) {
    return (
      <div className={`flex-1 flex flex-col items-center ${className}`}>
        <div className="relative w-full aspect-square rounded-[22px] overflow-hidden bg-[#FAF1F3] border border-[#EBE3E5] soft-card-shadow group">
          <img
            src={photoUrl}
            alt={title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-102"
          />
          {/* Reaction badge if reacted */}
          {reaction && (
            <div className="absolute bottom-2.5 right-2.5 w-9 h-9 rounded-full bg-white/95 border border-[#EBE3E5] shadow-xs flex items-center justify-center text-lg animate-in zoom-in-75 duration-150">
              {reaction}
            </div>
          )}
        </div>
        <span className="text-xs font-semibold text-[#343033] mt-2 tracking-tight">
          {title}
        </span>
      </div>
    );
  }

  // User uploaded, waiting or ready
  if (type === 'user' && photoUrl) {
    return (
      <div className={`flex-1 flex flex-col items-center ${className}`}>
        <div className="relative w-full aspect-square rounded-[22px] overflow-hidden bg-[#FAF1F3] border border-[#E9C3CB] soft-card-shadow">
          <img
            src={photoUrl}
            alt="Твоё фото"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2.5 right-2.5 bg-white/95 rounded-full p-1 border border-[#EBE3E5] text-[#E98787] shadow-xs">
            <CheckCircle2 size={17} />
          </div>
          {onAddPhoto && (
            <button
              type="button"
              onClick={onAddPhoto}
              className="absolute inset-x-3 bottom-2.5 bg-white/95 border border-[#EBE3E5] shadow-xs py-1.5 rounded-xl text-[11px] font-semibold text-[#343033] text-center transition-all hover:bg-white active:scale-97 cursor-pointer"
            >
              Заменить
            </button>
          )}
        </div>
        <span className="text-xs font-semibold text-[#343033] mt-2 tracking-tight">
          {title} · Готово
        </span>
      </div>
    );
  }

  // User not yet uploaded
  if (type === 'user' && !photoUrl) {
    return (
      <div className={`flex-1 flex flex-col items-center ${className}`}>
        <button
          type="button"
          onClick={onAddPhoto}
          className="w-full aspect-square rounded-[22px] bg-white border-2 border-dashed border-[#E5D7DA] hover:border-[#E98787] flex flex-col items-center justify-center p-3 text-center transition-all duration-150 active:scale-98 cursor-pointer group shadow-2xs"
        >
          <div className="w-11 h-11 rounded-2xl bg-[#FBF0F2] group-hover:bg-[#F6DCE1] flex items-center justify-center text-[#E98787] mb-2 transition-colors">
            <Camera size={20} />
          </div>
          <span className="text-xs font-semibold text-[#343033]">
            Добавить фото
          </span>
          <span className="text-[10px] text-[#777277] mt-0.5">
            Только ты
          </span>
        </button>
        <span className="text-xs font-medium text-[#777277] mt-2 tracking-tight">
          {title}
        </span>
      </div>
    );
  }

  // Partner slot before MATCH reveal
  return (
    <div className={`flex-1 flex flex-col items-center ${className}`}>
      {isPartnerUploaded ? (
        <div className="w-full aspect-square rounded-[22px] bg-white border border-[#EBE3E5] flex flex-col items-center justify-center p-3 text-center select-none shadow-2xs relative overflow-hidden">
          <div className="w-11 h-11 rounded-2xl bg-[#FBF0F2] flex items-center justify-center text-[#E98787] mb-2">
            <CheckCircle2 size={20} />
          </div>
          <span className="text-xs font-semibold text-[#343033]">
            Взгляд добавлен
          </span>
          <span className="text-[10px] text-[#777277] mt-0.5">
            Скрыто до MATCH
          </span>
          <div className="absolute top-2.5 right-2.5 text-[#8A8488]">
            <Lock size={14} />
          </div>
        </div>
      ) : onAddPhoto ? (
        <button
          type="button"
          onClick={onAddPhoto}
          className="w-full aspect-square rounded-[22px] bg-white border-2 border-dashed border-[#E5D7DA] hover:border-[#E98787] flex flex-col items-center justify-center p-3 text-center transition-all duration-150 active:scale-98 cursor-pointer group shadow-2xs"
        >
          <div className="w-11 h-11 rounded-2xl bg-[#FBF0F2] group-hover:bg-[#F6DCE1] flex items-center justify-center text-[#E98787] mb-2 transition-colors">
            <Camera size={20} />
          </div>
          <span className="text-xs font-semibold text-[#343033]">
            Добавь свой взгляд
          </span>
          <span className="text-[10px] text-[#777277] mt-0.5">
            {title}
          </span>
        </button>
      ) : (
        <div className="w-full aspect-square rounded-[22px] bg-white/70 border border-[#EBE3E5] flex flex-col items-center justify-center p-3 text-center select-none shadow-2xs relative overflow-hidden">
          <div className="w-11 h-11 rounded-2xl bg-[#FAF1F3] flex items-center justify-center text-[#8A8488] mb-2">
            <Lock size={18} />
          </div>
          <span className="text-xs font-medium text-[#777277]">
            Добавь свой взгляд
          </span>
          <span className="text-[10px] text-[#A69FA3] mt-0.5">
            Ждём {title}
          </span>
        </div>
      )}
      <span className="text-xs font-medium text-[#777277] mt-2 tracking-tight">
        {title}
      </span>
    </div>
  );

};
