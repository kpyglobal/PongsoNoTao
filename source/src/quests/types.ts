/** Shapes of public/data/quests.json (built by scripts/build-quests.mjs). */
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
  | { pending: true };

export type RespectId = 'first' | 'learning' | 'trusted' | 'friend';

export interface When {
  season?: 'fishing' | 'nonFishing';
  period?: string[];
  tide?: 'low' | 'high';
}

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
}

export interface QuestStep {
  kind: 'talk' | 'spot' | 'photo' | 'auto' | 'placeholder';
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
}

export interface QuestHint {
  tier: 'direct' | 'vague' | 'tao';
  from: string;
  zh: string;
  npc?: string;
  phrase?: string;
}

export interface QuestDef {
  id: string;
  line: QuestLine;
  group: string;
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
  when?: When;
  needsItem?: { item: string; from: string };
  distanceOnly?: boolean;
  /** fishing ground (族男, tradition) vs. dive spot (modern recreation, anyone) */
  ground?: 'fishing' | 'dive';
  /** activity song id (see QuestFile.songs) */
  song?: string;
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
  photoSpots: Record<string, { landmark?: string; place?: string; r: number }>;
  songs?: Record<string, SongDef>;
  quests: QuestDef[];
}
