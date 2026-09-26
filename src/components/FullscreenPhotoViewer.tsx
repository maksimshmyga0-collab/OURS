import React, { useEffect, useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { triggerHaptic } from '../services/feedback';

interface FullscreenPhotoViewerProps {
  isOpen: boolean;
  onClose: () => void;
  photoUrl: string | null;
  alt?: string;
  title?: string;
}

/**
 * Reusable Fullscreen Photo Viewer for OURS:
 * 
 * - Opens over existing UI with deep dark neutral backdrop (no pink wash over photo).
 * - Smooth luxury opening animation (scale 0.96 -> 1, opacity 0 -> 1 over 280ms).
 * - Photo is the central hero element, preserved aspect ratio (object-contain).
 * - Closes via close button, clicking outside the photo, Escape key, or Android system Back button.
 * - Handles Android Back button safely without closing the app.
 */
export const FullscreenPhotoViewer: React.FC<FullscreenPhotoViewerProps> = ({
  isOpen,
  onClose,
  photoUrl,
  alt = 'Фотография момента',
  title,
}) => {
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isPushedToHistoryRef = useRef(false);
  const isClosingRef = useRef(false);

  // Safe dismiss handler that coordinates with browser/Android history
  const handleDismiss = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    triggerHaptic(true);

    if (isPushedToHistoryRef.current) {
      isPushedToHistoryRef.current = false;
      // If history was pushed, go back in history which triggers popstate
      if (window.history.state?.modal === 'ours-photo-viewer') {
        window.history.back();
        return;
      }
    }

    // Trigger exit animation
    setIsVisible(false);
    setTimeout(() => {
      setIsRendered(false);
      isClosingRef.current = false;
      onCloseRef.current();
    }, 240);
  }, []);

  useEffect(() => {
    if (isOpen && photoUrl) {
      isClosingRef.current = false;
      setIsRendered(true);

      // Trigger entrance transition on next animation frame
      const frameId = requestAnimationFrame(() => {
        setIsVisible(true);
      });

      // Push history state for Android system Back button
      if (typeof window !== 'undefined') {
        window.history.pushState({ modal: 'ours-photo-viewer' }, '');
        isPushedToHistoryRef.current = true;

        const handlePopState = () => {
          isPushedToHistoryRef.current = false;
          setIsVisible(false);
          setTimeout(() => {
            setIsRendered(false);
            isClosingRef.current = false;
            onCloseRef.current();
          }, 240);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            handleDismiss();
          }
        };

        window.addEventListener('popstate', handlePopState);
        window.addEventListener('keydown', handleKeyDown);

        // Native Capacitor backButton support if available
        const win = window as unknown as {
          Capacitor?: {
            Plugins?: {
              App?: {
                addListener: (
                  eventName: string,
                  callback: () => void
                ) => Promise<{ remove: () => void }>;
              };
            };
          };
        };

        let capListener: { remove: () => void } | null = null;
        if (win.Capacitor?.Plugins?.App?.addListener) {
          win.Capacitor.Plugins.App.addListener('backButton', () => {
            handleDismiss();
          })
            .then((h) => {
              capListener = h;
            })
            .catch(() => {});
        }

        return () => {
          cancelAnimationFrame(frameId);
          window.removeEventListener('popstate', handlePopState);
          window.removeEventListener('keydown', handleKeyDown);
          if (capListener) {
            capListener.remove();
          }
        };
      }
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setIsRendered(false);
      }, 240);
      return () => clearTimeout(timer);
    }
  }, [isOpen, photoUrl, handleDismiss]);

  if (!isRendered || !photoUrl) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 select-none bg-[#09080A]/95 backdrop-blur-[16px] transition-opacity duration-280 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        paddingTop: 'calc(var(--sat, 0px) + 16px)',
        paddingBottom: 'calc(var(--sab, 0px) + 16px)',
      }}
      onClick={handleDismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фотографии на весь экран"
    >
      {/* Top Bar with Title and Minimal Close Button */}
      <div
        className="absolute top-0 inset-x-0 flex items-center justify-between p-4 sm:p-6 pointer-events-none z-20"
        style={{ top: 'var(--sat, 0px)' }}
      >
        {title ? (
          <div className="px-3.5 py-1.5 rounded-full bg-white/10 dark:bg-white/10 backdrop-blur-md border border-white/10 text-white/90 text-xs font-semibold tracking-wide pointer-events-auto shadow-xs">
            {title}
          </div>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          className="w-10 h-10 rounded-full bg-white/12 hover:bg-white/20 active:bg-white/28 text-white/90 hover:text-white flex items-center justify-center backdrop-blur-md border border-white/10 transition-all duration-200 active:scale-95 cursor-pointer shadow-xs pointer-events-auto"
          title="Закрыть (Esc)"
          aria-label="Закрыть просмотр"
        >
          <X size={20} strokeWidth={2.2} />
        </button>
      </div>

      {/* Main Photo: Central Hero Element with Smooth Scale Transition */}
      <div
        className={`relative max-w-full max-h-[85vh] sm:max-h-[88vh] flex items-center justify-center transition-all duration-280 ease-out ${
          isVisible ? 'scale-100 opacity-100' : 'scale-[0.96] opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photoUrl}
          alt={alt}
          referrerPolicy="no-referrer"
          className="max-w-full max-h-[85vh] sm:max-h-[88vh] w-auto h-auto object-contain rounded-[20px] sm:rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-white/10 select-none pointer-events-auto"
        />
      </div>
    </div>
  );
};
