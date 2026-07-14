// 2D free-running race simulation (RACE_V2 §4–§7). Pure and seeded: the renderer
// only replays frames. Horses run in Frenet coords (s along centerline, d across
// the track) and steer/collide continuously — there are no lanes.
import type { Stats, StatKey, RunStyle } from '../types';
import { STAT_KEYS } from '../types';
import type { Course } from '../data/courses';
import { lapLength } from './track';
import { mulberry32 } from './stats';
import { paceAt, STYLE_BIAS } from './runStyle';

export type RunnerState =
  | 'gate'
  | 'run'
  | 'boost'
  | 'blocked'
  | 'jump'
  | 'stumble'
  | 'tired'
  | 'finished';

export type Entrant = {
  horseId: string;
  name: string;
  isPlayer: boolean;
  stats: Stats;
  style: RunStyle;
};

export type RunnerFrame = { s: number; d: number; state: RunnerState; rank: number };
export type SimFrame = { t: number; runners: RunnerFrame[] };

export type Obstacle = { s: number; kind: 'hedge' | 'bamboo' | 'water' };
export type BoostPanel = { s: number; d: number };
export type SlowZone = { s: number; d: number; halfLen: number; halfWid: number };

export type SimResult = {
  dt: number;
  distanceS: number;
  duration: number;
  gate: number[]; // gate (post) number per entrant index
  frames: SimFrame[]; // empty unless recordFrames
  finishTimes: number[];
  ranks: number[];
  order: number[];
  obstacles: Obstacle[];
  boosts: BoostPanel[];
  slows: SlowZone[];
  trouble: string[]; // per entrant: a note about mishaps (RACE_V2 §13.4)
  metrics: {
    overtakes: number;
    maxBlocked: number;
    minPairDist: number;
    leadGap: number; // 1st-to-2nd finish time gap
  };
};

// ---- tunables (confirmed by the §8 test suite) --------------------------------
const DT = 0.02;
const HIT_R = 1.1;
const CORNER_PEN = 0.12;
const VD_MAX_BASE = 1.4;
const BLOCK_LIMIT = 0.8; // s of continuous block before forcing outward
const DASH_TIME = 0.5;

function eff(stats: Stats, weights: Stats): Stats {
  const e = {} as Stats;
  for (const k of STAT_KEYS) e[k] = stats[k] * weights[k as StatKey];
  return e;
}

function placements(distance: number, count: number, rng: () => number, pad = 15): number[] {
  if (count <= 0) return [];
  const out: number[] = [];
  const seg = distance / (count + 1);
  for (let i = 1; i <= count; i++) {
    const jitter = (rng() - 0.5) * seg * 0.5;
    out.push(Math.min(distance - pad, Math.max(pad, seg * i + jitter)));
  }
  return out.sort((a, b) => a - b);
}

type R = {
  e: Entrant;
  eff: Stats;
  gate: number;
  vMax0: number;
  accel0: number;
  spMax: number;
  s: number;
  d: number;
  v: number;
  vd: number;
  sp: number;
  state: RunnerState;
  boostUntil: number;
  jumpUntil: number;
  stumbleUntil: number;
  blockedSince: number; // -1 when not blocked
  stallSince: number; // -1 when moving; tracks true deadlock time
  forceOutUntil: number;
  forceOutDir: number; // -1 inner / +1 outer — toward the side with room
  lateUntil: number; // gate: stays put until this time
  nextObs: number;
  nextBoost: number;
  finished: boolean;
  finishT: number;
  trouble: string[];
};

