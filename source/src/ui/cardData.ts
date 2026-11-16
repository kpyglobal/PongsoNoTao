/**
 * 0.1.5: what goes on each unlock card (words, items, finished products, recipes, photos), from content + save.
 * Pure data → src/ui/cards.ts draws it.
 */
import type { ItemDef, OutfitDef, PhotoSpotDef, RecipeDef } from '../content/types';
import type { GlossaryEntry } from '../core/content';
import { Inventory } from '../systems/inventory';
import { CARD_ART, CARD_ICONS, type IngredientRow, type PhotoData, type PostcardData, type RecipeData } from './cards';

const tao = (s: string | undefined): string => (s ?? '').replace(/[\u0027\u02BC]/g, '\u2019');

export interface CardCtx {
  items: Map<string, ItemDef>;
  recipes: RecipeDef[];
  glossary: GlossaryEntry[];
  outfits: OutfitDef[];
  spots: PhotoSpotDef[];
  count: (id: string) => number;
  known: (id: string) => boolean;
  taught: (id: string) => boolean;
}

export const CATEGORY_ZH: Record<string, string> = {
  ingredient: '食材', material: '材料', tool: '裝備', accessory: '飾品', observe: '觀察紀錄', dish: '料理', outfit: '服裝',
};

/** the card icon of an item (cards-v1 art; an older illustration when there is none) */
export function itemIcon(d: ItemDef): string {
  return CARD_ICONS.has(d.id) ? CARD_ART.icon(d.id) : Inventory.illustrationUrl(d);
}

export function outfitIcon(o: OutfitDef): string {
  if (o.item && CARD_ICONS.has(o.item)) return CARD_ART.icon(o.item);
  return CARD_ART.icon('woven_cloth');
}

/** first sentence (short line on a postcard) */
function short(s: string | undefined, max = 46): string {
  const t = (s ?? '').trim();
  if (!t) return '';
  const m = /^[\s\S]*?[。！？.!?](?=\s|$|[^\s])/.exec(t);
  const one = m ? m[0] : t;
  return one.length > max + 12 ? `${one.slice(0, max)}…` : one;
}

export function itemCard(c: CardCtx, id: string, kicker?: string): PostcardData | null {
  const d = c.items.get(id);
  if (!d) return null;
  return {
    key: `i:${id}`,
    kicker: kicker ?? (d.category === 'observe' ? '新的觀察紀錄' : `新的${CATEGORY_ZH[d.category] ?? '物品'}`),
    img: itemIcon(d),
    tao: tao(d.name.tao),
    name: d.name.zh,
    line: short(d.description),
  };
}

/** the item whose Tao name is this word (alibangbang → 飛魚) */
function wordItem(c: CardCtx, w: string): ItemDef | undefined {
  const k = w.trim().toLowerCase();
  if (!k) return undefined;
  for (const d of c.items.values()) if (d.name.tao && d.name.tao.trim().toLowerCase() === k) return d;
  return undefined;
}

export function wordCard(c: CardCtx, ids: string[]): PostcardData | null {
  const es = ids.map((id) => c.glossary.find((e) => e.id === id)).filter((e): e is GlossaryEntry => !!e);
  if (!es.length) return null;
  if (es.length === 1) {
    const e = es[0];
    const it = wordItem(c, e.tao);
    return { key: `w:${e.id}`, kicker: '新的族語詞', img: it ? itemIcon(it) : undefined, tao: tao(e.tao), name: e.zh, line: short(e.detail) };
  }
  return {
    key: `w:${es.map((e) => e.id).join('+')}`,
    kicker: `學會 ${es.length} 個族語詞`,
    tao: tao(es[0].tao),
    name: es[0].zh,
    list: es.slice(0, 6).map((e) => ({ tao: tao(e.tao), name: e.zh })),
  };
}

export function outfitCard(c: CardCtx, id: string): PostcardData | null {
  const o = c.outfits.find((x) => x.id === id);
  if (!o) return null;
  return {
    key: `o:${id}`,
    kicker: '完成作品',
    img: outfitIcon(o),
    tao: tao(o.name.tao),
    name: o.name.zh,
    line: o.kind === 'traditional' ? '族人親手做給你們的衣服。' : '族女教旅人縫的小飾品。',
  };
}

export function recipeRows(c: CardCtx, r: RecipeDef): IngredientRow[] {
  return Object.entries(r.ingredients).map(([id, need]) => {
    const d = c.items.get(id);
    const found = c.known(id);
    return {
      id,
      icon: d ? itemIcon(d) : CARD_ART.icon(id),
      tao: tao(d?.name.tao),
      name: d?.name.zh ?? id,
      have: c.count(id),
      need,
      found,
      named: found || c.taught(id),
    };
  });
}

export function recipeCard(c: CardCtx, id: string, kicker = '新料理'): RecipeData | null {
  const r = c.recipes.find((x) => x.id === id);
  if (!r) return null;
  return { key: `r:${id}`, kicker, recipe: r.id, tao: tao(r.name.tao), name: r.name.zh, rows: recipeRows(c, r) };
}

/** item rows for anything a quest needs (recipe ingredients or one item gate) */
export function needRows(c: CardCtx, need: Record<string, number>): IngredientRow[] {
  return recipeRows(c, { ingredients: need } as RecipeDef);
}

export function photoCard(c: CardCtx, spot: string): PhotoData | null {
  const s = c.spots.find((x) => x.id === spot);
  if (!s) return null;
  return { key: `p:${spot}`, spot, caption: s.name.zh.replace(/（[^）]*）$/, '').replace(/\s*\([^)]*\)$/, '') };
}
