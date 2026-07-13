// Deterministic race simulation (RACE.md §3). Pure: same seed + same entrants
// => identical result. The renderer only plays back the frames it returns.
import type { Stats, StatKey } from '../types';
import { STAT_KEYS } from '../types';
import type { Course } from '../data/courses';
import { mulberry32 } from './stats';

export type RunnerState = 'run' | 'boost' | 'stumble' | 'tired' | 'jump';

export type Entrant = {
  horseId: string;
  name: string;
  isPlayer: boolean;
  stats: Stats;
};

export type RunnerFrame = { pos: number; state: RunnerState; rank: number };
export type SimFrame = { t: number; runners: RunnerFrame[] };

export type Obstacle = { pos: number; kind: 'hurdle' | 'rock' | 'water' };

export type SimResult = {
  dt: number;
  distance: number;
  duration: number; // seconds of the winner (race length for playback)
  frames: SimFrame[];
  finishTimes: number[]; // per entrant index, seconds (Infinity if DNF)
  ranks: number[]; // final rank per entrant index (1-based)
  order: number[]; // entrant indices in finishing order
  obstacles: Obstacle[];
  boosts: number[]; // panel positions (m)
};

const DT = 0.05;
const MAX_TICKS = 8000; // 400s safety cap

function eff(stats: Stats, weights: Stats): Stats {
  const e = {} as Stats;
  for (const k of STAT_KEYS) e[k] = stats[k] * weights[k];
  return e;
}

function placements(distance: number, count: number, rng: () => number): number[] {
  if (count <= 0) return [];
  const out: number[] = [];
  const seg = distance / (count + 1);
  for (let i = 1; i <= count; i++) {
    const jitter = (rng() - 0.5) * seg * 0.6;
    out.push(Math.min(distance - 15, Math.max(20, seg * i + jitter)));
  }
  return out.sort((a, b) => a - b);
}

type R = {
  e: Entrant;
  eff: Stats;
  vMax0: number;
  accel0: number;
  spMax: number;
  pos: number;
  v: number;
  sp: number;
  boostUntil: number;
  stumbleUntil: number;
  jumpUntil: number;
  nextBoost: number;
  nextObs: number;
  finished: boolean;
  finishT: number;
};

