import React, { useRef, useState } from 'react';
import { Camera, RefreshCw, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { OurDayPhoto, CoupleState } from '../types';
import { optimizePhotoForUpload } from '../services/storage/imageOptimizer';
import { FullscreenPhotoViewer } from '../components/FullscreenPhotoViewer';
import { AtmosphericGlow } from '../components/AtmosphericGlow';
import { triggerHaptic, playSoftChime } from '../services/feedback';
import { getLocalDateKey } from '../services/moments/momentTiming';

import { apiClient } from '../services/api/apiClient';

interface OurDayScreenProps {
  photos: OurDayPhoto[];
  couple: CoupleState;
  onAddPhotos: (imageUrls: string[]) => Promise<void>;
  onDeletePhoto?: (photoId: string) => Promise<void>;
  onClearAllPhotos?: () => Promise<void> | void;
  soundEnabled?: boolean;
  hapticEnabled?: boolean;
  isEmbedded?: boolean;
}

const isValidUuid = (id: any): boolean =>
  typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id.trim());

function getPhotoDateKey(photo: OurDayPhoto): string {
  if (!photo) return '';
  if (photo.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(photo.dateKey.trim())) {
    return photo.dateKey.trim();
  }
  if (photo.createdAt) {
    try {
      const d = new Date(photo.createdAt);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    } catch {
      // fallback
    }
    const sub = photo.createdAt.substring(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(sub)) return sub;
  }
  return getLocalDateKey();
}

function isCurrentUserOurDayPhoto(photo: OurDayPhoto, couple: CoupleState): boolean {
  const currentUserId = (couple.user?.id || apiClient.getCurrentUserId() || '').trim();
  const partnerUserId = (couple.partner?.id || '').trim();
  const photoAuthorId = (photo.authorId || '').trim();

  // 1. Authoritative check: if photo author matches partner ID, it is definitely partner's photo
  if (partnerUserId && photoAuthorId && photoAuthorId === partnerUserId) {
    return false;
  }

  // 2. Authoritative check: if photo author matches current user ID, it is definitely user's photo
  if (currentUserId && photoAuthorId && photoAuthorId === currentUserId) {
    return true;
  }

  // 3. Fallback for legacy local/anonymous IDs
  if (photoAuthorId === 'user_1' || photoAuthorId === 'local_user') {
    return true;
  }

  // 4. If authorId is a valid UUID that did not match currentUserId, it belongs to the other partner
  if (isValidUuid(photoAuthorId)) {
    if (currentUserId && isValidUuid(currentUserId) && photoAuthorId !== currentUserId) {
      return false;
    }
  }

  // 5. Fallback by name only if authorId is not a UUID
  const currentUserName = (couple.user?.name || '').trim().toLowerCase();
  const partnerName = (couple.partner?.name || '').trim().toLowerCase();
  const photoAuthorName = (photo.authorName || '').trim().toLowerCase();

  if (photoAuthorName && partnerName && photoAuthorName === partnerName) {
    return false;
  }
  if (photoAuthorName && currentUserName && photoAuthorName === currentUserName) {
    return true;
  }

  return false;
}

