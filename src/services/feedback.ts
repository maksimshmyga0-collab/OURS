/**
 * Subtle feedback service for Web Prototype
 * Provides soft Web Audio acoustic chimes and visual haptic feedback simulation.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function playSoftChime(type: 'tap' | 'match' | 'react' | 'success', enabled: boolean = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (type === 'tap') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  } else if (type === 'react') {
    // Gentle melodic 2-note chime
    const notes = [523.25, 659.25]; // C5, E5
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * 0.08);

      gain.gain.setValueAtTime(0.06, now + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + index * 0.08);
      osc.stop(now + index * 0.08 + 0.3);
    });
  } else if (type === 'match') {
    // Warm, delicate, celestial chime (soft harmonious bloom for the two stars connecting)
    const freqs = [440.0, 554.37, 659.25, 880.0]; // A4, C#5, E5, A5 (warm major chord)
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.035);

      // Soft progressive attack (15ms) to prevent any click/pop, followed by gentle exponential decay
      const startTime = now + idx * 0.035;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.035 / (idx * 0.2 + 1), startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.75);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.8);
    });
  } else if (type === 'success') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  }
}

export function triggerHaptic(enabled: boolean = true) {
  if (!enabled) return;
  // If navigator.vibrate is available, call it briefly
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(15);
    } catch {
      // ignore
    }
  }
}

/**
 * Soft whispery paper unsealing + warm crystalline chime
 */
export function playEnvelopeOpenSound(enabled: boolean = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  // 1. Soft paper friction release (filtered whisper noise or rapid soft downward sine sweep)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(420, now);
  osc1.frequency.exponentialRampToValueAtTime(180, now + 0.12);
  gain1.gain.setValueAtTime(0.001, now);
  gain1.gain.exponentialRampToValueAtTime(0.035, now + 0.02);
  gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.19);

  // 2. Gentle magical harmonic resonance
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const startT = now + 0.08 + idx * 0.05;
    osc.frequency.setValueAtTime(freq, startT);
    gain.gain.setValueAtTime(0.0001, startT);
    gain.gain.exponentialRampToValueAtTime(0.03 / (idx + 1), startT + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startT + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startT);
    osc.stop(startT + 0.48);
  });
}

/**
 * Tactile paper glide as card slides out of envelope
 */
export function playCardSlideSound(enabled: boolean = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.16); // up to D5
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.032, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.32);
}

/**
 * Warm celebratory romantic bloom when invite is sent
 */
export function playInviteSentSound(enabled: boolean = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const arpeggio = [440, 554.37, 659.25, 880]; // A major
  arpeggio.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const startT = now + idx * 0.055;
    osc.frequency.setValueAtTime(freq, startT);
    gain.gain.setValueAtTime(0.001, startT);
    gain.gain.exponentialRampToValueAtTime(0.04 / (idx * 0.2 + 1), startT + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startT + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startT);
    osc.stop(startT + 0.6);
  });
}

/**
 * Subtle paper flutter / card shuffle sound
 */
export function playCardShuffleSound(enabled: boolean = true) {
  if (!enabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(480, now);
  osc.frequency.exponentialRampToValueAtTime(260, now + 0.1);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.03, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

