/**
 * 0.1.5: what the planar reflection shows besides the world. The watercolor pass hides the character sprites from its
 * world render (they are drawn on top afterwards), so it sets `before` / `after` to put them back for the mirror only:
 * sprites then reflect exactly like the tatala and rocks (same tint, alpha, ripple distortion). `sprites` = false
 * (underwater views) keeps them out of the mirror.
 */
export const reflectHooks: { before: (() => void) | null; after: (() => void) | null; sprites: boolean } = { before: null, after: null, sprites: true };
