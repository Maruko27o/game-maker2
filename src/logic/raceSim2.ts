// 2D free-running race simulation (RACE_V2 §4–§7). Pure and seeded: the renderer
// only replays frames. Horses run in Frenet coords (s along centerline, d across
// the track) and steer/collide continuously — there are no lanes.
import type { Stats, StatKey, RunStyle } from '../types';
import { STAT_KEYS } from '../types';
import type { Course } from '../data/courses';
import { lapLength, goalS } from './track';
import { mulberry32 } from './stats';
import { paceAt } from './runStyle';

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
  distanceS: number; // travelled distance to the finish (laps * lap)
  startS: number; // absolute arc-length of the start/finish line (home-straight centre)
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
    // Jockey-AI (RACE_V4 §3.9)
    cornerDAvg: number;
    straightDAvg: number;
    homeLatAvg: number;
    midLatAvg: number;
    passToRail: number;
    cutIns: number;
    railCrowdFrac: number;
  };
};

// Bumped whenever the simulation's numeric behaviour changes, so ranking
// submissions can only be compared/verified against the same engine (RACE_V4 §5).
export const SIM_VERSION = 3;

// ---- tunables (confirmed by the §8 test suite) --------------------------------
const DT = 0.02;
const HIT_R = 1.1;
const START_SPREAD = 0.9; // gate draw spans ±0.9·dLimit (slightly compressed)
// How strongly a wide trip costs centreline distance on corners. 1.0 = exact
// geometry (made an outer post a near-certain loss); tuned below 1 so positioning
// — not the draw — decides the race, closer to real post-position bias.
const CORNER_DIST_K = 1.0;
const CORNER_PEN = 0.12;
const VD_MAX_BASE = 1.6;
const BLOCK_LIMIT = 0.8; // s of continuous block before forcing outward
const DASH_TIME = 0.5;
// Race-day luck (RACE §odds): a hidden per-race form factor so a small ability edge
// isn't a near-lock — upsets happen, and win rates (hence odds) spread like real
// racing instead of collapsing to one odds-on favourite. Folded into `perf` with the
// shown mood; the Monte-Carlo odds integrate over it, so 倍率=勝率 stays exact.
const LUCK = 0.16;

