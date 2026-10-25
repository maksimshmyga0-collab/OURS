import { Moment, HistoryDay, CoupleState, OurDayPhoto } from '../../types';
import { appStorage } from '../storage/keyValueStorage';
import { extractStarDateKey, isMomentMatched, StarEvent } from './skyService';
import { formatRussianDate, getLocalDateKey } from '../moments/momentTiming';

export interface CelestialCoordinate {
  x: number;
  y: number;
}

export interface SkyCelestialMoment {
  id: string; // canonical key: `match_${dateKey}` or `date_${dateKey}`
  dateKey: string; // 'YYYY-MM-DD'
  formattedDate: string; // e.g. '24 октября 2026'
  starType: 'moment' | 'date'; // 'moment' (Match ⭐) | 'date' (Date ✨)
  title: string;
  momentId?: string;
  primaryPhotoUrl: string | null;
  secondaryPhotoUrl: string | null; // e.g. partner's photo if both uploaded
  authorName?: string;
  hasPhoto: boolean;
  isLocked: boolean;
  isNewest?: boolean;
  coords: CelestialCoordinate;
}

export interface CelestialConstellationLine {
  fromId: string;
  toId: string;
  from: CelestialCoordinate;
  to: CelestialCoordinate;
  isLit: boolean;
}

const SKY_MAP_STORAGE_PREFIX = 'ours_sky_map_coords_v1_';

export const MAP_VIRTUAL_WIDTH = 1200;
export const MAP_VIRTUAL_HEIGHT = 1000;
const MAP_PADDING = 90;
const MIN_DISTANCE_BETWEEN_MOMENTS = 78; // Ensures 44px thumbnails have >= 34px clear cosmic space

// --------------------------------------------------------------------------
// DETERMINISTIC PSEUDO-RANDOM NUMBER GENERATOR
// --------------------------------------------------------------------------
function murmurhash3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// --------------------------------------------------------------------------
// GEOMETRY HELPERS
// --------------------------------------------------------------------------
function ccw(p1: CelestialCoordinate, p2: CelestialCoordinate, p3: CelestialCoordinate): number {
  return (p3.y - p1.y) * (p2.x - p1.x) - (p2.y - p1.y) * (p3.x - p1.x);
}

