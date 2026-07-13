// CPU horse generation shared by single races and the grand prix.
import { colorsBySlot, decosBySlot, DECO_SLOTS } from '../data/parts';
import { rollStatsTotal, type RNG } from './stats';
import { styleFor } from './runStyle';
import type { Entrant } from './raceSim2';
import type { HorseLook, DecoSlot } from '../types';

const NAME_A = ['カゼ', 'ホシ', 'ハナ', 'ユキ', 'ソラ', 'ナミ', 'ミネ', 'タキ', 'クモ', 'ツキ', 'イナ', 'アサ', 'ハル', 'ナツ'];
const NAME_B = ['マル', 'ゴウ', 'オー', 'キング', 'スター', 'ボーイ', 'ヒメ', 'ナデシコ', '号', '丸', 'クン', 'ロード'];

function pick<T>(a: T[], rng: RNG): T {
  return a[Math.floor(rng() * a.length)];
}

export function cpuName(rng: RNG): string {
  return pick(NAME_A, rng) + pick(NAME_B, rng);
}

/** A CPU racer with random look + stats in a grade band. Higher decoChance
 *  (grand-prix, higher grade) makes stronger-looking horses. */
export function makeCpu(
  id: string,
  rng: RNG,
  band: [number, number],
  decoChance: number,
  name = cpuName(rng),
): { entrant: Entrant; look: HorseLook } {
  const stats = rollStatsTotal(rng, band[0], band[1]);
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
    entrant: { horseId: id, name, isPlayer: false, stats, style: styleFor(id, stats) },
    look,
  };
}
