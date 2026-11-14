import * as THREE from 'three';
import { assetUrl } from './paths';

/** Player outfits (族人 / 旅人 x gender); each has a walk, a scooter (ride_) and a tatala (canoe_) sheet. */
export const PLAYER_OUTFITS = ['player', 'player_f', 'player_visitor', 'player_visitor_f'] as const;
export type PlayerOutfit = (typeof PLAYER_OUTFITS)[number];

/** public/assets/sprites/npc_atlas.json (format: docs/phase1/PROGRESS.md「# NPC cast rev」step 6) */
export interface NpcAtlasFile {
  version: number;
  sheet: { w: number; h: number; cols: number; rows: number };
  atlases: Record<string, { file: string; w: number; h: number; bytes?: number; sheets: Record<string, { x: number; y: number }> }>;
  npcs: Record<string, { atlas: string; sheet: string }>;
}

export interface NpcSheetRef {
  /** texture path under assets/sprites/ */
  rel: string;
  /** slot inside an atlas (absent for a single sheet) */
  region?: { x: number; y: number; w: number; h: number; atlasW: number; atlasH: number };
  /** atlas group (village / harbor), null for a single sheet */
  group: string | null;
}

export class Assets {
  textures = new Map<string, THREE.Texture>();
  private loader = new THREE.TextureLoader();

  get(path: string): THREE.Texture {
    const t = this.textures.get(path);
    if (!t) throw new Error(`Texture not loaded: ${path}`);
    return t;
  }

  async load(onProgress?: (p: number, label: string) => void): Promise<void> {
    // only sheets the game actually samples (characters, flying fish, flora atlas)
    const spriteFiles = [
      'characters/player_sheet.png',
      'characters/player_f_sheet.png',
      'characters/player_visitor_f_sheet.png',
      ...PLAYER_OUTFITS.flatMap((o) => [`characters/ride_${o}_sheet.png`, `characters/canoe_${o}_sheet.png`]),
      'characters/player_visitor_sheet.png',
      'props/flying_fish_sheet.png',
      'props/flora_atlas.webp',
    ];
    // game data (quests, items, NPCs, dialogue, places, UI text) is bundled from content/ at build time:
    // src/content/loader.ts. Only textures are fetched here.
    const total = spriteFiles.length;
    let done = 0;
    const tick = (label: string) => {
      done++;
      onProgress?.(done / total, label);
    };

    await Promise.all([
      ...spriteFiles.map(async (rel) => {
        const url = assetUrl(`assets/sprites/${rel}`);
        const tex = await this.loadTex(url, true);
        this.textures.set(rel, tex);
        this.pinned.add(rel);
        tick(rel);
      }),
    ]);
    // NPC walk sheets are NOT loaded here any more: NpcSystem streams the per-village atlases in near the player
    // (acquire / release). The manifest says which atlas + slot each NPC's sheet is in (NPC cast rev, 2026-11-14).
    try {
      const res = await fetch(assetUrl('assets/sprites/npc_atlas.json'));
      if (res.ok) this.atlas = (await res.json()) as NpcAtlasFile;
    } catch {
      this.atlas = null;
    }
  }

  private atlas: NpcAtlasFile | null = null;

  /** where an NPC's walk sheet lives: an atlas slot (preferred) or the old single sheet */
  npcSheet(id: string, sheet: string): NpcSheetRef {
    const a = this.atlas;
    const ref = a?.npcs[id];
    const at = ref ? a!.atlases[ref.atlas] : undefined;
    const slot = at?.sheets[ref!.sheet] ?? (at ? undefined : undefined);
    if (a && at && slot) {
      return {
        rel: at.file.replace(/^sprites\//, ''),
        region: { x: slot.x, y: slot.y, w: a.sheet.w, h: a.sheet.h, atlasW: at.w, atlasH: at.h },
        group: ref!.atlas,
      };
    }
    // not in the manifest (or no manifest): look the sheet name up in any atlas, else the single sheet file
    if (a) {
      for (const [g, at2] of Object.entries(a.atlases)) {
        const sl = at2.sheets[sheet];
        if (sl) return { rel: at2.file.replace(/^sprites\//, ''), region: { x: sl.x, y: sl.y, w: a.sheet.w, h: a.sheet.h, atlasW: at2.w, atlasH: at2.h }, group: g };
      }
    }
    return { rel: `characters/${sheet}_sheet.png`, group: null };
  }

  /** streamed sheets: refcount per file, the in-flight load shared by everyone who asks */
  private refs = new Map<string, number>();
  private pending = new Map<string, Promise<THREE.Texture>>();
  /** sheets that belong to the boot set (player / ride / canoe / props) are never released */
  private pinned = new Set<string>();

  /** load (once) and hold a sprite sheet; pair every acquire with a release */
  acquire(rel: string): Promise<THREE.Texture> {
    this.refs.set(rel, (this.refs.get(rel) ?? 0) + 1);
    const t = this.textures.get(rel);
    if (t) return Promise.resolve(t);
    let p = this.pending.get(rel);
    if (!p) {
      p = this.loadTex(assetUrl(`assets/sprites/${rel}`), true).then((tex) => {
        this.pending.delete(rel);
        // released while loading → drop it again
        if ((this.refs.get(rel) ?? 0) <= 0 && !this.pinned.has(rel)) {
          tex.dispose();
          return tex;
        }
        this.textures.set(rel, tex);
        return tex;
      }, (e: unknown) => {
        this.pending.delete(rel);
        throw e;
      });
      this.pending.set(rel, p);
    }
    return p;
  }

  /** drop one hold; the last one disposes the base texture (its clones were disposed by their sprites) */
  release(rel: string): void {
    const n = (this.refs.get(rel) ?? 0) - 1;
    if (n > 0) {
      this.refs.set(rel, n);
      return;
    }
    this.refs.delete(rel);
    if (this.pinned.has(rel)) return;
    const t = this.textures.get(rel);
    if (t) {
      t.dispose();
      this.textures.delete(rel);
    }
  }

  /** streaming stats (debug / perf scripts) */
  streamStats(): { sheets: number; held: Record<string, number> } {
    return { sheets: [...this.textures.keys()].filter((k) => !this.pinned.has(k)).length, held: Object.fromEntries(this.refs) };
  }

  private loadTex(url: string, nearest: boolean): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          if (nearest) {
            t.magFilter = THREE.NearestFilter;
            t.minFilter = THREE.NearestFilter;
            t.generateMipmaps = false;
          } else {
            t.anisotropy = 8;
          }
          t.needsUpdate = true;
          resolve(t);
        },
        undefined,
        (err) => reject(err),
      );
    });
  }

  sheetClone(rel: string): THREE.Texture {
    const t = this.get(rel).clone();
    t.needsUpdate = true;
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    if (rel.startsWith('characters/') || rel.startsWith('npc_atlas')) {
      // fine-pixel sprites: nearest when magnified (crisp pixels), trilinear when minified (no shimmer/tearing)
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
    } else {
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
    }
    return t;
  }
}
