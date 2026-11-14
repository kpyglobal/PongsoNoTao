/**
 * Procedural, crisp pixel textures (generated at boot, no extra downloads).
 * Deterministic so screenshots are stable.
 */
import * as THREE from 'three';

export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function finish(c: HTMLCanvasElement, pixel = true, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (pixel) {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
  }
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

const cache = new Map<string, THREE.Texture>();
function cached(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

/**
 * Close-zoom terrain micro detail (Phase 1 crispness): same channel layout as terrainDetail
 * (R grass, G basalt, B sand; linear, mean ~0.5) at a much finer scale. Only sampled near the
 * camera (distance-faded in the terrain shader), so wide shots pay nothing for it.
 */
export function terrainFine(): THREE.Texture {
  return cached('fine', () => {
    const S = 128;
    const [c, ctx] = canvas(S, S);
    const img = ctx.createImageData(S, S);
    const r = rng(23);
    const g = new Float32Array(S * S);
    const rk = new Float32Array(S * S);
    const sd = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) {
      g[i] = 0.46 + r() * 0.08;
      rk[i] = 0.47 + r() * 0.1;
      sd[i] = 0.4 + r() * 0.2;
    }
    const at = (x: number, y: number): number => (((y % S) + S) % S) * S + (((x % S) + S) % S);
    // tiny grass tufts: 3–5 blades fanning up from one root, light tips
    for (let n = 0; n < 520; n++) {
      const x = Math.floor(r() * S);
      const y = Math.floor(r() * S);
      const blades = 2 + Math.floor(r() * 3);
      for (let b = 0; b < blades; b++) {
        const lean = Math.round((b - (blades - 1) / 2) * 0.8);
        const len = 2 + Math.floor(r() * 3);
        for (let k = 0; k < len; k++) {
          const xx = x + Math.round((lean * k) / len);
          g[at(xx, y - k)] = k === len - 1 ? 0.8 : 0.32 + k * 0.1;
        }
      }
      g[at(x + 1, y + 1)] = Math.min(g[at(x + 1, y + 1)], 0.3); // root shade
    }
    // basalt: pits (vesicles) with a lit rim, plus fine grit
    for (let n = 0; n < 160; n++) {
      const x = Math.floor(r() * S);
      const y = Math.floor(r() * S);
      rk[at(x, y)] = 0.2;
      rk[at(x + 1, y)] = 0.32;
      rk[at(x, y - 1)] = 0.74;
    }
    for (let n = 0; n < 700; n++) rk[Math.floor(r() * S * S)] = 0.66 + r() * 0.18;
    // sand: grains, a few darker shell / pebble specks
    for (let n = 0; n < 900; n++) sd[Math.floor(r() * S * S)] = 0.66 + r() * 0.16;
    for (let n = 0; n < 120; n++) {
      const x = Math.floor(r() * S);
      const y = Math.floor(r() * S);
      sd[at(x, y)] = 0.24;
      sd[at(x + 1, y)] = 0.34;
    }
    for (let i = 0; i < S * S; i++) {
      img.data[i * 4] = Math.round(g[i] * 255);
      img.data[i * 4 + 1] = Math.round(rk[i] * 255);
      img.data[i * 4 + 2] = Math.round(sd[i] * 255);
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return finish(c, true, false);
  });
}

/** Terrain detail: R = grass blades, G = basalt cracks, B = sand grain. Linear (luminance ~0.5 mean). */
export function terrainDetail(): THREE.Texture {
  return cached('detail', () => {
    const S = 64;
    const [c, ctx] = canvas(S, S);
    const img = ctx.createImageData(S, S);
    const r = rng(7);
    const g = new Float32Array(S * S).fill(0.5);
    const rk = new Float32Array(S * S).fill(0.55);
    const sd = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) sd[i] = 0.42 + r() * 0.16;
    // grass blades: short vertical strokes, light tip / dark base
    for (let n = 0; n < 260; n++) {
      const x = Math.floor(r() * S);
      const y = Math.floor(r() * S);
      const len = 2 + Math.floor(r() * 3);
      for (let k = 0; k < len; k++) {
        const yy = (y - k + S) % S;
        const idx = yy * S + x;
        g[idx] = k === len - 1 ? 0.78 : 0.36 + k * 0.1;
      }
    }
    // basalt: polygonal cracks + vesicles
    for (let n = 0; n < 34; n++) {
      let x = r() * S;
      let y = r() * S;
      const a = r() * Math.PI * 2;
      for (let k = 0; k < 10; k++) {
        const ix = ((Math.floor(x) % S) + S) % S;
        const iy = ((Math.floor(y) % S) + S) % S;
        rk[iy * S + ix] = 0.22;
        rk[iy * S + ((ix + 1) % S)] = Math.max(0.3, rk[iy * S + ((ix + 1) % S)] - 0.12);
        x += Math.cos(a + (r() - 0.5) * 1.2) * 1.1;
        y += Math.sin(a + (r() - 0.5) * 1.2) * 1.1;
      }
    }
    for (let n = 0; n < 90; n++) {
      const idx = Math.floor(r() * S * S);
      rk[idx] = 0.75 + r() * 0.15;
    }
    for (let i = 0; i < S * S; i++) {
      img.data[i * 4] = Math.round(g[i] * 255);
      img.data[i * 4 + 1] = Math.round(rk[i] * 255);
      img.data[i * 4 + 2] = Math.round(sd[i] * 255);
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return finish(c, true, false);
  });
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string): void {
  ctx.fillStyle = col;
  ctx.fillRect(x, y, w, h);
}

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

/** Dry-laid basalt / coral stone masonry (砌石). */
export function stoneTex(): THREE.Texture {
  return cached('stone', () => {
    const S = 64;
    const [c, ctx] = canvas(S, S);
    const r = rng(11);
    px(ctx, 0, 0, S, S, '#4a4643');
    let y = 0;
    while (y < S) {
      const h = 6 + Math.floor(r() * 5);
      let x = -Math.floor(r() * 8);
      while (x < S) {
        const w = 7 + Math.floor(r() * 9);
        const base = ['#7d776e', '#6b665f', '#8a8478', '#5f5a55', '#938b7c', '#746c62'][Math.floor(r() * 6)];
        px(ctx, x + 1, y + 1, w - 1, h - 1, base);
        px(ctx, x + 1, y + 1, w - 2, 1, shade(base, 1.22));
        px(ctx, x + 1, y + h - 1, w - 1, 1, shade(base, 0.7));
        if (r() < 0.5) px(ctx, x + 2 + Math.floor(r() * (w - 4)), y + 2 + Math.floor(r() * (h - 4)), 1, 1, shade(base, 0.8));
        x += w;
      }
      y += h;
    }
    return finish(c);
  });
}

/** Dark, layered thatch (茅草) roof. */
export function thatchTex(dark = false): THREE.Texture {
  return cached(`thatch${dark}`, () => {
    const S = 64;
    const [c, ctx] = canvas(S, S);
    const r = rng(dark ? 21 : 23);
    const base = dark ? '#4b3f30' : '#9b8250';
    px(ctx, 0, 0, S, S, base);
    for (let row = 0; row < S; row += 8) {
      px(ctx, 0, row + 7, S, 1, shade(base, 0.55));
      for (let x = 0; x < S; x++) {
        const len = 3 + Math.floor(r() * 5);
        const k = 0.75 + r() * 0.55;
        px(ctx, x, row + 7 - len, 1, len, shade(base, k));
      }
      px(ctx, 0, row, S, 1, shade(base, 1.25));
    }
    return finish(c);
  });
}

/** Weathered timber planks with grain. */
export function woodTex(tone = '#8a6440'): THREE.Texture {
  return cached(`wood${tone}`, () => {
    const S = 64;
    const [c, ctx] = canvas(S, S);
    const r = rng(31);
    px(ctx, 0, 0, S, S, tone);
    for (let x = 0; x < S; x += 8) {
      px(ctx, x, 0, 1, S, shade(tone, 0.55));
      px(ctx, x + 1, 0, 1, S, shade(tone, 1.15));
      for (let y = 0; y < S; y++) {
        if (r() < 0.25) px(ctx, x + 2 + Math.floor(r() * 5), y, 1, 1 + Math.floor(r() * 3), shade(tone, 0.82 + r() * 0.3));
      }
      if (r() < 0.6) px(ctx, x + 3, Math.floor(r() * S), 2, 2, shade(tone, 0.6));
    }
    return finish(c);
  });
}

/** Grey slate / corrugated roof used on modern houses (tinted by material colour). */
export function sheetTex(): THREE.Texture {
  return cached('sheet', () => {
    const S = 32;
    const [c, ctx] = canvas(S, S);
    for (let x = 0; x < S; x++) {
      const k = 0.78 + 0.3 * Math.max(0, Math.sin((x / S) * Math.PI * 8));
      px(ctx, x, 0, 1, S, shade('#d8d8d8', k));
    }
    return finish(c);
  });
}

/** Plastered concrete with stains. */
export function plasterTex(): THREE.Texture {
  return cached('plaster', () => {
    const S = 64;
    const [c, ctx] = canvas(S, S);
    const r = rng(41);
    px(ctx, 0, 0, S, S, '#e9e4d8');
    for (let i = 0; i < 260; i++) px(ctx, Math.floor(r() * S), Math.floor(r() * S), 1, 1, r() < 0.5 ? '#ddd7c8' : '#f3efe6');
    for (let i = 0; i < 6; i++) px(ctx, Math.floor(r() * S), 0, 1 + Math.floor(r() * 2), 8 + Math.floor(r() * 20), '#d2cbbb');
    return finish(c);
  });
}

/** Tatala hull paint: white base, red & black geometric bands, concentric "eye" (mata) near the ends. */
export function tatalaTex(seed = 1): THREE.Texture {
  return cached(`tatala${seed}`, () => {
    const W = 256;
    const H = 32;
    const [c, ctx] = canvas(W, H);
    const r = rng(100 + seed);
    const RED = '#b3332a';
    const BLK = '#1b1714';
    const WHT = '#f1ebdc';
    px(ctx, 0, 0, W, H, WHT);
    // gunwale black + red bands
    px(ctx, 0, 0, W, 3, BLK);
    px(ctx, 0, 3, W, 2, RED);
    px(ctx, 0, H - 4, W, 4, BLK); // waterline
    // zig-zag (wave) band
    for (let x = 0; x < W; x++) {
      const y = 8 + Math.abs(((x % 8) - 4));
      px(ctx, x, y, 1, 2, RED);
    }
    // triangle (human-figure / wave) row in black
    for (let x = 0; x < W; x += 12) {
      for (let k = 0; k < 5; k++) px(ctx, x + k, 16 + k, 10 - k * 2, 1, BLK);
    }
    // red dot row
    for (let x = 6; x < W; x += 12) px(ctx, x, 23, 2, 2, RED);
    // the "eye of the boat" concentric rings near both ends
    for (const cx of [26, W - 26]) {
      for (const [rad, col] of [[11, BLK], [9, WHT], [7, RED], [5, WHT], [3, BLK]] as [number, string][]) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(cx, H / 2 + 1, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      // radiating rays
      ctx.fillStyle = RED;
      for (let a = 0; a < 12; a++) {
        const ang = (a / 12) * Math.PI * 2;
        px(ctx, Math.round(cx + Math.cos(ang) * 13), Math.round(H / 2 + 1 + Math.sin(ang) * 13 * 0.7), 1, 1, RED);
      }
    }
    // tiny variation per boat
    for (let i = 0; i < 30; i++) px(ctx, Math.floor(r() * W), 6 + Math.floor(r() * 20), 1, 1, shade(WHT, 0.9));
    const t = finish(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
}

/** Soft radial glow sprite for lanterns (additive). */
export function glowTex(): THREE.Texture {
  return cached('glow', () => {
    const S = 64;
    const [c, ctx] = canvas(S, S);
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,240,200,1)');
    g.addColorStop(0.2, 'rgba(255,190,110,0.75)');
    g.addColorStop(0.5, 'rgba(255,140,60,0.22)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

/** Cute HD-2D electric motor scooter (蘭嶼電動機車) — side-on pixel sprite. */
export function scooterTex(): THREE.Texture {
  return cached('scooter', () => {
    const W = 80;
    const H = 48;
    const [c, ctx] = canvas(W, H);
    const r = rng(88);
    const TEAL = '#1f6f70';
    const DEEP = '#164e52';
    const CREAM = '#f3ead4';
    const INK = '#2c2118';
    const RED = '#b33a32';
    // shadow
    ctx.fillStyle = 'rgba(20,20,20,0.25)';
    ctx.beginPath(); ctx.ellipse(40, 44, 28, 3.2, 0, 0, Math.PI * 2); ctx.fill();
    // wheels
    for (const cx of [16, 62]) {
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(cx, 36, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8d2c4';
      ctx.beginPath(); ctx.arc(cx, 36, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = TEAL;
      ctx.beginPath(); ctx.arc(cx, 36, 2, 0, Math.PI * 2); ctx.fill();
    }
    // body deck
    ctx.fillStyle = CREAM;
    ctx.fillRect(18, 26, 42, 7);
    ctx.fillStyle = TEAL;
    ctx.fillRect(20, 22, 30, 8);
    // front shield / cowling
    ctx.fillStyle = DEEP;
    ctx.fillRect(50, 12, 16, 18);
    ctx.fillStyle = TEAL;
    ctx.fillRect(52, 8, 13, 10);
    // headlight
    ctx.fillStyle = '#fff4c8';
    ctx.fillRect(62, 12, 5, 5);
    // seat
    ctx.fillStyle = INK;
    ctx.fillRect(24, 18, 22, 6);
    ctx.fillRect(22, 16, 10, 5);
    // handlebar
    ctx.fillStyle = INK;
    ctx.fillRect(56, 6, 10, 3);
    ctx.fillRect(64, 4, 3, 6);
    // rear rack / red reflector
    ctx.fillStyle = RED;
    ctx.fillRect(18, 24, 5, 4);
    // tiny paint noise
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
      ctx.fillRect(20 + Math.floor(r() * 40), 14 + Math.floor(r() * 18), 1, 1);
    }
    const tex = finish(c, true, true);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  });
}
