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
export const BADGE_COINS = 100; // per achievement badge earned
export const GRASS_DAILY_BONUS = 20; // grass first-visit bonus…
export const GRASS_DAILY_BONUS_MAX = 2; // …up to this many times a day

// ---- spending (§4.3) ----------------------------------------------------------
export const BET_AMOUNTS = [10, 50, 100, 500] as const;
export const GRASS_OKAWARI_COST = 300; // an extra grass charge (once/day)
export const SLOT_EXPAND_COST = 3000; // stable 10 → 15 (once)
export const SLOT_EXPAND_TO = 15;
export const RENAME_COST = 50; // rename a horse
