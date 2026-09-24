/**
 * Deterministic generator for «Отпечаток» (Couple Fingerprint Artifact)
 *
 * Mathematically synthesizes a unique, pure, deterministic organic fingerprint
 * artifact for each couple based on pairSeed and day-by-day history.
 *
 * Pattern A (matched day): Continuous harmonic flowing ridge / expanded structure
 * Pattern B (missed day): Breathing gap, shifted rhythm / graceful organic asymmetry
 *
 * Zero external calls, zero AI, zero Math.random() at render time.
 */

export type DayStatus = 'matched' | 'missed';

export interface FingerprintDayInput {
  date: string; // YYYY-MM-DD
  status: DayStatus;
}

export interface FingerprintLayer {
  id: string;
  dayIndex: number;
  date: string;
  status: DayStatus;
  pattern: 'A' | 'B';
  pathData: string;
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  strokeDasharray?: string;
  isLatest?: boolean;
  node?: {
    cx: number;
    cy: number;
    r: number;
    color: string;
    opacity: number;
  };
}

export interface FingerprintCorePath {
  id: string;
  pathData: string;
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
}

export interface FingerprintArtifact {
  pairSeed: string;
  viewBox: string;
  width: number;
  height: number;
  core: FingerprintCorePath[];
  layers: FingerprintLayer[];
  totalDays: number;
  matchedDays: number;
  missedDays: number;
  evolutionStage: string;
}

export interface GenerateFingerprintOptions {
  pairSeed: string;
  days: FingerprintDayInput[];
  width?: number;
  height?: number;
}

/**
 * Deterministic pseudo-random number generator (FNV-1a + LCG)
 */
