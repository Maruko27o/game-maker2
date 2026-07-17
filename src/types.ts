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

// Point-buy creation (RACE_V3 §3): the player distributes exactly 40 points,
// each stat 1..10. Training then raises the sum up to STAT_TOTAL_CAP (48).
export const STAT_ALLOC_TOTAL = 40;
export const STAT_ALLOC_MIN = 1;
export const STAT_ALLOC_MAX = STAT_CAP; // 10

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

// A trophy earned by finishing top-3 in a GRAND PRIX final (ACCOUNT.md §2).
// Everyday single races award badges instead.
export type Trophy = {
  id: string;
  horseId: string;
  rank: 1 | 2 | 3;
  courseId: string;
  mode: 30 | 60;
  grade: 'normal' | 'gp';
  at: number;
};

// A badge earned in everyday single races (ACCOUNT.md §2). Belongs to a horse.
// Placing badges (badge_1st/2nd/3rd) stack; achievement badges are once-only.
export type Badge = {
  id: string; // BadgeId from data/badges.ts
  horseId: string;
  courseId?: string;
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

// Betting market kinds (RACE_V4 §4 / 改修①).
export type BetKind = 'win' | 'place' | 'quinella' | 'wide' | 'trifecta';

// A settled bet, kept as recent history (RACE_V4 §4).
export type BetRecord = {
  courseId: string;
  kind: BetKind; // 単勝/複勝/馬連/ワイド/3連単
  picks: number[]; // gate numbers selected (for display)
  amount: number; // stake
  odds: number;
  won: boolean;
  payout: number; // coins returned (0 if lost)
  at: number; // ms
};

// Per-day counters (local date key), for the grass bonus and おかわり limits.
export type DailyCounters = { day: string; grassBonus: number; okawari: number; gp: number };

// Coin-earning tasks (改修：タスク). Progress that only advances when a race is
// actually finished (result screen reached), so it can't be farmed by bailing out.
// Designed to grow: add more fields/tasks over time.
export type TaskProgress = {
  racesFinished: number; // total races that reached the result screen (also 総レース回数)
  raceBanked: number; // race 10-cycles already credited to the reward bank
  grassSpawns: number; // total grass draws performed
  grassBanked: number; // grass 10-cycles already credited to the reward bank
  bank: number; // coins earned by tasks, waiting to be claimed together
};

// Lifetime player stats shown on the profile (改修：プロフィール実績).
export type PlayerStats = {
  betsPlaced: number; // total bet tickets purchased (to tell "no bets yet" from 0%)
  maxPayout: number; // best single-race total payout (最大獲得賞金)
  maxRecoveryPct: number; // best single-race 回収率 = payout ÷ staked, as a % (最高回収率)
  maxOdds: number; // highest odds of a winning bet (最大オッズ)
};

export type SaveData = {
  version: 6;
  owned: Record<string, number>; // part id -> count obtained (>=1 means owned)
  horses: Horse[]; // up to `maxHorses`
  energy: number; // grass spawn stock (0..3), charges 1 per hour
  energyUpdatedAt: number; // ms anchor for energy regen
  trophies: Trophy[]; // grand-prix only
  badges: Badge[]; // everyday single-race rewards (ACCOUNT.md §2)
  winStreaks: Record<string, number>; // horseId -> current consecutive 1st count
  items: TrainingItem[]; // owned training items (unused inventory)
  raceRecords: RaceRecord[];
  gpUnlocked: { g2: boolean; g1: boolean }; // grand-prix grade unlocks
  freeRebalance: boolean; // one free stat re-allocation after the v4 migration (RACE_V3 §3.6)
  coins: number; // soft currency (RACE_V4 §4)
  bets: BetRecord[]; // recent settled bets (capped)
  maxHorses: number; // stable slot cap (10, expandable to 15)
  daily: DailyCounters; // per-day bonus/おかわり counters
  tasks: TaskProgress; // coin-earning task progress (改修：タスク)
  stats: PlayerStats; // lifetime profile stats (改修：プロフィール実績)
  avatarHorseId: string | null; // profile: which owned horse is the player's icon
  displayTrophies: number[]; // profile: trophy ranks (1|2|3) shown on the shelf (max 5)
  savedAt: number; // ms of the last change — used for cloud last-write-wins sync
};
