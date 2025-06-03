export const SPRITE_CONFIG = {
  basePath: '/frames/',
  
  // Three animation sequences with corresponding blink overlays
  sequences: {
    sequence1: ['1-1.webp', '1-2.webp', '1-3.webp', '1-4.webp', '1-5.webp'],
    sequence2: ['2-1.webp', '2-2.webp', '2-3.webp'],
    sequence3: ['3-1.webp', '3-2.webp', '3-3.webp']
  },
  
  // Blink overlays for each frame
  blinkOverlays: {
    '1-1.webp': '1-1-blink.webp',
    '1-2.webp': '1-2-blink.webp',
    '1-3.webp': '1-3-blink.webp',
    '1-4.webp': '1-4-blink.webp',
    '1-5.webp': '1-5-blink.webp',
    '2-1.webp': '2-1-blink.webp',
    '2-2.webp': '2-2-blink.webp',
    '2-3.webp': '2-3-blink.webp',
    '3-1.webp': '3-1-blink.webp',
    '3-2.webp': '3-2-blink.webp',
    '3-3.webp': '3-3-blink.webp'
  },
  
  // Default sequence
  defaultSequence: 'sequence1'
} as const;

export const ANIMATION_CONFIG = {
  blinkInterval: { min: 2000, max: 5000 },
  blinkDuration: 150,
  floatAmplitude: 5,
  floatDuration: 2000,
  frameDuration: 60 // ms per frame during speech
} as const;