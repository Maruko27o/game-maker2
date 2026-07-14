// CPU horse generation shared by single races and the grand prix.
import { colorsBySlot, decosBySlot, DECO_SLOTS } from '../data/parts';
import { rollStatsForStyle, type RNG } from './stats';
import type { Entrant } from './raceSim2';
import type { HorseLook, DecoSlot, RunStyle } from '../types';

const STYLES: RunStyle[] = ['nige', 'senko', 'sashi', 'oikomi'];

const NAME_A = ['カゼ', 'ホシ', 'ハナ', 'ユキ', 'ソラ', 'ナミ', 'ミネ', 'タキ', 'クモ', 'ツキ', 'イナ', 'アサ', 'ハル', 'ナツ'];
const NAME_B = ['マル', 'ゴウ', 'オー', 'キング', 'スター', 'ボーイ', 'ヒメ', 'ナデシコ', '号', '丸', 'クン', 'ロード'];

function pick<T>(a: T[], rng: RNG): T {
  return a[Math.floor(rng() * a.length)];
}

export function cpuName(rng: RNG): string {
  return pick(NAME_A, rng) + pick(NAME_B, rng);
}

/** A CPU racer whose 40+ points are laid down along a running-style template
 *  (RACE_V3 §3.5), so it plays like a real 逃げ/差し… type. `band` is the total
 *  point range for the grade. Higher decoChance dresses stronger horses up. */
export function makeCpu(
  id: string,
  rng: RNG,
  band: [number, number],
  decoChance: number,
  name = cpuName(rng),
): { entrant: Entrant; look: HorseLook } {
  const style = pick(STYLES, rng);
  const total = band[0] + Math.floor(rng() * (band[1] - band[0] + 1));
  const stats = rollStatsForStyle(rng, total, style);
  const decos: Partial<Record<DecoSlot, string>> = {};
  let chance = decoChance;
  for (const slot of DECO_SLOTS) {
    if (rng() < chance) decos[slot] = pick(decosBySlot[slot], rng).id;
    chance *= 0.5;
  }
  const look: HorseLook = {
    name,
    colors: {
      body: pick(colorsBySlot.body, rng).id,
      mane: pick(colorsBySlot.mane, rng).id,
      hoof: pick(colorsBySlot.hoof, rng).id,
    },
    decos,
  };
  return {
    entrant: { horseId: id, name, isPlayer: false, stats, style },
    look,
  };
}
