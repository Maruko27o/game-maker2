// チーム編成の純粋ロジック（個体値厳選アップデート）。
// チーム＝出走と牧場収入の対象になる最大 TEAM_SIZE 頭。ボックス（最大30頭）から選ぶ。
//
// 新世代(gen2)のウマは、固有スキル・コース適性がシム（raceSim2）と倍率の両方に
// 接続され調整も済んだので、既存ウマと同じ条件でチームに入れられる。
// 入れられない理由は「チームが満員」だけ。
import type { Horse } from '../types';

/** チームに入れる資格があるか。理由つきで返す（UIの説明文にそのまま使う）。 */
export type JoinCheck = { ok: true } | { ok: false; reason: 'full' };

// `horses` は今は使わないが、将来また条件を足せるようシグネチャは維持する。
export function canJoinTeam(horse: Horse, team: string[], _horses: Horse[], size: number): JoinCheck {
  if (team.includes(horse.id)) return { ok: true }; // すでに入っている
  if (team.length >= size) return { ok: false, reason: 'full' };
  return { ok: true };
}

/** チームに追加（末尾）。入れられないときは元の配列をそのまま返す。 */
export function addToTeam(horse: Horse, team: string[], horses: Horse[], size: number): string[] {
  if (team.includes(horse.id)) return team;
  if (!canJoinTeam(horse, team, horses, size).ok) return team;
  return [...team, horse.id];
}

/** チームから外す（ボックスに戻す）。 */
export function removeFromTeam(id: string, team: string[]): string[] {
  return team.filter((x) => x !== id);
}

/** チーム内で並び順を1つ動かす（-1=前へ / +1=後ろへ）。端なら何もしない。 */
export function moveInTeam(id: string, team: string[], dir: -1 | 1): string[] {
  const at = team.indexOf(id);
  const to = at + dir;
  if (at < 0 || to < 0 || to >= team.length) return team;
  const next = [...team];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

/** 保存値の正規化：実在するウマのIDだけ・重複なし・最大 size 頭。 */
export function normalizeTeam(team: string[] | undefined, horses: Horse[], size: number): string[] {
  const ids = new Set(horses.map((h) => h.id));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of team ?? []) {
    if (!ids.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= size) break;
  }
  return out;
}
