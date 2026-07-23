// parts.json is the single source of truth (CLAUDE.md §3.2). Everything reads
// from here — no hardcoded part lists anywhere else.
import raw from './parts.json';
import type { ColorPart, DecoPart, ColorSlot, DecoSlot, Rarity } from '../types';

type PartsFile = {
  colors: Record<ColorSlot, ColorPart[]>;
  decos: DecoPart[];
};

const data = raw as PartsFile;

export const COLOR_SLOTS: ColorSlot[] = ['body', 'mane', 'hoof'];
export const DECO_SLOTS: DecoSlot[] = ['head', 'face', 'back', 'tail'];

export const colorsBySlot = data.colors;
export const decos = data.decos;

export const decosBySlot: Record<DecoSlot, DecoPart[]> = {
  head: decos.filter((d) => d.slot === 'head'),
  face: decos.filter((d) => d.slot === 'face'),
  back: decos.filter((d) => d.slot === 'back'),
  tail: decos.filter((d) => d.slot === 'tail'),
};

// Flat id -> part lookups.
export const colorById: Record<string, ColorPart> = {};
export const colorSlotById: Record<string, ColorSlot> = {};
for (const slot of COLOR_SLOTS) {
  for (const c of colorsBySlot[slot]) {
    colorById[c.id] = c;
    colorSlotById[c.id] = slot;
  }
}

export const decoById: Record<string, DecoPart> = {};
for (const d of decos) decoById[d.id] = d;

// Every part id (colors + decos), used for the collection grid and the gacha pool.
export type PoolEntry = { id: string; rarity: Rarity };

export const allParts: PoolEntry[] = [
  ...COLOR_SLOTS.flatMap((s) => colorsBySlot[s].map((c) => ({ id: c.id, rarity: c.rarity }))),
  ...decos.map((d) => ({ id: d.id, rarity: d.rarity })),
];

export const TOTAL_PARTS = allParts.length; // 48

export function isColorId(id: string): boolean {
  return id in colorById;
}

export function partName(id: string): string {
  return colorById[id]?.name ?? decoById[id]?.name ?? id;
}

export function partRarity(id: string): Rarity {
  return colorById[id]?.rarity ?? decoById[id]?.rarity ?? 'N';
}

/** The equip 部位（slot）a part occupies — a color slot (body/mane/hoof) or a
 *  deco slot (head/face/back/tail). A single grass draw keeps to one part per
 *  slot so the wild horse that appears wears exactly the parts you receive. */
export function slotOf(id: string): string {
  const cs = colorSlotById[id];
  if (cs) return `color:${cs}`;
  const d = decoById[id];
  if (d) return `deco:${d.slot}`;
  return id;
}
