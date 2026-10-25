import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Minus, Compass, Lock, X, Sparkles } from 'lucide-react';
import {
  SkyCelestialMoment,
  CelestialConstellationLine,
  MAP_VIRTUAL_WIDTH,
  MAP_VIRTUAL_HEIGHT,
} from '../services/sky/skyMomentsService';
import { triggerHaptic, playSoftChime } from '../services/feedback';

export interface InteractiveSkyMapProps {
  moments: SkyCelestialMoment[];
  lines: CelestialConstellationLine[];
  onOpenPhoto?: (photoUrl: string, title?: string, dateStr?: string, authorName?: string) => void;
  onOpenLockedMoment?: () => void;
  isActive?: boolean;
  className?: string;
}

const MAX_SCALE = 2.4;

/**
 * Atmospheric Interactive Starry Memory Map of the Couple («Карта моментов»)
 * - Deep velvet burgundy-blue cosmic canvas with natural nebula clouds
 * - Obsidian-style unconstrained canvas navigation with «К своим звёздам» centering
 * - Centered compact photo preview card overlay without in-place scaling or map displacement
 * - Crisp, delicate starry points and photo miniatures without blinding neon glow
 */
export const InteractiveSkyMap: React.FC<InteractiveSkyMapProps> = ({
  moments,
  lines,
  onOpenPhoto,
  onOpenLockedMoment,
  isActive = true,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uid = React.useId().replace(/:/g, '');

  // Transform state: position & zoom
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.75 });
  const transformRef = useRef(transform);
  transformRef.current = transform;

  // Selected star without photo (for floating memory tooltip)
  const [selectedStar, setSelectedStar] = useState<SkyCelestialMoment | null>(null);

  // Centered photo preview modal state
  const [previewMoment, setPreviewMoment] = useState<SkyCelestialMoment | null>(null);
  const previewMomentRef = useRef<SkyCelestialMoment | null>(null);
  previewMomentRef.current = previewMoment;
  const isPushedToHistoryRef = useRef(false);

  // Bounding box containing all celestial stars and photo thumbnails
  const bounds = useMemo(() => {
    if (moments.length === 0) {
      return {
        minX: 90,
        maxX: MAP_VIRTUAL_WIDTH - 90,
        minY: 90,
        maxY: MAP_VIRTUAL_HEIGHT - 90,
        width: MAP_VIRTUAL_WIDTH - 180,
        height: MAP_VIRTUAL_HEIGHT - 180,
        centerX: MAP_VIRTUAL_WIDTH / 2,
        centerY: MAP_VIRTUAL_HEIGHT / 2,
      };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const m of moments) {
      if (m.coords.x < minX) minX = m.coords.x;
      if (m.coords.x > maxX) maxX = m.coords.x;
      if (m.coords.y < minY) minY = m.coords.y;
      if (m.coords.y > maxY) maxY = m.coords.y;
    }

    // Safe padding around thumbnails (radius 22px + breathing room)
    const margin = 56;
    const bMinX = Math.max(0, minX - margin);
    const bMaxX = Math.min(MAP_VIRTUAL_WIDTH, maxX + margin);
    const bMinY = Math.max(0, minY - margin);
    const bMaxY = Math.min(MAP_VIRTUAL_HEIGHT, maxY + margin);

    return {
      minX: bMinX,
      maxX: bMaxX,
      minY: bMinY,
      maxY: bMaxY,
      width: Math.max(260, bMaxX - bMinX),
      height: Math.max(220, bMaxY - bMinY),
      centerX: (bMinX + bMaxX) / 2,
      centerY: (bMinY + bMaxY) / 2,
    };
  }, [moments]);

  // Dynamic minimum scale: strictly guarantees all stars and photos fit inside the container
  const calculateMinScale = useCallback(() => {
    if (!containerRef.current) return 0.22;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return 0.22;

    // Available space leaving safe margins for UI controls and frame borders
    const availW = Math.max(120, rect.width - 32);
    const availH = Math.max(120, rect.height - 32);

    const scaleMoments = Math.min(availW / bounds.width, availH / bounds.height);
    const scaleCanvas = Math.min(availW / MAP_VIRTUAL_WIDTH, availH / MAP_VIRTUAL_HEIGHT);

    // Target min scale allows seeing all moments with comfortable breathing space
    const targetMin = Math.min(scaleMoments, scaleCanvas);
    // Allow zooming out far enough even on compact mobile screens (floor 0.18)
    return Math.max(0.18, Math.min(targetMin, 0.7));
  }, [bounds]);

  // Safe dismiss coordinator for centered photo preview modal
  const closePhotoPreview = useCallback(() => {
    if (previewMomentRef.current) {
      setPreviewMoment(null);
      triggerHaptic(true);
      if (isPushedToHistoryRef.current) {
        isPushedToHistoryRef.current = false;
        try {
          if (window.history.state?.modal === 'ours-sky-photo-preview') {
            window.history.back();
          }
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const openPhotoPreview = useCallback((moment: SkyCelestialMoment) => {
    setPreviewMoment(moment);
    triggerHaptic(true);
    playSoftChime('tap', true);
    if (!isPushedToHistoryRef.current) {
      try {
        window.history.pushState({ modal: 'ours-sky-photo-preview' }, '');
        isPushedToHistoryRef.current = true;
      } catch {
        // ignore
      }
    }
  }, []);

  // Listen to Android hardware/gesture back navigation
  useEffect(() => {
    const handlePopState = () => {
      if (previewMomentRef.current) {
        isPushedToHistoryRef.current = false;
        setPreviewMoment(null);
        triggerHaptic(true);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Keyboard Escape key dismissal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewMomentRef.current) {
        closePhotoPreview();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closePhotoPreview]);

  // Drag & Pinch Tracking
  const pointerState = useRef({
    isDown: false,
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    hasMoved: false,
    activePointers: new Map<number, { clientX: number; clientY: number }>(),
    initialPinchDistance: 0,
    initialScale: 0.75,
    pinchCenter: { x: 0, y: 0 },
  });

  // Obsidian-canvas style generous boundary clamping so panning feels fluid and unconstrained
  const clampTranslate = useCallback((x: number, y: number, scale: number) => {
    if (!containerRef.current) return { x, y };
    const rect = containerRef.current.getBoundingClientRect();
    const mapW = MAP_VIRTUAL_WIDTH * scale;
    const mapH = MAP_VIRTUAL_HEIGHT * scale;

    // Generous padding allowing smooth canvas freedom around stars
    const padX = Math.max(rect.width * 1.5, 800);
    const padY = Math.max(rect.height * 1.5, 600);

    const minX = rect.width - mapW - padX;
    const maxX = padX;
    const clampedX = Math.min(Math.max(x, minX), maxX);

    const minY = rect.height - mapH - padY;
    const maxY = padY;
    const clampedY = Math.min(Math.max(y, minY), maxY);

    return { x: clampedX, y: clampedY };
  }, []);

  // Center on moments (or custom scale)
  const centerOnMoments = useCallback(
    (customScale?: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const minScale = calculateMinScale();
      const targetScale =
        customScale !== undefined
          ? Math.max(minScale, Math.min(customScale, MAX_SCALE))
          : transformRef.current.scale;

      const targetX = bounds.centerX;
      const targetY = bounds.centerY;

      const initialX = rect.width / 2 - targetX * targetScale;
      const initialY = rect.height / 2 - targetY * targetScale;
      const clamped = clampTranslate(initialX, initialY, targetScale);

      setTransform({ x: clamped.x, y: clamped.y, scale: targetScale });
    },
    [bounds, calculateMinScale, clampTranslate]
  );

  // Auto-centering on mount and dynamic container resize
  useEffect(() => {
    if (!containerRef.current) return;
    let initialCentered = false;

    const applyOptimalView = () => {
      const minScale = calculateMinScale();
      // Overview scale: fits all moments cleanly on screen
      const initialScale = Math.max(minScale, Math.min(0.85, minScale * 1.15));
      centerOnMoments(initialScale);
    };

    const timer = setTimeout(() => {
      applyOptimalView();
      initialCentered = true;
    }, 60);

    const observer = new ResizeObserver(() => {
      if (!initialCentered) {
        applyOptimalView();
        initialCentered = true;
      } else {
        const minScale = calculateMinScale();
        const current = transformRef.current;
        const safeScale = Math.max(minScale, Math.min(current.scale, MAX_SCALE));
        const clamped = clampTranslate(current.x, current.y, safeScale);
        setTransform((prev) => ({ ...prev, x: clamped.x, y: clamped.y, scale: safeScale }));
      }
    });

    observer.observe(containerRef.current);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [centerOnMoments, calculateMinScale, clampTranslate]);

  // Zoom controls (+ / - buttons)
  const handleZoom = useCallback(
    (delta: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const current = transformRef.current;
      const minScale = calculateMinScale();
      const newScale = Math.min(Math.max(current.scale + delta, minScale), MAX_SCALE);
      if (Math.abs(newScale - current.scale) < 0.005) return;

      // Scale around viewport center
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const ratio = newScale / current.scale;
      const newX = centerX - (centerX - current.x) * ratio;
      const newY = centerY - (centerY - current.y) * ratio;

      const clamped = clampTranslate(newX, newY, newScale);
      setTransform({ x: clamped.x, y: clamped.y, scale: newScale });
      triggerHaptic(true);
    },
    [calculateMinScale, clampTranslate]
  );

  // Pointer event handlers (mouse and touch unified)
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const ptr = pointerState.current;
    ptr.activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    if (ptr.activePointers.size === 1) {
      ptr.isDown = true;
      ptr.hasMoved = false;
      ptr.startX = e.clientX;
      ptr.startY = e.clientY;
      ptr.initialX = transformRef.current.x;
      ptr.initialY = transformRef.current.y;
    } else if (ptr.activePointers.size === 2) {
      // Begin pinch
      const pts = Array.from(ptr.activePointers.values());
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      ptr.initialPinchDistance = dist || 1;
      ptr.initialScale = transformRef.current.scale;
      ptr.pinchCenter = {
        x: (pts[0].clientX + pts[1].clientX) / 2,
        y: (pts[0].clientY + pts[1].clientY) / 2,
      };
      ptr.hasMoved = true;
    }
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const ptr = pointerState.current;
      if (!ptr.activePointers.has(e.pointerId)) return;
      ptr.activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

      if (ptr.activePointers.size === 1 && ptr.isDown) {
        const dx = e.clientX - ptr.startX;
        const dy = e.clientY - ptr.startY;
        if (Math.hypot(dx, dy) > 5) {
          ptr.hasMoved = true;
        }

        const newX = ptr.initialX + dx;
        const newY = ptr.initialY + dy;
        const clamped = clampTranslate(newX, newY, transformRef.current.scale);
        setTransform((prev) => ({ ...prev, x: clamped.x, y: clamped.y }));
      } else if (ptr.activePointers.size === 2 && containerRef.current) {
        // Pinch zooming around pinch center
        const pts = Array.from(ptr.activePointers.values());
        const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
        const rect = containerRef.current.getBoundingClientRect();
        const ratio = dist / (ptr.initialPinchDistance || 1);
        const minScale = calculateMinScale();
        const newScale = Math.min(Math.max(ptr.initialScale * ratio, minScale), MAX_SCALE);

        // Focal point relative to container
        const focalX = ptr.pinchCenter.x - rect.left;
        const focalY = ptr.pinchCenter.y - rect.top;

        const current = transformRef.current;
        const scaleRatio = newScale / current.scale;
        const newX = focalX - (focalX - current.x) * scaleRatio;
        const newY = focalY - (focalY - current.y) * scaleRatio;

        const clamped = clampTranslate(newX, newY, newScale);
        setTransform({ x: clamped.x, y: clamped.y, scale: newScale });
      }
    },
    [calculateMinScale, clampTranslate]
  );

  const handlePointerUpOrCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ptr = pointerState.current;
    ptr.activePointers.delete(e.pointerId);

    if (ptr.activePointers.size === 0) {
      ptr.isDown = false;
    } else if (ptr.activePointers.size === 1) {
      // Transitioned from pinch to 1-finger drag
      const remaining = Array.from(ptr.activePointers.values())[0];
      ptr.startX = remaining.clientX;
      ptr.startY = remaining.clientY;
      ptr.initialX = transformRef.current.x;
      ptr.initialY = transformRef.current.y;
    }
  }, []);

  // Wheel zoom on desktop
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      const delta = -e.deltaY * 0.0018;
      const current = transformRef.current;
      const minScale = calculateMinScale();
      const newScale = Math.min(Math.max(current.scale + delta, minScale), MAX_SCALE);
      if (Math.abs(newScale - current.scale) < 0.005) return;

      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const ratio = newScale / current.scale;
      const newX = cursorX - (cursorX - current.x) * ratio;
      const newY = cursorY - (cursorY - current.y) * ratio;

      const clamped = clampTranslate(newX, newY, newScale);
      setTransform({ x: clamped.x, y: clamped.y, scale: newScale });
    },
    [calculateMinScale, clampTranslate]
  );

  // Moments with and without photos (Strictly filtered, date stars excluded)
  const momentsWithPhotos = useMemo(
    () => moments.filter((m) => m.hasPhoto && m.starType !== 'date'),
    [moments]
  );
  const momentsWithoutPhotos = useMemo(
    () => moments.filter((m) => !m.hasPhoto && m.starType !== 'date'),
    [moments]
  );

  // Click on a moment: distinction between drag and tap
  const handleMomentClick = (e: React.MouseEvent, moment: SkyCelestialMoment) => {
    e.stopPropagation();
    if (pointerState.current.hasMoved) return; // Ignore drag release

    if (moment.hasPhoto && moment.primaryPhotoUrl) {
      if (selectedStar) {
        setSelectedStar(null);
      }
      openPhotoPreview(moment);
    } else {
      if (previewMoment) {
        closePhotoPreview();
      }
      triggerHaptic(true);
      playSoftChime('tap', true);
      setSelectedStar((prev) => (prev?.id === moment.id ? null : moment));
    }
  };

  // Close floating memory detail card or centered photo preview on background tap
  const handleBackgroundTap = () => {
    if (pointerState.current.hasMoved) return;
    if (previewMoment) {
      closePhotoPreview();
    }
    if (selectedStar) {
      setSelectedStar(null);
    }
  };

  // Background subtle stardust points (static pseudo-random celestial distribution)
  const backgroundStars = useMemo(() => {
    const list: Array<{ cx: number; cy: number; r: number; opacity: number }> = [];
    let seed = 12345;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 48; i++) {
      list.push({
        cx: Math.round(rng() * MAP_VIRTUAL_WIDTH),
        cy: Math.round(rng() * MAP_VIRTUAL_HEIGHT),
        r: 0.6 + rng() * 0.9,
        opacity: 0.15 + rng() * 0.35,
      });
    }
    return list;
  }, []);

  return (
    <div
      ref={containerRef}
      data-no-swipe="true"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onWheel={handleWheel}
      onClick={handleBackgroundTap}
      className={`relative select-none overflow-hidden rounded-[26px] sm:rounded-[32px] w-full h-full min-h-[300px] cursor-grab active:cursor-grabbing border border-[#E8BFC7]/15 shadow-[inset_0_1px_2px_rgba(245,222,230,0.12),0_16px_44px_-10px_rgba(6,6,14,0.75)] ${className}`}
      style={{
        backgroundColor: '#0A0A14',
        background:
          'radial-gradient(120% 120% at 50% 25%, #161830 0%, #0F1022 45%, #0A0A15 78%, #06060C 100%)',
        touchAction: 'none',
      }}
    >
      {/* 1. Transformed Celestial Canvas World */}
      <div
        className="absolute top-0 left-0 will-change-transform origin-top-left"
        style={{
          width: MAP_VIRTUAL_WIDTH,
          height: MAP_VIRTUAL_HEIGHT,
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
        }}
      >
        {/* SVG Layer: Ambient Nebulae, Gossamer Constellation Threads, and Stardust */}
        <svg
          width={MAP_VIRTUAL_WIDTH}
          height={MAP_VIRTUAL_HEIGHT}
          viewBox={`0 0 ${MAP_VIRTUAL_WIDTH} ${MAP_VIRTUAL_HEIGHT}`}
          className="absolute inset-0 pointer-events-none"
        >
          <defs>
            <radialGradient id={`skyMapNebula-${uid}`} cx="50%" cy="45%" r="65%">
              <stop offset="0%" stopColor="#E8B0BE" stopOpacity="0.12" />
              <stop offset="42%" stopColor="#5B76BA" stopOpacity="0.09" />
              <stop offset="80%" stopColor="#14152B" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#080811" stopOpacity="0" />
            </radialGradient>

            <linearGradient id={`constellationThread-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFF4E8" stopOpacity="0.32" />
              <stop offset="50%" stopColor="#F4CBD6" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#E8ABC0" stopOpacity="0.16" />
            </linearGradient>
          </defs>

          {/* Ambient Cosmic Clouds */}
          <rect width="100%" height="100%" fill={`url(#skyMapNebula-${uid})`} />

          {/* Background Ambient Micro-Stardust */}
          <g opacity={isActive ? '0.35' : '0.2'}>
            {backgroundStars.map((s, idx) => (
              <circle key={`bg-star-${idx}`} cx={s.cx} cy={s.cy} r={s.r} fill="#FFFDF8" opacity={s.opacity} />
            ))}
          </g>

          {/* Delicate Crisp Constellation Connecting Threads (clean gossamer lines without fuzzy glow) */}
          <g>
            {lines.map((l) => (
              <line
                key={`line-${l.fromId}-${l.toId}`}
                x1={l.from.x}
                y1={l.from.y}
                x2={l.to.x}
                y2={l.to.y}
                stroke={`url(#constellationThread-${uid})`}
                strokeWidth="1"
                strokeLinecap="round"
                opacity="0.6"
              />
            ))}
          </g>
        </svg>

        {/* 2. Interactive Moment Nodes (Photos & Crisp Celestial Stars) */}
        {/* A. Stars Without Photos: Clean, neat star points with zero unpleasant blur */}
        {momentsWithoutPhotos.map((m) => {
          const isSelected = selectedStar?.id === m.id;

          return (
            <div
              key={`star-node-${m.id}`}
              onClick={(e) => handleMomentClick(e, m)}
              role="button"
              tabIndex={0}
              aria-label={`${m.title} ${m.formattedDate}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group p-3 focus:outline-none z-10"
              style={{
                left: m.coords.x,
                top: m.coords.y,
              }}
            >
              <div
                className={`relative flex items-center justify-center transition-transform duration-200 group-hover:scale-130 ${
                  isSelected ? 'scale-140' : ''
                }`}
              >
                {/* Neat, clean celestial star point */}
                <div className="relative w-5 h-5 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="4.2" fill="#FFF4E8" fillOpacity="0.18" />
                    <circle cx="7" cy="7" r="2.4" fill="#FFEED8" />
                    <circle cx="7" cy="7" r="1.1" fill="#FFFFFF" />
                  </svg>
                </div>
              </div>
            </div>
          );
        })}

        {/* B. Moments With Photos: Clean circular miniatures without blinding halos */}
        {momentsWithPhotos.map((m) => {
          const hasDuo = Boolean(m.primaryPhotoUrl && m.secondaryPhotoUrl);

          return (
            <div
              key={`photo-node-${m.id}`}
              onClick={(e) => handleMomentClick(e, m)}
              role="button"
              tabIndex={0}
              aria-label={`Просмотреть фото ${m.title || 'момента'}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group focus:outline-none z-10"
              style={{
                left: m.coords.x,
                top: m.coords.y,
              }}
            >
              <div className="relative">
                {/* Photo Container: Clean 44px circular miniature */}
                <div className="w-11 h-11 rounded-[22px] overflow-hidden bg-[#120F1C] border-[1.5px] border-white/80 shadow-[0_3px_10px_rgba(0,0,0,0.55)] group-hover:scale-110 group-hover:border-white active:scale-95">
                  {hasDuo ? (
                    /* Split duo view when both partners uploaded */
                    <div className="flex w-full h-full select-none pointer-events-none">
                      <img
                        src={m.primaryPhotoUrl!}
                        alt={m.title}
                        loading="lazy"
                        decoding="async"
                        className="w-1/2 h-full object-cover border-r border-white/70"
                      />
                      <img
                        src={m.secondaryPhotoUrl!}
                        alt={m.title}
                        loading="lazy"
                        decoding="async"
                        className="w-1/2 h-full object-cover"
                      />
                    </div>
                  ) : (
                    /* Single photo view */
                    <img
                      src={m.primaryPhotoUrl!}
                      alt={m.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover select-none pointer-events-none"
                    />
                  )}

                </div>

                {/* Star glint indicator badge in the corner */}
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#181524] border border-white/40 flex items-center justify-center shadow-xs pointer-events-none">
                  <span className="text-[8px] text-[#FFEED8] leading-none">⭐</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Floating Viewport Navigation & «К своим звёздам» Controls */}
      <div className="absolute bottom-3 left-3 pointer-events-auto">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const minScale = calculateMinScale();
            const overviewScale = Math.max(minScale, Math.min(0.85, minScale * 1.15));
            centerOnMoments(overviewScale);
            triggerHaptic(true);
            playSoftChime('tap', true);
          }}
          className="h-8 px-3 rounded-full bg-[#141224]/85 backdrop-blur-md border border-[#FFF4E8]/15 flex items-center gap-1.5 text-[11px] font-medium text-white/90 hover:text-white hover:bg-white/15 active:scale-95 transition-all shadow-sm cursor-pointer"
          title="К своим звёздам"
          aria-label="Центрировать карту на звёздах пары"
        >
          <Sparkles size={12} className="text-[#E98787]" />
          <span>К своим звёздам</span>
        </button>
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 p-1 rounded-full bg-[#141224]/85 backdrop-blur-md border border-[#FFF4E8]/15 shadow-sm pointer-events-auto">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleZoom(-0.2);
          }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[#B8B2C8] hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          title="Уменьшить"
          aria-label="Уменьшить масштаб карты"
        >
          <Minus size={13} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const minScale = calculateMinScale();
            const overviewScale = Math.max(minScale, Math.min(0.85, minScale * 1.15));
            centerOnMoments(overviewScale);
            triggerHaptic(true);
          }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[#E98787] hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          title="Вся карта"
          aria-label="Показать всю карту"
        >
          <Compass size={13} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleZoom(0.2);
          }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[#B8B2C8] hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          title="Приблизить"
          aria-label="Приблизить масштаб карты"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Floating Info Tooltip for Stars without Photos */}
      {selectedStar && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3 inset-x-3 max-w-[320px] mx-auto p-3 rounded-2xl bg-[#141224]/92 backdrop-blur-lg border border-[#FFF4E8]/20 shadow-lg text-left animate-in fade-in zoom-in-95 duration-200 pointer-events-auto z-50"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/10 border border-[#FFF4E8]/20 flex items-center justify-center text-[#FFEED8] shrink-0">
                {selectedStar.isLocked ? (
                  <Lock size={12} className="text-[#E98787]" />
                ) : (
                  <span className="text-xs">⭐</span>
                )}
              </div>
              <div>
                <h5 className="text-xs font-semibold text-white leading-tight">
                  {selectedStar.title}
                </h5>
                <p className="text-[10px] text-[#A9A1B8] leading-tight mt-0.5">
                  {selectedStar.formattedDate}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedStar(null)}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[#A9A1B8] hover:text-white active:scale-95 cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>

          <div className="mt-2 text-[11px] text-[#D4CEE0] leading-snug">
            {selectedStar.isLocked ? (
              <div className="flex items-center justify-between gap-2 mt-1">
                <span>Воспоминание старше 7 дней сохранено навсегда</span>
                {onOpenLockedMoment && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStar(null);
                      onOpenLockedMoment();
                    }}
                    className="px-2.5 py-1 rounded-full bg-[#E98787] text-white text-[10px] font-medium hover:bg-[#DE7676] active:scale-95 transition-all shrink-0 cursor-pointer"
                  >
                    Открыть
                  </button>
                )}
              </div>
            ) : (
              <span>Касание зажгло звезду в вашем общем небе ✨</span>
            )}
          </div>
        </div>
      )}

      {/* 3. Centered Compact Square Photo Preview Modal */}
      {previewMoment && previewMoment.primaryPhotoUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр фотографии"
          onClick={closePhotoPreview}
          className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[3px] animate-in fade-in duration-200 pointer-events-auto select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-[78vw] max-w-[340px] sm:max-w-[380px] aspect-square rounded-[28px] bg-[#12101C] border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden flex items-center justify-center animate-in zoom-in-90 fade-in duration-200 ease-out shrink-0"
          >
            {/* Close button in top-right */}
            <button
              type="button"
              onClick={closePhotoPreview}
              aria-label="Закрыть"
              className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/90 hover:text-white hover:bg-black/70 active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              <X size={15} />
            </button>

            {/* Photo content: strict 1:1 square, object-cover filling entire container without letterboxing */}
            <div className="w-full h-full relative overflow-hidden bg-[#0D0B16]">
              {previewMoment.secondaryPhotoUrl ? (
                <div className="flex w-full h-full items-center justify-center">
                  <img
                    src={previewMoment.primaryPhotoUrl}
                    alt=""
                    className="w-1/2 h-full object-cover object-center border-r border-white/20 block"
                  />
                  <img
                    src={previewMoment.secondaryPhotoUrl}
                    alt=""
                    className="w-1/2 h-full object-cover object-center block"
                  />
                </div>
              ) : (
                <img
                  src={previewMoment.primaryPhotoUrl}
                  alt=""
                  className="w-full h-full object-cover object-center block"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

