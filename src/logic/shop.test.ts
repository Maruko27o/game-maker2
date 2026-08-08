import { describe, it, expect } from 'vitest';
import { drawShopBox, isComplete, shopProgress, canBuy, coinDelta } from './shop';
import { ANIMALS, SHOP_BOXES, type AnimalId } from '../data/shop';

// ショップは**見た目だけ**を売る場所なので、ここで守りたいのは
//   ・10種が等確率で出ること（偏りが無いこと）
//   ・ダブりの返却額が仕様どおりであること
//   ・10種そろった1回だけコンプリートが立つこと
// の3つ。レースの倍率・勝率には一切関与しないので、バランス面の検証は不要。

describe('ショップのくじ', () => {
  it('10種が等しい確率で出る（乱数の0..1をまんべんなく割り当てる）', () => {
    const hit = new Map<AnimalId, number>();
    const N = 10000;
    for (let i = 0; i < N; i++) {
      const r = drawShopBox('frame', [], i / N);
      hit.set(r.animal, (hit.get(r.animal) ?? 0) + 1);
    }
    expect(hit.size).toBe(ANIMALS.length);
    for (const a of ANIMALS) expect(hit.get(a)).toBe(N / ANIMALS.length);
  });

  it('乱数が範囲外・NaN でも配列の外に出ない', () => {
    for (const bad of [-1, 1, 1.5, NaN, Infinity]) {
      const r = drawShopBox('frame', [], bad);
      expect(ANIMALS).toContain(r.animal);
    }
  });

  it('新しく手に入れたら返却は0で、所持に足される', () => {
    const r = drawShopBox('frame', [], 0);
    expect(r.dupe).toBe(false);
    expect(r.refund).toBe(0);
    expect(r.owned).toEqual([r.animal]);
  });

  it('すでに持っているものが出たら、その箱の返却額が戻る', () => {
    const first = drawShopBox('frame', [], 0);
    const again = drawShopBox('frame', [first.animal], 0);
    expect(again.dupe).toBe(true);
    expect(again.refund).toBe(SHOP_BOXES.frame.refund);
    // ダブりでは所持は増えない。
    expect(again.owned).toEqual([first.animal]);
  });

  it('フレームは10万・称号は5万が戻る（指定どおり）', () => {
    expect(SHOP_BOXES.frame.price).toBe(500_000);
    expect(SHOP_BOXES.frame.refund).toBe(100_000);
    expect(SHOP_BOXES.title.price).toBe(250_000);
    expect(SHOP_BOXES.title.refund).toBe(50_000);
  });

  it('元の所持配列を書き換えない', () => {
    const owned: AnimalId[] = [ANIMALS[0]];
    drawShopBox('frame', owned, 0.55);
    expect(owned).toEqual([ANIMALS[0]]);
  });

  it('10種そろった「その1回」だけ completed が立つ', () => {
    let owned: AnimalId[] = [];
    const flags: boolean[] = [];
    for (let i = 0; i < ANIMALS.length; i++) {
      const r = drawShopBox('title', owned, i / ANIMALS.length);
      owned = r.owned;
      flags.push(r.completed);
    }
    expect(flags.filter(Boolean)).toHaveLength(1);
    expect(flags[ANIMALS.length - 1]).toBe(true);
    expect(isComplete(owned)).toBe(true);

    // そろったあとに引いてもコンプリートは二度は立たない（ダブりになる）。
    const after = drawShopBox('title', owned, 0);
    expect(after.completed).toBe(false);
    expect(after.dupe).toBe(true);
  });

  it('集まり具合はダブりを数えない', () => {
    expect(shopProgress([ANIMALS[0], ANIMALS[0], ANIMALS[1]])).toEqual({ have: 2, total: ANIMALS.length });
  });

  it('コインの増減は -値段 + 返却', () => {
    const miss = drawShopBox('frame', [], 0);
    expect(coinDelta('frame', miss)).toBe(-SHOP_BOXES.frame.price);
    const dupe = drawShopBox('frame', [miss.animal], 0);
    expect(coinDelta('frame', dupe)).toBe(-SHOP_BOXES.frame.price + SHOP_BOXES.frame.refund);
  });

  it('コインが足りているかを値段で判断する', () => {
    expect(canBuy('frame', SHOP_BOXES.frame.price - 1)).toBe(false);
    expect(canBuy('frame', SHOP_BOXES.frame.price)).toBe(true);
    expect(canBuy('title', SHOP_BOXES.title.price)).toBe(true);
  });
});
