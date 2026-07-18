import { describe, it, expect } from 'vitest';
import { runTournament, buildRoundField, playerSnapshot } from './arena';
import { arenaPrize, periodId, periodLabel, msToNextPeriod, ARENA_PERIOD_MS } from '../data/arena';
import { simulate2 } from './raceSim2';
import { snapToEntrant } from './arena';
import { COURSES } from '../data/courses';
import type { ArenaHorseSnapshot, Stats } from '../types';

function snap(stats: Stats, style: ArenaHorseSnapshot['style'] = 'senko'): ArenaHorseSnapshot {
  return playerSnapshot('p1', 'テスト馬', { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, {}, stats, style, 1);
}
const STRONG: Stats = { spd: 9, sta: 9, pwr: 8, jmp: 8, gut: 8, wit: 8 };
const WEAK: Stats = { spd: 3, sta: 3, pwr: 3, jmp: 3, gut: 2, wit: 2 };

describe('arena prize table', () => {
  it('pays the jackpot only for a championship', () => {
    expect(arenaPrize('champion', 1)).toBe(12000);
    expect(arenaPrize('final', 2)).toBe(5000);
    expect(arenaPrize('final', 3)).toBe(1000);
    expect(arenaPrize('final', 5)).toBe(500);
    expect(arenaPrize('q2out', 6)).toBe(0);
    expect(arenaPrize('q1out', 7)).toBe(0);
  });
});

describe('periods (1日2回開催)', () => {
  it('increments by 1 across each 0:00 / 12:00 boundary', () => {
    // Build local times just before/after noon on a fixed day.
    const beforeNoon = new Date(2026, 6, 18, 11, 30).getTime();
    const afterNoon = new Date(2026, 6, 18, 12, 30).getTime();
    const nextMidnight = new Date(2026, 6, 19, 0, 30).getTime();
    const p0 = periodId(beforeNoon);
    const p1 = periodId(afterNoon);
    const p2 = periodId(nextMidnight);
    expect(p1).toBe(p0 + 1);
    expect(p2).toBe(p1 + 1);
    // Two periods per calendar day.
    expect(periodId(new Date(2026, 6, 20, 6, 0).getTime()) - periodId(new Date(2026, 6, 18, 6, 0).getTime())).toBe(4);
  });
  it('labels the morning/afternoon halves distinctly', () => {
    const am = periodId(new Date(2026, 6, 18, 8, 0).getTime());
    const pm = periodId(new Date(2026, 6, 18, 20, 0).getTime());
    expect(periodLabel(am)).toContain('0時');
    expect(periodLabel(pm)).toContain('12時');
  });
  it('countdown to the next opening is within a 12h window', () => {
    const ms = msToNextPeriod(new Date(2026, 6, 18, 9, 0).getTime());
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(ARENA_PERIOD_MS);
    expect(ms).toBe(3 * 3600 * 1000); // 9:00 → 12:00 = 3h
  });
});

describe('buildRoundField', () => {
  it('always makes an 8-horse field with exactly one player', () => {
    for (let r = 0; r < 3; r++) {
      const field = buildRoundField(r, snap(STRONG), 123 + r, []);
      expect(field).toHaveLength(8);
      expect(field.filter((f) => f.isPlayer)).toHaveLength(1);
      expect(field.every((f) => typeof f.horseId === 'string')).toBe(true);
      // ids unique within the round (simulate2 requires it)
      expect(new Set(field.map((f) => f.horseId)).size).toBe(8);
    }
  });

  it('fills entirely with COM when the pool is empty', () => {
    const field = buildRoundField(0, snap(STRONG), 7, []);
    expect(field.filter((f) => f.isCom)).toHaveLength(7);
  });

  it('includes real opponents from the pool (capped)', () => {
    const pool: ArenaHorseSnapshot[] = Array.from({ length: 10 }, (_, i) => ({
      ...snap(WEAK, 'nige'),
      horseId: `pool_${i}`,
      name: `ライバル${i}`,
      isPlayer: false,
      isCom: false,
      playerNo: 100 + i,
    }));
    const field = buildRoundField(0, snap(STRONG), 42, pool);
    const reals = field.filter((f) => !f.isPlayer && !f.isCom);
    expect(reals.length).toBeGreaterThan(0);
    expect(reals.length).toBeLessThanOrEqual(4); // ARENA_REAL_CAP[0]
  });
});

describe('runTournament', () => {
  it('is deterministic for the same seed + pool', () => {
    const a = runTournament(snap(STRONG), 999, [], 60, 1000);
    const b = runTournament(snap(STRONG), 999, [], 60, 1000);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('stops at the round where the player is eliminated', () => {
    // Try several seeds; whenever a qualifier is lost, no later rounds are stored.
    for (let s = 0; s < 40; s++) {
      const res = runTournament(snap(WEAK), s, [], 60, 1);
      if (res.outcome === 'q1out') {
        expect(res.rounds).toHaveLength(1);
        expect(res.rounds[0].advanced).toBe(false);
      } else if (res.outcome === 'q2out') {
        expect(res.rounds).toHaveLength(2);
        expect(res.rounds[1].advanced).toBe(false);
      } else {
        expect(res.rounds).toHaveLength(3); // reached the 本線
      }
      expect(res.payout).toBe(arenaPrize(res.outcome, res.finalRank ?? 0));
    }
  });

  it('stored round order matches a fresh simulate2 (so playback lines up)', () => {
    const res = runTournament(snap(STRONG), 314, [], 60, 1);
    const rr = res.rounds[0];
    const course = COURSES.find((c) => c.id === rr.courseId)!;
    const fresh = simulate2(rr.field.map(snapToEntrant), course, res.mode, rr.seed);
    expect(fresh.order).toEqual(rr.order);
    expect(fresh.ranks).toEqual(rr.ranks);
  });

  it('a strong horse wins championships more often than a weak one', () => {
    let strongWins = 0;
    let weakWins = 0;
    for (let s = 0; s < 60; s++) {
      if (runTournament(snap(STRONG), s, [], 60, 1).outcome === 'champion') strongWins++;
      if (runTournament(snap(WEAK), s, [], 60, 1).outcome === 'champion') weakWins++;
    }
    expect(strongWins).toBeGreaterThan(weakWins);
    // The jackpot stays rare even for a strong horse (balance guardrail).
    expect(strongWins).toBeLessThan(40); // < ~66% of runs
  });
});
