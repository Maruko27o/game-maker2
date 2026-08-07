import { describe, it, expect } from 'vitest';
import { frameCatalog, frameProgress, rankingFrames } from './frameCatalog';
import { STREAK_MAX } from '../types';
import type { MailItem } from '../types';

const EMPTY = { boxFrames: [] as never[], streakClaimed: 0, aptFrames: [] as never[] };

describe('フレームの目録', () => {
  it('集められるフレームを全部ならべる（ボックス2＋連勝10＋適性4）', () => {
    const rows = frameCatalog(EMPTY);
    expect(rows).toHaveLength(2 + STREAK_MAX + 4);
    // キーは重複しない（一覧の key に使うため）
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
    // 何も持っていなければ全部未取得、獲得条件は必ず入っている
    expect(rows.every((r) => !r.owned)).toBe(true);
    expect(rows.every((r) => r.hint.length > 0)).toBe(true);
  });

  it('持っているものだけ owned になる', () => {
    const rows = frameCatalog({ boxFrames: ['gold'], streakClaimed: 3, aptFrames: ['C'] });
    const owned = rows.filter((r) => r.owned).map((r) => r.key).sort();
    expect(owned).toEqual(['apt-C', 'box-gold', 'streak-1', 'streak-2', 'streak-3']);
    expect(frameProgress(rows)).toEqual({ have: 5, total: rows.length });
  });

  it('殿堂フレームは目録に混ぜない（毎月増えて際限がないため）', () => {
    expect(frameCatalog(EMPTY).some((r) => r.key.startsWith('rank'))).toBe(false);
  });

  it('殿堂フレームは受信箱から、持っているぶんだけ取り出す', () => {
    const mail: MailItem[] = [
      { id: 'a', at: 3, read: true, kind: 'frame', frame: { period: '2026-07', rank: 1, metric: 'payout' } },
      { id: 'b', at: 2, read: true, kind: 'frame', frame: { period: '2026-06', rank: 2, metric: 'odds' } },
      // 同じ月・同じ種別が2通あっても1つにまとめる
      { id: 'c', at: 1, read: true, kind: 'frame', frame: { period: '2026-07', rank: 1, metric: 'payout' } },
      { id: 'd', at: 0, read: true, kind: 'notice', title: 'おしらせ' },
    ];
    const got = rankingFrames(mail);
    expect(got).toHaveLength(2);
    expect(got[0].period).toBe('2026-07'); // 受信箱の順（新しい月が先）のまま
    expect(got[1].period).toBe('2026-06');
  });

  it('殿堂フレームが1つも無ければ空（未取得の枠は作らない）', () => {
    expect(rankingFrames([])).toEqual([]);
    expect(rankingFrames([{ id: 'n', at: 0, read: true, kind: 'notice' }])).toEqual([]);
  });
});