export function simulate2(
  entrants: Entrant[],
  course: Course,
  mode: 30 | 60,
  seed: number,
  opts: { recordFrames?: boolean; laps?: number } = {},
): SimResult {
  const rng = mulberry32(seed >>> 0);
  const track = course.track;
  const lap = lapLength(track);
  const laps = opts.laps ?? (mode === 30 ? course.laps30 : course.laps60);
  const D = laps * lap + lap * 0.12;
  const halfW = track.width / 2;
  const margin = HIT_R;
  const dLimit = halfW - margin;
  const N = entrants.length;

  // Post (gate) draw — random permutation. Inner posts start nearer the rail.
  const posts = entrants.map((_, i) => i);
  for (let i = posts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [posts[i], posts[j]] = [posts[j], posts[i]];
  }
  const gateOf = new Array<number>(N);
  posts.forEach((entIdx, post) => (gateOf[entIdx] = post + 1));

  // Object placement (deterministic per race).
  const isSteeple = course.surface === 'steeple';
  const obsCount = Math.round((course.obstacleDensity * D) / 1000);
  const kinds: Obstacle['kind'][] = ['hedge', 'bamboo', 'water'];
  const obstacles: Obstacle[] = isSteeple
    ? placements(D, obsCount, rng, 25).map((s) => ({ s, kind: kinds[Math.floor(rng() * 3)] }))
    : [];
  const boostCount = Math.round((course.boostDensity * D) / 1000);
  const boosts: BoostPanel[] = placements(D, boostCount, rng).map((s) => ({
    s,
    d: (rng() * 2 - 1) * dLimit * 0.85,
  }));
  const slowCount = Math.round((course.drag * 12 * D) / 1000);
  const slows: SlowZone[] = placements(D, slowCount, rng).map((s) => ({
    s,
    d: (rng() * 2 - 1) * dLimit * 0.6,
    halfLen: 6,
    halfWid: 4,
  }));

  const runners: R[] = entrants.map((e) => {
    const ef = eff(e.stats, course.weights);
    const gate = gateOf[entrants.indexOf(e)];
    // Inner posts start nearer the inner rail.
    const startD = -dLimit + ((gate - 1) / Math.max(1, N - 1)) * (2 * dLimit);
    const late = ef.wit < 5 && rng() < 0.3 ? rng() * 0.4 : 0;
    return {
      e,
      eff: ef,
      gate,
      vMax0: 9 + ef.spd * 0.6,
      accel0: 1.8 + ef.pwr * 0.26,
      spMax: 48 + ef.sta * 12,
      s: 0,
      d: startD,
      v: 0,
      vd: 0,
      sp: 60 + ef.sta * 10,
      state: 'gate',
      boostUntil: 0,
      jumpUntil: 0,
      stumbleUntil: 0,
      blockedSince: -1,
      stallSince: -1,
      forceOutUntil: 0,
      forceOutDir: 1,
      lateUntil: late,
      nextObs: 0,
      nextBoost: 0,
      finished: false,
      finishT: Infinity,
      trouble: [],
    };
  });

  const frames: SimFrame[] = [];
  let prevRank = new Array<number>(N).fill(0);
  let overtakes = 0;
  let maxBlocked = 0;
  let minPairDist = Infinity;
  let t = 0;
  let finishedCount = 0;
  const MAX_TICKS = 12000;

  for (let tick = 0; tick < MAX_TICKS && finishedCount < N; tick++) {
    t = tick * DT;
    // Current leader position, for the terminal closing tow.
    let leaderS = 0;
    for (const r of runners) if (!r.finished && r.s > leaderS) leaderS = r.s;

    for (const r of runners) {
      if (r.finished) continue;
      if (t < r.lateUntil) {
        r.state = 'gate';
        continue;
      }
      const ef = r.eff;
      const progress = r.s / D;
      const c = centerCurv(track, r.s);
      const onCorner = c > 0;

      // --- longitudinal speed target ---
      // Tightly compressed base spread (spd barely moves top speed) so raw speed
      // can't run away; stamina failure, pace and positioning decide the winner.
      let vMax = (13.0 + ef.spd * 0.33) * paceAt(r.e.style, progress);
      vMax *= 1 - Math.max(0, course.drag - ef.pwr * 0.015);
      if (onCorner) vMax *= 1 - CORNER_PEN * (1 - ef.pwr * 0.03);
      const tired = r.sp <= 0;
      if (tired) vMax *= 0.5; // running on empty is punishing — stamina matters
      if (progress >= 0.7) vMax *= 1 + ef.gut * 0.025; // gut = a strong late kick
      const boosting = t < r.boostUntil;
      if (boosting) vMax *= 1.25;
      // Slipstream vs clean-air: a horse leading its line cuts the air and is a
      // touch slower, so the pack stays together and the lead keeps changing —
      // this is what produces close finishes (RACE_V2 §8 criterion 5).
      if (drafting(runners, r)) vMax *= 1.05;
      else vMax *= 0.97; // clean-air cost keeps the pack honest
      if (r.s >= leaderS - 0.01) vMax *= 0.965; // the outright leader cuts all the wind
      // Terminal closing (RACE_V2 §13): the last quarter pulls trailing horses
      // back toward the leader so finishes stay tight and closers can strike.
      // Gut ("こんじょう") strengthens the tow, so gutsy closers reliably reel the
      // leader in late (RACE_V3 §4 directionality).
      if (progress > 0.75) {
        const behind = leaderS - r.s;
        if (behind > 0 && behind < 45) {
          const towCap = 0.16 + ef.gut * 0.012; // gut10 => up to +0.28
          vMax *= 1 + Math.min(towCap, (behind / 45) * towCap);
        }
      }

      // stamina — drain scales with ABSOLUTE speed, so front-runners burning fast
      // early empty out and fade; gut ("こんじょう") rarely buys a second wind, so
      // only genuinely gutsy (closer) horses can keep striking on empty.
      const sandMul = course.surface === 'sand' ? 1.15 : 1;
      const drain = DT * Math.pow(r.v / 13, 2.2) * 4.0 * (1 - ef.wit * 0.012) * sandMul;
      r.sp = Math.max(0, r.sp - drain);
      if (r.sp <= 0 && rng() < ef.gut * 0.0035) r.sp = r.spMax * 0.15;

      // acceleration
      let accel = r.accel0;
      if (boosting) accel *= 2;
      if (t < DASH_TIME) accel *= 2;
      const stumbling = t < r.stumbleUntil;
      if (stumbling) accel *= 0.4;

      // Note whether a horse is right ahead (for state + harder avoidance). The
      // actual "can't pass" is enforced positionally after integration.
      const front = frontBlocker(runners, r);
      const blocked = !!front && !isAir(r, t) && !isAir(front, t);

      r.v = Math.min(vMax, r.v + accel * DT);

      // --- steering (lateral) ---
      const jumping = isAir(r, t);
      if (!jumping) {
        let lateral = 0;
        const biasD = STYLE_BIAS[r.e.style] * dLimit;
        lateral += (biasD - r.d) * 0.8; // style bias
        lateral += -0.3; // inner desire (mild, so the field doesn't wall up)
        if (onCorner) lateral += c * r.v * r.v * 0.02; // centrifugal push outward
        // rail avoidance
        if (r.d > dLimit - 1.5) lateral -= (r.d - (dLimit - 1.5)) * 3.0;
        if (r.d < -dLimit + 1.5) lateral += (-dLimit + 1.5 - r.d) * 3.0;
        // front avoidance + neighbours
        const avoidW = blocked ? 5.0 : 2.5;
        lateral += steerAvoid(runners, r, avoidW);
        // deadlock escape — commit hard toward the side that has room
        if (t < r.forceOutUntil) lateral += r.forceOutDir * 4.0;

        const vdMax = VD_MAX_BASE + ef.wit * 0.12;
        const target = Math.max(-vdMax, Math.min(vdMax, lateral));
        r.vd += (target - r.vd) * 0.35;
        r.d += r.vd * DT;
        // Weaving lowers the speed CEILING for this tick (no compounding decay).
        r.v = Math.min(r.v, vMax * (1 - Math.min(0.15, Math.abs(r.vd) * 0.05)));
        if (r.d > dLimit) {
          r.d = dLimit;
          if (r.vd > 0) r.vd = 0;
        }
        if (r.d < -dLimit) {
          r.d = -dLimit;
          if (r.vd < 0) r.vd = 0;
        }
      }

      // slow zones
      for (const z of slows) {
        if (Math.abs(r.s - z.s) < z.halfLen && Math.abs(r.d - z.d) < z.halfWid) {
          r.v *= 1 - Math.max(0, (5 - ef.pwr) * 0.03);
        }
      }

      // advance along the track (inner path is shorter)
      r.s += (r.v * DT) / (1 + r.d * c);

      // boost panels
      while (r.nextBoost < boosts.length && r.s >= boosts[r.nextBoost].s) {
        const b = boosts[r.nextBoost];
        r.nextBoost++;
        if (Math.abs(r.d - b.d) < HIT_R * 2.2) {
          const rate = Math.min(0.95, Math.max(0, 0.4 + ef.wit * 0.05));
          if (rng() < rate) r.boostUntil = t + 3;
        }
      }

      // obstacles (steeple)
      while (r.nextObs < obstacles.length && r.s >= obstacles[r.nextObs].s) {
        const o = obstacles[r.nextObs];
        r.nextObs++;
        const crowd = runners.filter(
          (x) => x !== r && !x.finished && Math.abs(x.s - r.s) < 3,
        ).length;
        const diff = o.kind === 'bamboo' ? 0.14 : o.kind === 'water' ? 0.1 : 0.05;
        const success = Math.min(
          0.98,
          Math.max(0.05, 0.35 + ef.jmp * 0.05 + ef.wit * 0.02 - diff - crowd * 0.04),
        );
        if (rng() < success) {
          r.jumpUntil = t + 0.6;
        } else {
          r.stumbleUntil = t + 0.8;
          r.v *= 0.55;
          if (r.trouble.length === 0) r.trouble.push('障害でつまずいた');
        }
      }

      // state resolve
      if (t < r.stumbleUntil) r.state = 'stumble';
      else if (jumping) r.state = 'jump';
      else if (boosting) r.state = 'boost';
      else if (blocked) r.state = 'blocked';
      else if (tired) r.state = 'tired';
      else r.state = 'run';

      // block streak drives the deadlock escape; a horse that is blocked AND
      // barely moving is "stalled" (the metric that must stay under 3s).
      if (r.state === 'blocked') {
        if (r.blockedSince < 0) r.blockedSince = t;
        if (t - r.blockedSince >= BLOCK_LIMIT && t >= r.forceOutUntil) {
          r.forceOutDir = openSideDir(runners, r, dLimit);
          r.forceOutUntil = t + 0.6;
          if (r.trouble.length === 0) r.trouble.push('前が詰まって進路がなかった');
        }
      } else {
        r.blockedSince = -1;
      }
      if (r.state === 'blocked' && r.v < 1.5) {
        if (r.stallSince < 0) r.stallSince = t;
        if (t - r.stallSince > maxBlocked) maxBlocked = t - r.stallSince;
      } else {
        r.stallSince = -1;
      }

      if (r.s >= D) {
        r.s = D;
        r.finished = true;
        r.finishT = t;
        r.state = 'finished';
        finishedCount++;
      }
    }

    // lateral separation + positional following (order matters)
    for (let pass = 0; pass < 2; pass++) resolveCollisions(runners, t, HIT_R, dLimit);
    enforceFollowing(runners, t, HIT_R);

    // ranks
    const order = runners
      .map((_, i) => i)
      .sort((a, b) => {
        const ra = runners[a];
        const rb = runners[b];
        if (ra.finished && rb.finished) return ra.finishT - rb.finishT;
        if (ra.finished) return -1;
        if (rb.finished) return 1;
        return rb.s - ra.s;
      });
    const rank = new Array<number>(N);
    order.forEach((idx, place) => (rank[idx] = place + 1));
    if (tick > 0) {
      for (let i = 0; i < N; i++) if (rank[i] < prevRank[i]) overtakes++;
    }
    prevRank = rank;

    // min pairwise distance (ignoring airborne)
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const a = runners[i];
        const b = runners[j];
        if (a.finished || b.finished || isAir(a, t) || isAir(b, t)) continue;
        const dist = Math.hypot(a.s - b.s, a.d - b.d);
        if (dist < minPairDist) minPairDist = dist;
      }
    }

    if (opts.recordFrames) {
      frames.push({
        t,
        runners: runners.map((r, i) => ({ s: r.s, d: r.d, state: r.state, rank: rank[i] })),
      });
    }
  }

  // finishing order
  const idxOrder = runners
    .map((_, i) => i)
    .sort((a, b) => {
      const ra = runners[a];
      const rb = runners[b];
      if (ra.finishT !== rb.finishT) return ra.finishT - rb.finishT;
      return rb.s - ra.s;
    });
  const ranks = new Array<number>(N);
  idxOrder.forEach((idx, place) => (ranks[idx] = place + 1));

  const first = runners[idxOrder[0]].finishT;
  const second = runners[idxOrder[1]]?.finishT ?? first;

  return {
    dt: DT,
    distanceS: D,
    duration: t,
    gate: gateOf,
    frames,
    finishTimes: runners.map((r) => r.finishT),
    ranks,
    order: idxOrder,
    obstacles,
    boosts,
    slows,
    trouble: runners.map((r) => r.trouble[0] ?? ''),
    metrics: {
      overtakes,
      maxBlocked,
      minPairDist,
      leadGap: second - first,
    },
  };
}

