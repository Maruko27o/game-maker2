// Core data model. Kept intentionally small; race/vote features will extend
// Horse later, so avoid baking in stat values now (see CLAUDE.md §6, §10).

export type Rarity = 'N' | 'R' | 'SR';
export type ColorSlot = 'body' | 'mane' | 'hoof';
export type DecoSlot = 'head' | 'face' | 'back' | 'tail';

export type ColorPart = {
  id: string;
  name: string;
  value: string; // paint applied to the CSS variable — a hex, or url(#grad…) for gradients
  rarity: Rarity;
  swatch?: string; // CSS-background equivalent for pickers (gradients can't use url() in CSS)
};

export type DecoPart = {
  id: string;
  name: string;
  slot: DecoSlot;
  rarity: Rarity;
  svg: string; // SVG snippet in the base 0 0 520 520 coordinate space
};

// Race ability stats (RACE.md §1). Each 0..10, sum 10..30 at birth, cap 48 via training.
export type StatKey = 'spd' | 'sta' | 'pwr' | 'jmp' | 'gut' | 'wit';
export type Stats = Record<StatKey, number>;

export const STAT_KEYS: StatKey[] = ['spd', 'sta', 'pwr', 'jmp', 'gut', 'wit'];
export const STAT_LABEL: Record<StatKey, string> = {
  spd: 'スピード',
  sta: 'スタミナ',
  pwr: 'パワー',
  jmp: 'ジャンプ',
  gut: 'こんじょう',
  wit: 'かしこさ',
};
export const STAT_CAP = 10; // per-stat max
export const STAT_TOTAL_CAP = 48; // sum hard cap via training

// Running style (脚質, RACE_V2 §4.2). Fixed per horse (derived from stats+id).
export type RunStyle = 'nige' | 'senko' | 'sashi' | 'oikomi';
export const RUN_STYLE_LABEL: Record<RunStyle, string> = {
  nige: '逃げ',
  senko: '先行',
  sashi: '差し',
  oikomi: '追込',
};

export type Horse = {
  id: string;
  name: string;
  colors: Record<ColorSlot, string>; // parts.json color part ids
  decos: Partial<Record<DecoSlot, string>>; // parts.json deco part ids; unequipped = key absent
  stats: Stats;
  createdAt: number;
};

// The minimum a Horse needs to be *drawn*. Real Horse is assignable to this, and
// cosmetic/preview horses can be built without stats.
export type HorseLook = {
  name?: string;
  colors: Record<ColorSlot, string>;
  decos: Partial<Record<DecoSlot, string>>;
};

// A trophy earned by finishing top-3 (RACE.md §8). Belongs to a horse.
export type Trophy = {
  id: string;
  horseId: string;
  rank: 1 | 2 | 3;
  courseId: string;
  mode: 30 | 60;
  grade: 'normal' | 'gp';
  at: number;
};

// A training item (RACE.md §9.2). Applied via logic/training.ts only.
export type TrainingItem = { kind: 'stat'; stat: StatKey } | { kind: 'any' };

// Best result per course+mode (RACE.md §11).
export type RaceRecord = {
  courseId: string;
  mode: 30 | 60;
  bestRank: number;
  bestTime: number; // seconds
};

export type SaveData = {
  version: 3;
  owned: Record<string, number>; // part id -> count obtained (>=1 means owned)
  horses: Horse[]; // max 10
  energy: number; // grass spawn stock (0..3), charges 1 per hour
  energyUpdatedAt: number; // ms anchor for energy regen
  trophies: Trophy[];
  items: TrainingItem[]; // owned training items (unused inventory)
  raceRecords: RaceRecord[];
  gpUnlocked: { g2: boolean; g1: boolean }; // grand-prix grade unlocks
  savedAt: number; // ms of the last change — used for cloud last-write-wins sync
};
