import { describe, it, expect } from 'vitest';
import { frameCatalog, frameProgress, rankingFrames } from './frameCatalog';
import { STREAK_MAX } from '../types';
import type { MailItem } from '../types';
import { ANIMALS } from '../data/shop';

const EMPTY = { boxFrames: [] as never[], streakClaimed: 0, aptFrames: [] as never[] };

describe('フレームの目録', () => {
  it('集められるフレームを全部ならべる（ボックス2＋連勝10＋適性4＋ショップ11）', () => {
    const rows = frameCatalog(EMPTY);
    // ショップは 動物10種 ＋ コンプリート1枠。コンプリートは動物を選び直せるが、
    // 目録では常に1枠（10枠に増やさない）。
    expect(rows).toHaveLength(2 + STREAK_MAX + 4 + ANIMALS.length + 1);
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
    // ショップを1つも引いていなければ、ショップの枠は全部未取得。
    expect(rows.filter((r) => r.key.startsWith('shop-')).every((r) => !r.owned)).toBe(true);
  });

  it('ショップの動物フレームは、当てたものだけ owned になる', () => {
    const rows = frameCatalog({ ...EMPTY, shopFrames: ['cat', 'frog'] });
    const shopOwned = rows.filter((r) => r.owned).map((r) => r.key).sort();
    expect(shopOwned).toEqual(['shop-cat', 'shop-frog']);
    // 10種そろっていないので、コンプリート枠はまだ未取得。
    expect(rows.find((r) => r.key === 'shop-master')!.owned).toBe(false);
  });

  it('10種そろうとコンプリート枠が owned になり、選んだ動物で描かれる', () => {
    const rows = frameCatalog({ ...EMPTY, shopFrames: [...ANIMALS], shopFramePick: 'penguin' });
    const master = rows.find((r) => r.key === 'shop-master')!;
    expect(master.owned).toBe(true);
    expect(master.frame).toEqual({ kind: 'animalMaster', animal: 'penguin' });
    // 動物を選び直しても、枠の数は増えない。
    expect(rows.filter((r) => r.key.startsWith('shop-'))).toHaveLength(ANIMALS.length + 1);
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
      { id: 'd', at: 0, read: true, kind: 'notice', title: 'お知らせ' },
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
