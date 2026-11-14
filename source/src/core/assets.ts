import * as THREE from 'three';
import { assetUrl } from './paths';
import { checkData, DATA_FILES, type DataFiles, type DataName } from './content';

/** Player outfits (族人 / 旅人 x gender); each has a walk, a scooter (ride_) and a tatala (canoe_) sheet. */
export const PLAYER_OUTFITS = ['player', 'player_f', 'player_visitor', 'player_visitor_f'] as const;
export type PlayerOutfit = (typeof PLAYER_OUTFITS)[number];

export interface CharacterSheet {
  texture: THREE.Texture;
  cols: number;
  rows: number;
  frameW: number;
  frameH: number;
}

export class Assets {
  textures = new Map<string, THREE.Texture>();
  private json = new Map<DataName, unknown>();
  private loader = new THREE.TextureLoader();

  get(path: string): THREE.Texture {
    const t = this.textures.get(path);
    if (!t) throw new Error(`Texture not loaded: ${path}`);
    return t;
  }

  /** Parsed + shape-checked public/data/<name>.json (checked once in load()). */
  data<K extends DataName>(name: K): DataFiles[K] {
    const d = this.json.get(name);
    if (d === undefined) throw new Error(`Data not loaded: ${name}`);
    return d as DataFiles[K];
  }

  async load(onProgress?: (p: number, label: string) => void): Promise<void> {
    // only sheets the game actually samples (characters, flying fish, flora atlas)
    const spriteFiles = [
      'characters/player_sheet.png',
      'characters/player_f_sheet.png',
      'characters/player_visitor_f_sheet.png',
      ...PLAYER_OUTFITS.flatMap((o) => [`characters/ride_${o}_sheet.png`, `characters/canoe_${o}_sheet.png`]),
      'characters/elder_sheet.png',
      'characters/villager_sheet.png',
      'characters/clinic_sheet.png',
      'characters/tourist_sheet.png',
      'characters/player_visitor_sheet.png',
      'characters/player_researcher_sheet.png',
      'characters/fisher_sheet.png',
      'characters/farmer_sheet.png',
      'characters/harbor_sheet.png',
      'props/flying_fish_sheet.png',
      'props/flora_atlas.webp',
    ];
    const dataFiles = DATA_FILES;

    const total = spriteFiles.length + dataFiles.length;
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
        tick(rel);
      }),
      ...dataFiles.map(async (name) => {
        const res = await fetch(assetUrl(`data/${name}.json`));
        if (!res.ok) throw new Error(`Failed to load data/${name}.json`);
        this.json.set(name, checkData(name, await res.json()));
        tick(name);
      }),
    ]);
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
    if (rel.startsWith('characters/')) {
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
