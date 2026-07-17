import { create } from 'zustand';
import type {
  SaveData,
  Horse,
  ColorSlot,
  DecoSlot,
  Trophy,
  Badge,
  TrainingItem,
  RaceRecord,
  Stats,
  StatKey,
  BetRecord,
  PlayerStats,
  RaceSession,
} from './types';
import { allParts } from './data/parts';
import { COURSES } from './data/courses';
import { spawn as gachaSpawn } from './logic/gacha';
import { ENERGY_CAP, spendEnergy } from './logic/energy';
import { rescaleTo40 } from './logic/stats';
import { applyTraining } from './logic/training';
import { evaluateBadges } from './logic/badges';
import {
  GRASS_DAILY_BONUS,
  GRASS_DAILY_BONUS_MAX,
  GRASS_OKAWARI_COST,
  GP_DAILY_LIMIT,
  SLOT_EXPAND_COST,
  SLOT_EXPAND_TO,
  RACE_TASK_EVERY,
  RACE_TASK_REWARD,
  GRASS_TASK_EVERY,
  GRASS_TASK_REWARD,
} from './data/coins';
import { cyclesOf, newlyBanked } from './logic/tasks';

export const STORAGE_KEY = 'horse-game/v1'; // guest slot; payload is versioned inside
export const MAX_HORSES = 10;

// Which localStorage slot we currently read/write. Guests use STORAGE_KEY; a
// signed-in user uses a per-account slot so two accounts on the same browser
// never share a local cache (ACCOUNT.md §1.6).
let activeKey = STORAGE_KEY;
function keyFor(uid: string | null): string {
  return uid ? `horse-game/v3/${uid}` : STORAGE_KEY;
}
/** Point future reads/writes at the given account's slot (null = guest). */
export function bindSaveKey(uid: string | null): void {
  activeKey = keyFor(uid);
}

// Starter parts so a brand-new player can build a horse immediately.
export const STARTER_PARTS = [
  'body_white',
  'body_chestnut',
  'body_bay',
  'body_gray',
  'mane_brown',
  'mane_black',
  'mane_cream',
  'hoof_dark',
  'hoof_stone',
  'hoof_ivory',
];

function starterOwned(): Record<string, number> {
  return Object.fromEntries(STARTER_PARTS.map((id) => [id, 1]));
}

