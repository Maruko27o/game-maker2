import { describe, it, expect } from 'vitest';
import { buildGpField, computeQualifiers, computeOdds, gpItemCount, heatLaps, finalLaps } from './grandprix';
import type { Entrant, SimResult } from './raceSim2';
import { COURSES } from '../data/courses';
import type { HorseLook } from '../types';

const PLAYER: Entrant = {
  horseId: 'me',
  name: 'あなた',
  isPlayer: true,
  stats: { spd: 6, sta: 6, pwr: 6, jmp: 4, gut: 5, wit: 5 },
  style: 'senko',
};
const LOOK: HorseLook = { colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {} };

// Build a SimResult where ranks follow the given finish order (indices).
function resultFromOrder(order: number[], baseTime: number): SimResult {
  const n = order.length;
  const ranks = new Array(n);
  const finishTimes = new Array(n);
  order.forEach((idx, place) => {
    ranks[idx] = place + 1;
    finishTimes[idx] = baseTime + place; // later places finish later
  });
  return {
    dt: 0.02,
    distanceS: 100,
    duration: baseTime + n,
    gate: order.map((_, i) => i),
    frames: [],
    finishTimes,
    ranks,
    order,
    obstacles: [],
    boosts: [],
  } as unknown as SimResult;
}

describe('grand prix structure', () => {
  it('builds 18 runners in three heats of six, player included exactly once', () => {
    const f = buildGpField(PLAYER, LOOK, 'g3', 12345);
    expect(f.heats).toHaveLength(3);
    for (const h of f.heats) expect(h).toHaveLength(6);
    const all = f.heats.flat();
    expect(all).toHaveLength(18);
    const players = all.filter((e) => e.isPlayer);
    expect(players).toHaveLength(1);
    expect(f.heats[f.playerHeat].some((e) => e.isPlayer)).toBe(true);
    // every runner has a look entry
    for (const e of all) expect(f.looks[e.horseId]).toBeDefined();
  });

  it('is deterministic for a fixed seed', () => {
    const a = buildGpField(PLAYER, LOOK, 'g2', 999);
    const b = buildGpField(PLAYER, LOOK, 'g2', 999);
    expect(a.playerHeat).toBe(b.playerHeat);
    expect(a.heats.flat().map((e) => e.name)).toEqual(b.heats.flat().map((e) => e.name));
  });

  it('selects 8 finalists: top-2 of each heat plus the two fastest 3rd-placers', () => {
    const f = buildGpField(PLAYER, LOOK, 'g3', 42);
    // Heat 0: 3rd-placer finishes fastest (baseTime 10 -> 3rd at 12)
    // Heat 1: 3rd-placer at baseTime 11 -> 13
    // Heat 2: 3rd-placer at baseTime 14 -> 16 (slowest, should NOT revive)
    const results: SimResult[] = [
      resultFromOrder([0, 1, 2, 3, 4, 5], 10),
      resultFromOrder([0, 1, 2, 3, 4, 5], 11),
      resultFromOrder([0, 1, 2, 3, 4, 5], 14),
    ];
    const q = computeQualifiers(f.heats, results);
    expect(q).toHaveLength(8);
    const revived = q.filter((x) => x.revived);
    expect(revived).toHaveLength(2);
    // The two revived thirds are from the two faster heats (0 and 1), not heat 2.
    expect(revived.map((r) => r.heat).sort()).toEqual([0, 1]);
    // Everyone ranked 1-2 in their heat is in and not marked revived.
    const auto = q.filter((x) => !x.revived);
    expect(auto).toHaveLength(6);
  });

  it('odds assign a unique popularity rank to every runner', () => {
    const f = buildGpField(PLAYER, LOOK, 'g1', 7);
    const odds = computeOdds(f.heats[0], COURSES[0]);
    expect(odds).toHaveLength(6);
    const pops = odds.map((o) => o.pop).sort((a, b) => a - b);
    expect(pops).toEqual([1, 2, 3, 4, 5, 6]);
    for (const o of odds) expect(o.odds).toBeGreaterThanOrEqual(1.1);
  });

  it('reward counts scale with grade, placing, and 60s bonus', () => {
    expect(gpItemCount('g3', 1, 30)).toBe(2);
    expect(gpItemCount('g1', 1, 30)).toBe(4);
    expect(gpItemCount('g1', 1, 60)).toBe(6); // ×1.5 floored
    expect(gpItemCount('g3', 2, 30)).toBe(1);
    expect(gpItemCount('g3', 4, 30)).toBe(0); // out of the money
  });

  it('heats are shorter than the final', () => {
    expect(heatLaps(30)).toBeLessThan(finalLaps(30));
    expect(heatLaps(60)).toBeLessThan(finalLaps(60));
  });
});
