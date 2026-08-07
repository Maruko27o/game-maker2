import type { AptGrade, BoxFrameKind, EquipFrame } from '../types';
import { APT_GRADES, STREAK_MAX } from '../types';
import { BOX_KINDS } from '../data/boxes';
import { ownedLevels } from './streak';

// 集められるフレームの全一覧。
//
// 「持っているものだけ」を並べると、何を目指せばいいのか分からない。未取得も
// 並べて、獲得条件を添える。ここが唯一の目録なので、フレームを増やすときは
// この関数に足せばアイコン設定にもコレクション画面にも同時に出る。
//
// 殿堂（ランキング）フレームは入れない。毎月増えていって際限がなく、集めきる
// 対象でもないため（受信箱から直接装備する）。

export type FrameSlot = {
  key: string;
  frame: EquipFrame;
  owned: boolean;
  /** 獲得条件のひとこと。 */
  hint: string;
};

export type FrameCatalogInput = {
  boxFrames: BoxFrameKind[];
  streakClaimed: number;
  aptFrames: AptGrade[];
};

const BOX_HINT: Record<BoxFrameKind, string> = {
  lucky: 'ラッキーボックスから 1/10000',
  gold: 'ゴールドボックスから 1/10000',
};

export function frameCatalog(s: FrameCatalogInput): FrameSlot[] {
  const rows: FrameSlot[] = [];

  // いちばん出ないものを先頭に。
  for (const b of BOX_KINDS) {
    rows.push({ key: `box-${b}`, frame: { kind: 'box', box: b }, owned: s.boxFrames.includes(b), hint: BOX_HINT[b] });
  }
  // 連勝フレーム（高い連勝ほど手前）。
  const claimed = new Set(ownedLevels({ soloStreak: 0, streakBest: 0, streakClaimed: s.streakClaimed }));
  for (let lv = STREAK_MAX; lv >= 1; lv--) {
    rows.push({ key: `streak-${lv}`, frame: { kind: 'streak', level: lv }, owned: claimed.has(lv), hint: `馬券レースで${lv}連勝` });
  }
  // 適性フレーム（S がいちばん豪華なので降順）。
  for (const g of [...APT_GRADES].reverse()) {
    rows.push({ key: `apt-${g}`, frame: { kind: 'apt', grade: g }, owned: s.aptFrames.includes(g), hint: `6コースの適性がすべて${g}のウマ` });
  }
  return rows;
}

/** 集まり具合（持っている数 / 全体）。 */
export function frameProgress(rows: FrameSlot[]): { have: number; total: number } {
  return { have: rows.filter((r) => r.owned).length, total: rows.length };
}
