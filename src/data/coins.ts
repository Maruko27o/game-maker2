// Coin economy (RACE_V4 §4). A single soft currency ("コイン"), earned by racing
// and spent on bets and small conveniences. No real money — purely in-game, held
// in the (cloud-synced) save. Denominations are cosmetic: bronze=1 / silver=10 /
// gold=100, used only to pick an icon.

export type CoinTier = 'bronze' | 'silver' | 'gold';

/** Pick a coin icon tier for a given amount (display only). */
export function coinTier(amount: number): CoinTier {
  return amount >= 100 ? 'gold' : amount >= 10 ? 'silver' : 'bronze';
}

// ---- earning table (§4.2) -----------------------------------------------------
export function normalRaceCoins(rank: number): number {
  return rank === 1 ? 100 : rank === 2 ? 50 : rank === 3 ? 30 : 10;
}
export function gpFinalCoins(rank: number): number {
  return rank === 1 ? 1000 : rank === 2 ? 500 : rank === 3 ? 300 : 0;
}
export const GP_QUALIFY_COINS = 200; // clearing a heat into the final
export const GP_DAILY_LIMIT = 3; // grand-prix attempts per day (qualifier+final = 1)
export const BADGE_COINS = 100; // per achievement badge earned
export const GRASS_DAILY_BONUS = 20; // grass first-visit bonus…
export const GRASS_DAILY_BONUS_MAX = 2; // …up to this many times a day

// ---- spending (§4.3) ----------------------------------------------------------
export const BET_AMOUNTS = [10, 100, 500, 1000] as const;
export const MAX_BETS_PER_RACE = 10; // bet-slip cap per single race
export const MAX_BETS_GP = 20; // bet-slip cap per grand-prix round (heat / final)
export const GRASS_OKAWARI_COST = 300; // an extra grass charge (repeatable)
export const SLOT_EXPAND_COST = 3000; // stable 10 → 15 (once)
export const SLOT_EXPAND_TO = 15;
export const RENAME_COST = 50; // rename a horse

// Coin-earning tasks (改修：タスク). Every N actions banks this many coins; the bank
// is claimed all at once from the top of the task screen.
export const RACE_TASK_EVERY = 10; // races per reward
export const RACE_TASK_REWARD = 1000; // coins banked per race cycle
export const GRASS_TASK_EVERY = 10; // grass draws per reward
export const GRASS_TASK_REWARD = 1000; // coins banked per grass cycle

// ---- 牧場の放置収入（idle income, 稼ぐコンテンツA）--------------------------
// マイウマがステーブルにいるだけで時間経過でコインを生む。総合力・トロフィー数で
// レートが決まり、開いたときにまとめて回収する。溜め込みは FARM_CAP_HOURS で頭打ち
// （毎日開く動機＋放置しすぎても無限には増えない）。
export const FARM_BASE_PER_HORSE = 30; // 1頭あたりの基礎 coins/時（作りたて総合40で計50/時）
export const FARM_PER_STAT = 0.5; // 総合力1につき coins/時
export const FARM_CAP_HOURS = 12; // これ以上の放置は加算されない

// トロフィー／バッジが時給を上乗せする（個数分だけ増える）。金トロフィー2個なら+100/時。
// ランク別レート：トロフィー 金50/銀20/銅10、バッジ 金3/銀2/銅1（順位バッジのみ）。
export const FARM_TROPHY_RATE: Record<1 | 2 | 3, number> = { 1: 50, 2: 20, 3: 10 };
export const FARM_BADGE_RATE: Record<string, number> = { badge_1st: 3, badge_2nd: 2, badge_3rd: 1 };
export const FARM_PER_HORSE_CAP = 1000; // 1頭あたりの時給上限（coins/時）

// ---- ウマ作成コスト（farm loop 防止）---------------------------------------
// 作成を有料化して「無料で作って引退で稼ぐ」荒稼ぎを封じる（作成1000＞引退ベース500）。
export const CREATE_COST = 1000; // 新しいウマを1頭つくるのに必要なコイン

// ---- 引退（retire a horse for coins, 稼ぐコンテンツB）------------------------
// 余った馬をコインに換えて馬房を空ける。育てた分（40超の強化）とトロフィー・バッジ＝
// 「投資」に価値を置き、作りたてを量産しても稼げない（作成1000＞引退ベース500で必ず赤字）。
export const RETIRE_BASE = 500; // 作りたて（未強化・無冠）でも最低これだけ
export const RETIRE_PER_TRAINED = 150; // 合計40を超えて強化した1につき
export const RETIRE_PER_TROPHY = 700; // トロフィー1個につき
export const RETIRE_PER_BADGE = 40; // バッジ1個につき