/** Local date key (YYYY-MM-DD) for per-day counters. */
export function dayKey(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function freshDaily(): SaveData['daily'] {
  return { day: dayKey(), grassBonus: 0, okawari: 0, gp: 0 };
}

// Normalize a stored daily object, defaulting any missing counter (older saves
// predate the `gp` field).
function normDaily(v: unknown): SaveData['daily'] {
  const d = (v ?? {}) as Partial<SaveData['daily']>;
  return {
    day: typeof d.day === 'string' ? d.day : dayKey(),
    grassBonus: typeof d.grassBonus === 'number' ? d.grassBonus : 0,
    okawari: typeof d.okawari === 'number' ? d.okawari : 0,
    gp: typeof d.gp === 'number' ? d.gp : 0,
  };
}
const BETS_CAP = 50; // keep only the most recent settled bets

function freshTasks(): SaveData['tasks'] {
  return { racesFinished: 0, raceBanked: 0, grassSpawns: 0, grassBanked: 0, bank: 0 };
}
// Normalize the tasks object, defaulting any missing counter and converting the
// old {racesFinished, raceRewardClaimed} shape: any race rewards that were earned
// but not yet claimed carry over into the new shared bank.
function normTasks(v: unknown): SaveData['tasks'] {
  const t = (v ?? {}) as Record<string, unknown>;
  const num = (x: unknown): number => (typeof x === 'number' && isFinite(x) ? x : 0);
  const racesFinished = num(t.racesFinished);
  const isNew = t.bank !== undefined || t.raceBanked !== undefined || t.grassSpawns !== undefined;
  if (isNew) {
    return {
      racesFinished,
      raceBanked: num(t.raceBanked),
      grassSpawns: num(t.grassSpawns),
      grassBanked: num(t.grassBanked),
      bank: num(t.bank),
    };
  }
  // Old shape → carry any unclaimed race rewards into the bank.
  const cycles = cyclesOf(racesFinished, RACE_TASK_EVERY);
  const owed = Math.max(0, cycles - num(t.raceRewardClaimed)) * RACE_TASK_REWARD;
  return { racesFinished, raceBanked: cycles, grassSpawns: 0, grassBanked: 0, bank: owed };
}

function freshStats(): SaveData['stats'] {
  return { betsPlaced: 0, maxPayout: 0, maxRecoveryPct: 0, maxOdds: 0 };
}
// Reconstruct profile stats from a player's saved bet history, so existing users
// see their past 最大オッズ / 回収率 / 獲得賞金 rather than starting at zero. Recovery
// here is per-ticket (payout ÷ stake) — the best available from saved records.
function deriveStatsFromBets(bets: SaveData['bets']): SaveData['stats'] {
  let maxOdds = 0;
  let maxPayout = 0;
  let maxRecoveryPct = 0;
  for (const b of bets) {
    if (b.won && b.odds > maxOdds) maxOdds = b.odds;
    if (b.payout > maxPayout) maxPayout = b.payout;
    if (b.amount > 0) {
      const rec = Math.round((b.payout / b.amount) * 100);
      if (rec > maxRecoveryPct) maxRecoveryPct = rec;
    }
  }
  return { betsPlaced: bets.length, maxPayout, maxRecoveryPct, maxOdds };
}
// Default any missing profile stat (older saves predate the profile-stats feature).
function normStats(v: unknown): SaveData['stats'] {
  const s = (v ?? {}) as Partial<SaveData['stats']>;
  return {
    betsPlaced: typeof s.betsPlaced === 'number' ? s.betsPlaced : 0,
    maxPayout: typeof s.maxPayout === 'number' ? s.maxPayout : 0,
    maxRecoveryPct: typeof s.maxRecoveryPct === 'number' ? s.maxRecoveryPct : 0,
    maxOdds: typeof s.maxOdds === 'number' ? s.maxOdds : 0,
  };
}

function freshSave(): SaveData {
  return {
    version: 6,
    owned: starterOwned(),
    horses: [],
    energy: ENERGY_CAP,
    energyUpdatedAt: Date.now(),
    trophies: [],
    badges: [],
    winStreaks: {},
    items: [],
    raceRecords: [],
    gpUnlocked: { g2: false, g1: false },
    freeRebalance: false,
    coins: 0,
    bets: [],
    maxHorses: MAX_HORSES,
    daily: freshDaily(),
    tasks: freshTasks(),
    stats: freshStats(),
    avatarHorseId: null,
    displayTrophies: [],
    raceSession: null,
    savedAt: 0, // untouched save loses to any real cloud data on first sync
  };
}

// Profile prefs (icon horse + trophy shelf) — default sensibly for older saves.
function normProfile(d: Record<string, unknown>): {
  avatarHorseId: string | null;
  displayTrophies: number[];
} {
  const avatarHorseId = typeof d.avatarHorseId === 'string' ? d.avatarHorseId : null;
  const displayTrophies = Array.isArray(d.displayTrophies)
    ? (d.displayTrophies as unknown[]).filter((n): n is number => n === 1 || n === 2 || n === 3).slice(0, 5)
    : [];
  return { avatarHorseId, displayTrophies };
}

function normGp(v: unknown): { g2: boolean; g1: boolean } {
  const g = (v ?? {}) as { g2?: boolean; g1?: boolean };
  return { g2: !!g.g2, g1: !!g.g1 };
}

// Balanced 40-point spread for horses that predate any stats (v1/v2).
const BALANCED_40: Stats = { spd: 7, sta: 7, pwr: 7, jmp: 7, gut: 6, wit: 6 };

// Keep a stored in-progress race only if it's structurally sound (改修：レース継続);
// anything unexpected just drops back to "no active race".
function normRaceSession(v: unknown): RaceSession | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  if (s.kind !== 'single' || typeof s.seed !== 'number' || typeof s.courseId !== 'string' || !s.player) return null;
  return s as unknown as RaceSession;
}