// How the shown mood is dealt out over the race distance (0→1 progress). It grows
// from a small early edge to the full swing at the line, so a good mood reads as a
// horse "coming ↑" and a bad one "fading ↓" — the direction the やる気 arrows point.
// Mean over the trip ≈ 1, so the average effect matches the shown level and the
// Monte-Carlo odds price it exactly. 2-lap races give this room to actually play out.
function moodRamp(progress: number): number {
  const p = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  return 0.4 + p * 1.2; // 0.4 at the break → 1.6 at the finish (mean 1.0)
}

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
  perf: number; // hidden race-day luck (flat, RACE §odds)
  moodDelta: number; // shown mood as a signed swing; ramps in over the race (⬆/⬇)
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
  // Jockey AI state machine (RACE_V4 §3): RAIL keeps the rail, SEEK looks for a
  // gap, PASS drives through it, HOME runs straight home on the final straight.
  aim: 'RAIL' | 'SEEK' | 'PASS' | 'HOME';
  seekSince: number; // t when SEEK began (-1 otherwise)
  passRef: R | null; // runner we committed to pass
  passDTarget: number; // lateral target chosen for the pass
  passedRef: R | null; // runner we just cleared — no cutting inside it yet (§3.7)
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
  opts: { recordFrames?: boolean; laps?: number; moods?: number[] } = {},
): SimResult {
  const rng = mulberry32(seed >>> 0);
  const track = course.track;
  const lap = lapLength(track);
  const laps = opts.laps ?? (mode === 30 ? course.laps30 : course.laps60);
  // Start AND finish at the centre of the home (bottom) straight (RACE_V4 §2):
  // the field breaks from the start/finish line, runs N full laps and finishes
  // back down the home straight. s0 is the absolute start offset; the finish is
  // s0 + dist. Distances elsewhere use the *travelled* distance (s − s0).
  const s0 = goalS(track);
  const dist = laps * lap;
  const D = s0 + dist; // absolute arc-length of the finish line
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

  // Object placement (deterministic per race). Placed along the travelled range
  // [s0, s0+dist] so nothing sits behind the start/finish line.
  const isSteeple = course.surface === 'steeple';
  const obsCount = Math.round((course.obstacleDensity * dist) / 1000);
  const kinds: Obstacle['kind'][] = ['hedge', 'bamboo', 'water'];
  const obstacles: Obstacle[] = isSteeple
    ? placements(dist, obsCount, rng, 25).map((s) => ({ s: s + s0, kind: kinds[Math.floor(rng() * 3)] }))
    : [];
  // Boost panels: 1.5× the base count. They are invisible during the race (see
  // RaceTrack2) and never sit in the innermost lane — keep ~one horse-width clear
  // of the inner rail so the shortest rail line is a pure skill/positioning gain.
  const boostCount = Math.round((course.boostDensity * dist * 1.5) / 1000);
  const boostInner = -dLimit + 2 * HIT_R; // rail-lane kept clear (~1 horse wide)
  const boostOuter = dLimit * 0.85;
  const boosts: BoostPanel[] = placements(dist, boostCount, rng).map((s) => ({
    s: s + s0,
    d: boostInner + rng() * (boostOuter - boostInner),
  }));
  const slowCount = Math.round((course.drag * 12 * dist) / 1000);
  const slows: SlowZone[] = placements(dist, slowCount, rng).map((s) => ({
    s: s + s0,
    d: (rng() * 2 - 1) * dLimit * 0.6,
    halfLen: 6,
    halfWid: 4,
  }));

  const runners: R[] = entrants.map((e, ei) => {
    const ef = eff(e.stats, course.weights);
    const gate = gateOf[entrants.indexOf(e)];
    // hidden race-day luck (flat, varies per seed) and the shown mood kept apart:
    // luck is a constant factor, mood is a signed swing that builds over the race.
    const luck = 1 + (rng() * 2 - 1) * LUCK;
    const moodDelta = (opts.moods?.[ei] ?? 1) - 1;
    // Inner posts start nearer the inner rail, but the draw is compressed toward
    // the middle (not the full track width) so an outer post isn't a near-certain
    // loss before the field even funnels to the rail.
    const startD = (-dLimit + ((gate - 1) / Math.max(1, N - 1)) * (2 * dLimit)) * START_SPREAD;
    const late = ef.wit < 5 && rng() < 0.3 ? rng() * 0.4 : 0;
    return {
      e,
      eff: ef,
      gate,
      perf: luck,
      moodDelta,
      vMax0: 9 + ef.spd * 0.6,
      accel0: 1.8 + ef.pwr * 0.26,
      spMax: 44 + ef.sta * 13,
      s: s0,
      d: startD,
      v: 0,
      vd: 0,
      sp: 44 + ef.sta * 13, // start with a full tank (== spMax)
      state: 'gate',
      boostUntil: 0,
      jumpUntil: 0,
      stumbleUntil: 0,
      blockedSince: -1,
      stallSince: -1,
      forceOutUntil: 0,
      forceOutDir: 1,
      aim: 'RAIL',
      seekSince: -1,
      passRef: null,
      passDTarget: 0,
      passedRef: null,
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
  // Jockey-AI metrics (RACE_V4 §3.9).
  let cornerDSum = 0, cornerDN = 0, straightDSum = 0, straightDN = 0; // #13
  let homeLatSum = 0, homeLatN = 0, midLatSum = 0, midLatN = 0; // #14
  let passToRail = 0; // #15
  let cutIns = 0; // #16 (should stay 0)
  let railCrowdTicks = 0, crowdTicks = 0; // #17

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
      const progress = (r.s - s0) / dist;
      const aimBefore = r.aim;
      const dBefore = r.d;
      const c = centerCurv(track, r.s);
      const onCorner = c > 0;

      // --- longitudinal speed target ---
      // Tightly compressed base spread (spd barely moves top speed) so raw speed
      // can't run away; stamina failure, pace and positioning decide the winner.
      // Mood plays out across the (2-lap) race like the やる気 arrows: a good mood
      // trends the horse UP and a bad one DOWN as the laps go by — a small edge at
      // the break, the full swing by the run home. Averaged over the trip it equals
      // the shown level, so the Monte-Carlo odds still price it exactly (倍率=勝率).
      const moodFactor = 1 + r.moodDelta * moodRamp(progress);
      let vMax = (13.0 + ef.spd * 0.36) * paceAt(r.e.style, progress) * r.perf * moodFactor;
      vMax *= 1 - Math.max(0, course.drag - ef.pwr * 0.015);
      if (onCorner) vMax *= 1 - CORNER_PEN * (1 - ef.pwr * 0.03);
      // Graduated fatigue: as the tank runs low the top speed sags, so stamina
      // bites *continuously* (a small tank fades late on any course) rather than
      // only at empty. Big-tank builds (high sta) and closers hold their speed.
      const tired = r.sp <= 0;
      const spFrac = Math.max(0, r.sp / r.spMax);
      if (spFrac < 0.35) vMax *= 0.53 + (spFrac / 0.35) * 0.47; // 0.53x empty → 1.0x at 35%
      if (progress >= 0.7) vMax *= 1 + ef.gut * 0.019; // gut = a strong late kick
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
          const towCap = 0.13 + ef.gut * 0.009; // gut10 => up to +0.22
          vMax *= 1 + Math.min(towCap, (behind / 45) * towCap);
        }
      }

      // stamina — drain scales with ABSOLUTE speed, so front-runners burning fast
      // early empty out and fade; gut ("こんじょう") rarely buys a second wind, so
      // only genuinely gutsy (closer) horses can keep striking on empty.
      const sandMul = course.surface === 'sand' ? 1.15 : 1;
      const drain = DT * Math.pow(r.v / 13, 2.2) * 4.0 * (1 - ef.wit * 0.012) * sandMul;
      r.sp = Math.max(0, r.sp - drain);
      if (r.sp <= 0 && rng() < ef.gut * 0.0045) r.sp = r.spMax * 0.15;

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

      // --- steering (lateral): jockey AI state machine (RACE_V4 §3) ---
      const jumping = isAir(r, t);
      if (!jumping) {
        const rr = HIT_R;
        const dInner = -dLimit;
        // HOME: the final straight — curvature 0 and within one straight of home.
        const inHome = c === 0 && D - r.s < track.straight;
        const jam = frontJam(runners, r, vMax);

        // transitions
        if (inHome) {
          r.aim = 'HOME';
        } else if (r.aim === 'HOME') {
          r.aim = 'RAIL'; // left the straight (multi-lap) — back to keeping the rail
        } else if (r.aim === 'RAIL') {
          if (jam) { r.aim = 'SEEK'; r.seekSince = t; }
        } else if (r.aim === 'SEEK') {
          if (!jam) { r.aim = 'RAIL'; r.seekSince = -1; }
          else {
            const gap = chooseGap(runners, r, jam, c, vMax, dLimit);
            if (gap != null) { r.aim = 'PASS'; r.passRef = jam; r.passDTarget = gap; }
            else if (t - r.seekSince > 2.5) { // waited too long — force outside (§3.5)
              r.aim = 'PASS'; r.passRef = jam; r.passDTarget = Math.min(dLimit - 1.6, r.d + 3 * rr);
            }
          }
        } else if (r.aim === 'PASS') {
          const tgt = r.passRef;
          if (!tgt || tgt.finished || r.s - tgt.s > 2 * rr) {
            r.passedRef = tgt && !tgt.finished && r.s - tgt.s < 3 * rr ? tgt : null; // §3.7 lock
            r.aim = 'RAIL'; r.passRef = null; r.seekSince = -1;
          } else if (!frontJam(runners, r, vMax)) {
            r.aim = 'RAIL'; r.passRef = null; r.seekSince = -1;
          }
        }
        // clear the no-cut-inside lock once we're safely (2r) clear of the passed
        // horse, so a passer ducks back to the rail promptly instead of running the
        // long way round the bend after an overtake (still no 斜行 — §3.7).
        if (r.passedRef && (r.passedRef.finished || r.s - r.passedRef.s > 2 * rr)) r.passedRef = null;

        // dTarget by state
        let dTarget = r.d;
        let vdScale = 1;
        let weaveCost = 0.05;
        if (r.aim === 'HOME') {
          dTarget = homeTarget(runners, r, dLimit);
          weaveCost = 0.035;
        } else if (r.aim === 'PASS') {
          dTarget = r.passDTarget;
          weaveCost = 0.025; // §3.6: accelerating through — half the weave penalty
        } else if (r.aim === 'RAIL') {
          dTarget = railTarget(r, dInner, rr, progress, dLimit, onCorner);
          // Converge onto the rail faster the farther out you are, so an
          // outer-gate horse can save ground into the first turn instead of
          // running the whole way wide (real jockeys tuck in). Near the rail it
          // stays gentle so the line doesn't jitter.
          vdScale = Math.min(1, 0.66 + Math.abs(dTarget - r.d) * 0.14);
          // A closer making its one big move off the outer stalking line to the rail
          // snaps in briskly, so the cut-in lands on a straight instead of stringing
          // out around the final bend (the ground is still paid — only the transition
          // is quicker, not the position). No inside neighbour to shove (guarded below).
          const closer = r.e.style === 'sashi' || r.e.style === 'oikomi';
          if (closer && r.d - dTarget > 2 * rr) vdScale = Math.min(1.6, 0.85 + Math.abs(dTarget - r.d) * 0.16);
          if (innerOccupied(runners, r, rr)) dTarget = r.d; // don't shove a rail neighbour
          if (r.passedRef) dTarget = Math.max(dTarget, r.d); // no cutting inside yet (§3.7)
        }
        // low-level deadlock escape overrides everything (§4.5, keeps the pack moving)
        if (t < r.forceOutUntil) { dTarget = r.d + r.forceOutDir * 3 * rr; vdScale = 1; }

        // physics: centrifugal drift out on corners + soft rail cushions
        let extra = 0;
        if (onCorner) extra += c * r.v * r.v * 0.014;
        if (r.d > dLimit - 1.5) extra -= (r.d - (dLimit - 1.5)) * 3.0;
        if (r.d < -dLimit + 1.5) extra += (-dLimit + 1.5 - r.d) * 3.0;

        const vdMax = VD_MAX_BASE + ef.wit * 0.12;
        let desired = (dTarget - r.d) * 2.2 + extra;
        desired = Math.max(-vdMax * vdScale, Math.min(vdMax * vdScale, desired));
        if (r.passedRef && desired < 0) desired = 0; // never cut inside a just-passed horse
        r.vd += (desired - r.vd) * 0.35;
        if (r.passedRef && r.vd < 0) r.vd = 0; // kill inward momentum too (§3.7, no 斜行)
        r.d += r.vd * DT;
        // Weaving lowers the speed CEILING for this tick (no compounding decay).
        r.v = Math.min(r.v, vMax * (1 - Math.min(0.15, Math.abs(r.vd) * weaveCost)));
        if (r.d > dLimit) { r.d = dLimit; if (r.vd > 0) r.vd = 0; }
        if (r.d < -dLimit) { r.d = -dLimit; if (r.vd < 0) r.vd = 0; }

        // --- jockey-AI metrics (§3.9) ---
        if (onCorner) { cornerDSum += r.d; cornerDN++; } else { straightDSum += r.d; straightDN++; }
        const moved = Math.abs(r.d - dBefore);
        // #14: front-runners (逃げ/先行) hold their line home — their deliberate
        // job is to run straight. Closers weave for the 大外 charge, so they're
        // excluded here (that movement is purposeful, not wasted).
        if (r.e.style === 'nige' || r.e.style === 'senko') {
          if (r.aim === 'HOME') { homeLatSum += moved; homeLatN++; } else { midLatSum += moved; midLatN++; }
        }
        if (aimBefore === 'PASS' && r.aim === 'RAIL') passToRail++;
        if (r.passedRef && r.d < dBefore - 0.01) cutIns++; // must stay 0 (no 斜行)
      }

      // slow zones
      for (const z of slows) {
        if (Math.abs(r.s - z.s) < z.halfLen && Math.abs(r.d - z.d) < z.halfWid) {
          r.v *= 1 - Math.max(0, (5 - ef.pwr) * 0.03);
        }
      }

      // advance along the track (inner path is shorter; softened by CORNER_DIST_K
      // so an outer draw isn't fatal — positioning still matters, the rail still helps)
      r.s += (r.v * DT) / (1 + r.d * c * CORNER_DIST_K);

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

    // #17: fraction of ticks where the whole field is packed on the rail.
    const active = runners.filter((r) => !r.finished && t >= r.lateUntil);
    if (active.length >= 2) {
      crowdTicks++;
      if (active.every((r) => r.d < -dLimit + 2 * HIT_R)) railCrowdTicks++;
    }

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
    distanceS: dist,
    startS: s0,
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
      cornerDAvg: cornerDN ? cornerDSum / cornerDN : 0,
      straightDAvg: straightDN ? straightDSum / straightDN : 0,
      homeLatAvg: homeLatN ? homeLatSum / homeLatN : 0,
      midLatAvg: midLatN ? midLatSum / midLatN : 0,
      passToRail,
      cutIns,
      railCrowdFrac: crowdTicks ? railCrowdTicks / crowdTicks : 0,
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

// The slower horse just ahead that we're catching and can't get around (§3.5).
function frontJam(runners: R[], r: R, vMax: number): R | null {
  let best: R | null = null;
  let bestGap = Infinity;
  for (const o of runners) {
    if (o === r || o.finished) continue;
    const ds = o.s - r.s;
    if (ds <= 0 || ds > r.v * 0.8 + 2 * HIT_R) continue;
    if (Math.abs(o.d - r.d) > 1.6 * HIT_R) continue;
    if (o.v >= vMax * 0.98) continue; // not actually slower — no need to pass
    if (ds < bestGap) { bestGap = ds; best = o; }
  }
  return best;
}

// A horse hugging our inside that we'd shove if we dived for the rail (§3.4).
function innerOccupied(runners: R[], r: R, rr: number): boolean {
  for (const o of runners) {
    if (o === r || o.finished) continue;
    if (o.d < r.d && Math.abs(o.d - r.d) < 2 * rr && Math.abs(o.s - r.s) < 0.9 * rr) return true;
  }
  return false;
}

// Score the inner vs outer gap around a jam and return the chosen lateral target,
// or null to wait ("包まれる"). Outer costs distance on corners; inner risks the
// rail. Smarter (wit) horses judge the risk more truly (§3.5).
function chooseGap(runners: R[], r: R, jam: R, c: number, vMax: number, dLimit: number): number | null {
  const rr = HIT_R;
  const need = 2.4 * rr;
  const gain = Math.max(0, vMax - jam.v) * 1.4; // ~ speed we'd unlock by getting by
  const evalSide = (dir: -1 | 1): { d: number; score: number } | null => {
    const dTarget = jam.d + dir * need;
    // Keep an inner run a horse-width off the rail so we never scrape/bounce it (柵検知).
    if (dTarget < -dLimit + 1.6 || dTarget > dLimit) return null;
    let occ = 0;
    for (const o of runners) {
      if (o === r || o === jam || o.finished) continue;
      if (Math.abs(o.s - r.s) > 5) continue;
      const inGap = dir === -1 ? o.d < jam.d && o.d > dTarget - rr : o.d > jam.d && o.d < dTarget + rr;
      if (inGap) occ++;
    }
    const move = Math.abs(dTarget - r.d);
    const costDistance = dir === 1 ? move * c * 6 : 0; // outer on a corner is dear; inner is free
    const width = dir === -1 ? jam.d + dLimit : dLimit - jam.d;
    // Diving inside is a real option whenever the rail is open — take the inner run
    // (on a corner it also saves ground). Closers doing this more is compensated by a
    // gentler late kick/tow below, so §4 balance holds. Only a genuinely tight rail
    // (no room) is penalised hard, and the fence margin above stops any scraping.
    const innerPen = 0.4;
    let costRisk = occ * 0.6 + (dir === -1 ? innerPen : 0) + (width < 3 * rr ? 1.4 : 0);
    costRisk *= 1 - Math.min(0.5, r.eff.wit * 0.03); // wit sees the risk truer
    return { d: dTarget, score: gain - costDistance - costRisk };
  };
  const cands = [evalSide(-1), evalSide(1)].filter((x): x is { d: number; score: number } => x != null);
  cands.sort((a, b) => b.score - a.score);
  if (cands.length === 0 || cands[0].score <= 0) return null;
  return cands[0].d;
}

// RAIL target — style dispersion so the field doesn't wall up on the rail (#17).
function railTarget(r: R, dInner: number, rr: number, progress: number, dLimit: number, onCorner: boolean): number {
  const style = r.e.style;
  if (style === 'nige' || style === 'senko') return dInner + 1.2 * rr;
  const early = progress < 0.55; // closers stalk off the rail, then take it
  // Early: closers stalk from just inside centre — off the rail for a clear late run
  // and to pay some ground (their handicap vs the late kick), but NOT out in the outer
  // third, so even a horse that loses the break tucks toward the rail on the first
  // bend instead of fanning wide. Late (from ~55%): they take the rail outright; the
  // wide 大外 charge is reserved for the home straight (see homeTarget).
  //
  // 改修：早いラップのコーナーでも内ラチへ寄せる。本物の競馬同様「コーナーは内で
  // 距離を詰め、直線でふくらむ」動きにする。early でもコーナー上なら内寄り（ただし
  // ラチべったりではなく数馬身外＝地面はいくらか払う）を狙い、直線ではストーキング
  // 位置へ戻す。後半（≥55%）は従来どおりラチを取り切る。
  if (style === 'sashi') return early ? -0.8 : dInner + 1.3 * rr;
  return early ? (onCorner ? dInner + 3.8 * rr : dLimit * 0.2) : dInner + 1.5 * rr; // oikomi
}

// HOME target — the final straight (§3.8). Front-runners hold their line and only
// dodge a horse dead ahead the shortest way; closers (差し/追込) swing to clean air
// on the outside for a 大外強襲 — on the straight (curvature 0) lateral position is
// distance-free, so the wide charge costs nothing and buys a clear run.
function homeTarget(runners: R[], r: R, dLimit: number): number {
  const rr = HIT_R;
  const closer = r.e.style === 'oikomi' || r.e.style === 'sashi';
  let blockedAhead = false;
  for (const o of runners) {
    if (o === r || o.finished) continue;
    const ds = o.s - r.s;
    if (ds > 0 && ds < r.v * 0.7 + 2 * rr && Math.abs(o.d - r.d) < 1.5 * rr) { blockedAhead = true; break; }
  }
  if (!blockedAhead) return closer ? Math.max(r.d, dLimit * 0.4) : r.d; // ease out for a run
  if (closer) return dLimit * (r.e.style === 'oikomi' ? 0.8 : 0.6); // 大外強襲
  // front-runner/先行: dodge the shortest way.
  const innerRoom = r.d + dLimit;
  const outerRoom = dLimit - r.d;
  return r.d + (outerRoom >= innerRoom ? 1 : -1) * 2 * rr;
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
