// Ranking submission (RACE_V4 §5). Foundation only: we capture the *inputs* to a
// race (seed, course, mode, the exact field) plus the client's claimed result,
// never trusting the client's numbers. Because the simulation is pure and seeded
// (raceSim2), a server can re-run simulate2 from these inputs and confirm the
// result before it counts — the client can't fake a time. Nothing is uploaded
// while ENABLE_RANKING is false; results are just buffered locally.
import { simulate2, SIM_VERSION, type Entrant, type SimResult } from './raceSim2';
import { courseById } from '../data/courses';
import { ENABLE_RANKING } from '../config';
import type { Stats, RunStyle } from '../types';

export type RunnerSnapshot = {
  horseId: string;
  name: string;
  isPlayer: boolean;
  stats: Stats;
  style: RunStyle;
};

export type RaceResult = { order: number[]; ranks: number[]; finishTimesMs: number[] };

export type RaceSubmission = {
  simVersion: number;
  seed: number;
  courseId: string;
  mode: 30 | 60;
  laps?: number; // set for grand-prix heats/finals (non-default lap counts)
  runners: RunnerSnapshot[]; // the full field, in entrant order
  playerHorseId: string; // which runner belongs to the submitter
  clientResult: RaceResult; // the client's claimed outcome (server re-verifies)
};

function snapshot(e: Entrant): RunnerSnapshot {
  return { horseId: e.horseId, name: e.name, isPlayer: e.isPlayer, stats: e.stats, style: e.style };
}

function resultOf(res: SimResult): RaceResult {
  return {
    order: res.order,
    ranks: res.ranks,
    finishTimesMs: res.finishTimes.map((t) => Math.round(t * 1000)),
  };
}

/** Build a verifiable submission from a finished race and its inputs. */
export function buildSubmission(
  entrants: Entrant[],
  courseId: string,
  mode: 30 | 60,
  seed: number,
  result: SimResult,
  playerHorseId: string,
  laps?: number,
): RaceSubmission {
  return {
    simVersion: SIM_VERSION,
    seed,
    courseId,
    mode,
    laps,
    runners: entrants.map(snapshot),
    playerHorseId,
    clientResult: resultOf(result),
  };
}

/** Re-run the simulation purely from a submission — the server-side check. Returns
 *  the reproduced result (compare to `clientResult`). */
export function reproduce(sub: RaceSubmission): RaceResult {
  const entrants: Entrant[] = sub.runners.map((r) => ({ ...r }));
  const res = simulate2(entrants, courseById(sub.courseId), sub.mode, sub.seed, { laps: sub.laps });
  return resultOf(res);
}

/** Whether a submission's claimed result matches a fresh re-simulation. */
export function verify(sub: RaceSubmission): boolean {
  if (sub.simVersion !== SIM_VERSION) return false;
  const got = reproduce(sub);
  return (
    got.ranks.length === sub.clientResult.ranks.length &&
    got.ranks.every((r, i) => r === sub.clientResult.ranks[i]) &&
    got.finishTimesMs.every((t, i) => t === sub.clientResult.finishTimesMs[i])
  );
}

// ---- local buffer -------------------------------------------------------------
// Until the leaderboard back-end is live, submissions accumulate here in a
// server-reproducible shape. `flushSubmissions` is a no-op while ranking is off.
const BUFFER_KEY = 'horse-game/rankbuf/v1';
const BUFFER_CAP = 100;

export function bufferSubmission(sub: RaceSubmission): void {
  try {
    const cur = readBuffer();
    cur.push(sub);
    localStorage.setItem(BUFFER_KEY, JSON.stringify(cur.slice(-BUFFER_CAP)));
  } catch {
    /* storage unavailable — drop silently */
  }
}

export function readBuffer(): RaceSubmission[] {
  try {
    const raw = localStorage.getItem(BUFFER_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as RaceSubmission[]) : [];
  } catch {
    return [];
  }
}

/** Upload buffered submissions once ranking is enabled. No-op for now (§5). */
export async function flushSubmissions(): Promise<void> {
  if (!ENABLE_RANKING) return;
  // Future: POST readBuffer() to the leaderboard endpoint, then clear on success.
}
