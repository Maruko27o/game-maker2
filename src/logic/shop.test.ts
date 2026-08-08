import { describe, it, expect } from 'vitest';
import { drawShopBox, isComplete, remaining, shopProgress, canBuy, totalCost } from './shop';
import { ANIMALS, SHOP_BOXES, type AnimalId } from '../data/shop';

// ショップは**見た目だけ**を売る場所なので、ここで守りたいのは
//   ・**被りが絶対に出ない**こと（＝10回で必ずそろう）
//   ・残っているものが等確率で出ること（偏りが無いこと）
//   ・10種そろった1回だけコンプリートが立つこと
// の3つ。レースの倍率・勝率には一切関与しないので、バランス面の検証は不要。

describe('ショップのくじ', () => {
  it('すでに持っているものは絶対に出ない（被りなし）', () => {
    // 9種持っている状態で、乱数を端から端まで振っても最後の1種しか出ない。
    const nine = ANIMALS.slice(0, 9);
    for (let i = 0; i <= 100; i++) {
      const r = drawShopBox(nine, i / 100);
      expect(r).not.toBeNull();
      expect(r!.animal).toBe(ANIMALS[9]);
    }
  });

  it('10回引けば必ず10種そろう（何度くり返しても）', () => {
    for (let seed = 0; seed < 200; seed++) {
      let owned: AnimalId[] = [];
      let rnd = seed + 1;
      for (let i = 0; i < ANIMALS.length; i++) {
        // 適当だが決まった乱数列。
        rnd = (rnd * 1103515245 + 12345) % 2147483648;
        const r = drawShopBox(owned, rnd / 2147483648);
        expect(r).not.toBeNull();
        owned = r!.owned;
      }
      expect(new Set(owned).size).toBe(ANIMALS.length);
      expect(isComplete(owned)).toBe(true);
    }
  });

  it('残っているものが等しい確率で出る', () => {
    const hit = new Map<AnimalId, number>();
    const N = 10000;
    for (let i = 0; i < N; i++) {
      const r = drawShopBox([], i / N)!;
      hit.set(r.animal, (hit.get(r.animal) ?? 0) + 1);
    }
    expect(hit.size).toBe(ANIMALS.length);
    for (const a of ANIMALS) expect(hit.get(a)).toBe(N / ANIMALS.length);
  });

  it('乱数が範囲外・NaN でも配列の外に出ない', () => {
    for (const bad of [-1, 1, 1.5, NaN, Infinity]) {
      const r = drawShopBox([], bad);
      expect(ANIMALS).toContain(r!.animal);
    }
  });

  it('そろったあとは、もう引けない（null）', () => {
    expect(drawShopBox([...ANIMALS], 0.5)).toBeNull();
    expect(remaining([...ANIMALS])).toEqual([]);
  });

  it('元の所持配列を書き換えない', () => {
    const owned: AnimalId[] = [ANIMALS[0]];
    drawShopBox(owned, 0.55);
    expect(owned).toEqual([ANIMALS[0]]);
  });

  it('10種そろった「その1回」だけ completed が立つ', () => {
    let owned: AnimalId[] = [];
    const flags: boolean[] = [];
    for (let i = 0; i < ANIMALS.length; i++) {
      const r = drawShopBox(owned, i / ANIMALS.length)!;
      owned = r.owned;
      flags.push(r.completed);
    }
    expect(flags.filter(Boolean)).toHaveLength(1);
    expect(flags[ANIMALS.length - 1]).toBe(true);
  });

  it('集まり具合は残りの数と食い違わない', () => {
    const some: AnimalId[] = [ANIMALS[0], ANIMALS[1]];
    expect(shopProgress(some)).toEqual({ have: 2, total: ANIMALS.length });
    expect(remaining(some)).toHaveLength(ANIMALS.length - 2);
  });

  it('値段は指定どおり（フレーム50万・称号25万）', () => {
    expect(SHOP_BOXES.frame.price).toBe(500_000);
    expect(SHOP_BOXES.title.price).toBe(250_000);
  });

  it('そろえるのにかかる総額は 値段×10 で確定する（被りが無いため）', () => {
    expect(totalCost('frame')).toBe(5_000_000);
    expect(totalCost('title')).toBe(2_500_000);
  });

  it('コインが足りない／もうそろっているときは引けない', () => {
    expect(canBuy('frame', SHOP_BOXES.frame.price - 1, [])).toBe(false);
    expect(canBuy('frame', SHOP_BOXES.frame.price, [])).toBe(true);
    expect(canBuy('frame', 99_999_999, [...ANIMALS])).toBe(false);
  });
});
