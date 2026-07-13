import { create } from 'zustand';
import type { SaveData, Horse, ColorSlot, DecoSlot } from './types';
import { allParts } from './data/parts';
import { spawn as gachaSpawn } from './logic/gacha';

export const STORAGE_KEY = 'horse-game/v1';
export const MAX_HORSES = 10;

const EMPTY: SaveData = { version: 1, owned: {}, horses: [], lastSpawnAt: null };

function isValid(data: unknown): data is SaveData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    d.version === 1 &&
    typeof d.owned === 'object' &&
    d.owned !== null &&
    Array.isArray(d.horses) &&
    (d.lastSpawnAt === null || typeof d.lastSpawnAt === 'number')
  );
}

function load(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw);
    if (!isValid(parsed)) return { ...EMPTY }; // corrupt / unknown version -> reset
    return parsed;
  } catch {
    return { ...EMPTY };
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

type Store = SaveData & {
  /** Draw parts from the grass, add them to the collection, consume the slot. */
  doSpawn: (rng?: () => number) => SpawnedPart[];
  addHorse: (h: Omit<Horse, 'id' | 'createdAt'>) => Horse | null;
  updateHorse: (id: string, patch: Partial<Pick<Horse, 'name' | 'colors' | 'decos'>>) => void;
  renameHorse: (id: string, name: string) => void;
  removeHorse: (id: string) => void;
  /** Test / debug helper. */
  resetAll: () => void;
};

export const useStore = create<Store>((set, get) => {
  const initial = load();

  const commit = (partial: Partial<SaveData>) => {
    const next = { ...get(), ...partial } as Store;
    const data: SaveData = {
      version: 1,
      owned: next.owned,
      horses: next.horses,
      lastSpawnAt: next.lastSpawnAt,
    };
    persist(data);
    set(partial as Partial<Store>);
  };

  return {
    ...initial,

    doSpawn: (rng = Math.random) => {
      const ids = gachaSpawn(rng, allParts);
      const owned = { ...get().owned };
      const result: SpawnedPart[] = ids.map((id) => {
        const isNew = !owned[id];
        owned[id] = (owned[id] ?? 0) + 1; // count also tracks "kaburi" duplicates
        return { id, isNew };
      });
      commit({ owned, lastSpawnAt: Date.now() });
      return result;
    },

    addHorse: (h) => {
      if (get().horses.length >= MAX_HORSES) return null;
      const horse: Horse = { ...h, id: newId(), createdAt: Date.now() };
      commit({ horses: [...get().horses, horse] });
      return horse;
    },

    updateHorse: (id, patch) => {
      commit({
        horses: get().horses.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      });
    },

    renameHorse: (id, name) => {
      commit({ horses: get().horses.map((h) => (h.id === id ? { ...h, name } : h)) });
    },

    removeHorse: (id) => {
      commit({ horses: get().horses.filter((h) => h.id !== id) });
    },

    resetAll: () => commit({ ...EMPTY }),
  };
});

// Selector helpers -----------------------------------------------------------

export function ownedCount(owned: Record<string, number>, id: string): number {
  return owned[id] ?? 0;
}

export function isOwned(owned: Record<string, number>, id: string): boolean {
  return (owned[id] ?? 0) > 0;
}

export const COLOR_SLOTS_ORDER: ColorSlot[] = ['body', 'mane', 'hoof'];
export const DECO_SLOTS_ORDER: DecoSlot[] = ['head', 'face', 'back', 'tail'];
