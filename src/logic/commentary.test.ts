import { describe, it, expect } from 'vitest';
import { raceCommentary, telopAt, TELOP_HOLD } from './commentary';
import { simulate2, type Entrant } from './raceSim2';
import { COURSES } from '../data/courses';
import type { Stats, RunStyle } from '../types';

const STATS: Stats = { spd: 7, sta: 7, pwr: 7, jmp: 7, gut: 6, wit: 6 };
const STYLES: RunStyle[] = ['nige', 'senko', 'sashi', 'oikomi'];
function field(n = 8): Entrant[] {
  return Array.from({ length: n }, (_, i) => ({
    horseId: `h${i}`,
    name: `ウマ${i}`,
    isPlayer: i === 0,
    stats: { ...STATS, spd: 6 + (i % 4) },
    style: STYLES[i % STYLES.length],
  }));
}
const run = (seed: number) => simulate2(field(), COURSES[0], 30, seed, { recordFrames: true });

describe('レースの実況テロップ', () => {
  it('同じレースなら毎回まったく同じ（表示だけで結果に関わらない）', () => {
    const a = raceCommentary(run(1234), field().map((e) => ({ name: e.name, isPlayer: !!e.isPlayer })));
    const b = raceCommentary(run(1234), field().map((e) => ({ name: e.name, isPlayer: !!e.isPlayer })));
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('時間順に並び、同時に2本出ない', () => {
    for (const seed of [1, 77, 4242, 90210]) {
      const list = raceCommentary(run(seed), field().map((e) => ({ name: e.name, isPlayer: !!e.isPlayer })));
      for (let i = 1; i < list.length; i++) {
        expect(list[i].at).toBeGreaterThan(list[i - 1].at);
        // 前の1本が消えてから次が出る
        expect(list[i].at - list[i - 1].at).toBeGreaterThanOrEqual(TELOP_HOLD);
      }
    }
  });

  it('レースが終わったあとには出ない', () => {
    for (const seed of [5, 555, 55555]) {
      const res = run(seed);
      const list = raceCommentary(res, field().map((e) => ({ name: e.name, isPlayer: !!e.isPlayer })));
      for (const t of list) expect(t.at).toBeLessThan(res.duration);
    }
  });

  it('自分のウマは名前ではなく「あなたのウマ」と呼ぶ', () => {
    const list = raceCommentary(run(31), field().map((e) => ({ name: e.name, isPlayer: !!e.isPlayer })));
    // プレイヤーは entrants[0]（名前は「ウマ0」）。その名前がそのまま出ないこと。
    for (const t of list) expect(t.text).not.toContain('ウマ0');
  });

  it('スタートの合図から始まる', () => {
    const list = raceCommentary(run(9), field().map((e) => ({ name: e.name, isPlayer: !!e.isPlayer })));
    expect(list[0].text).toBe('ゲートが開いた！');
  });

  it('telopAt は表示中のものだけを返す', () => {
    const list = [{ at: 2, text: 'あ' }, { at: 10, text: 'い' }];
    expect(telopAt(list, 0)).toBeNull();
    expect(telopAt(list, 2)?.text).toBe('あ');
    expect(telopAt(list, 2 + TELOP_HOLD - 0.01)?.text).toBe('あ');
    expect(telopAt(list, 2 + TELOP_HOLD)).toBeNull();
    expect(telopAt(list, 10.5)?.text).toBe('い');
  });

  it('記録の無いレース（frames 無し）では何も出ない', () => {
    const res = simulate2(field(), COURSES[0], 30, 1, {});
    expect(raceCommentary(res, [])).toEqual([]);
  });
});
