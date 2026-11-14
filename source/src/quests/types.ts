/** Quest shapes (content/quests/*.json, merged by src/content/loader.ts; format: docs/phase1/CONTENT_SCHEMA.md). */
import type { Windowed } from '../content/types';
export type Role = 'm' | 'f' | 't';
export type QuestLine = 'main' | 'side' | 'photo';

export type Req =
  | string
  | { all: Req[] }
  | { any: Req[]; n?: number }
  | { flag: string }
  | { respect: RespectId }
  | { stat: string; min: number }
  | { count: string; min: number }
  /** recipes: hold at least `min` of an ingredient / item */
  | { item: string; min: number }
  | { pending: true };

export type RespectId = 'first' | 'learning' | 'trusted' | 'friend';


export interface StepLine {
  who: string;
  zh: string;
  tao?: string;
}

export interface StepGives {
  flags?: string[];
  items?: string[];
  glossary?: string[];
  respect?: RespectId;
  relation?: number;
  counter?: Record<string, number>;
  toast?: [string, string];
  /** recipes: learn this recipe (recipes.json id) → notebook 食材與營養 */
  recipe?: string;
  /** recipes: hand these items over (removed from the bag) */
  consume?: Record<string, number>;
  /** outfits unlocked (content/outfits) */
  outfits?: string[];
}

/** Party split (docs/phase1/PARTY_SPLIT.md): where an away member is and what they are doing */
export interface SplitTask {
  /** place id (places.json or a derived place such as host_weave) */
  at: string;
  /** zh-TW, shown in the HUD: 離隊：<task> */
  task: string;
  /** true: the player can switch to them (3-way split / solo); false: busy, not controllable */
  ctrl?: boolean;
}

/** one member's part of a `tasks` step (all parts must be done before the step finishes) */
export interface MemberTask {
  role: Role;
  kind: 'talk' | 'spot';
  npc?: string;
  spot?: string;
  r?: number;
  text: string;
  lines?: StepLine[];
  gives?: StepGives;
}

export interface QuestStep {
  kind: 'talk' | 'spot' | 'photo' | 'auto' | 'placeholder' | 'tasks';
  npc?: string;
  spot?: string;
  r?: number;
  actor?: Role[];
  need?: string[];
  text: string;
  lines?: StepLine[];
  gives?: StepGives;
  translate?: boolean;
  /** auto steps: finish when this is true */
  until?: Req;
  /** batch 1b: spot step that plays the underwater moment (A 母雞岩浮潛, B 椰油港淺潛, POV 旅人照片組) */
  dive?: 'A' | 'B' | 'POV';
  // ---- party split (applied when the step completes)
  /** members leave for their own tasks; ctrl ones can be switched to (3-way split) */
  split?: Partial<Record<Role, SplitTask>>;
  /** regroup point while split (marker + HUD) */
  meet?: string;
  /** only this member is controllable until the solo part is done or given up (族男出海) */
  solo?: { role: Role; at: string; task: string; waitAt: string; giveUp?: StepLine[] };
  /** everyone back in the party (solo / split over) */
  regroup?: boolean;
  /** members that must be in the party (not away) to run this step */
  requires?: Role[];
  /** kind 'tasks': parallel member parts */
  tasks?: MemberTask[];
  /** spot step that plays a mini-game; success completes the step */
  minigame?: 'fish' | 'taro';
  /** board the tatala for the mini-game (sea trip) */
  canoe?: boolean;
}

export interface QuestHint {
  tier: 'direct' | 'vague' | 'tao';
  from: string;
  zh: string;
  npc?: string;
  phrase?: string;
}

export interface QuestDef extends Windowed {
  id: string;
  line: QuestLine;
  /** content arc (open, main, taro, split, night, village …) */
  arc: string;
  /** = arc (kept for older code / scripts) */
  group: string;
  village?: string | null;
  name: { zh: string; en: string };
  roles: Role[];
  n: number;
  need?: string[];
  text: { who: string; coop: string; season: string; pre: string; unlock: string; kind: string };
  req: Req;
  steps: QuestStep[];
  hint: QuestHint;
  playable: boolean;
  hidden?: boolean;
  /** points a Tao cultural consultant still has to confirm (shown nowhere in game) */
  review?: string[];
  labourNote?: string;
  needsItem?: { item: string; from: string };
  distanceOnly?: boolean;
  /** fishing ground (族男, tradition) vs. dive spot (modern recreation, anyone) */
  ground?: 'fishing' | 'dive';
  /** activity song id (see QuestFile.songs) */
  song?: string;
  /** 分工 (Larry 2026-11-14): who gives / approves it — f 女耆老 (芋頭、食物、紡織) or m 男耆老 (漁獵、拼板舟) */
  giver?: 'f' | 'm';
  /** recipe quests: the recipe id and the village whose keeper teaches it */
  recipe?: { id: string; village: string; keeper: string };
  /** a solo give-up sends the quest back to this step */
  abortTo?: number;
}

export interface SongDef {
  title: string;
  tao: string;
  zh: string;
  quests: string[];
  activity: string;
  source: string;
  license: string;
  url: string;
  status: string;
}

export interface QuestFile {
  notes?: string;
  roles: Record<Role, { zh: string; icon: string }>;
  respect: { id: RespectId; zh: string }[];
  items: Record<string, { zh: string }>;
  phrases: Record<string, { tao: string; zh: string; source: string; words: string[] }>;
  songs?: Record<string, SongDef>;
  /** elder resolution for @giver: gender → village → npc id */
  elders?: { m: Record<string, string>; f: Record<string, string> };
  quests: QuestDef[];
}
