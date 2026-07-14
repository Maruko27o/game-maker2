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

// Hue (0..360) of a #rrggbb colour, or null for non-hex (gradient) paints.
function hueOf(value: string | undefined): number | null {
  if (!value || value[0] !== '#' || value.length < 7) return null;
  const r = parseInt(value.slice(1, 3), 16) / 255;
  const g = parseInt(value.slice(3, 5), 16) / 255;
  const b = parseInt(value.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 1e-6) return null; // greyscale — no meaningful hue
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

function hueClash(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return false;
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff) < 30; // within 30° reads as "same colour"
}

/** Pick a body colour whose hue is ≥30° from the player's, so CPUs never blend
 *  into the player horse on track (RACE_V3 §2.2). Falls back after a few tries. */
function pickBodyColor(rng: RNG, avoidHue: number | null): string {
  let chosen = pick(colorsBySlot.body, rng);
  for (let i = 0; i < 6 && hueClash(hueOf(chosen.value), avoidHue); i++) {
    chosen = pick(colorsBySlot.body, rng);
  }
  return chosen.id;
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
  avoidBody?: string, // player's body colour value (#hex) to steer clear of
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
      body: pickBodyColor(rng, hueOf(avoidBody)),
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
