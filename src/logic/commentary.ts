import type { SimResult } from './raceSim2';
import type { RunStyle } from '../types';

// レース中の実況テロップ。
//
// 走り終わったレースの記録（frames）から作るので、出る文も出るタイミングも
// レースごとに必ず同じ。観ているだけの時間に起伏をつけるのが目的で、
// 勝敗にも倍率にも一切影響しない（表示だけ）。
//
// 作り方の方針：
//  ・実際に起きたことだけを言う（「盛り上げるための嘘」は入れない）
//  ・同時に何行も出さない。1本ずつ、間隔を空けて出す
//  ・あなたのウマの話を優先する（他馬の話ばかりだと他人事になる）

export type Telop = { at: number; text: string };
/** 内部用。近い時刻でぶつかったとき、どちらを残すかの重み。 */
type Cand = Telop & { pri: number };

/** 1本のテロップが出ている長さ(秒)。 */
export const TELOP_HOLD = 2.6;
/** テロップ同士の最短の間隔(秒)。詰まると読めない。 */
const MIN_GAP = 3.0;
/** スタートの合図を出す時刻と文。これだけは必ず1本目に出す。 */
const START_AT = 0.4;
const START_TEXT = 'ゲートが開いた！';

type Entrant = { name: string; isPlayer: boolean; style?: RunStyle };

/** 脚質ごとの、先手を取ったときの言い方。 */
const LEAD_BY_STYLE: Record<RunStyle, (n: string) => string> = {
  nige: (n) => `${n}がハナを切って飛ばす！`,
  senko: (n) => `${n}がすんなり前につけた`,
  sashi: (n) => `${n}が思い切って前に出た！`,
  oikomi: (n) => `${n}がめずらしく前につけている`,
};

/** そのウマの呼び名。自分のウマは名前ではなく「あなたのウマ」。 */
function who(e: Entrant): string {
  return e.isPlayer ? 'あなたのウマ' : e.name;
}

