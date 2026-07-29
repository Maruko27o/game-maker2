// チーム編成の純粋ロジック（個体値厳選アップデート）。
// チーム＝出走と牧場収入の対象になる最大 TEAM_SIZE 頭。ボックス（最大30頭）から選ぶ。
//
// 調整期間中のルール：
//   新世代(gen2)のウマ＝個体値・スキル・適性を持つ、アップデート後に生まれたウマは
//   まだシムに接続していないため、原則チーム（＝レース）に入れない。
//   ただし「既存ウマが6頭に満たない分だけ」は新世代で埋められる。そうしないと
//   ウマを1頭も持っていない新規プレイヤーが永久にレースへ出られなくなるため。
//   → 既存ウマを6頭持っているアカウントでは、新世代は一切チームに入らない（仕様どおり）。
import type { Horse } from '../types';

/** チームに入れる資格があるか。理由つきで返す（UIの説明文にそのまま使う）。 */
export type JoinCheck = { ok: true } | { ok: false; reason: 'full' | 'gen2' };

export function canJoinTeam(horse: Horse, team: string[], horses: Horse[], size: number): JoinCheck {
  if (team.includes(horse.id)) return { ok: true }; // すでに入っている
  if (team.length >= size) return { ok: false, reason: 'full' };
  if (!horse.gen2) return { ok: true }; // 既存ウマはいつでも入れる
  // 新世代：チーム外に既存ウマが残っているなら、そちらを優先（新世代はまだ入れない）。
  const legacyOutside = horses.some((h) => !h.gen2 && !team.includes(h.id));
  return legacyOutside ? { ok: false, reason: 'gen2' } : { ok: true };
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
