/**
 * 0.1.4: 蘭嶼 coastline, from the public OpenStreetMap island polygon (relation 10730513;
 * data © OpenStreetMap contributors, ODbL 1.0), simplified by scripts/dev/make-outline.py.
 * Only the outline geometry is used (no map art). 11.2 game units per km, +x east, +z south,
 * centred on the polygon's bounding box (lon 121.55001, lat 22.04384). 88 points, ≈ 5729 u².
 */
export const OUTLINE_SCALE = 11.2;
export const OUTLINE_LON0 = 121.550013;
export const OUTLINE_LAT0 = 22.043844;
/** flat x, z pairs, closed implicitly */
export const LANYU_OUTLINE: readonly number[] = [-58.4, -45.6, -48.3, -36.0, -45.0, -27.3, -47.4, -23.7, -47.8, -16.9, -49.2, -17.2, -48.9, -19.6, -49.6, -17.4, -47.0, -15.7, -48.8, -14.3, -47.0, -13.8, -45.0, -9.6, -47.5, -5.3, -47.5, -2.7, -45.0, -4.5, -39.1, -3.2, -39.1, -1.4, -34.0, 4.6, -34.5, 5.5, -31.3, 5.2, -30.7, 6.8, -28.2, 7.7, -26.6, 12.9, -16.4, 23.3, -12.5, 24.2, -9.0, 22.4, -6.6, 22.6, -6.2, 21.6, -1.7, 21.8, 3.7, 23.6, 3.9, 25.0, 5.4, 25.0, 6.8, 26.8, 8.7, 25.8, 9.2, 27.8, 14.3, 32.4, 14.8, 34.7, 17.8, 36.4, 18.9, 39.9, 22.6, 43.5, 23.6, 50.6, 24.9, 49.5, 30.2, 50.2, 35.2, 48.0, 40.4, 52.9, 44.5, 52.8, 49.5, 50.8, 51.5, 47.3, 53.6, 37.9, 58.4, 32.4, 58.4, 29.9, 56.6, 26.9, 57.3, 25.9, 56.4, 26.4, 54.4, 23.6, 44.8, 18.4, 35.8, 15.3, 22.1, 5.0, 20.5, 5.0, 20.8, 3.7, 19.3, 3.7, 20.5, 1.6, 16.0, -7.3, 15.9, -13.8, 18.8, -17.9, 22.8, -18.0, 23.3, -20.3, 27.5, -21.3, 30.2, -20.4, 21.6, -28.9, 22.5, -30.5, 21.1, -32.9, 20.5, -38.7, 22.7, -41.3, 24.0, -46.4, 20.6, -50.8, 20.6, -53.1, 11.4, -44.9, 8.2, -49.3, -0.3, -49.2, -20.3, -46.2, -22.5, -43.0, -24.2, -46.7, -27.2, -47.9, -36.1, -45.8, -43.2, -45.8, -51.6, -52.2, -56.5, -49.9];

/** real lon / lat → game x / z (same projection as the outline) */
export function geo(lon: number, lat: number): { x: number; z: number } {
  return { x: (lon - OUTLINE_LON0) * 103.1822 * OUTLINE_SCALE, z: -(lat - OUTLINE_LAT0) * 110.5740 * OUTLINE_SCALE };
}