export function raceCommentary(res: SimResult, entrants: Entrant[]): Telop[] {
  const frames = res.frames;
  if (frames.length === 0 || entrants.length === 0) return [];

  // pri は「同じころに2つ起きたとき、どちらを言うか」の重み。時刻だけで
  // 決めると、早く起きやすい文（順位の上下）ばかりが毎回残ってしまう。
  const out: Cand[] = [];
  const push = (at: number, text: string, pri: number) => out.push({ at, text, pri });

  const playerIdx = entrants.findIndex((e) => e.isPlayer);
  const goal = res.distanceS;
  /**
   * そのフレームの進み具合（先頭のウマ基準・0..1）。
   *
   * s はコース上の通し距離で、スタート線の位置（startS）から始まる。
   * startS を引かずに s / distanceS とすると、1周レースでは開始時点で
   * すでに 0.9 を超え、3周でも 0.3 から始まってしまう。そうなると
   * 「勝負どころ」「直線」の判定点がぜんぶレース前半に寄って、
   * 後半にテロップが出なくなる。
   */
  const progressAt = (fi: number) => {
    let best = 0;
    for (const r of frames[fi].runners) best = Math.max(best, r.s);
    return goal > 0 ? Math.min(1, Math.max(0, (best - res.startS) / goal)) : 0;
  };
  const leaderAt = (fi: number) => {
    const rs = frames[fi].runners;
    let idx = 0;
    for (let i = 1; i < rs.length; i++) if (rs[i].rank < rs[idx].rank) idx = i;
    return idx;
  };
  /** 進み具合が p を最初に超えるフレーム。 */
  const frameAtProgress = (p: number) => {
    for (let i = 0; i < frames.length; i++) if (progressAt(i) >= p) return i;
    return frames.length - 1;
  };

  // ── スタート ──
  push(START_AT, START_TEXT, 100);

  // ── 序盤の先頭。脚質で言い方を変える（逃げが飛ばすのと、追込が前に出るのは
  //     まったく違う出来事なので、同じ文にしてしまうともったいない）。 ──
  {
    const fi = frameAtProgress(0.18);
    const l = leaderAt(fi);
    const e = entrants[l];
    if (e) {
      const say = e.style ? LEAD_BY_STYLE[e.style] : null;
      push(frames[fi].t, say ? say(who(e)) : `${who(e)}が先手を取った！`, 65);
    }
  }

  // ── 追込・差しのあなたのウマが最後方でためている ──
  if (playerIdx >= 0) {
    const st = entrants[playerIdx].style;
    if (st === 'oikomi' || st === 'sashi') {
      const fi = frameAtProgress(0.45);
      const rank = frames[fi].runners[playerIdx]?.rank ?? 0;
      if (rank >= entrants.length - 1) {
        push(frames[fi].t, 'あなたのウマは後ろでじっと脚をためている', 40);
      }
    }
  }

  // ── 障害を跳んだ（このコースならではの見せ場）──
  outer2: for (let i = 0; i < frames.length; i++) {
    for (let k = 0; k < frames[i].runners.length; k++) {
      if (frames[i].runners[k].state !== 'jump') continue;
      if (!entrants[k]) continue;
      push(frames[i].t, `${who(entrants[k])}が障害を跳んだ！`, 70);
      break outer2;
    }
  }

  // ── 先頭が入れかわった（後半だけ。序盤の入れかわりはいちいち言わない）──
  {
    const from = frameAtProgress(0.5);
    let prev = leaderAt(from);
    for (let i = from + 1; i < frames.length; i++) {
      const l = leaderAt(i);
      if (l === prev) continue;
      if (entrants[l]) push(frames[i].t, `先頭が入れかわった！${who(entrants[l])}！`, 60);
      prev = l;
      break; // 1回だけ
    }
  }

  // ── スタミナ切れ（終盤に息が上がったウマ）──
  {
    const fi = frameAtProgress(0.8);
    for (let k = 0; k < frames[fi].runners.length; k++) {
      const r = frames[fi].runners[k];
      if (r.state !== 'tired' || !entrants[k]) continue;
      push(frames[fi].t, `${who(entrants[k])}、脚が上がってきた…`, 40);
      break;
    }
  }

  // ── つまずき（いちばん最初の1件だけ）──
  outer: for (let i = 0; i < frames.length; i++) {
    for (let k = 0; k < frames[i].runners.length; k++) {
      if (frames[i].runners[k].state !== 'stumble') continue;
      if (!entrants[k]) continue;
      push(frames[i].t, `${who(entrants[k])}がつまずいた！`, 70);
      break outer;
    }
  }

  // ── あなたのウマの動き（いちばん大きく上げた場面・下げた場面を1つずつ）──
  if (playerIdx >= 0) {
    const rankAt = (fi: number) => frames[fi].runners[playerIdx]?.rank ?? 0;
    const win = Math.max(1, Math.round(2.5 / res.dt)); // 2.5秒でどれだけ動いたか
    let bestGain = { d: 0, fi: -1 };
    let bestLoss = { d: 0, fi: -1 };
    for (let i = win; i < frames.length; i++) {
      const d = rankAt(i - win) - rankAt(i); // 正＝順位を上げた
      if (d > bestGain.d) bestGain = { d, fi: i };
      if (-d > bestLoss.d) bestLoss = { d: -d, fi: i };
    }
    if (bestGain.d >= 2) push(frames[bestGain.fi].t, `あなたのウマが上がってきた！${rankAt(bestGain.fi)}番手！`, 55);
    if (bestLoss.d >= 2) push(frames[bestLoss.fi].t, 'あなたのウマ、少し置かれた…', 45);
  }

  // ── 勝負どころ ──
  {
    const fi = frameAtProgress(0.72);
    const l = leaderAt(fi);
    if (entrants[l]) push(frames[fi].t, `勝負どころ！先頭は${who(entrants[l])}`, 50);
  }

  // ── 直線 ──
  {
    const fi = frameAtProgress(0.88);
    const l = leaderAt(fi);
    if (entrants[l]) push(frames[fi].t, `直線！${who(entrants[l])}が抜け出すか`, 55);
  }

  // ── ゴール前の接戦（1着と2着のタイム差が僅かなときだけ）──
  {
    const times = res.finishTimes.filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
    if (times.length >= 2 && times[1] - times[0] <= 0.25) {
      push(Math.max(0, times[0] - 1.4), 'ゴール前、横一線！', 90);
    }
  }

  // ── 先頭がゴール ──
  // 1着が入ってから最後のウマが入るまでは間があく（3周だと20秒以上のことも）。
  // そこが無言になってしまうので、勝った瞬間をちゃんと言う。
  {
    let win = -1;
    for (let i = 0; i < res.finishTimes.length; i++) {
      const t = res.finishTimes[i];
      if (!Number.isFinite(t)) continue;
      if (win < 0 || t < res.finishTimes[win]) win = i;
    }
    if (win >= 0 && entrants[win]) push(res.finishTimes[win], `${who(entrants[win])}が先頭でゴール！`, 95);
  }

  // 時間順にならべ、近すぎるものは落とす（同時に2本出さない）。
  // ぶつかったときは pri の高い方を残す。
  out.sort((a, b) => a.at - b.at);
  const kept: Cand[] = [];
  for (const t of out) {
    if (t.at > res.duration - 0.3) continue;
    // スタート直後の出来事はゲートの合図に含める（合図より前に何かを出さない）。
    if (t.at < START_AT && t.text !== START_TEXT) continue;
    const last = kept[kept.length - 1];
    if (last && t.at - last.at < MIN_GAP) {
      if (t.pri > last.pri) kept[kept.length - 1] = t;
      continue;
    }
    kept.push(t);
  }
  return kept.map(({ at, text }) => ({ at, text }));
}

/** その時刻に出ているテロップ（無ければ null）。 */
export function telopAt(list: Telop[], t: number): Telop | null {
  for (let i = list.length - 1; i >= 0; i--) {
    if (t >= list[i].at && t < list[i].at + TELOP_HOLD) return list[i];
  }
  return null;
}