// Migrate any stored payload up to v4, preserving collection/horses.
// Returns { data, migrated } — migrated=true when an upgrade happened.
export function migrate(parsed: unknown): { data: SaveData; migrated: boolean } | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const d = parsed as Record<string, unknown>;
  if (typeof d.owned !== 'object' || d.owned === null || !Array.isArray(d.horses)) return null;
  const owned = d.owned as Record<string, number>;
  const horses = d.horses as Horse[];

  const energy = typeof d.energy === 'number' ? d.energy : ENERGY_CAP;
  const energyUpdatedAt = typeof d.energyUpdatedAt === 'number' ? d.energyUpdatedAt : Date.now();
  const trophies = Array.isArray(d.trophies) ? (d.trophies as Trophy[]) : [];
  const badges = Array.isArray(d.badges) ? (d.badges as Badge[]) : [];
  const winStreaks =
    d.winStreaks && typeof d.winStreaks === 'object' ? (d.winStreaks as Record<string, number>) : {};
  const items = Array.isArray(d.items) ? (d.items as TrainingItem[]) : [];
  const raceRecords = Array.isArray(d.raceRecords) ? (d.raceRecords as RaceRecord[]) : [];
  const savedAt = typeof d.savedAt === 'number' ? d.savedAt : 0;
  // v6 (RACE_V4 §4) economy fields — default sensibly for older saves.
  const coins = typeof d.coins === 'number' ? d.coins : 0;
  const bets = Array.isArray(d.bets) ? (d.bets as SaveData['bets']) : [];
  const maxHorses = typeof d.maxHorses === 'number' ? d.maxHorses : MAX_HORSES;
  const daily = normDaily(d.daily);
  const tasks = normTasks(d.tasks);
  // Profile stats: normalize, and one-time backfill from bet history for saves
  // that predate the feature (missing, or still all-zero) so past data shows up.
  let stats = normStats(d.stats);
  const statsEmpty = stats.betsPlaced === 0 && stats.maxOdds === 0 && stats.maxPayout === 0 && stats.maxRecoveryPct === 0;
  if ((d.stats == null || statsEmpty) && bets.length > 0) stats = deriveStatsFromBets(bets);

  if (d.version === 6) {
    return {
      data: {
        version: 6,
        owned,
        horses,
        energy,
        energyUpdatedAt,
        trophies,
        badges,
        winStreaks,
        items,
        raceRecords,
        gpUnlocked: normGp(d.gpUnlocked),
        freeRebalance: !!d.freeRebalance,
        coins,
        bets,
        maxHorses,
        daily,
        tasks,
        stats,
        ...normProfile(d),
        raceSession: normRaceSession(d.raceSession),
        savedAt,
      },
      migrated: false,
    };
  }

  // v1/v2/v3 -> v4 stat rescale (RACE_V3 §3.6); v4 -> v5 just adds `badges: []`.
  const isPreV4 = d.version !== 4;
  const rescaled = isPreV4
    ? horses.map((h) => ({ ...h, stats: h.stats ? rescaleTo40(h.stats) : { ...BALANCED_40 } }))
    : horses;
  return {
    data: {
      version: 6,
      owned,
      horses: rescaled,
      energy,
      energyUpdatedAt,
      trophies,
      badges,
      winStreaks,
      items,
      raceRecords,
      gpUnlocked: normGp(d.gpUnlocked),
      freeRebalance: isPreV4 ? horses.length > 0 : !!d.freeRebalance,
      coins,
      bets,
      maxHorses,
      daily,
      tasks,
      stats,
      ...normProfile(d),
      savedAt,
    },
    migrated: isPreV4, // only the v3→v4 stat change warrants the one-time notice
  };
}

function loadKey(key: string): { data: SaveData; migrated: boolean } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { data: freshSave(), migrated: false };
    return migrate(JSON.parse(raw)) ?? { data: freshSave(), migrated: false };
  } catch {
    return { data: freshSave(), migrated: false };
  }
}

function load(): { data: SaveData; migrated: boolean } {
  return loadKey(activeKey);
}

