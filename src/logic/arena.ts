// 対戦トーナメントの純粋ロジック（決定的・テスト可能）。
// エントリー馬のスナップショット＋シード（＋あれば他プレイヤーのプール）から、
// 「予選1回戦 → 予選2回戦 → 本線」を決定的に再現する。ネットワークが無くても
// COMだけで必ず成立し、RaceTrack2 に同じ entrants/course/seed を渡せば、ここで
// 計算した着順とアニメが一致する。
import { COURSES } from '../data/courses';
import { simulate2, type Entrant } from './raceSim2';
import { mulberry32 } from './stats';
import { makeCpu } from './cpu';
import { colorById } from '../data/parts';
import { ARENA_FIELD, ARENA_ADVANCE, ARENA_REAL_CAP, ARENA_COM_BANDS, arenaPrize, periodLabel } from '../data/arena';
import type { ArenaHorseSnapshot, ArenaRoundResult, ArenaResult, ArenaOutcome, HorseLook } from '../types';

/** entrant/look へ変換するヘルパ（simulate2・HorseView 用）。 */
export function snapToEntrant(s: ArenaHorseSnapshot): Entrant {
  return { horseId: s.horseId, name: s.name, isPlayer: s.isPlayer, stats: s.stats, style: s.style };
}
export function snapToLook(s: ArenaHorseSnapshot): HorseLook {
  return { name: s.name, colors: s.colors, decos: s.decos };
}
/** ラウンドの全 look を id→look で。RaceTrack2 の looks 引数に渡す。 */
export function fieldLooks(field: ArenaHorseSnapshot[]): Record<string, HorseLook> {
  const out: Record<string, HorseLook> = {};
  for (const s of field) out[s.horseId] = snapToLook(s);
  return out;
}

// Fisher–Yates using a seeded RNG (deterministic opponent draw from the pool).
function shuffled<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build one round's 8-horse field: the player + real opponents (capped, from the
 *  pool) + scaled COM fill. Difficulty rises each round so a championship stays
 *  rare regardless of who else entered. */
export function buildRoundField(
  round: number,
  player: ArenaHorseSnapshot,
  seed: number,
  pool: ArenaHorseSnapshot[],
): ArenaHorseSnapshot[] {
  const rng = mulberry32((seed ^ 0x51ed) >>> 0);
  const field: ArenaHorseSnapshot[] = [{ ...player, isPlayer: true, isCom: false }];

  // Real opponents (excluding the player), capped so later rounds lean on COM.
  const cap = ARENA_REAL_CAP[round] ?? 2;
  const reals = shuffled(pool.filter((p) => p.horseId !== player.horseId), rng).slice(0, cap);
  reals.forEach((r, i) => {
    field.push({ ...r, horseId: `real${round}_${i}`, isPlayer: false, isCom: false });
  });

  // COM fill. Absolute strength bands (independent of the player) so training pays
  // off: a strong/maxed horse (合計48) clears the field and profits（参加費1000に対し
  // 期待値>1）、育てていない馬（合計40前後）は勝ち越せない。ラウンドが進むほど少し強くなり、
  // 本線・優勝は鍛えた馬でも希少に保つ。
  const band = (ARENA_COM_BANDS[round] ?? ARENA_COM_BANDS[2]) as [number, number];
  const avoidBody = colorById[player.colors.body]?.value;
  let i = 0;
  while (field.length < ARENA_FIELD) {
    const cpu = makeCpu(`com${round}_${i}`, rng, band, 0.5, undefined, avoidBody);
    field.push({
      horseId: cpu.entrant.horseId,
      name: cpu.entrant.name,
      colors: cpu.look.colors,
      decos: cpu.look.decos,
      stats: cpu.entrant.stats,
      style: cpu.entrant.style,
      isPlayer: false,
      isCom: true,
      playerNo: null,
    });
    i++;
  }
  return field;
}

/** Run the whole tournament deterministically. Plays round 0; on a top-4 finish
 *  advances to round 1, then (again top-4) to the 本線. Stops the moment the
 *  player is eliminated. `mode` sets the race length. */
export function runTournament(
  player: ArenaHorseSnapshot,
  seed: number,
  pool: ArenaHorseSnapshot[],
  mode: 30 | 60,
  period: number,
): ArenaResult {
  const crng = mulberry32((seed ^ 0xa0a0) >>> 0);
  const course = COURSES[Math.floor(crng() * COURSES.length)];
  const rounds: ArenaRoundResult[] = [];
  let outcome: ArenaOutcome = 'q1out';
  let finalRank: number | null = null;

  for (let r = 0; r < 3; r++) {
    const roundSeed = (seed + r * 7919) >>> 0;
    const field = buildRoundField(r, player, seed + r * 1009, pool);
    const entrants = field.map(snapToEntrant);
    const res = simulate2(entrants, course, mode, roundSeed);
    const playerIdx = field.findIndex((f) => f.isPlayer);
    const playerRank = res.ranks[playerIdx];
    const advanced = r < 2 && playerRank <= ARENA_ADVANCE;
    rounds.push({
      round: r as 0 | 1 | 2,
      seed: roundSeed,
      courseId: course.id,
      field,
      playerIdx,
      order: res.order,
      ranks: res.ranks,
      finishTimes: res.finishTimes,
      playerRank,
      advanced,
    });
    if (r < 2 && !advanced) {
      outcome = r === 0 ? 'q1out' : 'q2out';
      break;
    }
    if (r === 2) {
      finalRank = playerRank;
      outcome = playerRank === 1 ? 'champion' : 'final';
    }
  }

  const payout = arenaPrize(outcome, finalRank ?? 0);
  return { period, label: periodLabel(period), seed, mode, rounds, outcome, finalRank, payout, awarded: false, seen: false };
}

/** Build the player's own entry snapshot from a live horse. */
export function playerSnapshot(
  horseId: string,
  name: string,
  colors: ArenaHorseSnapshot['colors'],
  decos: ArenaHorseSnapshot['decos'],
  stats: ArenaHorseSnapshot['stats'],
  style: ArenaHorseSnapshot['style'],
  playerNo: number | null,
): ArenaHorseSnapshot {
  return { horseId, name, colors, decos, stats, style, isPlayer: true, isCom: false, playerNo };
}
