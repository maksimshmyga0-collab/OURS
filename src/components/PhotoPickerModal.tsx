import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera as CameraIcon,
  Image as ImageIcon,
  X,
  RefreshCw,
  Check,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNativeApp } from '../services/device/platform';
import { optimizePhotoForUpload } from '../services/storage/imageOptimizer';
import { triggerHaptic, playSoftChime } from '../services/feedback';

interface PhotoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPhoto: (photoUrl: string) => void;
  title?: string;
  subtitle?: string;
}

export const PhotoPickerModal: React.FC<PhotoPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectPhoto,
  title = 'Добавить фото',
  subtitle = 'Снимок для вашего общего момента',
}) => {
  const systemCameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'menu' | 'preview'>('menu');
  const [sourceType, setSourceType] = useState<'camera' | 'gallery'>('camera');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Keep track of any temporary object URLs created to revoke on cleanup
  const activeObjectUrlRef = useRef<string | null>(null);

  const cleanupObjectUrl = useCallback(() => {
    if (activeObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(activeObjectUrlRef.current);
      } catch {
        // ignore
      }
      activeObjectUrlRef.current = null;
    }
  }, []);

  // Reset modal state
  const handleReset = useCallback(() => {
    cleanupObjectUrl();
    setMode('menu');
    setSourceType('camera');
    setCapturedDataUrl(null);
    setCapturedFile(null);
    setErrorMessage(null);
    setIsLoading(false);
  }, [cleanupObjectUrl]);

  // Clean close
  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  // Reset on open/close
  useEffect(() => {
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen, handleReset]);

  // Escape key support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Helper to determine if we are running in Capacitor native runtime
  const isCapacitorNative = useCallback(() => {
    try {
      if (typeof window === 'undefined') return false;
      const win = window as any;
      if (!win.Capacitor) return false;
      if (typeof isNativeApp === 'function' && isNativeApp()) return true;
      if (typeof win.Capacitor.isNativePlatform === 'function') {
        return win.Capacitor.isNativePlatform();
      }
      const platform = win.Capacitor.getPlatform?.();
      return platform === 'android' || platform === 'ios';
    } catch {
      return false;
    }
  }, []);

  // Update preview image state with cleanup of previous object URL
  const updatePreviewImage = useCallback(
    (url: string, file: File | null = null, source: 'camera' | 'gallery' = 'camera') => {
      cleanupObjectUrl();
      if (url.startsWith('blob:')) {
        activeObjectUrlRef.current = url;
      }
      setCapturedDataUrl(url);
      setCapturedFile(file);
      setSourceType(source);
      setMode('preview');
      setErrorMessage(null);
      setIsLoading(false);
    },
    [cleanupObjectUrl]
  );

  // =========================================================================
  // CAMERA CAPTURE (SYSTEM CAMERA)
  // =========================================================================
  const handleTakePhoto = async () => {
    triggerHaptic(true);
    playSoftChime('tap', true);
    setErrorMessage(null);

    // 1. Android APK / iOS Native App via Capacitor Camera plugin
    if (isCapacitorNative()) {
      try {
        setIsLoading(true);
        const photo = await Camera.getPhoto({
          quality: 92,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
        });

        if (photo?.dataUrl) {
          updatePreviewImage(photo.dataUrl, null, 'camera');
        } else if (photo?.webPath) {
          try {
            const res = await fetch(photo.webPath);
            const blob = await res.blob();
            const file = new File([blob], 'system-camera.jpg', { type: 'image/jpeg' });
            const previewUrl = URL.createObjectURL(blob);
            updatePreviewImage(previewUrl, file, 'camera');
          } catch {
            if (photo.webPath) {
              updatePreviewImage(photo.webPath, null, 'camera');
            }
          }
        }
      } catch (err: any) {
        setIsLoading(false);
        const message = String(err?.message || err || '');
        // User cancelled in system camera (e.g. back button) - do not show error
        if (
          message.includes('User cancelled') ||
          message.includes('cancelled') ||
          message.includes('Canceled') ||
          message.includes('canceled')
        ) {
          return;
        }

        // Permission denied
        if (
          message.includes('denied') ||
          message.includes('permission') ||
          message.includes('Permission')
        ) {
          setErrorMessage(
            'Доступ к камере запрещён. Разрешите использование камеры в настройках устройства.'
          );
        } else {
          // Fallback to HTML capture input if native plugin threw unexpected error
          console.warn('[PhotoPickerModal] Capacitor Camera fallback to input:', err);
          if (systemCameraInputRef.current) {
            systemCameraInputRef.current.value = '';
            systemCameraInputRef.current.click();
          }
        }
      }
      return;
    }

    // 2. Web / PWA / Telegram Mini App (TMA):
    // Standard HTML5 capture="environment" invokes the system's native stock camera app
    if (systemCameraInputRef.current) {
      systemCameraInputRef.current.value = '';
      systemCameraInputRef.current.click();
    }
  };

  // Handle file from system camera input
  const handleCameraInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      // User dismissed or canceled system camera prompt
      return;
    }
    e.target.value = '';

    try {
      const previewUrl = URL.createObjectURL(file);
      updatePreviewImage(previewUrl, file, 'camera');
    } catch (err) {
      console.warn('[PhotoPickerModal] Failed to read camera file:', err);
      setErrorMessage('Не удалось загрузить снимок. Попробуйте ещё раз.');
    }
  };

  // =========================================================================
  // GALLERY SELECTION (SYSTEM PHOTOS / PICKER)
  // =========================================================================
  const handleOpenGallery = () => {
    triggerHaptic(true);
    playSoftChime('tap', true);
    setErrorMessage(null);

    // 1. Android APK / iOS Native App via Capacitor Camera Photos source
    if (isCapacitorNative()) {
      setIsLoading(true);
      Camera.getPhoto({
        quality: 92,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      })
        .then((photo) => {
          if (photo?.dataUrl) {
            updatePreviewImage(photo.dataUrl, null, 'gallery');
          } else if (photo?.webPath) {
            fetch(photo.webPath)
              .then((res) => res.blob())
              .then((blob) => {
                const file = new File([blob], 'gallery-photo.jpg', { type: 'image/jpeg' });
                const previewUrl = URL.createObjectURL(blob);
                updatePreviewImage(previewUrl, file, 'gallery');
              })
              .catch(() => {
                if (photo.webPath) updatePreviewImage(photo.webPath, null, 'gallery');
              });
          }
        })
        .catch((err: any) => {
          setIsLoading(false);
          const msg = String(err?.message || err || '');
          if (!msg.includes('cancelled') && !msg.includes('User cancelled')) {
            if (galleryInputRef.current) {
              galleryInputRef.current.value = '';
              galleryInputRef.current.click();
            }
          }
        });
      return;
    }

    // 2. Modern Chromium File System Access API (direct image picker bypasses multi-source chooser)
    if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
      (window as any)
        .showOpenFilePicker({
          types: [
            {
              description: 'Фотографии и изображения',
              accept: {
                'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.heic', '.heif'],
              },
            },
          ],
          multiple: false,
        })
        .then(async ([handle]: any[]) => {
          if (handle) {
            const file = await handle.getFile();
            if (file) {
              const previewUrl = URL.createObjectURL(file);
              updatePreviewImage(previewUrl, file, 'gallery');
            }
          }
        })
        .catch((err: any) => {
          if (err?.name !== 'AbortError' && galleryInputRef.current) {
            galleryInputRef.current.value = '';
            galleryInputRef.current.click();
          }
        });
      return;
    }

    // 3. Clean direct file input for standard mobile Web/PWA/TMA
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
      galleryInputRef.current.click();
    }
  };

  // Handle file from gallery input
  const handleGalleryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    try {
      const previewUrl = URL.createObjectURL(file);
      updatePreviewImage(previewUrl, file, 'gallery');
    } catch (err) {
      console.warn('[PhotoPickerModal] Failed to read gallery file:', err);
      setErrorMessage('Не удалось загрузить выбранное фото. Попробуйте ещё раз.');
    }
  };

  // =========================================================================
  // CONFIRM PHOTO FOR UPLOAD PIPELINE
  // =========================================================================
  const handleConfirmPhoto = async (photoUrl: string, file: File | null = capturedFile) => {
    triggerHaptic(true);
    playSoftChime('success', true);
    handleClose();

    // 1. Instant fast preview in the parent screen
    onSelectPhoto(photoUrl);

    // 2. Client-side optimization (scale down, crisp JPEG, orientation preserve)
    try {
      let sourceToOptimize: File | Blob | string = file || photoUrl;
      if (!file && photoUrl.startsWith('blob:')) {
        const res = await fetch(photoUrl);
        sourceToOptimize = await res.blob();
      }

      const optimized = await optimizePhotoForUpload(sourceToOptimize);
      if (optimized && optimized !== photoUrl) {
        onSelectPhoto(optimized);
      }
    } catch (err) {
      console.warn('[PhotoPickerModal] Optimization error:', err);
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#000000]/70 backdrop-blur-[6px] animate-sheet-backdrop"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#111111] border border-[#EBE3E5] dark:border-[#242024] rounded-t-[32px] sm:rounded-[28px] p-6 pb-8 shadow-[0_-4px_32px_rgba(0,0,0,0.25)] max-h-[90vh] overflow-y-auto no-scrollbar animate-sheet-enter transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden System Camera & Gallery Inputs */}
        <input
          ref={systemCameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/jpg"
          capture="environment"
          onChange={handleCameraInputChange}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          onChange={handleGalleryInputChange}
          className="hidden"
        />

        {/* =========================================================================
            VIEW 1: MENU (CAMERA OR GALLERY SELECTION)
            ========================================================================= */}
        {mode === 'menu' && (
          <div>
            {/* Header with dismiss */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-[#343033] dark:text-white">
                  {title}
                </h3>
                <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-0.5">
                  {subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-[#F5EFF1] dark:bg-[#1E1C1E] hover:bg-[#EFE7E9] dark:hover:bg-[#252225] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5] transition-all hover:text-[#343033] dark:hover:text-white active:scale-95 cursor-pointer border border-transparent dark:border-[#242024]"
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error Banner if any */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-500">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Clean Empty State Preview Frame */}
            <div className="w-full aspect-[4/3] rounded-[24px] border-2 border-dashed border-[#E5D7DA] dark:border-[#2E282E] bg-[#FAF5F7] dark:bg-[#161416] flex flex-col items-center justify-center p-6 text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#20181B] border border-[#EED7DC] dark:border-[#382329] flex items-center justify-center text-[#E98787] mb-3 shadow-2xs">
                <CameraIcon size={26} />
              </div>
              <h4 className="text-sm font-semibold text-[#343033] dark:text-white">
                Ваш кадр для этого момента
              </h4>
              <p className="text-xs text-[#777277] dark:text-[#B8B2B5] max-w-[240px] mt-1 leading-relaxed">
                Сделайте снимок на системную камеру или выберите готовый из галереи
              </p>
            </div>

            {/* Action Buttons: Camera & Device Gallery */}
            <div className="space-y-2.5">
              {/* 1. System Camera Button */}
              <button
                type="button"
                onClick={handleTakePhoto}
                disabled={isLoading}
                className="w-full min-h-[50px] rounded-[20px] bg-[#E98787] hover:bg-[#DE7777] active:bg-[#D56868] disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer shadow-xs"
              >
                <CameraIcon size={18} />
                <span>{isLoading ? 'Запуск камеры...' : 'Сделать снимок'}</span>
              </button>

              {/* 2. Choose from Device / Gallery */}
              <button
                type="button"
                onClick={handleOpenGallery}
                disabled={isLoading}
                className="w-full min-h-[50px] rounded-[20px] bg-[#FAF0F2] dark:bg-[#1C1719] hover:bg-[#F6E6E9] dark:hover:bg-[#231C1F] disabled:opacity-60 text-[#343033] dark:text-white font-semibold text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer border border-[#EED7DC] dark:border-[#35252A]"
              >
                <ImageIcon size={18} className="text-[#E98787]" />
                <span>Открыть из галереи устройства</span>
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEW 2: CAPTURED PHOTO REVIEW / CONFIRMATION
            ========================================================================= */}
        {mode === 'preview' && capturedDataUrl && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMode('menu')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white"
              >
                <ArrowLeft size={16} />
                <span>Назад</span>
              </button>

              <span className="text-xs font-semibold text-[#343033] dark:text-white">
                Просмотр кадра
              </span>

              <button
                type="button"
                onClick={handleClose}
                className="w-7 h-7 rounded-full bg-[#F5EFF1] dark:bg-[#1E1C1E] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5]"
                aria-label="Закрыть"
              >
                <X size={15} />
              </button>
            </div>

            {/* Preview Frame */}
            <div className="relative w-full aspect-square rounded-[24px] overflow-hidden bg-black border border-[#EBE3E5] dark:border-[#282529] shadow-md flex items-center justify-center">
              <img
                src={capturedDataUrl}
                alt="Сделанный снимок"
                className="w-full h-full object-cover"
              />

              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-medium text-white/90 border border-white/10 pointer-events-none">
                {sourceType === 'camera' ? 'Снимок с камеры' : 'Из галереи'}
              </div>
            </div>

            {/* Action Buttons: Retake vs Confirm */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={sourceType === 'camera' ? handleTakePhoto : handleOpenGallery}
                className="w-full min-h-[48px] rounded-[20px] bg-[#FAF0F2] dark:bg-[#1C1719] hover:bg-[#F6E6E9] text-[#343033] dark:text-white font-semibold text-sm flex items-center justify-center gap-2 border border-[#EED7DC] dark:border-[#35252A] active:scale-[0.98] transition-all cursor-pointer"
              >
                <RefreshCw size={16} />
                <span>{sourceType === 'camera' ? 'Переснять' : 'Другое фото'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmPhoto(capturedDataUrl, capturedFile)}
                className="w-full min-h-[48px] rounded-[20px] bg-[#E98787] hover:bg-[#DE7777] active:bg-[#D56868] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all cursor-pointer"
              >
                <Check size={18} strokeWidth={2.4} />
                <span>Использовать</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