function segmentsCross(
  p1: CelestialCoordinate,
  p2: CelestialCoordinate,
  p3: CelestialCoordinate,
  p4: CelestialCoordinate
): boolean {
  if (
    (Math.abs(p1.x - p3.x) < 0.001 && Math.abs(p1.y - p3.y) < 0.001) ||
    (Math.abs(p1.x - p4.x) < 0.001 && Math.abs(p1.y - p4.y) < 0.001) ||
    (Math.abs(p2.x - p3.x) < 0.001 && Math.abs(p2.y - p3.y) < 0.001) ||
    (Math.abs(p2.x - p4.x) < 0.001 && Math.abs(p2.y - p4.y) < 0.001)
  ) {
    return false;
  }
  const d1 = ccw(p1, p2, p3);
  const d2 = ccw(p1, p2, p4);
  const d3 = ccw(p3, p4, p1);
  const d4 = ccw(p3, p4, p2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function distToSegment(
  p: CelestialCoordinate,
  v: CelestialCoordinate,
  w: CelestialCoordinate
): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  return Math.hypot(p.x - projX, p.y - projY);
}

// --------------------------------------------------------------------------
// PHOTO RESOLUTION FROM EXISTING ARCHITECTURE
// --------------------------------------------------------------------------
function isDateMomentObj(moment: Moment): boolean {
  if (!moment) return false;
  return Boolean(
    moment.isDate ||
      (typeof moment.id === 'string' &&
        (moment.id.startsWith('date-') || moment.id.startsWith('date_'))) ||
      moment.label === 'СВИДАНИЕ' ||
      (typeof moment.prompt === 'string' && moment.prompt.startsWith('Свидание'))
  );
}

function resolvePhotoPairForDate(
  dateKey: string,
  starType: 'moment' | 'date',
  history: HistoryDay[] = [],
  todayMoments: Moment[] = [],
  ourDayPhotos: OurDayPhoto[] = [],
  currentUserId?: string
): {
  primaryPhotoUrl: string | null;
  secondaryPhotoUrl: string | null;
  isLocked: boolean;
  momentTitle?: string;
  momentId?: string;
} {
  const todayKey = getLocalDateKey();
  let primaryPhotoUrl: string | null = null;
  let secondaryPhotoUrl: string | null = null;
  let isLocked = false;
  let momentTitle: string | undefined;
  let resolvedMomentId: string | undefined;

  // 1. Check Today's Moments
  if (dateKey === todayKey && Array.isArray(todayMoments)) {
    if (starType === 'moment') {
      const touchM = todayMoments.find((m) => m && !isDateMomentObj(m) && isMomentMatched(m));
      if (touchM) {
        resolvedMomentId = touchM.id;
        momentTitle = touchM.prompt || 'Касание';
        const uPhoto = touchM.userPhoto || (touchM.photos && touchM.photos[0]?.imageUrl);
        const pPhoto = touchM.partnerPhoto || (touchM.photos && touchM.photos[1]?.imageUrl);
        if (uPhoto && pPhoto) {
          primaryPhotoUrl = uPhoto;
          secondaryPhotoUrl = pPhoto;
        } else {
          primaryPhotoUrl = uPhoto || pPhoto || touchM.imageUrl || null;
        }
      }
    } else {
      const dateM = todayMoments.find((m) => m && isDateMomentObj(m));
      if (dateM) {
        resolvedMomentId = dateM.id;
        momentTitle = dateM.prompt || 'Свидание';
        primaryPhotoUrl = dateM.imageUrl || dateM.userPhoto || dateM.partnerPhoto || (dateM.photos && dateM.photos[0]?.imageUrl) || null;
      }
    }
  }

  // 2. Check History Days
  if (!primaryPhotoUrl && Array.isArray(history)) {
    const day = history.find((d) => d && (d.dateKey === dateKey || d.id === `day-${dateKey}` || d.id === `hist-${dateKey}`));
    if (day) {
      if (day.isLocked) {
        isLocked = true;
      }

      if (Array.isArray(day.moments)) {
        if (starType === 'moment') {
          const matchM = day.moments.find((m) => m && !isDateMomentObj(m) && isMomentMatched(m));
          if (matchM) {
            resolvedMomentId = matchM.id;
            momentTitle = matchM.prompt || 'Касание';
            if (!isLocked) {
              const uPhoto = matchM.userPhoto || (matchM.photos && matchM.photos[0]?.imageUrl);
              const pPhoto = matchM.partnerPhoto || (matchM.photos && matchM.photos[1]?.imageUrl);
              if (uPhoto && pPhoto) {
                primaryPhotoUrl = uPhoto;
                secondaryPhotoUrl = pPhoto;
              } else {
                primaryPhotoUrl = uPhoto || pPhoto || matchM.imageUrl || null;
              }
            }
          }
        } else {
          const dateM = day.moments.find((m) => m && isDateMomentObj(m));
          if (dateM) {
            resolvedMomentId = dateM.id;
            momentTitle = dateM.prompt || 'Свидание';
            if (!isLocked) {
              primaryPhotoUrl = dateM.imageUrl || dateM.userPhoto || dateM.partnerPhoto || (dateM.photos && dateM.photos[0]?.imageUrl) || null;
            }
          }
        }
      }
    }
  }

  // 3. Check "Наш день" (OUR_DAY) photos fallback
  if (!primaryPhotoUrl && !isLocked && Array.isArray(ourDayPhotos)) {
    const matchingOurDay = ourDayPhotos.filter((p) => {
      if (!p || typeof p.imageUrl !== 'string' || !p.imageUrl.trim() || p.imageUrl.startsWith('blob:')) return false;
      const dKey = extractStarDateKey(p.dateKey, p.createdAt);
      return dKey === dateKey;
    });

    if (matchingOurDay.length > 0) {
      if (matchingOurDay.length >= 2) {
        primaryPhotoUrl = matchingOurDay[0].imageUrl;
        secondaryPhotoUrl = matchingOurDay[1].imageUrl;
      } else {
        primaryPhotoUrl = matchingOurDay[0].imageUrl;
      }
      if (!momentTitle) momentTitle = 'Наш день';
    }
  }

  return {
    primaryPhotoUrl,
    secondaryPhotoUrl,
    isLocked,
    momentTitle,
    momentId: resolvedMomentId,
  };
}

// --------------------------------------------------------------------------
// DETERMINISTIC COORDINATE RETRIEVAL & GROWING CELESTIAL PLACEMENT
// --------------------------------------------------------------------------
function loadStoredCoordinates(pairKey: string): Record<string, CelestialCoordinate> {
  const cleanKey = (pairKey || 'default').trim().toLowerCase();
  try {
    const raw = appStorage.getItem(`${SKY_MAP_STORAGE_PREFIX}${cleanKey}`);
    if (typeof raw === 'string' && raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const validCoords: Record<string, CelestialCoordinate> = {};
        for (const [id, pt] of Object.entries(parsed)) {
          if (
            pt &&
            typeof pt === 'object' &&
            typeof (pt as any).x === 'number' &&
            typeof (pt as any).y === 'number' &&
            Number.isFinite((pt as any).x) &&
            Number.isFinite((pt as any).y)
          ) {
            validCoords[id] = {
              x: Math.round((pt as any).x * 10) / 10,
              y: Math.round((pt as any).y * 10) / 10,
            };
          }
        }
        return validCoords;
      }
    }
  } catch {
    // fallback
  }
  return {};
}

