import type { Rarity } from '../types';
import { partRarity } from '../data/parts';

// ダブったパーツを染料に替える。
//
// 草むらを回していると同じパーツが何度も出て、2個目から先はまったく使い道が
// なかった。100個ぶんためると染料が1つできるようにして、ダブりに行き先を作る。
//
// 大事な決めごとが2つ：
//  ・**1個目は絶対に使わない**。図鑑の「持っている」という記録そのものなので、
//    交換で図鑑が欠けてはいけない。使えるのは2個目から（＝count - 1）。
//  ・レアさで「何個ぶん」かが変わる。N は1個ぶん、R は5個ぶん、SR は10個ぶん。
//    実際の排出の重み（N70 / R25 / SR5 ＝ 1個あたり N:R:SR ≒ 1 : 1.9 : 3.7）より
//    レアを厚くしてある。SR のダブりが「うれしい」と感じられるようにするため。

/** 染料1つと交換するのに必要な「個ぶん」。 */
export const DYE_EXCHANGE_COST = 100;

/** レアさ1個あたりの「個ぶん」。5の倍数にそろえてあるので端数が出ない。 */
export const DUPE_VALUE: Record<Rarity, number> = { N: 1, R: 5, SR: 10 };

/** 交換に出せるダブりの1行。 */
export type DupeRow = {
  id: string;
  rarity: Rarity;
  /** 交換に出せる数（＝所持数 - 1）。 */
  dupes: number;
  /** 1個あたりの「個ぶん」。 */
  value: number;
};

/** 所持数から「交換に出せるダブり」の一覧を作る。多い順・レアな順に並べる。 */
export function dupeRows(owned: Record<string, number>): DupeRow[] {
  const rows: DupeRow[] = [];
  for (const [id, n] of Object.entries(owned ?? {})) {
    const dupes = Math.max(0, (n ?? 0) - 1); // 1個目は図鑑の記録なので使わない
    if (dupes <= 0) continue;
    const rarity = partRarity(id);
    rows.push({ id, rarity, dupes, value: DUPE_VALUE[rarity] });
  }
  const order: Record<Rarity, number> = { SR: 0, R: 1, N: 2 };
  return rows.sort((a, b) => order[a.rarity] - order[b.rarity] || b.dupes - a.dupes || a.id.localeCompare(b.id));
}

/** いま選んでいるぶんの合計「個ぶん」。 */
export function pickedValue(rows: DupeRow[], picks: Record<string, number>): number {
  let n = 0;
  for (const r of rows) n += Math.min(picks[r.id] ?? 0, r.dupes) * r.value;
  return n;
}

/** 選んだぶんで染料を作れるか（ちょうど、または足りている）。 */
export function canExchange(rows: DupeRow[], picks: Record<string, number>): boolean {
  return pickedValue(rows, picks) >= DYE_EXCHANGE_COST;
}

/**
 * 「自動でえらぶ」。
 *
 * 安いもの（N）から詰めていく。手元にレアなダブりを残したいはずなので、
 * わざわざ SR から溶かさない。ちょうど100個ぶんに届かないときは空を返す
 * （足りないのに中途半端に選んだ状態にしない）。
 */
export function autoPick(rows: DupeRow[]): Record<string, number> {
  const cheap = rows.slice().sort((a, b) => a.value - b.value || b.dupes - a.dupes);
  const picks: Record<string, number> = {};
  let left = DYE_EXCHANGE_COST;
  for (const r of cheap) {
    if (left <= 0) break;
    const want = Math.min(r.dupes, Math.ceil(left / r.value));
    if (want <= 0) continue;
    picks[r.id] = want;
    left -= want * r.value;
  }
  return left <= 0 ? picks : {};
}

/**
 * 交換したあとの所持数。選んだぶんだけ減らす。
 * 1個目は残る（dupes で頭を止めているので、ここで0になることはない）。
 */
export function spendDupes(
  owned: Record<string, number>,
  rows: DupeRow[],
  picks: Record<string, number>,
): Record<string, number> {
  const next = { ...owned };
  for (const r of rows) {
    const n = Math.min(picks[r.id] ?? 0, r.dupes);
    if (n > 0) next[r.id] = (next[r.id] ?? 0) - n;
  }
  return next;
}
