import { describe, it, expect } from 'vitest';
import { openBox, stackBox, takeBox, boxCount } from './boxes';
import { BOXES, BOX_KINDS, dropTable, boxOfDow, boxMailId } from '../data/boxes';
import { mulberry32 } from './stats';
import type { MailItem } from '../types';

describe('週末のボックス', () => {
  it('曜日と箱の対応（土＝ラッキー／日＝ゴールド／平日は無し）', () => {
    expect(boxOfDow(6)).toBe('lucky');
    expect(boxOfDow(0)).toBe('gold');
    for (const d of [1, 2, 3, 4, 5]) expect(boxOfDow(d)).toBeNull();
  });

  it('土と日で中身のジャンルが違う（混同しないため）', () => {
    // 土＝育成系：コイン以外がちゃんと入っている
    const lucky = new Set(BOXES.lucky.slots.map((s) => s.reward.type));
    expect(lucky.has('item')).toBe(true);
    expect(lucky.has('ticket')).toBe(true);
    expect(lucky.has('dye')).toBe(true);
    // 日＝お金系：ぜんぶコイン
    expect(BOXES.gold.slots.every((s) => s.reward.type === 'coins')).toBe(true);
  });

  it('排出率の合計はぴったり100%（i ボタンの表と実際がずれない）', () => {
    for (const k of BOX_KINDS) {
      const sum = dropTable(BOXES[k]).reduce((n, r) => n + r.pct, 0);
      expect(sum).toBeCloseTo(100, 9);
    }
  });

  it('限定フレームの確率が 1/1000 と 1/10000 になっている', () => {
    const trials = 400_000;
    for (const [k, odds] of [['lucky', 1000], ['gold', 10000]] as const) {
      const rng = mulberry32(12345);
      let hits = 0;
      for (let i = 0; i < trials; i++) if (openBox(k, rng, false).reward.type === 'frame') hits++;
      const rate = hits / trials;
      // 実測が理論値の ±25% に収まること（400k 回ならこの幅で十分安定）
      expect(rate).toBeGreaterThan((1 / odds) * 0.75);
      expect(rate).toBeLessThan((1 / odds) * 1.25);
    }
  });

  it('もう持っている限定フレームは二度と出ない（一度きりの約束）', () => {
    const rng = mulberry32(999);
    for (let i = 0; i < 200_000; i++) {
      expect(openBox('lucky', rng, true).reward.type).not.toBe('frame');
    }
  });

  it('必ず何かが当たる（空っぽで返らない）', () => {
    const rng = mulberry32(7);
    for (const k of BOX_KINDS) {
      for (let i = 0; i < 5000; i++) {
        const r = openBox(k, rng, false);
        expect(r.reward).toBeTruthy();
        expect(r.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('同じ箱は行が増えず個数だけ増える（×2 → ×4）', () => {
    let box: MailItem[] = [];
    for (let i = 1; i <= 4; i++) {
      box = stackBox(box, 'lucky', 1000 + i);
      expect(box.filter((m) => m.kind === 'box').length).toBe(1);
      expect(boxCount(box, 'lucky')).toBe(i);
    }
    // 増えたら未読になっていちばん手前に出る
    expect(box[0].id).toBe(boxMailId('lucky'));
    expect(box[0].read).toBe(false);
  });

  it('土と日の箱は別の行としてたまる（中身が違うので混ざらない）', () => {
    let box: MailItem[] = [];
    box = stackBox(box, 'lucky', 1);
    box = stackBox(box, 'gold', 2);
    box = stackBox(box, 'lucky', 3);
    expect(box.filter((m) => m.kind === 'box').length).toBe(2);
    expect(boxCount(box, 'lucky')).toBe(2);
    expect(boxCount(box, 'gold')).toBe(1);
  });

  it('ほかのメールを押しのけない（フレームやおしらせは残る）', () => {
    const notice: MailItem = { id: 'n1', at: 0, read: true, kind: 'notice', title: 'おしらせ' };
    const box = stackBox(stackBox([notice], 'lucky', 1), 'lucky', 2);
    expect(box.find((m) => m.id === 'n1')).toEqual(notice);
  });

  it('開けると1つ減り、0になったら行ごと消える', () => {
    let box = stackBox(stackBox([], 'gold', 1), 'gold', 2);
    box = takeBox(box, 'gold')!;
    expect(boxCount(box, 'gold')).toBe(1);
    box = takeBox(box, 'gold')!;
    expect(boxCount(box, 'gold')).toBe(0);
    expect(box.some((m) => m.kind === 'box')).toBe(false);
    // 持っていない箱は開けられない
    expect(takeBox(box, 'gold')).toBeNull();
    expect(takeBox([], 'lucky')).toBeNull();
  });

  it('表に載っている中身は、実際にちゃんと出てくる', () => {
    for (const k of BOX_KINDS) {
      const rng = mulberry32(4242);
      const seen = new Set<string>();
      for (let i = 0; i < 200_000; i++) seen.add(openBox(k, rng, true).label);
      for (const s of BOXES[k].slots) expect(seen.has(s.label)).toBe(true);
    }
  });
});
