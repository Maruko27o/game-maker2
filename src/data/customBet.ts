// カスタムベット（倍率と金額を決めておいて、ワンタップでその条件の馬券を買う）。
//
// 「3〜4倍を500コインで」のように決めておくと、その時のレースで実際に組める
// 買い目の中から条件に合うものを1つ選んで買う。候補が複数あればランダム。

export const CUSTOM_BET = {
  amountMin: 100,
  amountMax: 5000,
  amountStep: 100, // 十の位・一の位は決められない
  oddsMin: 1,
  oddsMax: 10000, // 小数点以下は指定できない（整数の範囲指定）
} as const;

export type CustomBetSpec = { amount: number; minOdds: number; maxOdds: number };

export const DEFAULT_CUSTOM_BET: CustomBetSpec = { amount: 500, minOdds: 3, maxOdds: 10 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** 画面から来た値を、決めた刻み・範囲に丸める。 */
export function normalizeCustomBet(s: CustomBetSpec): CustomBetSpec {
  const amount = clamp(
    Math.floor((Number.isFinite(s.amount) ? s.amount : CUSTOM_BET.amountMin) / CUSTOM_BET.amountStep) * CUSTOM_BET.amountStep,
    CUSTOM_BET.amountMin,
    CUSTOM_BET.amountMax,
  );
  let minOdds = clamp(Math.floor(Number.isFinite(s.minOdds) ? s.minOdds : CUSTOM_BET.oddsMin), CUSTOM_BET.oddsMin, CUSTOM_BET.oddsMax);
  let maxOdds = clamp(Math.floor(Number.isFinite(s.maxOdds) ? s.maxOdds : CUSTOM_BET.oddsMax), CUSTOM_BET.oddsMin, CUSTOM_BET.oddsMax);
  if (minOdds > maxOdds) [minOdds, maxOdds] = [maxOdds, minOdds];
  return { amount, minOdds, maxOdds };
}

/** 決めておけるパターンの数。2つあれば「本命の帯」と「大穴の帯」を使い分けられる。 */
export const CUSTOM_BET_SLOTS = 2;

/** 1枠ぶんの中身。まだ決めていない枠は null。 */
export type CustomBetSlots = (CustomBetSpec | null)[];

/** 1件ぶんの値として受け取ってよいか調べる（外から来た値の検証）。 */
function parseSpec(raw: unknown): CustomBetSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<CustomBetSpec>;
  if (typeof s.amount !== 'number' || typeof s.minOdds !== 'number' || typeof s.maxOdds !== 'number') return null;
  return normalizeCustomBet(s as CustomBetSpec);
}

/**
 * 保存されている値を、**必ず枠の数ぶんある配列**にそろえる（空の枠は null）。
 *
 * 長さを固定するのが大事。以前は「決めたぶんだけ」を詰めた配列にしていたので、
 * 1つめが空のまま2つめを決めると **詰められて1つめの位置に入って**しまい、
 * 画面は2つめの位置を見にいくので「設定したのに消えた」ように見えていた。
 * 枠と位置を1対1にしておけば、この取り違えは起こらない。
 *
 * 以前は1つだけ（オブジェクト1個）だったセーブも受け取って、1枠目に入れる。
 */
export function normalizeCustomBets(v: unknown): CustomBetSlots {
  const list = Array.isArray(v) ? v : v ? [v] : [];
  const out: CustomBetSlots = Array.from({ length: CUSTOM_BET_SLOTS }, () => null);
  for (let i = 0; i < Math.min(list.length, CUSTOM_BET_SLOTS); i++) out[i] = parseSpec(list[i]);
  return out;
}

/** 1枠だけ入れ替える。ほかの枠は動かさない（位置がずれないのがねらい）。 */
export function setCustomBetSlot(cur: unknown, slot: number, spec: CustomBetSpec | null): CustomBetSlots {
  const out = normalizeCustomBets(cur);
  if (slot >= 0 && slot < CUSTOM_BET_SLOTS) out[slot] = spec ? normalizeCustomBet(spec) : null;
  return out;
}

/**
 * 入力欄の文字を数字だけにそろえる。
 *
 * 「3」と打ったのに「03」になっていたのは、入力中の文字をそのまま数値に変えて
 * 書き戻していたため（先頭の 0 が消えないことがあった）。入力中は文字のまま
 * 持っておき、確定するときだけ数値にする。ここはその「文字のまま」の掃除役。
 */
export function digitsOnly(s: string, maxLen = 5): string {
  return s.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '').slice(0, maxLen);
}
