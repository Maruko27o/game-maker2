import type { EquipFrame, SaveData } from '../types';
import { parseEquipFrame, sameFrame } from '../types';
import { BADGES } from '../data/badges';
import { titleById, titleCtx } from '../data/titles';

// ギャラリー（飾り棚）。
//
// 集めたフレーム・称号・トロフィー・バッジの中から**自分で選んだものだけ**を並べて、
// 他の人に見てもらう場所。
//
// 「持っているもの全部」ではなく選んで飾る形にした理由：
//  ・見る側は、その人が何を自慢したいのかが一目で分かる（全部並ぶと要点がぼける）
//  ・ランキングに送るデータが小さく収まる（全部だと数十件ぶんのJSONになる）
//
// **ここに入るのは「見た目」だけ**。強さにも確率にも一切かかわらない。

/** 飾れる数。多すぎると個人ページが縦に伸びて、肝心の記録が見えなくなる。 */
export const GALLERY_MAX = 8;

/** 飾り棚の1枠。キーを短くしてあるのは、ランキングに送るJSONを小さく保つため。 */
export type GalleryItem =
  | { k: 'frame'; frame: EquipFrame }
  | { k: 'title'; id: string }
  | { k: 'trophy'; rank: 1 | 2 | 3 }
  | { k: 'badge'; id: string };

/** 同じ枠か（重複して飾らせないための判定）。 */
export function sameItem(a: GalleryItem, b: GalleryItem): boolean {
  if (a.k !== b.k) return false;
  if (a.k === 'frame' && b.k === 'frame') return sameFrame(a.frame, b.frame);
  if (a.k === 'title' && b.k === 'title') return a.id === b.id;
  if (a.k === 'trophy' && b.k === 'trophy') return a.rank === b.rank;
  if (a.k === 'badge' && b.k === 'badge') return a.id === b.id;
  return false;
}

/**
 * 外から来た値をギャラリーとして受け取ってよいか調べる。
 *
 * セーブ（localStorage）とランキング（Supabase の jsonb）は、どちらも中身が
 * 保証されない外部データなので、必ずここを通してから使う。
 * 知らない形は**黙って落とす**（1件おかしいだけで棚ごと消さない）。
 */
export function parseGallery(v: unknown): GalleryItem[] {
  if (!Array.isArray(v)) return [];
  const out: GalleryItem[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    let item: GalleryItem | null = null;
    if (o.k === 'frame') {
      const f = parseEquipFrame(o.frame);
      if (f) item = { k: 'frame', frame: f };
    } else if (o.k === 'title') {
      if (typeof o.id === 'string' && titleById[o.id]) item = { k: 'title', id: o.id };
    } else if (o.k === 'trophy') {
      if (o.rank === 1 || o.rank === 2 || o.rank === 3) item = { k: 'trophy', rank: o.rank };
    } else if (o.k === 'badge') {
      if (typeof o.id === 'string' && (BADGES as Record<string, unknown>)[o.id]) item = { k: 'badge', id: o.id };
    }
    if (!item) continue;
    if (out.some((x) => sameItem(x, item!))) continue; // 同じものは1つだけ
    out.push(item);
    if (out.length >= GALLERY_MAX) break;
  }
  return out;
}

/** 飾る枠を1つ入れ替える（入っていれば外す、入っていなければ足す）。 */
export function toggleItem(cur: GalleryItem[], item: GalleryItem): GalleryItem[] {
  const i = cur.findIndex((x) => sameItem(x, item));
  if (i >= 0) return cur.filter((_, k) => k !== i);
  if (cur.length >= GALLERY_MAX) return cur; // 満杯のときは何もしない（勝手に押し出さない）
  return [...cur, item];
}

/**
 * その人が本当に持っているものだけに絞る。
 *
 * 飾る枠はセーブにもクラウドにも入るので、あとから引退・仕様変更で失われた
 * ものが残ることがある。**表示のたびにここを通して**、持っていないものは出さない。
 */
export function ownedOnly(items: GalleryItem[], owned: OwnedSet): GalleryItem[] {
  return items.filter((it) => {
    if (it.k === 'frame') return owned.frames.some((f) => sameFrame(f, it.frame));
    if (it.k === 'title') return owned.titles.includes(it.id);
    if (it.k === 'trophy') return owned.trophies.includes(it.rank);
    return owned.badges.includes(it.id);
  });
}

export type OwnedSet = {
  frames: EquipFrame[];
  titles: string[];
  trophies: (1 | 2 | 3)[];
  badges: string[];
};

/** セーブから「飾れるもの」を集める。 */
export function ownedFor(save: SaveData, frames: EquipFrame[], collectPct: number): OwnedSet {
  const ctx = titleCtx(save, collectPct);
  const trophies = [...new Set((save.trophies ?? []).map((t) => t.rank))].sort() as (1 | 2 | 3)[];
  const badges = [...new Set((save.badges ?? []).map((b) => b.id))];
  return {
    frames,
    titles: Object.values(titleById).filter((t) => t.check(ctx)).map((t) => t.id),
    trophies,
    badges,
  };
}
