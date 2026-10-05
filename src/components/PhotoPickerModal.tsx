import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Image as ImageIcon, X, RefreshCw, Check, ArrowLeft } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fallbackCameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<'menu' | 'camera' | 'preview'>('menu');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Stop camera stream safely
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Start in-app camera
  const startCamera = useCallback(async (facing: 'user' | 'environment' = facingMode) => {
    stopCamera();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Fallback for environments without getUserMedia support
      fallbackCameraInputRef.current?.click();
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      });

      setStream(mediaStream);
      setMode('camera');
      setFacingMode(facing);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch((err) => {
          console.warn('[PhotoPickerModal] Video play error:', err);
        });
      }
    } catch (err: unknown) {
      console.warn('[PhotoPickerModal] Camera access error, falling back:', err);
      // If camera access fails (e.g. permission denied or unsupported device constraints), fallback to native capture
      stopCamera();
      fallbackCameraInputRef.current?.click();
    }
  }, [facingMode, stopCamera]);

  // Attach stream to video element when entering camera mode
  useEffect(() => {
    if (mode === 'camera' && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [mode, stream]);

  // Cleanup camera stream on close / unmount
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setMode('menu');
      setCapturedDataUrl(null);
      setCameraError(null);
    }
  }, [isOpen, stopCamera]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stopCamera();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, stopCamera]);

  if (!isOpen || typeof document === 'undefined') return null;

  // Handle shutter snap
  const handleCaptureSnapshot = () => {
    triggerHaptic(true);
    playSoftChime('tap', true);

    const video = videoRef.current;
    if (!video) return;

    const canvas = canvasRef.current || document.createElement('canvas');
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;

    // Center-crop square / 4:5 snapshot from video stream
    const size = Math.min(vw, vh);
    const startX = (vw - size) / 2;
    const startY = (vh - size) / 2;

    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontally if front camera for natural mirror feel
    if (facingMode === 'user') {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedDataUrl(dataUrl);
    setMode('preview');
    stopCamera();
  };

  // Flip front/rear camera
  const handleToggleFacingMode = () => {
    triggerHaptic(true);
    const next = facingMode === 'environment' ? 'user' : 'environment';
    startCamera(next);
  };

  // Confirm and use captured photo
  const handleConfirmPhoto = async (photoUrl: string) => {
    triggerHaptic(true);
    playSoftChime('success', true);
    stopCamera();
    onClose();

    // Instant fast preview
    onSelectPhoto(photoUrl);

    try {
      // Optimize snapshot
      const res = await fetch(photoUrl);
      const blob = await res.blob();
      const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
      const optimized = await optimizePhotoForUpload(file);
      if (optimized && optimized !== photoUrl) {
        onSelectPhoto(optimized);
      }
    } catch (err) {
      console.warn('[PhotoPickerModal] Optimization error:', err);
    }
  };

  // Process selected file through existing optimization and upload pipeline
  const handleProcessFile = async (file: File) => {
    stopCamera();
    onClose();

    // Instant fast preview
    const fastPreview = URL.createObjectURL(file);
    onSelectPhoto(fastPreview);

    try {
      const optimized = await optimizePhotoForUpload(file);
      if (optimized && optimized !== fastPreview) {
        onSelectPhoto(optimized);
      }
    } catch (err) {
      console.warn('[PhotoPicker] Optimization fallback:', err);
    }
  };

  // Dedicated direct Photo Gallery launcher (bypasses Android camera/camcorder/files chooser)
  const handleOpenGallery = async () => {
    triggerHaptic(true);
    playSoftChime('tap', true);

    // 1. Native Capacitor Camera Plugin (directly opens Photos / Media Library without chooser)
    const win = window as any;
    if (win.Capacitor?.Plugins?.Camera?.getPhoto) {
      try {
        const photo = await win.Capacitor.Plugins.Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: 'dataUrl',
          source: 'PHOTOS',
        });
        if (photo?.dataUrl) {
          stopCamera();
          onClose();
          onSelectPhoto(photo.dataUrl);
          return;
        } else if (photo?.webPath) {
          const res = await fetch(photo.webPath);
          const blob = await res.blob();
          const file = new File([blob], 'gallery-photo.jpg', { type: 'image/jpeg' });
          handleProcessFile(file);
          return;
        }
      } catch (err: any) {
        // User cancelled in system gallery -> do not trigger error or fallback
        if (err?.message?.includes('cancelled') || err?.message?.includes('User cancelled')) {
          return;
        }
      }
    }

    // 2. Modern Android Photo Picker API (Chromium showOpenFilePicker opens Photos directly)
    if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
      try {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: 'Изображения',
              accept: {
                'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
              },
            },
          ],
          multiple: false,
          excludeAcceptAllOption: true,
        });
        if (handle) {
          const file = await handle.getFile();
          if (file) {
            handleProcessFile(file);
            return;
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          // User closed gallery without selecting
          return;
        }
      }
    }

    // 3. Fallback: Clean standard image/* input
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle device file / gallery input change
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      e.target.value = '';
      handleProcessFile(file);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#000000]/70 backdrop-blur-[6px] animate-sheet-backdrop"
      onClick={() => {
        stopCamera();
        onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#111111] border border-[#EBE3E5] dark:border-[#242024] rounded-t-[32px] sm:rounded-[28px] p-6 pb-8 shadow-[0_-4px_32px_rgba(0,0,0,0.25)] max-h-[90vh] overflow-y-auto no-scrollbar animate-sheet-enter transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden Fallback Inputs: clean image/* without multi-mime chooser triggering */}
        <input
          ref={fallbackCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <canvas ref={canvasRef} className="hidden" />

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
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="w-8 h-8 rounded-full bg-[#F5EFF1] dark:bg-[#1E1C1E] hover:bg-[#EFE7E9] dark:hover:bg-[#252225] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5] transition-all hover:text-[#343033] dark:hover:text-white active:scale-95 cursor-pointer border border-transparent dark:border-[#242024]"
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>

            {/* Clean Empty State Preview Frame */}
            <div className="w-full aspect-[4/3] rounded-[24px] border-2 border-dashed border-[#E5D7DA] dark:border-[#2E282E] bg-[#FAF5F7] dark:bg-[#161416] flex flex-col items-center justify-center p-6 text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#20181B] border border-[#EED7DC] dark:border-[#382329] flex items-center justify-center text-[#E98787] mb-3 shadow-2xs">
                <Camera size={26} />
              </div>
              <h4 className="text-sm font-semibold text-[#343033] dark:text-white">
                Ваш кадр для этого момента
              </h4>
              <p className="text-xs text-[#777277] dark:text-[#B8B2B5] max-w-[240px] mt-1 leading-relaxed">
                Сделайте живое фото на камеру или выберите готовое из галереи
              </p>
            </div>

            {/* Action Buttons: Camera & Device Gallery */}
            <div className="space-y-2.5">
              {/* 1. Live Camera Button */}
              <button
                type="button"
                onClick={() => startCamera('environment')}
                className="w-full min-h-[50px] rounded-[20px] bg-[#E98787] hover:bg-[#DE7777] active:bg-[#D56868] text-white font-semibold text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer shadow-xs"
              >
                <Camera size={18} />
                <span>Сделать снимок</span>
              </button>

              {/* 2. Choose from Device / Gallery */}
              <button
                type="button"
                onClick={handleOpenGallery}
                className="w-full min-h-[50px] rounded-[20px] bg-[#FAF0F2] dark:bg-[#1C1719] hover:bg-[#F6E6E9] dark:hover:bg-[#231C1F] text-[#343033] dark:text-white font-semibold text-sm flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer border border-[#EED7DC] dark:border-[#35252A]"
              >
                <ImageIcon size={18} className="text-[#E98787]" />
                <span>Выбрать из галереи устройства</span>
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEW 2: LIVE IN-APP CAMERA VIEWFINDER
            ========================================================================= */}
        {mode === 'camera' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setMode('menu');
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white"
              >
                <ArrowLeft size={16} />
                <span>Назад</span>
              </button>

              <span className="text-xs font-semibold text-[#343033] dark:text-white">
                Камера
              </span>

              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="w-7 h-7 rounded-full bg-[#F5EFF1] dark:bg-[#1E1C1E] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5]"
              >
                <X size={15} />
              </button>
            </div>

            {/* Live Camera Viewfinder */}
            <div className="relative w-full aspect-square rounded-[24px] overflow-hidden bg-black border border-[#EBE3E5] dark:border-[#282529] shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />

              {/* Viewfinder Corner Framing Guides */}
              <div className="absolute inset-4 pointer-events-none">
                <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white/70 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white/70 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white/70 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white/70 rounded-br-lg" />
              </div>

              {/* Switch Front/Rear Camera Button */}
              <button
                type="button"
                onClick={handleToggleFacingMode}
                className="absolute top-3 right-3 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-md z-10"
                title="Переключить камеру"
              >
                <RefreshCw size={18} />
              </button>
            </div>

            {cameraError && (
              <p className="text-xs text-rose-500 text-center font-medium">
                {cameraError}
              </p>
            )}

            {/* Shutter Button Controls */}
            <div className="flex items-center justify-center pt-2">
              <button
                type="button"
                onClick={handleCaptureSnapshot}
                className="w-18 h-18 rounded-full bg-white dark:bg-[#1C1719] border-4 border-[#E98787] flex items-center justify-center p-1.5 shadow-lg active:scale-95 transition-transform cursor-pointer"
                title="Сделать снимок"
                aria-label="Сделать снимок"
              >
                <div className="w-full h-full rounded-full bg-[#E98787] flex items-center justify-center text-white">
                  <Camera size={22} />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            VIEW 3: CAPTURED PHOTO REVIEW / CONFIRMATION
            ========================================================================= */}
        {mode === 'preview' && capturedDataUrl && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#343033] dark:text-white">
                Просмотр кадра
              </span>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="w-7 h-7 rounded-full bg-[#F5EFF1] dark:bg-[#1E1C1E] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5]"
              >
                <X size={15} />
              </button>
            </div>

            {/* Preview Frame */}
            <div className="relative w-full aspect-square rounded-[24px] overflow-hidden bg-black border border-[#EBE3E5] dark:border-[#282529] shadow-md">
              <img
                src={capturedDataUrl}
                alt="Сделанный снимок"
                className="w-full h-full object-cover"
              />
            </div>

            {/* Action Buttons: Retake vs Confirm */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="w-full min-h-[48px] rounded-[20px] bg-[#FAF0F2] dark:bg-[#1C1719] hover:bg-[#F6E6E9] text-[#343033] dark:text-white font-semibold text-sm flex items-center justify-center gap-2 border border-[#EED7DC] dark:border-[#35252A] active:scale-[0.98] transition-all cursor-pointer"
              >
                <RefreshCw size={16} />
                <span>Переснять</span>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmPhoto(capturedDataUrl)}
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