function saveStoredCoordinates(pairKey: string, coords: Record<string, CelestialCoordinate>): void {
  const cleanKey = (pairKey || 'default').trim().toLowerCase();
  try {
    appStorage.setItem(`${SKY_MAP_STORAGE_PREFIX}${cleanKey}`, JSON.stringify(coords));
  } catch {
    // ignore
  }
}

/**
 * Assigns or retrieves stable coordinates for all celestial moments.
 * Rules strictly followed:
 * - Existing moments never shift or change their coordinates.
 * - Adding a new moment never shifts older moments.
 * - Initial placement is unique to the pairSeed and moment ID (murmurhash3).
 * - Organic, non-grid, asymmetrical celestial branching.
 * - Keeps >= MIN_DISTANCE_BETWEEN_MOMENTS to eliminate collisions.
 */
export function buildCelestialMomentsWithCoordinates(
  pairSeed: string,
  events: StarEvent[],
  history: HistoryDay[] = [],
  todayMoments: Moment[] = [],
  ourDayPhotos: OurDayPhoto[] = [],
  currentUserId?: string
): {
  moments: SkyCelestialMoment[];
  lines: CelestialConstellationLine[];
} {
  const cleanSeed = (pairSeed || 'ours').trim().toLowerCase();
  const storedCoords = loadStoredCoordinates(cleanSeed);
  const activeCoords: Record<string, CelestialCoordinate> = { ...storedCoords };
  let needsStorageSave = false;

  // STRICTLY FILTER OUT DATE STARS:
  // Date stars are temporarily hidden; we only display couple moment stars and photo points
  const nonDateEvents = events.filter((ev) => ev.starType !== 'date');

  // Sort events chronologically so the celestial map expands naturally from origin outwards
  const sortedEvents = [...nonDateEvents].sort((a, b) => {
    const cmp = a.dateKey.localeCompare(b.dateKey);
    if (cmp !== 0) return cmp;
    if (a.starType === b.starType) return a.id.localeCompare(b.id);
    return a.starType === 'moment' ? -1 : 1;
  });

  const placedPoints: Array<{ id: string; x: number; y: number }> = [];

  // Seed placedPoints from existing coordinates
  for (const ev of sortedEvents) {
    if (activeCoords[ev.id]) {
      placedPoints.push({ id: ev.id, ...activeCoords[ev.id] });
    }
  }

  // Place missing moments organically
  for (let idx = 0; idx < sortedEvents.length; idx++) {
    const ev = sortedEvents[idx];
    if (activeCoords[ev.id]) continue; // Already has permanent stable coordinate

    const prng = murmurhash3(`${cleanSeed}_celestial_coord_${ev.id}`);
    let newPt: CelestialCoordinate | null = null;

    if (placedPoints.length === 0) {
      // First moment: placed gracefully near celestial core with pair-seeded offset
      const cx = MAP_VIRTUAL_WIDTH / 2;
      const cy = MAP_VIRTUAL_HEIGHT / 2;
      const ox = (prng() - 0.5) * 120;
      const oy = (prng() - 0.5) * 120;
      newPt = {
        x: Math.round((cx + ox) * 10) / 10,
        y: Math.round((cy + oy) * 10) / 10,
      };
    } else {
      // Natural organic branching: place in free space near existing constellation cluster
      let bestCandidate: CelestialCoordinate | null = null;
      let maxSpacingScore = -Infinity;

      for (let attempt = 0; attempt < 240; attempt++) {
        // Pick an anchor from recent 4 points or random placed point
        const anchorIdx = Math.max(0, placedPoints.length - 1 - Math.floor(prng() * Math.min(placedPoints.length, 5)));
        const anchor = placedPoints[anchorIdx];

        const angle = prng() * Math.PI * 2;
        const dist = MIN_DISTANCE_BETWEEN_MOMENTS + prng() * 95; // 78px to ~173px
        const candX = Math.round((anchor.x + Math.cos(angle) * dist) * 10) / 10;
        const candY = Math.round((anchor.y + Math.sin(angle) * dist) * 10) / 10;

        // Verify boundary limits
        if (
          candX < MAP_PADDING ||
          candX > MAP_VIRTUAL_WIDTH - MAP_PADDING ||
          candY < MAP_PADDING ||
          candY > MAP_VIRTUAL_HEIGHT - MAP_PADDING
        ) {
          continue;
        }

        // Verify non-collision with all already placed moments
        let tooClose = false;
        let minDistToOthers = Infinity;
        for (const p of placedPoints) {
          const d = Math.hypot(p.x - candX, p.y - candY);
          if (d < MIN_DISTANCE_BETWEEN_MOMENTS) {
            tooClose = true;
            break;
          }
          if (d < minDistToOthers) minDistToOthers = d;
        }

        if (!tooClose) {
          // Score: prefer good spacing (not squeezed against min boundary)
          const score = minDistToOthers;
          if (score > maxSpacingScore) {
            maxSpacingScore = score;
            bestCandidate = { x: candX, y: candY };
            if (minDistToOthers >= MIN_DISTANCE_BETWEEN_MOMENTS + 25) {
              // Excellent candidate found, break early
              break;
            }
          }
        }
      }

      if (bestCandidate) {
        newPt = bestCandidate;
      } else {
        // Safe fallback in wide area
        const candX = MAP_PADDING + prng() * (MAP_VIRTUAL_WIDTH - MAP_PADDING * 2);
        const candY = MAP_PADDING + prng() * (MAP_VIRTUAL_HEIGHT - MAP_PADDING * 2);
        newPt = {
          x: Math.round(candX * 10) / 10,
          y: Math.round(candY * 10) / 10,
        };
      }
    }

    activeCoords[ev.id] = newPt;
    placedPoints.push({ id: ev.id, ...newPt });
    needsStorageSave = true;
  }

  if (needsStorageSave) {
    saveStoredCoordinates(cleanSeed, activeCoords);
  }

  // Assemble full SkyCelestialMoment objects
  const moments: SkyCelestialMoment[] = sortedEvents.map((ev, index) => {
    const coords = activeCoords[ev.id] || {
      x: MAP_VIRTUAL_WIDTH / 2,
      y: MAP_VIRTUAL_HEIGHT / 2,
    };

    const photoRes = resolvePhotoPairForDate(
      ev.dateKey,
      ev.starType,
      history,
      todayMoments,
      ourDayPhotos,
      currentUserId
    );

    const hasPhoto = Boolean(photoRes.primaryPhotoUrl);
    const title = photoRes.momentTitle || ev.title || (ev.starType === 'date' ? 'Свидание' : 'Касание');
    const isNewest = index === sortedEvents.length - 1;

    return {
      id: ev.id,
      dateKey: ev.dateKey,
      formattedDate: formatRussianDate(ev.dateKey),
      starType: ev.starType,
      title,
      momentId: photoRes.momentId || ev.momentId,
      primaryPhotoUrl: photoRes.primaryPhotoUrl,
      secondaryPhotoUrl: photoRes.secondaryPhotoUrl,
      hasPhoto,
      isLocked: photoRes.isLocked,
      isNewest,
      coords,
    };
  });

  // Assemble gossamer constellation connecting threads
  const lines: CelestialConstellationLine[] = [];
  const degrees: Record<string, number> = {};

  const countCrossings = (pA: CelestialCoordinate, pB: CelestialCoordinate): number => {
    let crossings = 0;
    for (const l of lines) {
      if (segmentsCross(pA, pB, l.from, l.to)) {
        crossings++;
      }
    }
    return crossings;
  };

  const passesThroughExistingPoint = (pA: CelestialCoordinate, pB: CelestialCoordinate, excludeIdA: string, excludeIdB: string): boolean => {
    for (const m of moments) {
      if (m.id === excludeIdA || m.id === excludeIdB) continue;
      if (distToSegment(m.coords, pA, pB) < 22) {
        return true;
      }
    }
    return false;
  };

  for (let i = 1; i < moments.length; i++) {
    const curr = moments[i];
    let chosenTargetId: string | null = null;
    let minCandidateDist = Infinity;

    // Connect to closest preceding moment without line crossings
    for (let j = 0; j < i; j++) {
      const prev = moments[j];
      const d = Math.hypot(prev.coords.x - curr.coords.x, prev.coords.y - curr.coords.y);
      if (d > 260) continue; // Keep lines clean and delicate

      if (countCrossings(prev.coords, curr.coords) === 0 && !passesThroughExistingPoint(prev.coords, curr.coords, curr.id, prev.id)) {
        if (d < minCandidateDist) {
          minCandidateDist = d;
          chosenTargetId = prev.id;
        }
      }
    }

    if (chosenTargetId) {
      const targetMoment = moments.find((m) => m.id === chosenTargetId);
      if (targetMoment) {
        lines.push({
          fromId: chosenTargetId,
          toId: curr.id,
          from: targetMoment.coords,
          to: curr.coords,
          isLit: true,
        });
        degrees[chosenTargetId] = (degrees[chosenTargetId] || 0) + 1;
        degrees[curr.id] = (degrees[curr.id] || 0) + 1;
      }
    }
  }

  return { moments, lines };
}
