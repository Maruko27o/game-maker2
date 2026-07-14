import { create } from 'zustand';
import type {
  SaveData,
  Horse,
  ColorSlot,
  DecoSlot,
  Trophy,
  TrainingItem,
  RaceRecord,
  Stats,
  StatKey,
} from './types';
import { allParts } from './data/parts';
import { spawn as gachaSpawn } from './logic/gacha';
import { ENERGY_CAP, spendEnergy } from './logic/energy';
import { rescaleTo40 } from './logic/stats';
import { applyTraining } from './logic/training';

export const STORAGE_KEY = 'horse-game/v1'; // storage slot; payload is versioned inside
export const MAX_HORSES = 10;

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

function freshSave(): SaveData {
  return {
    version: 4,
    owned: starterOwned(),
    horses: [],
    energy: ENERGY_CAP,
    energyUpdatedAt: Date.now(),
    trophies: [],
    items: [],
    raceRecords: [],
    gpUnlocked: { g2: false, g1: false },
    freeRebalance: false,
    savedAt: 0, // untouched save loses to any real cloud data on first sync
  };
}

function normGp(v: unknown): { g2: boolean; g1: boolean } {
  const g = (v ?? {}) as { g2?: boolean; g1?: boolean };
  return { g2: !!g.g2, g1: !!g.g1 };
}

// Balanced 40-point spread for horses that predate any stats (v1/v2).
const BALANCED_40: Stats = { spd: 7, sta: 7, pwr: 7, jmp: 7, gut: 6, wit: 6 };

// Migrate any stored payload up to v4, preserving collection/horses.
// Returns { data, migrated } — migrated=true when an upgrade happened.
function migrate(parsed: unknown): { data: SaveData; migrated: boolean } | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const d = parsed as Record<string, unknown>;
  if (typeof d.owned !== 'object' || d.owned === null || !Array.isArray(d.horses)) return null;
  const owned = d.owned as Record<string, number>;
  const horses = d.horses as Horse[];

  const energy = typeof d.energy === 'number' ? d.energy : ENERGY_CAP;
  const energyUpdatedAt = typeof d.energyUpdatedAt === 'number' ? d.energyUpdatedAt : Date.now();
  const trophies = Array.isArray(d.trophies) ? (d.trophies as Trophy[]) : [];
  const items = Array.isArray(d.items) ? (d.items as TrainingItem[]) : [];
  const raceRecords = Array.isArray(d.raceRecords) ? (d.raceRecords as RaceRecord[]) : [];
  const savedAt = typeof d.savedAt === 'number' ? d.savedAt : 0;

  if (d.version === 4) {
    return {
      data: {
        version: 4,
        owned,
        horses,
        energy,
        energyUpdatedAt,
        trophies,
        items,
        raceRecords,
        gpUnlocked: normGp(d.gpUnlocked),
        freeRebalance: !!d.freeRebalance,
        savedAt,
      },
      migrated: false,
    };
  }

  // v1/v2/v3 -> v4: re-scale every horse's stats to sum 40 (RACE_V3 §3.6) and
  // grant one free re-allocation so the player can adapt to the new rules.
  const rescaled = horses.map((h) => ({
    ...h,
    stats: h.stats ? rescaleTo40(h.stats) : { ...BALANCED_40 },
  }));
  return {
    data: {
      version: 4,
      owned,
      horses: rescaled,
      energy,
      energyUpdatedAt,
      trophies,
      items,
      raceRecords,
      gpUnlocked: normGp(d.gpUnlocked),
      freeRebalance: horses.length > 0, // only worth a rebalance if there are horses
      savedAt,
    },
    migrated: true,
  };
}

function load(): { data: SaveData; migrated: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: freshSave(), migrated: false };
    return migrate(JSON.parse(raw)) ?? { data: freshSave(), migrated: false };
  } catch {
    return { data: freshSave(), migrated: false };
  }
}

function persist(data: SaveData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
  doSpawn: (rng?: () => number) => SpawnResult;
  addHorse: (h: Omit<Horse, 'id' | 'createdAt' | 'stats'>, stats: Stats) => Horse | null;
  updateHorse: (id: string, patch: Partial<Pick<Horse, 'name' | 'colors' | 'decos'>>) => void;
  renameHorse: (id: string, name: string) => void;
  removeHorse: (id: string) => void;
  /** One-time free stat re-allocation after the v4 migration. Returns success. */
  rebalanceHorse: (id: string, stats: Stats) => boolean;
  addTrophies: (t: Trophy[]) => void;
  grantItems: (items: TrainingItem[]) => void;
  unlockGp: (patch: { g2?: boolean; g1?: boolean }) => void;
  /** Consume item at index and raise `target` on the horse. Returns success. */
  trainHorse: (horseId: string, itemIndex: number, target: StatKey) => boolean;
  recordRace: (courseId: string, mode: 30 | 60, rank: number, time: number) => void;
  resetAll: () => void;
};

export const useStore = create<Store>((set, get) => {
  const { data: initial, migrated } = load();
  if (migrated) persist(initial); // save the upgraded shape immediately

  const commit = (partial: Partial<SaveData>) => {
    const savedAt = Date.now();
    const next = { ...get(), ...partial, savedAt } as Store;
    const data: SaveData = {
      version: 4,
      owned: next.owned,
      horses: next.horses,
      energy: next.energy,
      energyUpdatedAt: next.energyUpdatedAt,
      trophies: next.trophies,
      items: next.items,
      raceRecords: next.raceRecords,
      gpUnlocked: next.gpUnlocked,
      freeRebalance: next.freeRebalance,
      savedAt,
    };
    persist(data);
    set({ ...(partial as Partial<Store>), savedAt });
  };

  return {
    ...initial,
    migrated,
    clearMigrated: () => set({ migrated: false }),

    hydrate: (data) => {
      persist(data); // keep cloud's savedAt as-is (do not bump)
      set({ ...data, migrated: false });
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
      commit({ owned, energy: spent.energy, energyUpdatedAt: spent.energyUpdatedAt });
      return { parts, energyLeft: spent.energy };
    },

    addHorse: (h, stats) => {
      if (get().horses.length >= MAX_HORSES) return null;
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