function persist(data: SaveData): void {
  try {
    localStorage.setItem(activeKey, JSON.stringify(data));
  } catch {
    // storage full / unavailable — keep running with in-memory state
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type SpawnedPart = { id: string; isNew: boolean };
export type SpawnResult = { parts: SpawnedPart[]; energyLeft: number } | null;

type Store = SaveData & {
  migrated: boolean; // true once, right after a save upgrade (for a one-time notice)
  clearMigrated: () => void;
  /** Replace the entire save (used when loading a cloud save on login). */
  hydrate: (data: SaveData) => void;
  /** Re-read state from an account's local slot (null = guest). Used on logout. */
  reloadFromKey: (uid: string | null) => void;
  /** Serialize the current save to a JSON string (backup export). */
  exportSave: () => string;
  /** Replace the save from an exported JSON string. Returns success. */
  importSave: (json: string) => boolean;
  doSpawn: (rng?: () => number) => SpawnResult;
  addHorse: (h: Omit<Horse, 'id' | 'createdAt' | 'stats'>, stats: Stats) => Horse | null;
  updateHorse: (id: string, patch: Partial<Pick<Horse, 'name' | 'colors' | 'decos'>>) => void;
  renameHorse: (id: string, name: string) => void;
  removeHorse: (id: string) => void;
  /** One-time free stat re-allocation after the v4 migration. Returns success. */
  rebalanceHorse: (id: string, stats: Stats) => boolean;
  addTrophies: (t: Trophy[]) => void;
  addBadges: (b: Badge[]) => void;
  grantItems: (items: TrainingItem[]) => void;
  unlockGp: (patch: { g2?: boolean; g1?: boolean }) => void;
  /** Consume item at index and raise `target` on the horse. Returns success. */
  trainHorse: (horseId: string, itemIndex: number, target: StatKey) => boolean;
  recordRace: (courseId: string, mode: 30 | 60, rank: number, time: number) => void;
  /** Record a finished single race: updates best time, win streak, and awards
   *  badges (ACCOUNT.md §2). Returns the newly-earned badges (for the cut-in). */
  finishNormalRace: (args: {
    horseId: string;
    courseId: string;
    mode: 30 | 60;
    rank: number;
    time: number;
    isJumpCourse: boolean;
    flawless: boolean;
  }) => Badge[];
  // Coin economy (RACE_V4 §4).
  addCoins: (n: number) => void;
  /** Spend coins if affordable. Returns true on success. */
  spendCoins: (n: number) => boolean;
  /** Record a settled bet (payout already added via addCoins by the caller). */
  recordBet: (bet: BetRecord) => void;
  /** Grass first-visits-of-day bonus (up to GRASS_DAILY_BONUS_MAX). Returns coins granted. */
  claimGrassBonus: () => number;
  /** Buy an extra grass charge (300, repeatable). Returns true on success. */
  buyOkawari: () => boolean;
  /** Begin a grand-prix attempt, consuming one of the day's plays (max
   *  GP_DAILY_LIMIT). Returns false when the daily limit is reached. */
  startGpAttempt: () => boolean;
  /** Expand the stable 10→15 for 3000 coins (once). Returns true on success. */
  expandSlots: () => boolean;
  // Coin-earning tasks (改修：タスク).
  /** Count one finished race toward the task (also banks a reward every N). Call
   *  ONLY on the result screen so it can't be farmed by bailing out mid-race. */
  finishRaceTask: () => void;
  /** Claim the whole task bank at once. Returns the coins granted (0 if empty). */
  claimTaskBank: () => number;
  /** Fold one race's betting outcome into the lifetime profile stats: best single
   *  payout (最大獲得賞金), best single-race 回収率 = payout ÷ staked (最高回収率),
   *  and the highest winning odds (最大オッズ). */
  recordBetStats: (r: { placed: number; staked: number; payout: number; wonOdds: number }) => void;
  /** Merge external maxima into the profile stats (raise-only). Used to backfill
   *  from the account's ranking history (best odds/payout) on sign-in. */
  foldStats: (p: Partial<PlayerStats>) => void;
  // Profile (avatar horse + trophy shelf).
  setAvatarHorse: (id: string | null) => void;
  setDisplayTrophies: (ranks: number[]) => void;
  // In-progress race, kept in the save so it resumes across reloads (改修：レース継続).
  raceSession: RaceSession | null;
  setRaceSession: (s: RaceSession | null) => void;
  patchRaceSession: (patch: Partial<RaceSession>) => void;
  resetAll: () => void;
};

export const useStore = create<Store>((set, get) => {
  const { data: initial, migrated } = load();
  if (migrated) persist(initial); // save the upgraded shape immediately

  const commit = (partial: Partial<SaveData>) => {
    const savedAt = Date.now();
    const next = { ...get(), ...partial, savedAt } as Store;
    const data: SaveData = {
      version: 6,
      owned: next.owned,
      horses: next.horses,
      energy: next.energy,
      energyUpdatedAt: next.energyUpdatedAt,
      trophies: next.trophies,
      badges: next.badges,
      winStreaks: next.winStreaks,
      items: next.items,
      raceRecords: next.raceRecords,
      gpUnlocked: next.gpUnlocked,
      freeRebalance: next.freeRebalance,
      coins: next.coins,
      bets: next.bets,
      maxHorses: next.maxHorses,
      daily: next.daily,
      tasks: next.tasks,
      stats: next.stats,
      avatarHorseId: next.avatarHorseId,
      displayTrophies: next.displayTrophies,
      raceSession: next.raceSession ?? null,
      savedAt,
    };
    persist(data);
    set({ ...(partial as Partial<Store>), savedAt });
  };

  return {
    ...initial,
    raceSession: initial.raceSession ?? null,
    migrated,
    clearMigrated: () => set({ migrated: false }),

    hydrate: (data) => {
      persist(data); // keep cloud's savedAt as-is (do not bump)
      set({ ...data, migrated: false });
    },

    reloadFromKey: (uid) => {
      bindSaveKey(uid);
      const { data } = loadKey(activeKey);
      set({ ...data, migrated: false });
    },

    exportSave: () => {
      const s = get();
      const data: SaveData = {
        version: 6,
        owned: s.owned,
        horses: s.horses,
        energy: s.energy,
        energyUpdatedAt: s.energyUpdatedAt,
        trophies: s.trophies,
        badges: s.badges,
        winStreaks: s.winStreaks,
        items: s.items,
        raceRecords: s.raceRecords,
        gpUnlocked: s.gpUnlocked,
        freeRebalance: s.freeRebalance,
        coins: s.coins,
        bets: s.bets,
        maxHorses: s.maxHorses,
        daily: s.daily,
        tasks: s.tasks,
        stats: s.stats,
        avatarHorseId: s.avatarHorseId,
        displayTrophies: s.displayTrophies,
        savedAt: s.savedAt,
      };
      return JSON.stringify(data);
    },

    importSave: (json) => {
      try {
        const parsed = migrate(JSON.parse(json));
        if (!parsed) return false;
        const data = { ...parsed.data, savedAt: Date.now() }; // treat import as newest
        persist(data);
        set({ ...data, migrated: false });
        return true;
      } catch {
        return false;
      }
    },

    doSpawn: (rng = Math.random) => {
      const now = Date.now();
      const spent = spendEnergy({ energy: get().energy, energyUpdatedAt: get().energyUpdatedAt }, now);
      if (!spent) return null;

      const ids = gachaSpawn(rng, allParts);
      const owned = { ...get().owned };
      const parts: SpawnedPart[] = ids.map((id) => {
        const isNew = !owned[id];
        owned[id] = (owned[id] ?? 0) + 1;
        return { id, isNew };
      });
      // Grass task (改修：タスク): every 10 draws banks a reward.
      const t = get().tasks;
      const grassSpawns = t.grassSpawns + 1;
      const gCycles = cyclesOf(grassSpawns, GRASS_TASK_EVERY);
      const tasks = {
        ...t,
        grassSpawns,
        grassBanked: Math.max(t.grassBanked, gCycles),
        bank: t.bank + newlyBanked(grassSpawns, t.grassBanked, GRASS_TASK_EVERY, GRASS_TASK_REWARD),
      };
      commit({ owned, energy: spent.energy, energyUpdatedAt: spent.energyUpdatedAt, tasks });
      return { parts, energyLeft: spent.energy };
    },

    addHorse: (h, stats) => {
      if (get().horses.length >= get().maxHorses) return null;
      const id = newId();
      const horse: Horse = { ...h, id, stats, createdAt: Date.now() };
      commit({ horses: [...get().horses, horse] });
      return horse;
    },

    updateHorse: (id, patch) => {
      commit({ horses: get().horses.map((h) => (h.id === id ? { ...h, ...patch } : h)) });
    },

    renameHorse: (id, name) => {
      commit({ horses: get().horses.map((h) => (h.id === id ? { ...h, name } : h)) });
    },

    removeHorse: (id) => {
      commit({
        horses: get().horses.filter((h) => h.id !== id),
        trophies: get().trophies.filter((t) => t.horseId !== id),
        badges: get().badges.filter((b) => b.horseId !== id),
      });
    },

    rebalanceHorse: (id, stats) => {
      if (!get().freeRebalance) return false;
      const exists = get().horses.some((h) => h.id === id);
      if (!exists) return false;
      commit({
        horses: get().horses.map((h) => (h.id === id ? { ...h, stats } : h)),
        freeRebalance: false, // consume the one-time free rebalance
      });
      return true;
    },

    addTrophies: (t) => {
      if (t.length === 0) return;
      commit({ trophies: [...get().trophies, ...t] });
    },

    addBadges: (b) => {
      if (b.length === 0) return;
      commit({ badges: [...get().badges, ...b] });
    },

    grantItems: (items) => {
      if (items.length === 0) return;
      commit({ items: [...get().items, ...items] });
    },

    unlockGp: (patch) => {
      const cur = get().gpUnlocked;
      const next = { g2: cur.g2 || !!patch.g2, g1: cur.g1 || !!patch.g1 };
      if (next.g2 === cur.g2 && next.g1 === cur.g1) return;
      commit({ gpUnlocked: next });
    },

    trainHorse: (horseId, itemIndex, target) => {
      const horse = get().horses.find((h) => h.id === horseId);
      const item = get().items[itemIndex];
      if (!horse || !item) return false;
      if (item.kind === 'stat' && item.stat !== target) return false; // stat items are fixed
      const next = applyTraining(horse.stats, target);
      if (!next) return false; // capped — item is NOT consumed
      const items = get().items.slice();
      items.splice(itemIndex, 1);
      commit({
        horses: get().horses.map((h) => (h.id === horseId ? { ...h, stats: next } : h)),
        items,
      });
      return true;
    },

    recordRace: (courseId, mode, rank, time) => {
      const records = get().raceRecords.slice();
      const i = records.findIndex((r) => r.courseId === courseId && r.mode === mode);
      if (i < 0) {
        records.push({ courseId, mode, bestRank: rank, bestTime: time });
      } else {
        const cur = records[i];
        records[i] = {
          ...cur,
          bestRank: Math.min(cur.bestRank, rank),
          bestTime: Math.min(cur.bestTime, time),
        };
      }
      commit({ raceRecords: records });
    },

    finishNormalRace: ({ horseId, courseId, mode, rank, time, isJumpCourse, flawless }) => {
      const s = get();
      const prevBest = s.raceRecords.find((r) => r.courseId === courseId && r.mode === mode);
      const isNewRecord = !prevBest || time < prevBest.bestTime;

      const { badges: awarded, newStreak } = evaluateBadges(
        { horseId, rank, courseId, isJumpCourse, flawless, isNewRecord },
        {
          existing: s.badges.filter((b) => b.horseId === horseId),
          priorStreak: s.winStreaks[horseId] ?? 0,
          allCourseIds: COURSES.map((c) => c.id),
        },
      );

      // Update best time (reuse the same rule as recordRace).
      const records = s.raceRecords.slice();
      const i = records.findIndex((r) => r.courseId === courseId && r.mode === mode);
      if (i < 0) records.push({ courseId, mode, bestRank: rank, bestTime: time });
      else records[i] = { ...records[i], bestRank: Math.min(records[i].bestRank, rank), bestTime: Math.min(records[i].bestTime, time) };

      commit({
        raceRecords: records,
        badges: [...s.badges, ...awarded],
        winStreaks: { ...s.winStreaks, [horseId]: newStreak },
      });
      return awarded;
    },

    addCoins: (n) => {
      if (!n) return;
      commit({ coins: Math.max(0, get().coins + n) });
    },

    spendCoins: (n) => {
      if (get().coins < n) return false;
      commit({ coins: get().coins - n });
      return true;
    },

    recordBet: (bet) => {
      commit({ bets: [bet, ...get().bets].slice(0, BETS_CAP) });
    },

    claimGrassBonus: () => {
      const s = get();
      const today = dayKey();
      const daily = s.daily.day === today ? s.daily : freshDaily();
      if (daily.grassBonus >= GRASS_DAILY_BONUS_MAX) {
        if (s.daily.day !== today) commit({ daily });
        return 0;
      }
      commit({
        coins: s.coins + GRASS_DAILY_BONUS,
        daily: { ...daily, grassBonus: daily.grassBonus + 1 },
      });
      return GRASS_DAILY_BONUS;
    },

    buyOkawari: () => {
      // Repeatable now: buy an extra grass charge any time coins allow and the
      // stock isn't already full (no once-per-day cap).
      const s = get();
      const today = dayKey();
      const daily = s.daily.day === today ? s.daily : freshDaily();
      if (s.coins < GRASS_OKAWARI_COST || s.energy >= ENERGY_CAP) return false;
      commit({
        coins: s.coins - GRASS_OKAWARI_COST,
        energy: Math.min(ENERGY_CAP, s.energy + 1),
        daily: { ...daily, okawari: daily.okawari + 1 },
      });
      return true;
    },

    startGpAttempt: () => {
      // Grand-prix is limited to GP_DAILY_LIMIT attempts per day (qualifier +
      // final together count as one). Returns false when the day's limit is hit.
      const s = get();
      const today = dayKey();
      const daily = s.daily.day === today ? s.daily : freshDaily();
      if (daily.gp >= GP_DAILY_LIMIT) {
        if (s.daily.day !== today) commit({ daily });
        return false;
      }
      commit({ daily: { ...daily, gp: daily.gp + 1 } });
      return true;
    },

    expandSlots: () => {
      const s = get();
      if (s.maxHorses >= SLOT_EXPAND_TO || s.coins < SLOT_EXPAND_COST) return false;
      commit({ coins: s.coins - SLOT_EXPAND_COST, maxHorses: SLOT_EXPAND_TO });
      return true;
    },

    finishRaceTask: () => {
      const t = get().tasks;
      const racesFinished = t.racesFinished + 1;
      const cycles = cyclesOf(racesFinished, RACE_TASK_EVERY);
      commit({
        tasks: {
          ...t,
          racesFinished,
          raceBanked: Math.max(t.raceBanked, cycles),
          bank: t.bank + newlyBanked(racesFinished, t.raceBanked, RACE_TASK_EVERY, RACE_TASK_REWARD),
        },
      });
    },

    claimTaskBank: () => {
      const s = get();
      const coins = s.tasks.bank;
      if (coins <= 0) return 0;
      commit({ coins: s.coins + coins, tasks: { ...s.tasks, bank: 0 } });
      return coins;
    },

    recordBetStats: ({ placed, staked, payout, wonOdds }) => {
      if (placed <= 0 && payout <= 0) return;
      const s = get().stats;
      const recovery = staked > 0 ? Math.round((payout / staked) * 100) : 0;
      commit({
        stats: {
          betsPlaced: s.betsPlaced + Math.max(0, placed),
          maxPayout: Math.max(s.maxPayout, payout),
          maxRecoveryPct: Math.max(s.maxRecoveryPct, recovery),
          maxOdds: Math.max(s.maxOdds, wonOdds),
        },
      });
    },

    foldStats: (p) => {
      const s = get().stats;
      const next: PlayerStats = {
        betsPlaced: Math.max(s.betsPlaced, p.betsPlaced ?? 0),
        maxPayout: Math.max(s.maxPayout, p.maxPayout ?? 0),
        maxRecoveryPct: Math.max(s.maxRecoveryPct, p.maxRecoveryPct ?? 0),
        maxOdds: Math.max(s.maxOdds, p.maxOdds ?? 0),
      };
      if (
        next.betsPlaced !== s.betsPlaced ||
        next.maxPayout !== s.maxPayout ||
        next.maxRecoveryPct !== s.maxRecoveryPct ||
        next.maxOdds !== s.maxOdds
      ) {
        commit({ stats: next });
      }
    },

    setAvatarHorse: (id) => commit({ avatarHorseId: id }),
    setDisplayTrophies: (ranks) =>
      commit({
        displayTrophies: ranks.filter((n) => n === 1 || n === 2 || n === 3).slice(0, 5),
      }),

    setRaceSession: (s) => commit({ raceSession: s }),
    patchRaceSession: (patch) => {
      const cur = get().raceSession;
      if (!cur) return;
      commit({ raceSession: { ...cur, ...patch } });
    },

    resetAll: () => commit({ ...freshSave() }),
  };
});

// Selector helpers -----------------------------------------------------------

export function isOwned(owned: Record<string, number>, id: string): boolean {
  return (owned[id] ?? 0) > 0;
}

export function trophyCount(trophies: Trophy[], horseId: string): number {
  return trophies.filter((t) => t.horseId === horseId).length;
}

export const COLOR_SLOTS_ORDER: ColorSlot[] = ['body', 'mane', 'hoof'];
export const DECO_SLOTS_ORDER: DecoSlot[] = ['head', 'face', 'back', 'tail'];
