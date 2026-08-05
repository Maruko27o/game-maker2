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
