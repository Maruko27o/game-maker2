import { ANIMALS, SHOP_BOXES, type AnimalId, type ShopBoxKind } from '../data/shop';

// ショップのくじを引く計算。**ここには乱数以外の副作用を置かない**ので、
// 確率と結果はテストで固定できる。
//
// 決めごと（ユーザーの指定どおり）：
//  ・**被りは出ない**。まだ持っていないものの中から等しい確率で1つ出る。
//    したがって10回引けば必ず10種そろう（返却の仕組みは要らない）。
//  ・10種そろった人には、コンプリート品を1種おくる（抽選ではなく確定）。
//  ・そろったあとは、もう引けない（引いても出るものが無い）。
//
// レースの倍率・勝率には一切かかわらない。売っているのは見た目だけなので、
// 値段をいくらにしてもレースのバランスは動かない。

export type ShopBuyResult = {
  /** 出た動物。 */
  animal: AnimalId;
  /** この1回で10種がそろったか（コンプリート品を贈るタイミング）。 */
  completed: boolean;
  /** 引いたあとの所持一覧（元の配列は書き換えない）。 */
  owned: AnimalId[];
};

/** 10種そろっているか。 */
export function isComplete(owned: readonly AnimalId[]): boolean {
  return new Set(owned).size >= ANIMALS.length;
}

/** まだ持っていない動物（データ側の並びのまま）。 */
export function remaining(owned: readonly AnimalId[]): AnimalId[] {
  const had = new Set(owned);
  return ANIMALS.filter((a) => !had.has(a));
}

/** 集まり具合（持っている数 / 10）。 */
export function shopProgress(owned: readonly AnimalId[]): { have: number; total: number } {
  return { have: new Set(owned).size, total: ANIMALS.length };
}

/**
 * くじを1回引く。**まだ持っていないものからだけ**選ぶので、被りは出ない。
 *
 * @param owned いま持っている動物
 * @param rand  0以上1未満の乱数（テストでは固定値を渡す）
 * @returns そろっていて引くものが無ければ null
 */
export function drawShopBox(owned: readonly AnimalId[], rand: number): ShopBuyResult | null {
  const left = remaining(owned);
  if (left.length === 0) return null;
  // rand が 1 ちょうど（や NaN）でも配列の外に出ないよう丸める。
  const r = Number.isFinite(rand) ? Math.min(0.999999, Math.max(0, rand)) : 0;
  const animal = left[Math.floor(r * left.length)];
  const next = [...owned, animal];
  return { animal, completed: isComplete(next), owned: next };
}

/** その箱を引けるか（コインが足りていて、まだそろっていない）。 */
export function canBuy(kind: ShopBoxKind, coins: number, owned: readonly AnimalId[]): boolean {
  return coins >= SHOP_BOXES[kind].price && !isComplete(owned);
}

/** 10種そろえるのにかかる総額（被りが無いので値段 × 10で確定）。 */
export function totalCost(kind: ShopBoxKind): number {
  return SHOP_BOXES[kind].price * ANIMALS.length;
}
