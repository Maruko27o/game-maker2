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
import { rollStats, rngFromId } from './logic/stats';
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
    version: 3,
    owned: starterOwned(),
    horses: [],
    energy: ENERGY_CAP,
    energyUpdatedAt: Date.now(),
    trophies: [],
    items: [],
    raceRecords: [],
    savedAt: 0, // untouched save loses to any real cloud data on first sync
  };
}

// Give a horse reproducible stats seeded from its id (RACE.md §11).
function statsForId(id: string): Stats {
  return rollStats(rngFromId(id));
}

// Migrate any stored payload up to v3, preserving collection/horses.
// Returns { data, migrated } — migrated=true when an upgrade happened.
function migrate(parsed: unknown): { data: SaveData; migrated: boolean } | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const d = parsed as Record<string, unknown>;
  if (typeof d.owned !== 'object' || d.owned === null || !Array.isArray(d.horses)) return null;
  const owned = d.owned as Record<string, number>;
  const horses = d.horses as Horse[];

  if (d.version === 3) {
    return {
      data: {
        version: 3,
        owned,
        horses,
        energy: typeof d.energy === 'number' ? d.energy : ENERGY_CAP,
        energyUpdatedAt: typeof d.energyUpdatedAt === 'number' ? d.energyUpdatedAt : Date.now(),
        trophies: Array.isArray(d.trophies) ? (d.trophies as Trophy[]) : [],
        items: Array.isArray(d.items) ? (d.items as TrainingItem[]) : [],
        raceRecords: Array.isArray(d.raceRecords) ? (d.raceRecords as RaceRecord[]) : [],
        savedAt: typeof d.savedAt === 'number' ? d.savedAt : 0,
      },
      migrated: false,
    };
  }

  // v1 (0:00/12:00 slot) or v2 (energy, no stats) -> v3.
  const energy =
    d.version === 2 && typeof d.energy === 'number' ? (d.energy as number) : ENERGY_CAP;
  const energyUpdatedAt =
    d.version === 2 && typeof d.energyUpdatedAt === 'number'
      ? (d.energyUpdatedAt as number)
      : Date.now();
  const withStats = horses.map((h) => ({ ...h, stats: h.stats ?? statsForId(h.id) }));
  return {
    data: {
      version: 3,
      owned,
      horses: withStats,
      energy,
      energyUpdatedAt,
      trophies: [],
      items: [],
      raceRecords: [],
      savedAt: typeof d.savedAt === 'number' ? d.savedAt : 0,
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
  addHorse: (h: Omit<Horse, 'id' | 'createdAt' | 'stats'>) => Horse | null;
  updateHorse: (id: string, patch: Partial<Pick<Horse, 'name' | 'colors' | 'decos'>>) => void;
  renameHorse: (id: string, name: string) => void;
  removeHorse: (id: string) => void;
  addTrophies: (t: Trophy[]) => void;
  grantItems: (items: TrainingItem[]) => void;
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
      version: 3,
      owned: next.owned,
      horses: next.horses,
      energy: next.energy,
      energyUpdatedAt: next.energyUpdatedAt,
      trophies: next.trophies,
      items: next.items,
      raceRecords: next.raceRecords,
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

    addHorse: (h) => {
      if (get().horses.length >= MAX_HORSES) return null;
      const id = newId();
      const horse: Horse = { ...h, id, stats: statsForId(id), createdAt: Date.now() };
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

    addTrophies: (t) => {
      if (t.length === 0) return;
      commit({ trophies: [...get().trophies, ...t] });
    },

    grantItems: (items) => {
      if (items.length === 0) return;
      commit({ items: [...get().items, ...items] });
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
