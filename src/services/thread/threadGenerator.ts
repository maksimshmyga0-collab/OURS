/**
 * Deterministic generator for «Наша нить» (Couple Thread Artifact)
 *
 * Mathematically generates two smooth, interwoven Bezier curves symbolizing
 * the two partners. Evolves over time based on total active history, streak,
 * moments count, and couple identity seed.
 */

export interface ThreadArtifactData {
  pathA: string; // SVG path for partner A
  pathB: string; // SVG path for partner B
  intersections: Array<{ x: number; y: number; id: string; size: number }>;
  evolutionLevel: number; // 1 to 5 (e.g., Начало, Сближение, Переплетение, Глубина, Союз)
  levelName: string;
}

export interface ThreadGenerationInput {
  seed: string; // e.g. pairId or "Аня+Макс"
  totalActiveDays: number;
  currentStreak: number;
  totalMoments: number;
  duoMomentsCount: number;
  width?: number;
  height?: number;
}

/**
 * Deterministic pseudo-random number generator from integer seed
 */
function createDeterministicRandom(seedStr: string) {
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

export function generateCoupleThread(input: ThreadGenerationInput): ThreadArtifactData {
  const {
    seed,
    totalActiveDays,
    totalMoments,
    duoMomentsCount,
    width = 300,
    height = 100,
  } = input;

  const rand = createDeterministicRandom(`${seed}-${totalActiveDays}-${totalMoments}`);

  // Base parameters based on history depth
  const safeDays = Math.max(1, totalActiveDays);
  // Waves/segments count grows smoothly with active days:
  // Day 1: 3-4 segments
  // Day 7: 5-6 segments
  // Day 30: 8-9 segments
  // Day 100+: 10-12 segments
  const segmentCount = Math.min(12, Math.max(3, Math.floor(3 + Math.log2(safeDays) * 1.5)));

  // Evolution level
  let evolutionLevel = 1;
  let levelName = 'Первые шаги';
  if (safeDays >= 30) {
    evolutionLevel = 4;
    levelName = 'Глубокая связь';
  } else if (safeDays >= 14) {
    evolutionLevel = 3;
    levelName = 'Общий ритм';
  } else if (safeDays >= 5) {
    evolutionLevel = 2;
    levelName = 'Сближение';
  }

  // Amplitude of curves
  const midY = height / 2;
  const maxAmp = (height / 2) * 0.72;

  // Partner seed offsets
  const phaseA = rand() * Math.PI * 2;
  const phaseB = phaseA + Math.PI * (0.8 + rand() * 0.4); // slightly offset phase

  const dx = width / segmentCount;

  // Generate control points for Line A and Line B
  interface Point {
    x: number;
    y: number;
  }
  const pointsA: Point[] = [];
  const pointsB: Point[] = [];

  for (let i = 0; i <= segmentCount; i++) {
    const x = i * dx;
    const progress = i / segmentCount;

    // Harmonic wave frequencies
    const freq1 = (1 + segmentCount * 0.35) * Math.PI * 2;
    const freq2 = (0.5 + segmentCount * 0.2) * Math.PI * 2;

    // Intertwining factor increases with duo moments and active history
    const closeness = Math.min(1, 0.4 + (duoMomentsCount / Math.max(1, totalMoments)) * 0.6);

    const waveA =
      Math.sin(progress * freq1 + phaseA) * 0.7 +
      Math.cos(progress * freq2 + phaseA * 1.5) * 0.3;

    const waveB =
      Math.sin(progress * freq1 + phaseB) * 0.7 +
      Math.sin(progress * freq2 + phaseB * 1.2) * 0.3;

    // Dampen endpoints to center gracefully
    const envelope = Math.sin(progress * Math.PI);
    const amp = maxAmp * (0.4 + envelope * 0.6);

    // Subtle drift modulated by deterministic seed
    const driftA = (rand() - 0.5) * 6;
    const driftB = (rand() - 0.5) * 6;

    const yA = midY + waveA * amp * closeness + driftA;
    const yB = midY + waveB * amp * closeness + driftB;

    pointsA.push({ x: Number(x.toFixed(1)), y: Number(Math.max(8, Math.min(height - 8, yA)).toFixed(1)) });
    pointsB.push({ x: Number(x.toFixed(1)), y: Number(Math.max(8, Math.min(height - 8, yB)).toFixed(1)) });
  }

  // Build smooth cubic Bezier SVG paths
  function pointsToBezierPath(pts: Point[]): string {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  const pathA = pointsToBezierPath(pointsA);
  const pathB = pointsToBezierPath(pointsB);

  // Find approximate intersection nodes between Line A and Line B
  const intersections: Array<{ x: number; y: number; id: string; size: number }> = [];
  for (let i = 0; i < pointsA.length - 1; i++) {
    const diff1 = pointsA[i].y - pointsB[i].y;
    const diff2 = pointsA[i + 1].y - pointsB[i + 1].y;
    // Sign change indicates intersection
    if (diff1 * diff2 <= 0) {
      const interX = (pointsA[i].x + pointsA[i + 1].x) / 2;
      const interY = (pointsA[i].y + pointsB[i].y + pointsA[i + 1].y + pointsB[i + 1].y) / 4;
      intersections.push({
        x: Number(interX.toFixed(1)),
        y: Number(interY.toFixed(1)),
        id: `node-${i}`,
        size: 3,
      });
    }
  }

  return {
    pathA,
    pathB,
    intersections,
    evolutionLevel,
    levelName,
  };
}
