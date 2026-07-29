import { describe, it, expect } from 'vitest';
import { lookFromParts, rollWildStats, rollName, makeWildHorse } from './wild';
import { mulberry32, statTotal } from './stats';
import { COLOR_SLOTS, colorsBySlot, colorSlotById, decoById, isColorId } from '../data/parts';
import { STAT_ALLOC_TOTAL, STAT_CAP, STAT_ALLOC_MIN, STAT_KEYS } from '../types';

describe('lookFromParts（引いたパーツがそのまま姿になる）', () => {
  it('引いた色はその部位に必ず使われる', () => {
    const body = colorsBySlot.body[0].id;
    const look = lookFromParts([body], mulberry32(1));
    expect(look.colors.body).toBe(body);
  });

  it('引けなかった色も必ず埋まる（欠けた姿にならない）', () => {
    for (let seed = 0; seed < 60; seed++) {
      const look = lookFromParts([], mulberry32(seed));
      for (const slot of COLOR_SLOTS) {
        expect(look.colors[slot]).toBeTruthy();
        expect(colorSlotById[look.colors[slot]]).toBe(slot); // 部位が食い違わない
      }
    }
  });

  it('引いた飾りは装備される', () => {
    const deco = Object.keys(decoById)[0];
    const look = lookFromParts([deco], mulberry32(2));
    expect(look.decos[decoById[deco].slot]).toBe(deco);
  });

  it('飾りを引かなければ何も着けていない', () => {
    const look = lookFromParts([colorsBySlot.body[0].id], mulberry32(3));
    expect(Object.keys(look.decos)).toHaveLength(0);
  });

  it('同じ部位の色を2つ引いても最初のものだけ使う', () => {
    const [a, b] = colorsBySlot.body;
    const look = lookFromParts([a.id, b.id], mulberry32(4));
    expect(look.colors.body).toBe(a.id);
  });

  it('色は毎回同じにならず、ちゃんとばらける', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) seen.add(lookFromParts([], mulberry32(seed)).colors.body);
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('rollWildStats（ランダムなステータス）', () => {
  it('合計は必ず40（自分で割り振っていた頃と同じ＝強さの総量が変わらない）', () => {
    for (let seed = 0; seed < 300; seed++) {
      expect(statTotal(rollWildStats(mulberry32(seed)))).toBe(STAT_ALLOC_TOTAL);
    }
  });

  it('どのステータスも 1〜10 に収まる', () => {
    for (let seed = 0; seed < 300; seed++) {
      const st = rollWildStats(mulberry32(seed));
      for (const k of STAT_KEYS) {
        expect(st[k]).toBeGreaterThanOrEqual(STAT_ALLOC_MIN);
        expect(st[k]).toBeLessThanOrEqual(STAT_CAP);
      }
    }
  });

  it('毎回同じ配分にならない（引きの差が出る）', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 100; seed++) seen.add(JSON.stringify(rollWildStats(mulberry32(seed))));
    expect(seen.size).toBeGreaterThan(20);
  });
});

describe('rollName', () => {
  it('空でない名前が出て、何種類もある', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const n = rollName(mulberry32(seed));
      expect(n.length).toBeGreaterThan(0);
      seen.add(n);
    }
    expect(seen.size).toBeGreaterThan(20);
  });
});

describe('makeWildHorse', () => {
  it('名前・3色・ステータスがそろった1頭になる', () => {
    for (let seed = 0; seed < 50; seed++) {
      const h = makeWildHorse([], mulberry32(seed));
      expect(h.name).toBeTruthy();
      for (const slot of COLOR_SLOTS) expect(h.colors[slot]).toBeTruthy();
      expect(statTotal(h.stats)).toBe(STAT_ALLOC_TOTAL);
    }
  });

  it('引いたパーツが姿に反映される', () => {
    const body = colorsBySlot.mane[2]?.id ?? colorsBySlot.mane[0].id;
    expect(isColorId(body)).toBe(true);
    const h = makeWildHorse([body], mulberry32(9));
    expect(h.colors.mane).toBe(body);
  });
});