// ---- helpers ------------------------------------------------------------------

function centerCurv(track: { straight: number; radius: number }, s: number): number {
  const R = track.radius;
  const L = track.straight;
  const lap = 2 * L + 2 * Math.PI * R;
  const arc = Math.PI * R;
  let x = ((s % lap) + lap) % lap;
  if (x < arc) return 1 / R;
  x -= arc;
  if (x < L) return 0;
  x -= L;
  if (x < arc) return 1 / R;
  return 0;
}

function isAir(r: R, t: number): boolean {
  return t < r.jumpUntil;
}

// Only the horse we are about to touch caps our speed — NOT anyone within our
// look-ahead. A wide reach here makes the whole field crawl behind the leader.
function frontBlocker(runners: R[], r: R): R | null {
  let best: R | null = null;
  let bestGap = Infinity;
  const reach = HIT_R * 2.2; // ~2.4m — imminent contact only
  for (const o of runners) {
    if (o === r || o.finished) continue;
    const gap = o.s - r.s;
    if (gap > 0 && gap < reach && Math.abs(o.d - r.d) < HIT_R * 1.4) {
      if (gap < bestGap) {
        bestGap = gap;
        best = o;
      }
    }
  }
  return best;
}

// Pick the side (inner −1 / outer +1) with more lateral room to escape a jam.
function openSideDir(runners: R[], r: R, dLimit: number): number {
  let innerRoom = r.d + dLimit; // distance to inner rail
  let outerRoom = dLimit - r.d; // distance to outer rail
  for (const o of runners) {
    if (o === r || o.finished) continue;
    if (Math.abs(o.s - r.s) > 3.5) continue;
    if (o.d < r.d) innerRoom = Math.min(innerRoom, r.d - o.d);
    else outerRoom = Math.min(outerRoom, o.d - r.d);
  }
  return outerRoom >= innerRoom ? 1 : -1;
}

