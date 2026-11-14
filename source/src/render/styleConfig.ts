/**
 * Art-style knobs in one place (watercolor + ink look, seasons, time of day). Data only, no logic.
 * Tweak a number here and only the look changes; nothing else in the game needs touching.
 *
 *  - PAINT: the full-screen watercolor/ink pass (src/render/stylize.ts), per quality tier.
 *  - MATERIAL: hand-painted surface washes + flat toon light on 3D objects (src/render/paintMaterials.ts).
 *  - PERIOD_LOOK: time-of-day changes to the paint (night = thinner ink, darker paper, …).
 *  - SEASON_LOOK: season changes to sky, fog, sea, grass and grading. Orchid Island is tropical:
 *    no snow ever. Summer (flying-fish season) = clear and vivid turquoise; winter (northeast monsoon)
 *    = grey overcast, cooler colours, rougher darker sea, vegetation still green.
 * Colours are hex strings; "mix" pairs are [colour, amount 0..1].
 */
import type { Period, Season } from '../core/timeSeason';

export type Mix = [string, number];

export const PAINT = {
  ink: '#3a2a1e',            // dark-brown ink (fine pen line like the target)
  paper: '#f7f0e2',          // light warm-cream paper
  paperTint: 0.04,           // how much the paper colour tints the whole image
  lineWidth: { high: 0.75, mobile: 0.7 }, // CSS px (fine pen line)
  line: 0.8,                 // ink contour strength
  silhouette: [0.02, 0.06] as [number, number], // depth-jump thresholds (lower = more contours)
  crease: [0.004, 0.014] as [number, number],
  creaseStrength: 0.8,
  inkFade: [80, 190] as [number, number],    // far contours dissolve into the wash (world units)
  wobble: 1.4,               // CSS px pigment bleed (soft colour edges)
  band: 0.35,                // value banding (washes)
  pool: 0.4,                 // edge darkening
  grain: 0.12,
  wash: 0.08,
  hatch: 0.3,                // light hatching in shadows (high tier only)
  lift: 0.0,                 // (kept 0: lifting darks toward white read as haze)
  airy: 0.0,                 // (kept 0: no veil)
  simplify: 0.0,             // soften fine texture detail (0 = none)
  tiltShift: 0.25,           // diorama blur multiplier in this style (a painting is sharp edge to edge)
  /** crisp air: fog distances multiplied, bloom and vignette reduced in this style */
  fogScale: 3.0,
  bloom: 0.35,
  vignette: 0.08,
  /** shadow tint: darker tones lean blue-violet instead of black (multiplier, amount by darkness) */
  shadowTint: '#c9c6ee',
  shadowTintK: 0.55,
  /**
   * Palette sampled from art-src/style-ref/target_watercolor_ink.jpg (2026-11-14). Each pixel's hue is pulled
   * toward the nearest target colours; paletteK = how much, paletteValue = how much the brightness follows too.
   */
  palette: [
    '#3f87b8', // open sea blue (v2 blue, Larry's pick)
    '#62b2b8', // sea mid (turquoise)
    '#9fd4c8', // sea shallow
    '#ecd49c', // sand cream
    '#9cbc8e', // soft grass green
    '#86683e', // warm wood brown
    '#b3ad9e', // light warm-grey stone
    '#6f7a86', // slate roof / shadowed stone
  ],
  paletteK: 0.45,
  paletteValue: 0.1,
  paletteSigma: 0.35,
};

/** painted sea (src/world/water.ts, watercolor style) */
export const WATER = {
  streak: 0.11,              // opacity of the light wind/wave streaks
  streakWidth: 0.008,        // streak thickness (smaller = thinner; ~hairline)
};

/**
 * Building / prop albedo (the real surface colours, used by world/textures.ts and world/buildings.ts in both
 * styles). Tuned toward the target painting: light warm-grey stone, warm mid-brown wood and thatch,
 * soft slate-blue roofs. Lighter colours here, not an overlay, so the air stays crisp.
 */
export const BUILDING_ALBEDO = {
  stoneMortar: '#77716a',
  stoneBlocks: ['#aaa498', '#9a9388', '#b5ae9f', '#928b81', '#bdb5a5', '#a39b8e'],
  thatchDark: '#7a6444',     // the dark layered 茅草 (was #4b3f30)
  thatchLight: '#ad9160',
  woodDark: '#7a5a3c', wood: '#9c7449', woodPale: '#bb9767', woodInside: '#8f6a45',
  stone: '#f6f2ea', stoneDark: '#c8c1b4', thatchTint: '#f2e9d8',
  roofBlue: '#5b90bd', roofGrey: '#8f9dae', concrete: '#bab5aa',
};

