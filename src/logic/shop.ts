import { ANIMALS, SHOP_BOXES, type AnimalId, type ShopBoxKind } from '../data/shop';

// ショップのくじを引く計算。**ここには乱数以外の副作用を置かない**ので、
// 確率と返却額はテストで固定できる。
//
// 決めごと（ユーザーの指定どおり）：
//  ・10種の出る確率はすべて同じ（1/10）。重みづけは無い。
//  ・すでに持っているものが出たら、その場でコインが戻る（フレーム10万／称号5万）。
//  ・10種そろった人には、コンプリート品を1種おくる（在庫や抽選ではなく確定）。
//
// レースの倍率・勝率には一切かかわらない。売っているのは見た目だけなので、
// 値段をいくらにしてもレースのバランスは動かない。

export type ShopBuyResult = {
  /** 出た動物。 */
  animal: AnimalId;
  /** すでに持っていたか（＝コインが戻る）。 */
  dupe: boolean;
  /** 戻ったコイン（新しく手に入れたときは0）。 */
  refund: number;
  /** この1回で10種がそろったか（コンプリート品を贈るタイミング）。 */
  completed: boolean;
  /** 引いたあとの所持一覧（元の配列は書き換えない）。 */
  owned: AnimalId[];
};

/** 10種そろっているか。 */
export function isComplete(owned: readonly AnimalId[]): boolean {
  return new Set(owned).size >= ANIMALS.length;
}

/** 集まり具合（持っている数 / 10）。 */
export function shopProgress(owned: readonly AnimalId[]): { have: number; total: number } {
  return { have: new Set(owned).size, total: ANIMALS.length };
}

/**
 * くじを1回引く。
 *
 * @param kind  どちらの箱か
 * @param owned いま持っている動物
 * @param rand  0以上1未満の乱数（テストでは固定値を渡す）
 */
export function drawShopBox(kind: ShopBoxKind, owned: readonly AnimalId[], rand: number): ShopBuyResult {
  const def = SHOP_BOXES[kind];
  // 10種を等しく。rand が 1 ちょうど（や NaN）でも配列の外に出ないよう丸める。
  const r = Number.isFinite(rand) ? Math.min(0.999999, Math.max(0, rand)) : 0;
  const animal = ANIMALS[Math.floor(r * ANIMALS.length)];

  const had = new Set(owned);
  const dupe = had.has(animal);
  const next = dupe ? [...owned] : [...owned, animal];
  return {
    animal,
    dupe,
    refund: dupe ? def.refund : 0,
    completed: !dupe && isComplete(next),
    owned: next,
  };
}

/** その箱を買えるか（コインが足りているか）。 */
export function canBuy(kind: ShopBoxKind, coins: number): boolean {
  return coins >= SHOP_BOXES[kind].price;
}

/** 1回引いたときのコインの増減（＝ -値段 + 返却）。 */
export function coinDelta(kind: ShopBoxKind, result: ShopBuyResult): number {
  return result.refund - SHOP_BOXES[kind].price;
}
