import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NavigationTab } from '../types';
import { playSoftChime, triggerHaptic } from '../services/feedback';

const TABS: NavigationTab[] = ['today', 'history', 'profile'];

interface SwipeableTabViewsProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  soundEnabled?: boolean;
  hapticEnabled?: boolean;
  disabled?: boolean;
  children: {
    today: React.ReactNode;
    history: React.ReactNode;
    profile: React.ReactNode;
  };
}

/**
 * SwipeableTabViews:
 * Smooth horizontal swipe navigation between the three main OURS tabs:
 * 1. 'today'   ("Сегодня")
 * 2. 'history' ("История")
 * 3. 'profile' ("Профиль")
 * 
 * Guarantees:
 * - Content directly follows finger during swipe (interactive gesture).
 * - Soft spring-less 350ms ease-out transitions.
 * - Direction lock: vertical scrolling is 100% native and never triggers tab swipe.
 * - Boundaries: cannot swipe right on tab 1; cannot swipe left on tab 3.
 * - Maximum one tab switch per swipe.
 * - Fullscreen photo viewer & modal protection: gestures ignored when dialog/viewer is open.
 * - Taps on PhotoSlot, buttons, and reactions are completely unaffected.
 * - Bidirectional synchronization with BottomTabBar.
 */
export const SwipeableTabViews: React.FC<SwipeableTabViewsProps> = ({
  activeTab,
  onTabChange,
  soundEnabled = true,
  hapticEnabled = true,
  disabled = false,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentIndex = Math.max(0, TABS.indexOf(activeTab));
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const [dragOffset, setDragOffset] = useState(0);
  const dragOffsetRef = useRef(0);
  dragOffsetRef.current = dragOffset;

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  isDraggingRef.current = isDragging;

  const [isAnimating, setIsAnimating] = useState(false);

  // Track activeTab changes from external controls (e.g. BottomTabBar, header avatar, in-screen links)
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      prevTabRef.current = activeTab;
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 360);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // Touch tracking state
  const touchState = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    isDetermined: false,
    isSwiping: false,
    isScrolling: false,
  });

  // Check if any modal or viewer is currently blocking tab swipe navigation
  const isBlocked = useCallback(() => {
    if (disabled) return true;
    if (typeof document === 'undefined') return false;
    return Boolean(
      document.querySelector('[role="dialog"]') ||
      document.querySelector('[aria-modal="true"]') ||
      document.querySelector('.fixed.inset-0')
    );
  }, [disabled]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (isBlocked()) return;

    // Do not interfere with horizontal inner scrolls (e.g. history thumbnails) or inputs
    const target = e.target as HTMLElement | null;
    if (
      target?.closest('input, textarea, select, [data-no-swipe], .overflow-x-auto, .overflow-x-scroll')
    ) {
      touchState.current.isScrolling = true;
      return;
    }

    const touch = e.touches[0];
    if (!touch) return;

    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isDetermined: false,
      isSwiping: false,
      isScrolling: false,
    };
  }, [isBlocked]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchState.current.isScrolling) {
      return;
    }

    if (isBlocked()) {
      touchState.current.isScrolling = true;
      return;
    }

    const touch = e.touches[0];
    if (!touch) return;

    const dx = touch.clientX - touchState.current.startX;
    const dy = touch.clientY - touchState.current.startY;

    if (!touchState.current.isDetermined) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // Require at least 10px movement before determining gesture axis
      if (absX < 10 && absY < 10) {
        return;
      }

      touchState.current.isDetermined = true;

      // If vertical movement is dominant or comparable -> native vertical scroll
      if (absY >= absX * 0.8) {
        touchState.current.isScrolling = true;
        return;
      }

      // Check boundary conditions:
      // Tab 0 ('today'): cannot swipe right (dx > 0)
      // Tab 2 ('profile'): cannot swipe left (dx < 0)
      if (
        (currentIndexRef.current === 0 && dx > 0) ||
        (currentIndexRef.current === 2 && dx < 0)
      ) {
        touchState.current.isScrolling = true;
        return;
      }

      // Horizontal swipe navigation confirmed
      touchState.current.isSwiping = true;
      setIsDragging(true);
      setIsAnimating(false);
    }

    if (touchState.current.isSwiping) {
      // Prevent browser default window gesture (bounce / navigation back)
      if (e.cancelable) {
        e.preventDefault();
      }

      // Enforce tab boundaries:
      // Tab 0: cannot drag right beyond 0
      // Tab 2: cannot drag left beyond 0
      let clampedDx = dx;
      if (currentIndexRef.current === 0 && dx > 0) {
        clampedDx = 0;
      } else if (currentIndexRef.current === 2 && dx < 0) {
        clampedDx = 0;
      }

      setDragOffset(clampedDx);
    }
  }, [isBlocked]);

  const handleTouchEnd = useCallback(() => {
    if (!touchState.current.isSwiping) {
      touchState.current.isDetermined = false;
      touchState.current.isScrolling = false;
      return;
    }

    const dx = dragOffsetRef.current;
    const elapsed = Math.max(1, Date.now() - touchState.current.startTime);
    const velocity = Math.abs(dx) / elapsed; // px/ms

    const containerWidth = containerRef.current?.offsetWidth || window.innerWidth || 360;
    const threshold = Math.max(50, containerWidth * 0.22);
    const isFlick = Math.abs(dx) > 35 && velocity > 0.32;

    let targetIndex = currentIndexRef.current;

    // Single tab advance per swipe
    if ((dx < -threshold || (dx < -35 && isFlick)) && currentIndexRef.current < 2) {
      targetIndex = currentIndexRef.current + 1;
    } else if ((dx > threshold || (dx > 35 && isFlick)) && currentIndexRef.current > 0) {
      targetIndex = currentIndexRef.current - 1;
    }

    // Reset touch state
    touchState.current = {
      startX: 0,
      startY: 0,
      startTime: 0,
      isDetermined: false,
      isSwiping: false,
      isScrolling: false,
    };

    setIsDragging(false);
    setIsAnimating(true);
    setDragOffset(0);

    if (targetIndex !== currentIndexRef.current) {
      const nextTab = TABS[targetIndex];
      onTabChange(nextTab);
      playSoftChime('tap', soundEnabled);
      triggerHaptic(hapticEnabled);
    }

    setTimeout(() => {
      setIsAnimating(false);
    }, 360);
  }, [onTabChange, soundEnabled, hapticEnabled]);

  // Attach non-passive touch listeners to container for responsive gesture control
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Mouse Drag support for testing in desktop preview
  const mouseState = useRef({
    isDown: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    isSwiping: false,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || isBlocked()) return;

    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('select') ||
      target.closest('[role="dialog"]') ||
      target.closest('[data-no-swipe]') ||
      target.closest('.overflow-x-auto') ||
      target.closest('.overflow-x-scroll')
    ) {
      return;
    }

    mouseState.current = {
      isDown: true,
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      isSwiping: false,
    };
  };

  useEffect(() => {
    const onWindowMouseMove = (e: MouseEvent) => {
      if (!mouseState.current.isDown || isBlocked()) return;

      const dx = e.clientX - mouseState.current.startX;
      const dy = e.clientY - mouseState.current.startY;

      if (!mouseState.current.isSwiping) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          if (
            (currentIndexRef.current === 0 && dx > 0) ||
            (currentIndexRef.current === 2 && dx < 0)
          ) {
            return;
          }
          mouseState.current.isSwiping = true;
          setIsDragging(true);
          setIsAnimating(false);
        }
      }

      if (mouseState.current.isSwiping) {
        let clampedDx = dx;
        if (currentIndexRef.current === 0 && dx > 0) {
          clampedDx = 0;
        } else if (currentIndexRef.current === 2 && dx < 0) {
          clampedDx = 0;
        }
        setDragOffset(clampedDx);
      }
    };

    const onWindowMouseUp = () => {
      if (!mouseState.current.isDown) return;

      const isSwiping = mouseState.current.isSwiping;
      const dx = dragOffsetRef.current;
      const elapsed = Math.max(1, Date.now() - mouseState.current.startTime);
      const velocity = Math.abs(dx) / elapsed;

      mouseState.current.isDown = false;
      mouseState.current.isSwiping = false;

      if (isSwiping) {
        const containerWidth = containerRef.current?.offsetWidth || window.innerWidth || 360;
        const threshold = Math.max(50, containerWidth * 0.22);
        const isFlick = Math.abs(dx) > 35 && velocity > 0.32;

        let targetIndex = currentIndexRef.current;
        if ((dx < -threshold || (dx < -35 && isFlick)) && currentIndexRef.current < 2) {
          targetIndex = currentIndexRef.current + 1;
        } else if ((dx > threshold || (dx > 35 && isFlick)) && currentIndexRef.current > 0) {
          targetIndex = currentIndexRef.current - 1;
        }

        setIsDragging(false);
        setIsAnimating(true);
        setDragOffset(0);

        if (targetIndex !== currentIndexRef.current) {
          const nextTab = TABS[targetIndex];
          onTabChange(nextTab);
          playSoftChime('tap', soundEnabled);
          triggerHaptic(hapticEnabled);
        }

        setTimeout(() => {
          setIsAnimating(false);
        }, 360);
      }
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [isBlocked, onTabChange, soundEnabled, hapticEnabled]);

  const isTabVisible = (index: number) => {
    return index === currentIndex || isDragging || isAnimating;
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      className="w-full overflow-hidden relative select-none"
      style={{ touchAction: 'pan-y' }}
    >
      <div
        className="flex w-full"
        style={{
          transform: `translate3d(calc(-${currentIndex * 100}% + ${dragOffset}px), 0, 0)`,
          transition: isDragging
            ? 'none'
            : 'transform 350ms cubic-bezier(0.25, 1, 0.4, 1)',
          alignItems: 'flex-start',
        }}
      >
        {/* Slide 0: Today */}
        <div
          className={`w-full min-w-full max-w-full shrink-0 grow-0 box-border px-4 pt-4 pb-2 ${
            !isTabVisible(0)
              ? 'h-0 overflow-hidden invisible pointer-events-none'
              : 'h-auto opacity-100 visible'
          }`}
          aria-hidden={currentIndex !== 0}
        >
          {children.today}
        </div>

        {/* Slide 1: History */}
        <div
          className={`w-full min-w-full max-w-full shrink-0 grow-0 box-border px-4 pt-4 pb-2 ${
            !isTabVisible(1)
              ? 'h-0 overflow-hidden invisible pointer-events-none'
              : 'h-auto opacity-100 visible'
          }`}
          aria-hidden={currentIndex !== 1}
        >
          {children.history}
        </div>

        {/* Slide 2: Profile */}
        <div
          className={`w-full min-w-full max-w-full shrink-0 grow-0 box-border px-4 pt-4 pb-2 ${
            !isTabVisible(2)
              ? 'h-0 overflow-hidden invisible pointer-events-none'
              : 'h-auto opacity-100 visible'
          }`}
          aria-hidden={currentIndex !== 2}
        >
          {children.profile}
        </div>
      </div>
    </div>
  );
};
