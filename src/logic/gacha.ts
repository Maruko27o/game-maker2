// Pure gacha logic (CLAUDE.md §5.3). No side effects, RNG is injected so the
// distribution can be tested. The store is responsible for applying results to
// save data (owned counts, duplicates).
import type { Rarity } from '../types';

export type Poolable = { id: string; rarity: Rarity };

export type RNG = () => number; // [0, 1)

// How many parts a single spawn yields. Cumulative over 50/40/7/3 (= 100%).
export const COUNT_TABLE: { count: number; p: number }[] = [
  { count: 1, p: 0.5 },
  { count: 2, p: 0.4 },
  { count: 3, p: 0.07 },
  { count: 4, p: 0.03 },
];

// Rarity draw weights.
export const RARITY_WEIGHT: Record<Rarity, number> = { N: 70, R: 25, SR: 5 };

/** Pick how many parts this spawn yields (1..4). */
export function pickCount(rng: RNG): number {
  const r = rng();
  let acc = 0;
  for (const { count, p } of COUNT_TABLE) {
    acc += p;
    if (r < acc) return count;
  }
  return COUNT_TABLE[COUNT_TABLE.length - 1].count; // fallback for r ~= 1
}

/** Weighted single pick from the pool by rarity. */
export function pickOne<T extends Poolable>(rng: RNG, pool: T[]): T {
  const total = pool.reduce((s, e) => s + RARITY_WEIGHT[e.rarity], 0);
  let r = rng() * total;
  for (const e of pool) {
    r -= RARITY_WEIGHT[e.rarity];
    if (r < 0) return e;
  }
  return pool[pool.length - 1];
}

/**
 * Draw `count` parts from the pool, distinct by `keyOf` (defaults to the part
 * id). Re-rolls on a repeat key within the same draw (CLAUDE.md §5.3). Passing a
 * slot key makes a single draw hold at most one part per 部位. Returns the drawn
 * part ids in draw order.
 */
export function drawParts<T extends Poolable>(
  rng: RNG,
  pool: T[],
  count: number,
  keyOf: (e: T) => string = (e) => e.id,
): string[] {
  // The number of distinct keys caps the draw (e.g. one part per slot).
  const distinctKeys = new Set(pool.map(keyOf)).size;
  const n = Math.min(count, distinctKeys);
  const picked: string[] = [];
  const seenKeys = new Set<string>();
  // Bounded reroll: with a 48-part pool and count<=4 this terminates quickly.
  let guard = 0;
  while (picked.length < n && guard < 10000) {
    guard++;
    const e = pickOne(rng, pool);
    const k = keyOf(e);
    if (seenKeys.has(k)) continue;
    seenKeys.add(k);
    picked.push(e.id);
  }
  return picked;
}

/** Full spawn: decide the count, then draw that many parts distinct by `keyOf`. */
export function spawn<T extends Poolable>(rng: RNG, pool: T[], keyOf?: (e: T) => string): string[] {
  return drawParts(rng, pool, pickCount(rng), keyOf);
}
