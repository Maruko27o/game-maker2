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

/**
 * 保存されている値をパターンの配列にそろえる。
 *
 * 以前は1つだけ（オブジェクト1個）だったので、そのまま入っているセーブも
 * 受け取って1件の配列にする。壊れた値は落とす。上限を超えるぶんも切る。
 */
export function normalizeCustomBets(v: unknown): CustomBetSpec[] {
  const list = Array.isArray(v) ? v : v ? [v] : [];
  const out: CustomBetSpec[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const s = raw as Partial<CustomBetSpec>;
    if (typeof s.amount !== 'number' || typeof s.minOdds !== 'number' || typeof s.maxOdds !== 'number') continue;
    out.push(normalizeCustomBet(s as CustomBetSpec));
    if (out.length >= CUSTOM_BET_SLOTS) break;
  }
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
