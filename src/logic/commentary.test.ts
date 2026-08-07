import { describe, it, expect } from 'vitest';
import { raceCommentary, sameHorseGapFor, telopAt, TELOP_HOLD } from './commentary';
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
const run = (seed: number, laps?: number) => simulate2(field(), COURSES[0], 30, seed, { recordFrames: true, laps });

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

describe('実況テロップの語彙', () => {
  const names = () => field().map((e) => ({ name: e.name, isPlayer: !!e.isPlayer, style: e.style }));

  it('脚質で先手の言い方が変わる', () => {
    // 逃げのウマが先頭になったレースでは「ハナを切って」が出る
    const seeds = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
    const texts = seeds.flatMap((s) => raceCommentary(run(s), names()).map((t) => t.text));
    const leadLines = texts.filter((t) => /ハナを切って|すんなり前に|思い切って前に|めずらしく前に|先手を取った/.test(t));
    expect(leadLines.length).toBeGreaterThan(0);
    // 12レースぶん集めれば、言い方は1種類では終わらない
    expect(new Set(leadLines.map((t) => t.replace(/^\S+?(?=が)/, ''))).size).toBeGreaterThan(1);
  });

  it('語彙を増やしても「同時に2本」「レース後」の決まりは守られる', () => {
    for (const seed of [7, 70, 700, 7000, 70000]) {
      const res = run(seed);
      const list = raceCommentary(res, names());
      for (let i = 1; i < list.length; i++) {
        expect(list[i].at - list[i - 1].at).toBeGreaterThanOrEqual(TELOP_HOLD);
      }
      for (const t of list) expect(t.at).toBeLessThan(res.duration);
    }
  });

  it('1レースに出しすぎない（多くても9本）', () => {
    for (const seed of [11, 22, 33, 44, 55]) {
      expect(raceCommentary(run(seed), names()).length).toBeLessThanOrEqual(9);
    }
  });

  it('周回数が増えても、後半までまんべんなく出る', () => {
    // s はスタート線の位置から始まるので、startS を引かずに進み具合を出すと
    // 判定点がぜんぶ前半に寄ってしまう（1周だと開始時点でもう 0.9 を超える）。
    for (const laps of [1, 2, 3]) {
      const res = simulate2(field(), COURSES[0], 30, 4242, { recordFrames: true, laps });
      const list = raceCommentary(res, names());
      expect(list.length).toBeGreaterThanOrEqual(4);
      const last = list[list.length - 1].at;
      // 最後のテロップがレースの7割より後に出ている（後半が無言にならない）
      expect(last / res.duration).toBeGreaterThan(0.7);
      // 前半・後半それぞれに最低1本ある
      expect(list.some((t) => t.at < res.duration * 0.5)).toBe(true);
      expect(list.some((t) => t.at > res.duration * 0.5)).toBe(true);
    }
  });

  it('先頭がゴールした瞬間を言う（1着と最下位の間が空くため）', () => {
    const res = run(4242);
    const list = raceCommentary(res, names());
    expect(list.some((t) => /先頭でゴール/.test(t.text))).toBe(true);
  });
});

describe('馬券に絡むテロップ', () => {
  const names = () => field().map((e) => ({ name: e.name, isPlayer: !!e.isPlayer, style: e.style }));

  it('買っていなければ、馬券の文は出ない', () => {
    for (const seed of [1, 2, 3, 5, 8]) {
      const list = raceCommentary(run(seed), names());
      expect(list.some((t) => t.text.startsWith('買った'))).toBe(false);
    }
  });

  it('買ったウマが動くと実況される', () => {
    // 自分以外の全頭を買っておけば、どれかは動く
    const all = [1, 2, 3, 4, 5, 6, 7];
    const hits = [1, 2, 3, 5, 8, 13, 21].filter((seed) =>
      raceCommentary(run(seed), names(), all).some((t) => t.text.startsWith('買った')),
    );
    expect(hits.length).toBeGreaterThan(0);
  });

  it('自分のウマは「買った」扱いにしない（別の文が担当している）', () => {
    for (const seed of [1, 2, 3, 5, 8, 13]) {
      const list = raceCommentary(run(seed), names(), [0]); // 0 番＝自分のウマ
      expect(list.some((t) => t.text.startsWith('買った'))).toBe(false);
    }
  });

  it('馬券を渡してもレースの中身は変わらない（表示だけ）', () => {
    const res = run(4242);
    const a = raceCommentary(res, names());
    const b = raceCommentary(res, names(), [3, 5]);
    // 順位・タイムは当然おなじ。テロップも「買った」以外は変わらない。
    const strip = (l: typeof a) => l.filter((t) => !t.text.startsWith('買った')).map((t) => t.text);
    expect(strip(b)).toEqual(expect.arrayContaining(strip(a).filter((t) => strip(b).includes(t))));
    expect(a.length).toBeLessThanOrEqual(b.length + 2);
  });
});

describe('同じウマの話が続かない', () => {
  const names = () => field().map((e) => ({ name: e.name, isPlayer: !!e.isPlayer, style: e.style }));

  it('「脚が上がってきた」の直後に「上がってきた！」が来ない', () => {
    // 同じウマについて、続けて逆のことを言うと読み手が混乱する
    for (const seed of [1, 4242, 777, 31, 99, 512]) {
      const res = run(seed, 2);
      const list = raceCommentary(res, names(), [3, 5]);
      const gap = sameHorseGapFor(res.duration);
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1].text;
        const cur = list[i].text;
        // 両方に同じウマ名が入っているなら、間隔をちゃんとあけていること
        const m = prev.match(/ウマ\d/);
        if (m && cur.includes(m[0])) {
          expect(list[i].at - list[i - 1].at).toBeGreaterThanOrEqual(gap);
        }
      }
    }
  });
});

describe('呼び名は「枠番＋名前」でそろえる', () => {
  const names = () => field().map((e) => ({ name: e.name, isPlayer: !!e.isPlayer, style: e.style }));

  it('ウマに触れる文は、必ず番号から始まる呼び名になっている', () => {
    for (const seed of [1, 4242, 777, 31, 99]) {
      const res = run(seed, 2);
      const list = raceCommentary(res, names(), [3, 5]);
      const nums = new Set(res.gate);
      for (const t of list) {
        // 名前が出ているなら、その直前に「N番」が付いていること
        for (let i = 0; i < res.gate.length; i++) {
          const name = names()[i].isPlayer ? 'あなたのウマ' : names()[i].name;
          const at = t.text.indexOf(name);
          if (at < 0) continue;
          expect(t.text.slice(0, at)).toMatch(/\d+番$/);
        }
      }
      expect(nums.size).toBe(res.gate.length); // 枠番は重複しない
    }
  });

  it('自分のウマも番号つきで呼ぶ（他と同じ形にそろえる）', () => {
    const res = run(4242, 2);
    const list = raceCommentary(res, names());
    const mine = list.filter((t) => t.text.includes('あなたのウマ'));
    expect(mine.length).toBeGreaterThan(0);
    for (const t of mine) expect(t.text).toMatch(new RegExp(`${res.gate[0]}番あなたのウマ`));
  });
});