export function simulate(
  entrants: Entrant[],
  course: Course,
  distance: number,
  seed: number,
): SimResult {
  const rng = mulberry32(seed >>> 0);

  const obsCount = Math.round((course.obstacleDensity * distance) / 1000);
  const boostCount = Math.round((course.boostDensity * distance) / 1000);
  const obsPos = placements(distance, obsCount, rng);
  const kinds: Obstacle['kind'][] = ['hurdle', 'rock', 'water'];
  const obstacles: Obstacle[] = obsPos.map((p) => ({ pos: p, kind: kinds[Math.floor(rng() * 3)] }));
  const boosts = placements(distance, boostCount, rng);

  const runners: R[] = entrants.map((e) => {
    const ef = eff(e.stats, course.weights);
    return {
      e,
      eff: ef,
      vMax0: 9 + ef.spd * 0.8,
      accel0: 1.8 + ef.pwr * 0.35,
      spMax: 60 + ef.sta * 10,
      pos: 0,
      v: 0,
      sp: 60 + ef.sta * 10,
      boostUntil: 0,
      stumbleUntil: 0,
      jumpUntil: 0,
      nextBoost: 0,
      nextObs: 0,
      finished: false,
      finishT: Infinity,
    };
  });

  const frames: SimFrame[] = [];
  let t = 0;
  let finishedCount = 0;

  for (let tick = 0; tick < MAX_TICKS && finishedCount < runners.length; tick++) {
    t = tick * DT;

    for (const r of runners) {
      if (r.finished) continue;
      const ef = r.eff;

      // Effective top speed for this tick.
      let vMax = r.vMax0;
      const tired = r.sp <= 0;
      if (tired) vMax *= 0.6;
      if (distance - r.pos <= distance * 0.25) vMax *= 1 + ef.gut * 0.02;
      vMax *= 1 - Math.max(0, course.drag - ef.pwr * 0.015);
      const boosting = t < r.boostUntil;
      if (boosting) vMax *= 1.25;

      // Stamina drain (eased by wit). Recover a little via guts when bottomed out.
      const drain = DT * Math.pow(r.v / Math.max(1, vMax), 2) * 3.0 * (1 - ef.wit * 0.02);
      r.sp = Math.max(0, r.sp - drain);
      if (r.sp <= 0 && rng() < ef.gut * 0.004) r.sp = r.spMax * 0.15;

      // Acceleration (boost doubles, stumble quarters).
      const stumbling = t < r.stumbleUntil;
      let accel = r.accel0;
      if (boosting) accel *= 2;
      if (stumbling) accel *= 0.4;
      r.v = Math.min(vMax, r.v + accel * DT);
      r.pos += r.v * DT;

      // Boost panels.
      while (r.nextBoost < boosts.length && r.pos >= boosts[r.nextBoost]) {
        r.nextBoost++;
        const rate = Math.min(0.95, Math.max(0, 0.4 + ef.wit * 0.05));
        if (rng() < rate) r.boostUntil = t + 3;
      }

      // Obstacles — jump or stumble.
      while (r.nextObs < obstacles.length && r.pos >= obstacles[r.nextObs].pos) {
        r.nextObs++;
        const success = Math.min(
          0.98,
          Math.max(0.05, 0.35 + ef.jmp * 0.05 + ef.wit * 0.02 - course.difficulty),
        );
        if (rng() < success) {
          r.jumpUntil = t + 0.5;
        } else {
          r.stumbleUntil = t + 0.8;
          r.v *= 0.55;
        }
      }

      if (r.pos >= distance) {
        r.pos = distance;
        r.finished = true;
        r.finishT = t;
        finishedCount++;
      }
    }

    // Ranks by distance (finished first, by finish time).
    const order = runners
      .map((_, i) => i)
      .sort((a, b) => {
        const ra = runners[a];
        const rb = runners[b];
        if (ra.finished && rb.finished) return ra.finishT - rb.finishT;
        if (ra.finished) return -1;
        if (rb.finished) return 1;
        return rb.pos - ra.pos;
      });
    const rankOf = new Array(runners.length);
    order.forEach((idx, place) => (rankOf[idx] = place + 1));

    frames.push({
      t,
      runners: runners.map((r, i) => ({ pos: r.pos, rank: rankOf[i], state: stateOf(r, t) })),
    });
  }

  // Final ordering.
  const idxOrder = runners
    .map((_, i) => i)
    .sort((a, b) => {
      const ra = runners[a];
      const rb = runners[b];
      if (ra.finishT !== rb.finishT) return ra.finishT - rb.finishT;
      return rb.pos - ra.pos;
    });
  const ranks = new Array(runners.length);
  idxOrder.forEach((idx, place) => (ranks[idx] = place + 1));

  return {
    dt: DT,
    distance,
    duration: t,
    frames,
    finishTimes: runners.map((r) => r.finishT),
    ranks,
    order: idxOrder,
    obstacles,
    boosts,
  };
}

function stateOf(r: R, t: number): RunnerState {
  if (t < r.stumbleUntil) return 'stumble';
  if (t < r.jumpUntil) return 'jump';
  if (t < r.boostUntil) return 'boost';
  if (r.sp <= 0) return 'tired';
  return 'run';
}

// Convenience: CPU stat bands by grade (RACE.md §3.3).
export const GRADE_BANDS: Record<string, [number, number]> = {
  practice: [12, 24],
  normal: [20, 34],
  gp: [32, 44],
};

// Exported for tests.
export const _internal = { placements, eff, DT };
export type { StatKey };
