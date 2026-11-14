import * as THREE from 'three';

export type Period = 'dawn' | 'day' | 'dusk' | 'night';
export type Season = 'meyvanwa' | 'rayon' | 'manoyotoyon' | 'off';

export const PERIODS: { id: Period; zh: string; tao: string; icon: string }[] = [
  { id: 'dawn', zh: '清晨', tao: '', icon: '◐' },
  { id: 'day', zh: '白天', tao: '', icon: '☀' },
  { id: 'dusk', zh: '黃昏', tao: '', icon: '◑' },
  { id: 'night', zh: '夜晚', tao: '', icon: '☾' },
];

export const SEASONS: { id: Season; zh: string; tao: string }[] = [
  { id: 'meyvanwa', zh: '招魚祭', tao: 'meyvanwa' },
  { id: 'rayon', zh: '飛魚季', tao: 'rayon' },
  { id: 'manoyotoyon', zh: '終食祭', tao: 'manoyotoyon' },
  { id: 'off', zh: '休漁期', tao: 'teyteyka / amian' },
];

export interface LightPreset {
  /** direction TOWARD the sun / moon (+X east, +Z south) */
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  fog: THREE.Color;
  fogNear: number;
  fogFar: number;
  zenith: THREE.Color;
  horizon: THREE.Color;
  /** warm band low on the horizon (sunrise / sunset glow) */
  glow: THREE.Color;
  waterDeep: THREE.Color;
  waterShallow: THREE.Color;
  ambientExtra: number;
  exposure: number;
  bloom: number;
}

function c(hex: string): THREE.Color {
  return new THREE.Color(hex);
}
function v(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z).normalize();
}

export const PRESETS: Record<Period, LightPreset> = {
  // sun rising over the Pacific (east, +X)
  dawn: {
    sunDir: v(0.92, 0.3, 0.18),
    sunColor: c('#ffc08a'),
    sunIntensity: 2.0,
    hemiSky: c('#ffd6c4'),
    hemiGround: c('#45503d'),
    hemiIntensity: 0.85,
    fog: c('#f1cdb9'),
    fogNear: 70,
    fogFar: 260,
    zenith: c('#7b9ccf'),
    horizon: c('#f9d3b2'),
    glow: c('#ffb07a'),
    waterDeep: c('#1d4f76'),
    waterShallow: c('#5fcac0'),
    ambientExtra: 0.2,
    exposure: 1.0,
    bloom: 0.32,
  },
  // bright, readable tropical noon
  day: {
    sunDir: v(-0.38, 0.86, 0.34),
    sunColor: c('#fff1d6'),
    sunIntensity: 2.9,
    hemiSky: c('#d6ecfb'),
    hemiGround: c('#5a6e40'),
    hemiIntensity: 1.0,
    fog: c('#cfe5ee'),
    fogNear: 90,
    fogFar: 320,
    zenith: c('#3f8fd6'),
    horizon: c('#cfe8f4'),
    glow: c('#fff3dc'),
    waterDeep: c('#0f5a8c'),
    waterShallow: c('#3fd0c0'),
    ambientExtra: 0.24,
    exposure: 1.0,
    bloom: 0.22,
  },
  // sunset over the west (−X), long warm shadows
  dusk: {
    sunDir: v(-0.94, 0.17, 0.2),
    sunColor: c('#ff9a55'),
    sunIntensity: 2.2,
    hemiSky: c('#f6a585'),
    hemiGround: c('#3b3230'),
    hemiIntensity: 0.65,
    fog: c('#d9917a'),
    fogNear: 60,
    fogFar: 240,
    zenith: c('#3a4f92'),
    horizon: c('#ffb27e'),
    glow: c('#ff7a45'),
    waterDeep: c('#1e3557'),
    waterShallow: c('#c08a78'),
    ambientExtra: 0.14,
    exposure: 1.02,
    bloom: 0.55,
  },
  // cool moonlight, warm village lanterns
  night: {
    sunDir: v(0.3, 0.72, -0.45),
    sunColor: c('#b9caff'),
    sunIntensity: 0.62,
    hemiSky: c('#33477a'),
    hemiGround: c('#141a1c'),
    hemiIntensity: 0.55,
    fog: c('#141d33'),
    fogNear: 55,
    fogFar: 220,
    zenith: c('#060a1a'),
    horizon: c('#1b2848'),
    glow: c('#2a3a66'),
    waterDeep: c('#06121f'),
    waterShallow: c('#173d52'),
    ambientExtra: 0.18,
    exposure: 1.1,
    bloom: 0.85,
  },
};

export function seasonTint(season: Season, period: Period): { grass: number; warm: number } {
  if (season === 'meyvanwa') return { grass: 0.96, warm: period === 'night' ? 0.2 : 0.05 };
  if (season === 'rayon') return { grass: 1.04, warm: 0.08 };
  if (season === 'manoyotoyon') return { grass: 1.0, warm: 0.16 };
  return { grass: 0.9, warm: 0.0 };
}