function drafting(runners: R[], r: R): boolean {
  for (const o of runners) {
    if (o === r || o.finished) continue;
    const gap = o.s - r.s;
    if (gap > 1.5 && gap < 9 && Math.abs(o.d - r.d) < HIT_R * 1.8) return true;
  }
  return false;
}

function steerAvoid(runners: R[], r: R, avoidW: number): number {
  let lat = 0;
  for (const o of runners) {
    if (o === r || o.finished) continue;
    const ds = o.s - r.s;
    const dd = o.d - r.d;
    // front avoidance
    if (ds > 0 && ds < r.v * 0.6 + HIT_R && Math.abs(dd) < HIT_R * 1.8) {
      const openSide = r.d >= o.d ? 1 : -1; // steer to the side we're already leaning
      lat += openSide * avoidW;
    }
    // neighbour repulsion
    if (Math.abs(ds) < HIT_R * 2 && Math.abs(dd) < HIT_R * 2) {
      lat += (dd >= 0 ? -1 : 1) * 1.5 * (1 - Math.abs(dd) / (HIT_R * 2));
    }
  }
  return lat;
}

function resolveCollisions(runners: R[], t: number, r: number, dLimit: number): void {
  for (let i = 0; i < runners.length; i++) {
    for (let j = i + 1; j < runners.length; j++) {
      const a = runners[i];
      const b = runners[j];
      if (a.finished || b.finished || isAir(a, t) || isAir(b, t)) continue;
      const ds = a.s - b.s;
      const dd = a.d - b.d;
      const hit = Math.pow(ds / (r * 1.6), 2) + Math.pow(dd / r, 2) < 1;
      if (!hit) continue;
      // Fully separate laterally to |Δd| = r (weighted by power). This is what
      // keeps horses from tunnelling through each other.
      const pa = a.eff.pwr + 1;
      const pb = b.eff.pwr + 1;
      const dir = dd === 0 ? (a.gate < b.gate ? -1 : 1) : Math.sign(dd);
      const overlap = r - Math.abs(dd);
      a.d += dir * overlap * (pb / (pa + pb));
      b.d -= dir * overlap * (pa / (pa + pb));
      a.d = Math.max(-dLimit, Math.min(dLimit, a.d));
      b.d = Math.max(-dLimit, Math.min(dLimit, b.d));
    }
  }
}

// Positional "can't pass" constraint (RACE_V2 §4.5): a horse laterally behind
// another cannot occupy the same s. Clamp it just behind, matching speed. This
// prevents both tunnelling AND the velocity death-spiral of a mutual cap.
function enforceFollowing(runners: R[], t: number, r: number): void {
  const active = runners.filter((x) => !x.finished && !isAir(x, t));
  active.sort((a, b) => b.s - a.s); // front first
  const minGap = r * 1.6;
  for (let iter = 0; iter < 2; iter++) {
    for (let j = 1; j < active.length; j++) {
      const back = active[j];
      for (let i = j - 1; i >= 0; i--) {
        const front = active[i];
        if (Math.abs(front.d - back.d) < r && front.s - back.s < minGap) {
          const maxS = front.s - minGap;
          if (back.s > maxS) {
            back.s = maxS;
            if (back.v > front.v) back.v = front.v;
          }
          break; // only the nearest horse ahead constrains us
        }
      }
    }
  }
}