export const MATERIAL = {
  /** world-space wash noise: scale in world units, strength of the blotches */
  washScale: 9.0,
  washStrength: { high: 0.14, mobile: 0.1 },
  /** fine pigment granulation */
  grainScale: 1.6,
  grainStrength: 0.05,
  /** flat toon light: 0 = normal smooth light, 1 = two flat tones (lit / shadow) */
  toon: 0.75,
  toonEdge: [0.18, 0.32] as [number, number],
  shadowTone: 0.6,          // brightness of the shadow tone relative to lit (gentle shadows)
  shadowColor: '#b8bdf0',    // shadow side leans blue-violet
};

/** bright: overall brightness multiplier; glow: soft halo around characters (0 = off) */
export interface PeriodPaint { ink: number; paperTint: number; lift: number; hatch: number; airy: number; bright: number; glow: number; palette: number }
export const PERIOD_LOOK: Record<Period, PeriodPaint> = {
  dawn:  { ink: 0.95, paperTint: 0.05, lift: 0, hatch: 1.0, airy: 0, bright: 1.0, glow: 0, palette: 0.6 },
  day:   { ink: 1.0,  paperTint: 0.06, lift: 0, hatch: 1.0, airy: 0, bright: 1.08, glow: 0, palette: 1.0 },
  dusk:  { ink: 0.95, paperTint: 0.03, lift: 0, hatch: 1.0, airy: 0, bright: 1.0, glow: 0.25, palette: 0.4 },
  night: { ink: 0.7,  paperTint: 0.0,  lift: 0, hatch: 0.15, airy: 0, bright: 1.05, glow: 1, palette: 0.15 },
};

export type SeasonKind = 'summer' | 'autumn' | 'winter';
/** which look each Tao season uses */
export const SEASON_KIND: Record<Season, SeasonKind> = {
  meyvanwa: 'summer',     // 招魚祭 (early spring, already clear)
  rayon: 'summer',        // 飛魚季
  manoyotoyon: 'autumn',  // 終食祭
  off: 'winter',          // 休漁期, northeast monsoon
};

export interface SeasonLook {
  zenith: Mix; horizon: Mix; cloud: number;          // sky
  fog: Mix;                                          // fog / background
  sunMul: number; hemiMul: number;                   // light (overcast = softer sun)
  waterDeep: Mix; waterShallow: Mix; wave: number;   // sea
  grass: [number, number, number];                   // terrain grass tint (multiplier)
  sat: number; warm: number;                         // final grade
}
export const SEASON_LOOK: Record<SeasonKind, SeasonLook> = {
  summer: {
    zenith: ['#2f8fe0', 0.25], horizon: ['#d8f1fa', 0.2], cloud: 0.3,
    fog: ['#d4eef6', 0.1],
    sunMul: 1.12, hemiMul: 1.0,
    waterDeep: ['#3a82b8', 0.45], waterShallow: ['#52dccb', 0.45], wave: 0.85,
    grass: [1.02, 1.06, 0.95],
    sat: 1.0, warm: 0.06,
  },
  autumn: {
    zenith: ['#5d93c4', 0.15], horizon: ['#f0dcc0', 0.15], cloud: 0.55,
    fog: ['#e6d2b8', 0.12],
    sunMul: 0.95, hemiMul: 1.0,
    waterDeep: ['#3f8fbf', 0.5], waterShallow: ['#7fd8c8', 0.4], wave: 1.15,
    grass: [1.1, 1.03, 0.82],
    sat: 1.04, warm: 0.15,
  },
  winter: {
    zenith: ['#8a99a6', 0.5], horizon: ['#c9d0d4', 0.4], cloud: 1.0,
    fog: ['#b7c1c8', 0.15],
    sunMul: 0.7, hemiMul: 1.1,
    waterDeep: ['#34627a', 0.5], waterShallow: ['#6aa8a8', 0.5], wave: 2.0,
    grass: [0.88, 0.98, 0.96],
    sat: 0.95, warm: 0,
  },
};

/** Night halo around player characters and NPCs (sprites), scaled by PERIOD_LOOK.glow. */
export const CHARACTER_GLOW = {
  color: '#ffe9c4',          // warm lantern-like light
  strength: 0.14,            // halo opacity at glow = 1 (keep subtle)
  px: 1.6,                   // halo width in sprite texels
  rim: 0.08,                 // slight brightening of the sprite itself at glow = 1
};
