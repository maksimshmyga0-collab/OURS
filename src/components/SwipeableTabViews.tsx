import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NavigationTab } from '../types';
import { playSoftChime, triggerHaptic } from '../services/feedback';

const TABS: NavigationTab[] = ['date', 'today', 'our_day', 'history', 'profile'];
const LAST_SWIPEABLE_INDEX = 3; // 'history' — 'profile' (index 4) opens only via header button

export type TabContentNode = React.ReactNode | (() => React.ReactNode);

interface SwipeableTabViewsProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  soundEnabled?: boolean;
  hapticEnabled?: boolean;
  disabled?: boolean;
  children: {
    date: TabContentNode;
    today: TabContentNode;
    our_day: TabContentNode;
    history: TabContentNode;
    profile: TabContentNode;
  };
}

function renderTabContent(nodeOrFn: TabContentNode) {
  if (typeof nodeOrFn === 'function') {
    return (nodeOrFn as () => React.ReactNode)();
  }
  return nodeOrFn;
}

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

  const trackRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef(0);

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  isDraggingRef.current = isDragging;

  const [isAnimating, setIsAnimating] = useState(false);

  // Lazy tab mounting: track which tabs have ever been rendered/visited
  const [mountedTabs, setMountedTabs] = useState<Set<number>>(() => new Set([currentIndex]));

  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(currentIndex)) return prev;
      const next = new Set(prev);
      next.add(currentIndex);
      return next;
    });
  }, [currentIndex]);

  const ensureAdjacentMounted = useCallback((idx: number) => {
    if (idx > LAST_SWIPEABLE_INDEX) return;
    setMountedTabs((prev) => {
      let changed = false;
      const next = new Set(prev);
      if (idx > 0 && !next.has(idx - 1)) {
        next.add(idx - 1);
        changed = true;
      }
      if (idx < LAST_SWIPEABLE_INDEX && !next.has(idx + 1)) {
        next.add(idx + 1);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  // Idle pre-mount adjacent tabs in the background so swiping is 100% instant without frame drops
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const idleCallback = (window as any).requestIdleCallback || ((cb: Function) => setTimeout(cb, 500));
    const handle = idleCallback(() => {
      ensureAdjacentMounted(currentIndex);
    });
    return () => {
      if ((window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(handle);
      } else {
        clearTimeout(handle);
      }
    };
  }, [currentIndex, ensureAdjacentMounted]);

  // Track activeTab changes from external controls (e.g. BottomTabBar, header avatar, in-screen links)
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      prevTabRef.current = activeTab;
      setIsAnimating(true);
      if (trackRef.current) {
        trackRef.current.style.transition = 'transform 230ms cubic-bezier(0.22, 1, 0.36, 1)';
        trackRef.current.style.transform = `translate3d(-${currentIndex * 100}%, 0, 0)`;
      }
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 240);
      return () => clearTimeout(timer);
    }
  }, [activeTab, currentIndex]);

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
    const dialog = document.querySelector('[role="dialog"], [aria-modal="true"]');
    if (dialog && (dialog as HTMLElement).offsetParent !== null) {
      return true;
    }
    return Boolean(
      document.querySelector('.fixed.z-\\[9999\\]')
    );
  }, [disabled]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (isBlocked() || currentIndexRef.current > LAST_SWIPEABLE_INDEX) return;

    if (e.touches.length > 1) {
      touchState.current.isScrolling = true;
      return;
    }

    // Do not interfere with horizontal inner scrolls (e.g. history thumbnails), inputs, sliders or modal buttons
    const target = e.target as HTMLElement | null;
    if (
      target?.closest('input, textarea, select, button, [data-no-swipe], .overflow-x-auto, .overflow-x-scroll')
    ) {
      touchState.current.isScrolling = true;
      return;
    }

    const touch = e.touches[0];
    if (!touch) return;

    ensureAdjacentMounted(currentIndexRef.current);

    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      isDetermined: false,
      isSwiping: false,
      isScrolling: false,
    };
    dragOffsetRef.current = 0;
  }, [isBlocked, ensureAdjacentMounted]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchState.current.isScrolling) {
      return;
    }

    if (e.touches.length > 1 || isBlocked() || currentIndexRef.current > LAST_SWIPEABLE_INDEX) {
      touchState.current.isScrolling = true;
      if (touchState.current.isSwiping) {
        touchState.current.isSwiping = false;
        isDraggingRef.current = false;
        setIsDragging(false);
        if (trackRef.current) {
          trackRef.current.style.transition = 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)';
          trackRef.current.style.transform = `translate3d(-${currentIndexRef.current * 100}%, 0, 0)`;
        }
      }
      return;
    }

    const touch = e.touches[0];
    if (!touch) return;

    const dx = touch.clientX - touchState.current.startX;
    const dy = touch.clientY - touchState.current.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!touchState.current.isDetermined) {
      // Require at least 10px displacement before evaluating gesture angle
      const totalDist = Math.hypot(dx, dy);
      if (totalDist < 10) {
        return;
      }

      // Check if horizontal movement is strictly dominant over vertical (angle < ~38.6°)
      const isHorizontal = absX > absY * 1.25;

      // Check boundary conditions: cannot swipe past first tab ('date' = 0) or last bottom-nav tab ('history' = 3)
      const isBoundaryBlocked =
        (currentIndexRef.current === 0 && dx > 0) ||
        (currentIndexRef.current >= LAST_SWIPEABLE_INDEX && dx < 0);

      if (!isHorizontal || isBoundaryBlocked) {
        touchState.current.isDetermined = true;
        touchState.current.isScrolling = true;
        return;
      }

      // Strict horizontal tab swipe confirmed
      touchState.current.isDetermined = true;
      touchState.current.isSwiping = true;
      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        setIsDragging(true);
      }
      setIsAnimating(false);
    }

    if (touchState.current.isSwiping) {
      // Prevent browser default window gesture (bounce / navigation back)
      if (e.cancelable) {
        e.preventDefault();
      }

      // Enforce tab boundaries without revealing Profile (index 4)
      let clampedDx = dx;
      if (currentIndexRef.current === 0 && dx > 0) {
        clampedDx = dx * 0.2;
      } else if (currentIndexRef.current >= LAST_SWIPEABLE_INDEX && dx < 0) {
        clampedDx = 0;
      }

      dragOffsetRef.current = clampedDx;
      if (trackRef.current) {
        trackRef.current.style.transition = 'none';
        trackRef.current.style.transform = `translate3d(calc(-${currentIndexRef.current * 100}% + ${clampedDx}px), 0, 0)`;
      }
    }
  }, [isBlocked]);

  const handleTouchEnd = useCallback(() => {
    if (!touchState.current.isSwiping) {
      touchState.current.isDetermined = false;
      touchState.current.isScrolling = false;
      dragOffsetRef.current = 0;
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
      }
      return;
    }

    const dx = dragOffsetRef.current;
    const elapsed = Math.max(1, Date.now() - touchState.current.startTime);
    const velocity = Math.abs(dx) / elapsed; // px/ms

    const containerWidth = containerRef.current?.offsetWidth || window.innerWidth || 360;
    const threshold = Math.max(60, containerWidth * 0.20);
    const isFlick = Math.abs(dx) > 30 && velocity > 0.28;

    let targetIndex = currentIndexRef.current;

    // Single tab advance per swipe within swipeable tabs (0..LAST_SWIPEABLE_INDEX)
    if ((dx < -threshold || (dx < -30 && isFlick)) && currentIndexRef.current < LAST_SWIPEABLE_INDEX) {
      targetIndex = currentIndexRef.current + 1;
    } else if ((dx > threshold || (dx > 30 && isFlick)) && currentIndexRef.current > 0 && currentIndexRef.current <= LAST_SWIPEABLE_INDEX) {
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

    dragOffsetRef.current = 0;
    isDraggingRef.current = false;
    setIsDragging(false);
    setIsAnimating(true);

    if (trackRef.current) {
      trackRef.current.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
      trackRef.current.style.transform = `translate3d(-${targetIndex * 100}%, 0, 0)`;
    }

    if (targetIndex !== currentIndexRef.current) {
      const nextTab = TABS[targetIndex];
      onTabChange(nextTab);
      playSoftChime('tap', soundEnabled);
      triggerHaptic(hapticEnabled);
    }

    setTimeout(() => {
      setIsAnimating(false);
    }, 230);
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
    if (e.button !== 0 || isBlocked() || currentIndexRef.current > LAST_SWIPEABLE_INDEX) return;

    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('select') ||
      target.closest('[role="dialog"]') ||
      target.closest('[aria-modal="true"]') ||
      target.closest('[data-no-swipe]') ||
      target.closest('.overflow-x-auto') ||
      target.closest('.overflow-x-scroll')
    ) {
      return;
    }

    ensureAdjacentMounted(currentIndexRef.current);

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
      if (!mouseState.current.isDown || isBlocked() || currentIndexRef.current > LAST_SWIPEABLE_INDEX) return;

      const dx = e.clientX - mouseState.current.startX;
      const dy = e.clientY - mouseState.current.startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (!mouseState.current.isSwiping) {
        if (absX >= 12 && absX > absY * 1.35) {
          if (
            (currentIndexRef.current === 0 && dx > 0) ||
            (currentIndexRef.current >= LAST_SWIPEABLE_INDEX && dx < 0)
          ) {
            return;
          }
          mouseState.current.isSwiping = true;
          if (!isDraggingRef.current) {
            isDraggingRef.current = true;
            setIsDragging(true);
          }
          setIsAnimating(false);
        } else if (absY >= 8) {
          mouseState.current.isDown = false;
          return;
        }
      }

      if (mouseState.current.isSwiping) {
        let clampedDx = dx;
        if (currentIndexRef.current === 0 && dx > 0) {
          clampedDx = dx * 0.2;
        } else if (currentIndexRef.current >= LAST_SWIPEABLE_INDEX && dx < 0) {
          clampedDx = 0;
        }
        dragOffsetRef.current = clampedDx;
        if (trackRef.current) {
          trackRef.current.style.transition = 'none';
          trackRef.current.style.transform = `translate3d(calc(-${currentIndexRef.current * 100}% + ${clampedDx}px), 0, 0)`;
        }
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
        const threshold = Math.max(60, containerWidth * 0.20);
        const isFlick = Math.abs(dx) > 30 && velocity > 0.28;

        let targetIndex = currentIndexRef.current;
        if ((dx < -threshold || (dx < -30 && isFlick)) && currentIndexRef.current < LAST_SWIPEABLE_INDEX) {
          targetIndex = currentIndexRef.current + 1;
        } else if ((dx > threshold || (dx > 30 && isFlick)) && currentIndexRef.current > 0 && currentIndexRef.current <= LAST_SWIPEABLE_INDEX) {
          targetIndex = currentIndexRef.current - 1;
        }

        dragOffsetRef.current = 0;
        isDraggingRef.current = false;
        setIsDragging(false);
        setIsAnimating(true);

        if (trackRef.current) {
          trackRef.current.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
          trackRef.current.style.transform = `translate3d(-${targetIndex * 100}%, 0, 0)`;
        }

        if (targetIndex !== currentIndexRef.current) {
          const nextTab = TABS[targetIndex];
          onTabChange(nextTab);
          playSoftChime('tap', soundEnabled);
          triggerHaptic(hapticEnabled);
        }

        setTimeout(() => {
          setIsAnimating(false);
        }, 230);
      } else {
        dragOffsetRef.current = 0;
        if (trackRef.current) {
          trackRef.current.style.transition = 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)';
          trackRef.current.style.transform = `translate3d(-${currentIndexRef.current * 100}%, 0, 0)`;
        }
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
    if (index > LAST_SWIPEABLE_INDEX) {
      return currentIndex === index || isAnimating;
    }
    return Math.abs(index - currentIndex) <= 1 || isDragging || isAnimating;
  };

  const isTabActiveForAnimations = (index: number) => {
    return index === currentIndex || isDragging || isAnimating;
  };

  const getTabClass = (index: number) => {
    const isVisible = isTabVisible(index);
    const isAnimated = isTabActiveForAnimations(index);
    if (!isVisible) {
      return 'invisible pointer-events-none tab-hidden tab-inactive';
    }
    if (!isAnimated) {
      return 'opacity-100 visible tab-inactive';
    }
    return 'opacity-100 visible';
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      className="w-full flex-1 min-h-0 h-full flex flex-col overflow-hidden relative select-none"
      style={{ touchAction: 'pan-y' }}
    >
      <div
        ref={trackRef}
        className="flex w-full flex-1 min-h-0 h-full will-change-transform"
        style={{
          transform: `translate3d(-${currentIndex * 100}%, 0, 0)`,
          transition: isDragging
            ? 'none'
            : 'transform 230ms cubic-bezier(0.22, 1, 0.36, 1)',
          alignItems: 'stretch',
        }}
      >
        {/* Slide 0: Date */}
        <div
          className={`w-full min-w-full max-w-full shrink-0 grow-0 box-border px-3 sm:px-4 pt-2 pb-2 flex flex-col h-full min-h-0 overflow-hidden ${getTabClass(0)}`}
          aria-hidden={currentIndex !== 0}
        >
          {mountedTabs.has(0) ? renderTabContent(children.date) : null}
        </div>

        {/* Slide 1: Today */}
        <div
          className={`w-full min-w-full max-w-full shrink-0 grow-0 box-border px-3 sm:px-4 pt-1.5 sm:pt-2.5 pb-1 flex flex-col h-full min-h-0 overflow-hidden ${getTabClass(1)}`}
          aria-hidden={currentIndex !== 1}
        >
          {mountedTabs.has(1) ? renderTabContent(children.today) : null}
        </div>

        {/* Slide 2: Our Day */}
        <div
          className={`w-full min-w-full max-w-full shrink-0 grow-0 box-border px-3 sm:px-4 pt-1.5 sm:pt-2 pb-1 flex flex-col h-full min-h-0 overflow-hidden ${getTabClass(2)}`}
          aria-hidden={currentIndex !== 2}
        >
          {mountedTabs.has(2) ? renderTabContent(children.our_day) : null}
        </div>

        {/* Slide 3: History */}
        <div
          className={`w-full min-w-full max-w-full shrink-0 grow-0 box-border px-4 pt-4 pb-2 flex flex-col h-full min-h-0 overflow-hidden ${getTabClass(3)}`}
          aria-hidden={currentIndex !== 3}
        >
          {mountedTabs.has(3) ? renderTabContent(children.history) : null}
        </div>

        {/* Slide 4: Profile */}
        <div
          className={`w-full min-w-full max-w-full shrink-0 grow-0 box-border px-4 pt-4 pb-2 flex flex-col h-full min-h-0 overflow-hidden ${getTabClass(4)}`}
          aria-hidden={currentIndex !== 4}
        >
          {mountedTabs.has(4) ? renderTabContent(children.profile) : null}
        </div>
      </div>
    </div>
  );
};
