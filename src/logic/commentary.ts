import type { SimResult } from './raceSim2';

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

/** 1本のテロップが出ている長さ(秒)。 */
export const TELOP_HOLD = 2.6;
/** テロップ同士の最短の間隔(秒)。詰まると読めない。 */
const MIN_GAP = 3.0;
/** スタートの合図を出す時刻と文。これだけは必ず1本目に出す。 */
const START_AT = 0.4;
const START_TEXT = 'ゲートが開いた！';

type Entrant = { name: string; isPlayer: boolean };

/** そのウマの呼び名。自分のウマは名前ではなく「あなたのウマ」。 */
function who(e: Entrant): string {
  return e.isPlayer ? 'あなたのウマ' : e.name;
}

export function raceCommentary(res: SimResult, entrants: Entrant[]): Telop[] {
  const frames = res.frames;
  if (frames.length === 0 || entrants.length === 0) return [];

  const out: Telop[] = [];
  const push = (at: number, text: string) => out.push({ at, text });

  const playerIdx = entrants.findIndex((e) => e.isPlayer);
  const goal = res.distanceS;
  /** そのフレームの進み具合（先頭のウマ基準・0..1）。 */
  const progressAt = (fi: number) => {
    let best = 0;
    for (const r of frames[fi].runners) best = Math.max(best, r.s);
    return goal > 0 ? best / goal : 0;
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
  push(START_AT, START_TEXT);

  // ── 序盤の先頭 ──
  {
    const fi = frameAtProgress(0.18);
    const l = leaderAt(fi);
    if (entrants[l]) push(frames[fi].t, `${who(entrants[l])}が先手を取った！`);
  }

  // ── つまずき（いちばん最初の1件だけ）──
  outer: for (let i = 0; i < frames.length; i++) {
    for (let k = 0; k < frames[i].runners.length; k++) {
      if (frames[i].runners[k].state !== 'stumble') continue;
      if (!entrants[k]) continue;
      push(frames[i].t, `${who(entrants[k])}がつまずいた！`);
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
    if (bestGain.d >= 2) push(frames[bestGain.fi].t, `あなたのウマが上がってきた！${rankAt(bestGain.fi)}番手！`);
    if (bestLoss.d >= 2) push(frames[bestLoss.fi].t, 'あなたのウマ、少し置かれた…');
  }

  // ── 勝負どころ ──
  {
    const fi = frameAtProgress(0.72);
    const l = leaderAt(fi);
    if (entrants[l]) push(frames[fi].t, `勝負どころ！先頭は${who(entrants[l])}`);
  }

  // ── 直線 ──
  {
    const fi = frameAtProgress(0.88);
    const l = leaderAt(fi);
    if (entrants[l]) push(frames[fi].t, `直線！${who(entrants[l])}が抜け出すか`);
  }

  // ── ゴール前の接戦（1着と2着のタイム差が僅かなときだけ）──
  {
    const times = res.finishTimes.filter((t) => Number.isFinite(t)).sort((a, b) => a - b);
    if (times.length >= 2 && times[1] - times[0] <= 0.25) {
      push(Math.max(0, times[0] - 1.4), 'ゴール前、横一線！');
    }
  }

  // 時間順にならべ、近すぎるものは落とす（同時に2本出さない）。
  out.sort((a, b) => a.at - b.at);
  const kept: Telop[] = [];
  for (const t of out) {
    if (t.at > res.duration - 0.3) continue;
    // スタート直後の出来事はゲートの合図に含める（合図より前に何かを出さない）。
    if (t.at < START_AT && t.text !== START_TEXT) continue;
    if (kept.length > 0 && t.at - kept[kept.length - 1].at < MIN_GAP) continue;
    kept.push(t);
  }
  return kept;
}

/** その時刻に出ているテロップ（無ければ null）。 */
export function telopAt(list: Telop[], t: number): Telop | null {
  for (let i = list.length - 1; i >= 0; i--) {
    if (t >= list[i].at && t < list[i].at + TELOP_HOLD) return list[i];
  }
  return null;
}