export const OurDayScreen: React.FC<OurDayScreenProps> = ({
  photos = [],
  couple,
  onAddPhotos,
  soundEnabled = true,
  hapticEnabled = true,
  isEmbedded = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<{ url: string; title: string } | null>(null);

  const todayKey = getLocalDateKey();

  // Filter photos for today only
  const todayPhotos = photos.filter((p) => {
    if (!p || !p.imageUrl || p.imageUrl.startsWith('blob:')) return false;
    return getPhotoDateKey(p) === todayKey;
  });

  let userPhotoToday: OurDayPhoto | undefined;
  let partnerPhotoToday: OurDayPhoto | undefined;

  if (todayPhotos.length === 1) {
    const single = todayPhotos[0];
    if (isCurrentUserOurDayPhoto(single, couple)) {
      userPhotoToday = single;
    } else {
      partnerPhotoToday = single;
    }
  } else if (todayPhotos.length >= 2) {
    const primaryUser = todayPhotos.find((p) => isCurrentUserOurDayPhoto(p, couple));
    const primaryPartner = todayPhotos.find((p) => !isCurrentUserOurDayPhoto(p, couple));

    if (primaryUser && primaryPartner && primaryUser.id !== primaryPartner.id) {
      userPhotoToday = primaryUser;
      partnerPhotoToday = primaryPartner;
    } else {
      // Classification collision safeguard: guarantees BOTH photos are displayed and neither is dropped
      const currentUid = (couple.user?.id || apiClient.getCurrentUserId() || '').trim();
      const partnerUid = (couple.partner?.id || '').trim();

      if (currentUid && todayPhotos[0].authorId === currentUid) {
        userPhotoToday = todayPhotos[0];
        partnerPhotoToday = todayPhotos[1];
      } else if (partnerUid && todayPhotos[0].authorId === partnerUid) {
        partnerPhotoToday = todayPhotos[0];
        userPhotoToday = todayPhotos[1];
      } else if (primaryUser) {
        userPhotoToday = primaryUser;
        partnerPhotoToday = todayPhotos.find((p) => p.id !== primaryUser.id) || todayPhotos[1];
      } else {
        userPhotoToday = todayPhotos[0];
        partnerPhotoToday = todayPhotos[1];
      }
    }
  }

  const hasUserPhoto = Boolean(userPhotoToday);
  const hasPartnerPhoto = Boolean(partnerPhotoToday);
  const activeTodayPhotos = [userPhotoToday, partnerPhotoToday].filter(
    (p): p is OurDayPhoto => Boolean(p)
  );
  const totalTodayCount = activeTodayPhotos.length;

  const handleOpenPhoto = (url: string, title: string) => {
    triggerHaptic(hapticEnabled);
    playSoftChime('tap', soundEnabled);
    setFullscreenPhoto({ url, title });
  };

  const handleSelectFilesClick = () => {
    triggerHaptic(hapticEnabled);
    playSoftChime('tap', soundEnabled);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';

    setIsUploading(true);
    setErrorMessage(null);
    setUploadProgress('Обработка кадра...');

    let uploadTimer: any = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      uploadTimer = setTimeout(() => {
        reject(new Error('Время ожидания загрузки истекло. Пожалуйста, попробуйте снова.'));
      }, 25000);
    });

    try {
      const file = files[0];
      let dataUrl = '';
      try {
        const optimized = await optimizePhotoForUpload(file);
        if (optimized && !optimized.startsWith('blob:')) {
          dataUrl = optimized;
        } else {
          const reader = new FileReader();
          dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Reading failed'));
            reader.readAsDataURL(file);
          });
        }
      } catch {
        const reader = new FileReader();
        dataUrl = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }

      if (dataUrl) {
        setUploadProgress('Сохранение кадра...');
        await Promise.race([onAddPhotos([dataUrl]), timeoutPromise]);
        triggerHaptic(hapticEnabled);
        playSoftChime('match', soundEnabled);
      }
    } catch (err: any) {
      console.error('[OurDayScreen] Upload error:', err);
      setErrorMessage(err?.message || 'Не удалось сохранить новое фото. Ваше прежнее фото сохранено.');
    } finally {
      if (uploadTimer) {
        clearTimeout(uploadTimer);
      }
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  return (
    <div
      className={
        isEmbedded
          ? 'w-full flex flex-col space-y-1.5'
          : 'flex-1 h-full w-full flex flex-col space-y-2 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] overflow-y-auto overscroll-y-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-1'
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/jpg"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Screen / Section Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="font-display text-base sm:text-lg font-bold text-[#343033] dark:text-white">
            Наш день
          </h2>
        </div>
      </div>

      {/* Uploading Status Banner */}
      {isUploading && uploadProgress && (
        <div className="rounded-[18px] bg-white/90 dark:bg-[#1A1518]/90 border border-[#F0D5DC] dark:border-[#382329] p-2 text-center space-y-0.5 shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#E98787] dark:text-[#F0B9C6]">
            <Loader2 size={14} className="animate-spin" />
            <span>{uploadProgress}</span>
          </div>
        </div>
      )}

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="rounded-[18px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 p-2 flex items-center justify-between gap-2 shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5 text-xs font-medium text-rose-700 dark:text-rose-300">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={handleSelectFilesClick}
            className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-semibold shrink-0 cursor-pointer"
          >
            Повторить
          </button>
        </div>
      )}

      {/* Main Frosted Matte Card - Fixed Independent Geometry Container with Atmospheric Backlight Glow */}
      <div className="relative overflow-visible w-full max-w-md mx-auto my-0.5">
        <AtmosphericGlow variant="card" insetClassName="-inset-3 sm:-inset-4" roundedClassName="rounded-[28px]" />
        <div className="relative w-full overflow-hidden rounded-[22px] sm:rounded-[26px] bg-white/80 dark:bg-[#121013]/80 backdrop-blur-md border border-[#EBE3E5] dark:border-[#242024] p-2 sm:p-2.5 shadow-xs transition-all duration-300 flex flex-col space-y-1.5">
        
        {/* Fixed Aspect Canvas Area Controlling Image Display */}
        <div className="relative w-full aspect-[16/10] min-h-[150px] xs:min-h-[170px] sm:min-h-[190px] rounded-[18px] sm:rounded-[20px] overflow-hidden bg-[#FAF1F3]/80 dark:bg-[#181215]/80 border border-[#F0D5DC] dark:border-[#3D252E] shadow-2xs shrink-0">
          
          {/* CASE 0: No photos uploaded for today */}
          {totalTodayCount === 0 && !isUploading && (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-2 space-y-1 select-none">
              <div className="w-8 h-8 rounded-xl bg-[#FAF0F2] dark:bg-[#201518] text-[#E98787] dark:text-[#F0B9C6] flex items-center justify-center border border-[#EED7DC] dark:border-[#382329] shadow-2xs">
                <ImageIcon size={16} strokeWidth={1.8} />
              </div>
              <h2 className="font-display text-xs sm:text-sm font-bold text-[#343033] dark:text-white">
                Кадр сегодняшнего дня
              </h2>
              <button
                type="button"
                onClick={handleSelectFilesClick}
                disabled={isUploading}
                className="inline-flex items-center gap-1.5 h-6.5 px-3.5 rounded-full bg-gradient-to-r from-[#E98787] to-[#F0B9C6] dark:from-[#382329] dark:to-[#2A1B22] border border-[#F0D5DC] dark:border-[#422632] text-white dark:text-[#F0B9C6] font-display font-semibold text-[11px] tracking-wide shadow-xs active:scale-[0.97] transition-all cursor-pointer"
              >
                <Camera size={12} />
                <span>Загрузить фото</span>
              </button>
            </div>
          )}

          {/* CASE 1: Exactly 1 photo uploaded today */}
          {totalTodayCount === 1 && activeTodayPhotos[0] && (
            <div
              onClick={() =>
                handleOpenPhoto(
                  activeTodayPhotos[0].imageUrl,
                  `Фото от ${hasUserPhoto ? 'тебя' : couple.partner.name || 'Партнёра'}`
                )
              }
              className="relative w-full h-full overflow-hidden cursor-pointer group select-none"
              role="button"
              tabIndex={0}
            >
              <img
                src={activeTodayPhotos[0].imageUrl}
                alt="Фото сегодняшнего дня"
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
              />

              {/* Author badge */}
              <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-xs font-medium text-white flex items-center gap-1.5 z-10 pointer-events-none">
                <span>{hasUserPhoto ? 'Ты' : couple.partner.name || 'Партнёр'}</span>
              </div>

              {/* Replace overlay button ONLY for user's own photo */}
              {hasUserPhoto && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectFilesClick();
                  }}
                  disabled={isUploading}
                  className="absolute bottom-2.5 right-2.5 h-8 px-3 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-xs font-medium text-white flex items-center gap-1.5 z-10 cursor-pointer active:scale-95 transition-transform"
                  title="Заменить своё фото"
                >
                  <RefreshCw size={12} className={isUploading ? 'animate-spin' : ''} />
                  <span>Заменить</span>
                </button>
              )}
            </div>
          )}

          {/* CASE 2: Both partners uploaded photos today */}
          {totalTodayCount >= 2 && (
            <div className="flex flex-row items-center justify-between w-full h-full gap-2 p-1.5 select-none">
              {/* User photo */}
              {userPhotoToday && (
                <div
                  onClick={() => handleOpenPhoto(userPhotoToday.imageUrl, 'Твоё фото')}
                  className="relative flex-1 h-full min-w-0 min-h-0 rounded-[18px] overflow-hidden bg-[#FAF1F3] dark:bg-[#181215] cursor-pointer group"
                  role="button"
                  tabIndex={0}
                >
                  <img
                    src={userPhotoToday.imageUrl}
                    alt="Твоё фото"
                    loading="eager"
                    decoding="async"
                    className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[11px] font-medium text-white z-10 pointer-events-none">
                    Ты
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectFilesClick();
                    }}
                    disabled={isUploading}
                    className="absolute bottom-2 right-2 h-7 px-2.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-[11px] font-medium text-white flex items-center gap-1 z-10 cursor-pointer active:scale-95 transition-transform"
                    title="Заменить своё фото"
                  >
                    <RefreshCw size={11} className={isUploading ? 'animate-spin' : ''} />
                    <span>Заменить</span>
                  </button>
                </div>
              )}

              {/* Partner photo */}
              {partnerPhotoToday && (
                <div
                  onClick={() =>
                    handleOpenPhoto(
                      partnerPhotoToday.imageUrl,
                      `Фото от ${couple.partner.name || 'Партнёра'}`
                    )
                  }
                  className="relative flex-1 h-full min-w-0 min-h-0 rounded-[18px] overflow-hidden bg-[#FAF1F3] dark:bg-[#181215] cursor-pointer group"
                  role="button"
                  tabIndex={0}
                >
                  <img
                    src={partnerPhotoToday.imageUrl}
                    alt={`Фото от ${couple.partner.name || 'Партнёра'}`}
                    loading="eager"
                    decoding="async"
                    className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                  <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[11px] font-medium text-white z-10 pointer-events-none">
                    {couple.partner.name || 'Партнёр'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stable Action Bar Below Photo Canvas Area (Only shown when user hasn't added photo yet) */}
        {!hasUserPhoto && totalTodayCount > 0 && (
          <div className="pt-0.5 flex items-center justify-center shrink-0">
            <button
              type="button"
              onClick={handleSelectFilesClick}
              disabled={isUploading}
              className="inline-flex items-center gap-1.5 h-7 px-4 rounded-full bg-gradient-to-r from-[#E98787] to-[#F0B9C6] dark:from-[#382329] dark:to-[#2A1B22] border border-[#F0D5DC] dark:border-[#422632] text-white dark:text-[#F0B9C6] text-[11px] font-semibold tracking-wide shadow-xs active:scale-[0.97] transition-all cursor-pointer"
            >
              <Camera size={13} />
              <span>{isUploading ? 'Загрузка...' : 'Добавить своё фото'}</span>
            </button>
          </div>
        )}
      </div>
    </div>

      {/* Fullscreen Photo Viewer Modal */}
      <FullscreenPhotoViewer
        isOpen={Boolean(fullscreenPhoto)}
        onClose={() => setFullscreenPhoto(null)}
        photoUrl={fullscreenPhoto?.url || null}
        title={fullscreenPhoto?.title}
      />
    </div>
  );
};
