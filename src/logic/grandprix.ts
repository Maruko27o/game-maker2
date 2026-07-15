// Grand prix structure (RACE_V2 §12): 18 runners → three 6-horse heats →
// top-2 of each + the two fastest 3rd-placers (敗者復活) → an 8-horse final.
import type { Course } from '../data/courses';
import type { Entrant, SimResult } from './raceSim2';
import { mulberry32 } from './stats';
import { makeCpu } from './cpu';
import { colorById } from '../data/parts';
import { paceAt } from './runStyle';
import type { HorseLook, StatKey } from '../types';
import { STAT_KEYS } from '../types';

export type GpGrade = 'g3' | 'g2' | 'g1';

// Total-point bands per grade under the 40-point system (RACE_V3 §3.5).
export const GP_GRADES: Record<GpGrade, { name: string; band: [number, number]; win1Items: number; star: boolean }> = {
  g3: { name: 'G3', band: [40, 44], win1Items: 2, star: false },
  g2: { name: 'G2', band: [42, 46], win1Items: 3, star: false },
  g1: { name: 'G1', band: [44, 48], win1Items: 4, star: true },
};

export type GpField = {
  heats: Entrant[][]; // 3 heats of 6 (player is in playerHeat)
  looks: Record<string, HorseLook>;
  playerHeat: number;
};

/** Build the 18-horse field and draw three heats (player's heat is random). */
export function buildGpField(
  player: Entrant,
  playerLook: HorseLook,
  grade: GpGrade,
  seed: number,
): GpField {
  const rng = mulberry32(seed >>> 0);
  const band = GP_GRADES[grade].band;
  const decoChance = grade === 'g1' ? 0.9 : grade === 'g2' ? 0.7 : 0.5;
  const looks: Record<string, HorseLook> = { [player.horseId]: playerLook };
  const avoidBody = colorById[playerLook.colors.body]?.value;
  const cpus: Entrant[] = [];
  for (let i = 0; i < 17; i++) {
    const c = makeCpu(`gp${i}`, rng, band, decoChance, undefined, avoidBody);
    cpus.push(c.entrant);
    looks[c.entrant.horseId] = c.look;
  }
  // Shuffle CPUs, then deal: player into a random heat, CPUs fill the rest.
  for (let i = cpus.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cpus[i], cpus[j]] = [cpus[j], cpus[i]];
  }
  const playerHeat = Math.floor(rng() * 3);
  const heats: Entrant[][] = [[], [], []];
  let ci = 0;
  for (let h = 0; h < 3; h++) {
    for (let k = 0; k < 6; k++) {
      if (h === playerHeat && k === 0) heats[h].push(player);
      else heats[h].push(cpus[ci++]);
    }
  }
  return { heats, looks, playerHeat };
}

export type Qualifier = { entrant: Entrant; heat: number; revived: boolean };

/** Given each heat's result, return the 8 finalists (top-2 + fastest two 3rds). */
export function computeQualifiers(heats: Entrant[][], results: SimResult[]): Qualifier[] {
  const q: Qualifier[] = [];
  const thirds: { entrant: Entrant; time: number; heat: number }[] = [];
  heats.forEach((heat, h) => {
    const res = results[h];
    heat.forEach((e, i) => {
      const rank = res.ranks[i];
      if (rank <= 2) q.push({ entrant: e, heat: h, revived: false });
      else if (rank === 3) thirds.push({ entrant: e, time: res.finishTimes[i], heat: h });
    });
  });
  thirds.sort((a, b) => a.time - b.time);
  for (const t of thirds.slice(0, 2)) q.push({ entrant: t.entrant, heat: t.heat, revived: true });
  return q;
}

// Win-odds estimate (RACE_V2 §13.1). Not for betting — just "how popular is my
// horse". Based on effective ability with a pace-shape allowance.
export function computeOdds(entrants: Entrant[], course: Course): { odds: number; pop: number }[] {
  const score = entrants.map((e) => {
    const eff = STAT_KEYS.reduce((n, k) => n + e.stats[k] * course.weights[k as StatKey], 0);
    const late = paceAt(e.style, 0.9); // reward strong finishers a touch
    return eff * (0.9 + late * 0.1);
  });
  const T = 3.2;
  const exps = score.map((s) => Math.exp(s / T));
  const sum = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((x) => x / sum);
  const order = probs.map((_, i) => i).sort((a, b) => probs[b] - probs[a]);
  const pop = new Array(entrants.length);
  order.forEach((idx, place) => (pop[idx] = place + 1));
  // 80% payout (0.80 takeout, RACE_V4 §4.4): fair decimal odds (1/p) × 0.80.
  return probs.map((p, i) => ({ odds: Math.min(99, Math.max(1.1, (1 / p) * 0.8)), pop: pop[i] }));
}

/** Item drops for a grand-prix final placing (RACE_V2 §12.2; 60s ×1.5 floored). */
export function gpItemCount(grade: GpGrade, rank: number, mode: 30 | 60): number {
  let base = 0;
  if (rank === 1) base = GP_GRADES[grade].win1Items;
  else if (rank === 2 || rank === 3) base = 1;
  if (mode === 60) base = Math.floor(base * 1.5);
  return base;
}

/** Heats are shorter; the final runs one extra lap (RACE_V2 §12.1). */
export function heatLaps(mode: 30 | 60): number {
  return mode === 30 ? 1 : 2;
}
export function finalLaps(mode: 30 | 60): number {
  return mode === 30 ? 2 : 3;
}