export function createDeterministicRandom(seedStr: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let s = h >>> 0;

  return function next(): number {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Format a smooth cubic bezier SVG path from a sequence of 2D points
 */
function pointsToSvgPath(points: Array<{ x: number; y: number }>, closed: boolean = false): string {
  if (points.length < 2) return '';

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  if (points.length === 2) {
    d += ` L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;
    return d;
  }

  const n = points.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i % n];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    // Catmull-Rom to Cubic Bézier conversion
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;

    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  if (closed) {
    d += ' Z';
  }

  return d;
}

/**
 * Generate a complete, deterministic Fingerprint artifact for a couple
 */
export function generateFingerprint(options: GenerateFingerprintOptions): FingerprintArtifact {
  const {
    pairSeed,
    days,
    width = 320,
    height = 320,
  } = options;

  const cx = width / 2;
  const cy = height / 2;

  // Stable random stream based on pairSeed
  const seedRand = createDeterministicRandom(pairSeed);

  // Intrinsic parameters for this couple
  const tiltAngle = (seedRand() - 0.5) * 0.45; // -13° to +13° tilt
  const cosTilt = Math.cos(tiltAngle);
  const sinTilt = Math.sin(tiltAngle);
  const eccentricity = 1.08 + seedRand() * 0.16; // soft natural oval
  const baseFreq = 2 + Math.floor(seedRand() * 2); // 2 or 3 gentle lobes
  const phaseSeed = seedRand() * Math.PI * 2;

  // Maximum outer radius boundary
  const maxRadius = Math.min(width, height) * 0.44;
  const coreBaseRadius = 18;

  // Radial spacing adapts gracefully so the print never overflows
  const totalDays = days.length;
  const spacing = Math.max(3.2, Math.min(7.2, (maxRadius - coreBaseRadius) / Math.max(7, totalDays + 2)));

  // Transform polar coordinate to tilted cartesian coordinate
  const toCartesian = (r: number, theta: number) => {
    // Apply elliptical stretch along major axis
    const ex = r * Math.cos(theta);
    const ey = r * Math.sin(theta) * eccentricity;

    // Apply couple tilt rotation
    const rx = ex * cosTilt - ey * sinTilt;
    const ry = ex * sinTilt + ey * cosTilt;

    return {
      x: cx + rx,
      y: cy + ry,
    };
  };

  // -------------------------------------------------------------
  // 1. BASE KERNEL (Ядро) - Always present, symbolizes couple inception
  // -------------------------------------------------------------
  const core: FingerprintCorePath[] = [];

  // Inner loop A (User - warm signature coral)
  const corePointsA: Array<{ x: number; y: number }> = [];
  const coreRadiusA = coreBaseRadius * 0.68;
  const coreSteps = 16;
  for (let s = 0; s < coreSteps; s++) {
    const theta = (s / coreSteps) * Math.PI * 2;
    const r = coreRadiusA * (1 + 0.12 * Math.cos(theta * 2 + phaseSeed));
    corePointsA.push(toCartesian(r, theta));
  }
  core.push({
    id: 'core-a',
    pathData: pointsToSvgPath(corePointsA, true),
    strokeColor: '#E98787',
    strokeWidth: 2.2,
    strokeOpacity: 0.9,
  });

  // Inner loop B (Partner - soft mauve/rose, gently interwoven)
  const corePointsB: Array<{ x: number; y: number }> = [];
  const coreRadiusB = coreBaseRadius * 1.05;
  for (let s = 0; s < coreSteps; s++) {
    const theta = (s / coreSteps) * Math.PI * 2;
    const r = coreRadiusB * (1 + 0.1 * Math.sin(theta * 2 + phaseSeed + 0.7));
    corePointsB.push(toCartesian(r, theta + 0.35));
  }
  core.push({
    id: 'core-b',
    pathData: pointsToSvgPath(corePointsB, true),
    strokeColor: '#C9948D',
    strokeWidth: 2.0,
    strokeOpacity: 0.75,
  });

  // -------------------------------------------------------------
  // 2. DAILY LAYERS (Слои истории)
  // -------------------------------------------------------------
  const layers: FingerprintLayer[] = [];
  let matchedDays = 0;
  let missedDays = 0;

  days.forEach((day, index) => {
    const isMatched = day.status === 'matched';
    if (isMatched) matchedDays++;
    else missedDays++;

    const dayRand = createDeterministicRandom(`${pairSeed}-${day.date}-${index}`);
    const rBase = coreBaseRadius + (index + 1) * spacing;
    const dayPhase = phaseSeed + index * 0.42 + dayRand() * 0.2;
    const dayFreq = baseFreq + (index % 2 === 0 ? 1 : 0);

    const isLatest = index === days.length - 1;

    if (isMatched) {
      // ---------------------------------------------------------
      // PATTERN A: День прожит (был MATCH)
      // Smooth, flowing, continuous resonant ridge
      // ---------------------------------------------------------
      const pointCount = 28;
      const points: Array<{ x: number; y: number }> = [];

      for (let p = 0; p < pointCount; p++) {
        const theta = (p / pointCount) * Math.PI * 2;
        // Organic ripple undulation
        const wave = 0.045 * Math.sin(dayFreq * theta + dayPhase) +
                     0.025 * Math.cos((dayFreq + 1) * theta + dayPhase * 1.3);
        const r = rBase * (1 + wave);
        points.push(toCartesian(r, theta));
      }

      // Micro-node milestone along the ridge (symbolic memory point)
      const nodeAngle = dayRand() * Math.PI * 2;
      const nodePos = toCartesian(rBase, nodeAngle);

      layers.push({
        id: `layer-${index}-${day.date}`,
        dayIndex: index + 1,
        date: day.date,
        status: 'matched',
        pattern: 'A',
        pathData: pointsToSvgPath(points, true),
        strokeColor: index % 2 === 0 ? '#E98787' : '#F0B9C6',
        strokeWidth: 2.3,
        strokeOpacity: 0.88,
        isLatest,
        node: {
          cx: nodePos.x,
          cy: nodePos.y,
          r: 2.2,
          color: '#E98787',
          opacity: 0.9,
        },
      });
    } else {
      // ---------------------------------------------------------
      // PATTERN B: День пропущен (без MATCH)
      // Breathing gap / graceful organic pause in rhythm
      // NEVER punished, never red, gentle subtle presence
      // ---------------------------------------------------------
      const gapCenter = (dayRand() * Math.PI * 2);
      const gapSpan = Math.PI * (0.45 + dayRand() * 0.25); // ~80° to 120° opening
      const arcStart = gapCenter + gapSpan / 2;
      const arcEnd = gapCenter + (Math.PI * 2) - gapSpan / 2;

      const pointCount = 20;
      const points: Array<{ x: number; y: number }> = [];

      for (let p = 0; p <= pointCount; p++) {
        const t = p / pointCount;
        const theta = arcStart + t * (arcEnd - arcStart);
        // Slightly shifted phase and gentler breathing wave
        const wave = 0.035 * Math.sin((dayFreq - 1) * theta + dayPhase + 1.2);
        const r = rBase * (1 + wave);
        points.push(toCartesian(r, theta));
      }

      layers.push({
        id: `layer-${index}-${day.date}`,
        dayIndex: index + 1,
        date: day.date,
        status: 'missed',
        pattern: 'B',
        pathData: pointsToSvgPath(points, false), // Open arc with breathing gap
        strokeColor: '#9C9196', // Calm muted taupe-plum
        strokeWidth: 1.85,
        strokeOpacity: 0.55,
        strokeDasharray: index % 3 === 0 ? '6 3' : undefined,
        isLatest,
      });
    }
  });

  // Stage naming based purely on accumulated history depth
  let evolutionStage = 'Начало пути';
  if (totalDays >= 30) {
    evolutionStage = 'Глубокий отпечаток';
  } else if (totalDays >= 14) {
    evolutionStage = 'Особый ритм';
  } else if (totalDays >= 5) {
    evolutionStage = 'Сформированный след';
  } else if (totalDays >= 1) {
    evolutionStage = 'Первые следы';
  }

  return {
    pairSeed,
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    core,
    layers,
    totalDays,
    matchedDays,
    missedDays,
    evolutionStage,
  };
}
