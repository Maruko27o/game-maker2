import { create } from 'zustand';
import type { SaveData, Horse, ColorSlot, DecoSlot } from './types';
import { allParts } from './data/parts';
import { spawn as gachaSpawn } from './logic/gacha';
import { ENERGY_CAP, spendEnergy } from './logic/energy';

export const STORAGE_KEY = 'horse-game/v1'; // storage slot; payload is versioned inside
export const MAX_HORSES = 10;

// Starter parts so a brand-new player can build a horse immediately without
// collecting first — basic colors for every color slot (CLAUDE.md follow-up).
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
    version: 2,
    owned: starterOwned(),
    horses: [],
    energy: ENERGY_CAP, // start with a full stock
    energyUpdatedAt: Date.now(),
  };
}

// Accept a stored payload, migrating older versions while keeping the player's
// collection and horses. Returns null when the data is unusable.
function migrate(parsed: unknown): SaveData | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const d = parsed as Record<string, unknown>;
  if (typeof d.owned !== 'object' || d.owned === null || !Array.isArray(d.horses)) return null;
  const owned = d.owned as Record<string, number>;
  const horses = d.horses as Horse[];

  if (d.version === 2 && typeof d.energy === 'number' && typeof d.energyUpdatedAt === 'number') {
    return { version: 2, owned, horses, energy: d.energy, energyUpdatedAt: d.energyUpdatedAt };
  }
  if (d.version === 1) {
    // v1 had a single 0:00/12:00 reset slot; grant a full stock on upgrade.
    return { version: 2, owned, horses, energy: ENERGY_CAP, energyUpdatedAt: Date.now() };
  }
  return null;
}

function load(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshSave();
    return migrate(JSON.parse(raw)) ?? freshSave();
  } catch {
    return freshSave();
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
  /** Spend one energy to draw parts from the grass. Returns null if no energy. */
  doSpawn: (rng?: () => number) => SpawnResult;
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
      version: 2,
      owned: next.owned,
      horses: next.horses,
      energy: next.energy,
      energyUpdatedAt: next.energyUpdatedAt,
    };
    persist(data);
    set(partial as Partial<Store>);
  };

  return {
    ...initial,

    doSpawn: (rng = Math.random) => {
      const now = Date.now();
      const spent = spendEnergy({ energy: get().energy, energyUpdatedAt: get().energyUpdatedAt }, now);
      if (!spent) return null; // out of energy

      const ids = gachaSpawn(rng, allParts);
      const owned = { ...get().owned };
      const parts: SpawnedPart[] = ids.map((id) => {
        const isNew = !owned[id];
        owned[id] = (owned[id] ?? 0) + 1; // count also tracks "kaburi" duplicates
        return { id, isNew };
      });
      commit({ owned, energy: spent.energy, energyUpdatedAt: spent.energyUpdatedAt });
      return { parts, energyLeft: spent.energy };
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

    resetAll: () => commit({ ...freshSave() }),
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
