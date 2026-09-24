/**
 * Curated warm photo presets for instant testing of OURS couple moments.
 * Clean, lightweight, self-contained SVG data URIs with cozy pastel aesthetics.
 */

function createSvgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

export interface PresetPhoto {
  id: string;
  title: string;
  url: string;
}

export const PRESET_PHOTOS: PresetPhoto[] = [
  {
    id: 'coffee',
    title: 'Утренний кофе',
    url: createSvgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
        <defs>
          <linearGradient id="c-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FCEEE8"/>
            <stop offset="100%" stop-color="#E9D7C8"/>
          </linearGradient>
          <linearGradient id="c-wood" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#E2CCA8"/>
            <stop offset="100%" stop-color="#C5AA82"/>
          </linearGradient>
          <filter id="soft-sh" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#4A3427" flood-opacity="0.12"/>
          </filter>
        </defs>
        <rect width="400" height="400" fill="url(#c-bg)"/>
        <!-- Table surface -->
        <path d="M0,180 Q200,165 400,180 L400,400 L0,400 Z" fill="url(#c-wood)"/>
        <!-- Morning sunlight beam -->
        <polygon points="120,0 280,0 350,400 30,400" fill="#FFFFFF" opacity="0.18"/>
        <!-- Coffee cup 1 (Ceramic White) -->
        <g filter="url(#soft-sh)">
          <ellipse cx="140" cy="275" rx="52" ry="46" fill="#FAF5EE"/>
          <ellipse cx="140" cy="275" rx="42" ry="38" fill="#805037"/>
          <ellipse cx="138" cy="274" rx="35" ry="30" fill="#603723"/>
          <!-- Latte heart foam art -->
          <path d="M138,266 C134,260 126,260 124,266 C121,274 138,284 138,284 C138,284 155,274 152,266 C150,260 142,260 138,266 Z" fill="#F4E9DC" opacity="0.9"/>
          <!-- Cup handle -->
          <path d="M88,270 C72,270 72,284 88,286" stroke="#FAF5EE" stroke-width="7" fill="none" stroke-linecap="round"/>
        </g>
        <!-- Coffee cup 2 (Soft Terracotta) -->
        <g filter="url(#soft-sh)">
          <ellipse cx="260" cy="250" rx="46" ry="40" fill="#E89B84"/>
          <ellipse cx="260" cy="250" rx="37" ry="32" fill="#6A3B28"/>
          <!-- Latte leaf foam -->
          <path d="M260,238 Q252,246 260,256 Q268,246 260,238 Z" fill="#FCECE2" opacity="0.85"/>
          <path d="M260,238 L260,258" stroke="#FCECE2" stroke-width="2"/>
          <!-- Cup handle -->
          <path d="M306,245 C320,245 320,258 306,260" stroke="#E89B84" stroke-width="6" fill="none" stroke-linecap="round"/>
        </g>
        <!-- Croissant plate -->
        <g filter="url(#soft-sh)">
          <ellipse cx="200" cy="335" rx="55" ry="30" fill="#FFFFFF" opacity="0.9"/>
          <path d="M170,332 C175,320 225,320 230,332 C220,338 180,338 170,332 Z" fill="#DFA261"/>
          <path d="M185,328 C192,322 208,322 215,328" stroke="#BF7D3A" stroke-width="3" fill="none"/>
        </g>
      </svg>
    `),
  },
  {
    id: 'park',
    title: 'Парк и солнце',
    url: createSvgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
        <defs>
          <linearGradient id="p-sky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#E8F4F8"/>
            <stop offset="60%" stop-color="#FCF3EB"/>
            <stop offset="100%" stop-color="#D9ECD9"/>
          </linearGradient>
          <radialGradient id="sun-glow" cx="80%" cy="20%" r="50%">
            <stop offset="0%" stop-color="#FFF9DF" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="#FFF9DF" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="400" height="400" fill="url(#p-sky)"/>
        <rect width="400" height="400" fill="url(#sun-glow)"/>
        <!-- Soft green hills & trees -->
        <ellipse cx="60" cy="360" rx="200" ry="110" fill="#B3D3B1"/>
        <ellipse cx="320" cy="370" rx="190" ry="100" fill="#9EC69C"/>
        <!-- Sun rays -->
        <polygon points="320,80 0,400 180,400" fill="#FFFBF0" opacity="0.15"/>
        <polygon points="320,80 160,400 360,400" fill="#FFFBF0" opacity="0.2"/>
        <!-- Couple walking silhouette holding hands -->
        <g fill="#4B4049">
          <!-- Person 1 -->
          <circle cx="185" cy="275" r="9"/>
          <path d="M178,287 C178,287 185,285 192,287 L189,325 L180,325 Z"/>
          <path d="M180,325 L178,358 L184,358 L186,325 Z"/>
          <!-- Person 2 -->
          <circle cx="215" cy="277" r="8"/>
          <path d="M208,288 C208,288 215,286 222,288 L220,324 L212,324 Z"/>
          <path d="M217,324 L219,358 L213,358 L211,324 Z"/>
          <!-- Linked hands in center -->
          <path d="M190,298 Q200,310 210,298" stroke="#4B4049" stroke-width="3" fill="none"/>
        </g>
        <!-- Flower petals in air -->
        <circle cx="90" cy="220" r="3" fill="#F4B8C5" opacity="0.8"/>
        <circle cx="140" cy="180" r="2.5" fill="#F4B8C5" opacity="0.7"/>
        <circle cx="270" cy="210" r="3.5" fill="#F4B8C5" opacity="0.8"/>
        <circle cx="310" cy="170" r="2" fill="#F4B8C5" opacity="0.6"/>
      </svg>
    `),
  },
  {
    id: 'sunset',
    title: 'Закат на крыше',
    url: createSvgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
        <defs>
          <linearGradient id="s-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#C2D6EE"/>
            <stop offset="40%" stop-color="#F6D5DC"/>
            <stop offset="70%" stop-color="#FCDBC2"/>
            <stop offset="100%" stop-color="#F9BEAA"/>
          </linearGradient>
        </defs>
        <rect width="400" height="400" fill="url(#s-grad)"/>
        <!-- Soft golden sun sinking -->
        <circle cx="200" cy="260" r="45" fill="#FFE8C4"/>
        <circle cx="200" cy="260" r="60" fill="#FFF2DC" opacity="0.4"/>
        <!-- Distant city skyline silhouette -->
        <path d="M0,320 L30,320 L30,300 L50,300 L50,320 L90,320 L90,290 L110,290 L110,320 L160,320 L160,280 L180,270 L200,280 L200,320 L260,320 L260,305 L290,305 L290,320 L330,320 L330,295 L360,295 L360,320 L400,320 L400,400 L0,400 Z" fill="#6B5364" opacity="0.3"/>
        <!-- Rooftop railing foreground -->
        <rect x="0" y="360" width="400" height="40" fill="#3B3239"/>
        <rect x="0" y="356" width="400" height="5" fill="#52444F"/>
        <!-- Vertical balusters -->
        <line x1="60" y1="356" x2="60" y2="400" stroke="#52444F" stroke-width="4"/>
        <line x1="130" y1="356" x2="130" y2="400" stroke="#52444F" stroke-width="4"/>
        <line x1="200" y1="356" x2="200" y2="400" stroke="#52444F" stroke-width="4"/>
        <line x1="270" y1="356" x2="270" y2="400" stroke="#52444F" stroke-width="4"/>
        <line x1="340" y1="356" x2="340" y2="400" stroke="#52444F" stroke-width="4"/>
        <!-- Two cocktail glasses on the ledge -->
        <path d="M150,356 L156,342 L164,342 L170,356 Z" fill="#FFF7ED" opacity="0.8"/>
        <path d="M175,356 L180,345 L188,345 L193,356 Z" fill="#FFF7ED" opacity="0.8"/>
      </svg>
    `),
  },
  {
    id: 'cozy_home',
    title: 'Домашний вечер',
    url: createSvgDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
        <defs>
          <linearGradient id="h-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#342B36"/>
            <stop offset="100%" stop-color="#231B24"/>
          </linearGradient>
          <radialGradient id="lamp" cx="50%" cy="30%" r="65%">
            <stop offset="0%" stop-color="#FFF2D6" stop-opacity="0.85"/>
            <stop offset="50%" stop-color="#EAA66E" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#231B24" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="400" height="400" fill="url(#h-bg)"/>
        <rect width="400" height="400" fill="url(#lamp)"/>
        <!-- Warm glowing lamp -->
        <ellipse cx="200" cy="110" rx="35" ry="20" fill="#FFFBE8"/>
        <polygon points="165,110 235,110 265,170 135,170" fill="#FAF1DE" opacity="0.9"/>
        <line x1="200" y1="0" x2="200" y2="100" stroke="#C4B097" stroke-width="3"/>
        <!-- Soft knitted blanket on sofa -->
        <path d="M40,280 Q200,240 360,280 L380,400 L20,400 Z" fill="#E8D5C8"/>
        <!-- Book and candle -->
        <rect x="120" y="275" width="55" height="35" rx="3" fill="#D9A595" transform="rotate(-10 120 275)"/>
        <rect x="230" y="265" width="24" height="34" rx="4" fill="#FFFFFF"/>
        <!-- Candle flame -->
        <ellipse cx="242" cy="256" rx="4" ry="7" fill="#FFAA42"/>
        <ellipse cx="242" cy="258" rx="2" ry="4" fill="#FFF7CC"/>
      </svg>
    `),
  },
];

// Helper to provide partner default photos for matching
export const PARTNER_SAMPLE_PHOTOS = [
  PRESET_PHOTOS[1].url, // park
  PRESET_PHOTOS[3].url, // cozy home
  PRESET_PHOTOS[2].url, // sunset
];
