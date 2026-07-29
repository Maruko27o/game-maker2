import { describe, it, expect } from 'vitest';
import { canJoinTeam, addToTeam, removeFromTeam, moveInTeam, normalizeTeam } from './team';
import type { Horse } from '../types';

const SIZE = 6;
const H = (id: string, gen2 = false): Horse => ({
  id, name: id, colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {},
  stats: { spd: 10, sta: 6, pwr: 6, jmp: 6, gut: 6, wit: 6 }, createdAt: 0,
  ...(gen2 ? { gen2: true } : {}),
});

describe('canJoinTeam（調整期間中の新世代ルール）', () => {
  it('既存ウマは空きがあれば入れる', () => {
    const horses = [H('a'), H('b')];
    expect(canJoinTeam(H('b'), ['a'], horses, SIZE)).toEqual({ ok: true });
  });

  it('チームが満員なら誰も入れない', () => {
    const horses = Array.from({ length: 7 }, (_, i) => H(`h${i}`));
    const team = horses.slice(0, SIZE).map((h) => h.id);
    expect(canJoinTeam(horses[6], team, horses, SIZE)).toEqual({ ok: false, reason: 'full' });
  });

  it('既存ウマがチーム外に残っている間は、新世代は入れない', () => {
    const legacy = [H('a'), H('b')];
    const fresh = H('n1', true);
    const horses = [...legacy, fresh];
    // 'b' がチーム外に残っている → 新世代 n1 は入れない
    expect(canJoinTeam(fresh, ['a'], horses, SIZE)).toEqual({ ok: false, reason: 'gen2' });
  });

  it('既存ウマを6頭持つアカウントでは新世代は一切入れない（仕様どおり）', () => {
    const legacy = Array.from({ length: 6 }, (_, i) => H(`L${i}`));
    const fresh = H('n1', true);
    const horses = [...legacy, fresh];
    const team = legacy.map((h) => h.id);
    expect(canJoinTeam(fresh, team, horses, SIZE).ok).toBe(false);
  });

  it('既存ウマが全員チームに入っていて空きがあるなら、新世代で埋められる', () => {
    const legacy = [H('a'), H('b')];
    const fresh = H('n1', true);
    const horses = [...legacy, fresh];
    expect(canJoinTeam(fresh, ['a', 'b'], horses, SIZE)).toEqual({ ok: true });
  });

  it('ウマを1頭も持たない新規プレイヤーは、作ったウマ（新世代）でチームを組める', () => {
    const fresh = H('n1', true);
    expect(canJoinTeam(fresh, [], [fresh], SIZE)).toEqual({ ok: true });
  });

  it('すでにチームに入っているウマは常に ok', () => {
    const fresh = H('n1', true);
    const horses = [H('a'), fresh];
    expect(canJoinTeam(fresh, ['n1'], horses, SIZE)).toEqual({ ok: true });
  });
});

describe('addToTeam / removeFromTeam / moveInTeam', () => {
  it('入れられるときだけ末尾に追加する', () => {
    const horses = [H('a'), H('b')];
    expect(addToTeam(H('b'), ['a'], horses, SIZE)).toEqual(['a', 'b']);
    // 重複は増えない
    expect(addToTeam(H('a'), ['a'], horses, SIZE)).toEqual(['a']);
  });

  it('入れられないときは元の配列をそのまま返す（参照も同じ）', () => {
    const legacy = [H('a'), H('b')];
    const fresh = H('n1', true);
    const team = ['a'];
    expect(addToTeam(fresh, team, [...legacy, fresh], SIZE)).toBe(team);
  });

  it('外すとチームから消える', () => {
    expect(removeFromTeam('b', ['a', 'b', 'c'])).toEqual(['a', 'c']);
    expect(removeFromTeam('zzz', ['a'])).toEqual(['a']);
  });

  it('並び順を1つ前/後ろに動かす。端では何もしない', () => {
    expect(moveInTeam('c', ['a', 'b', 'c'], -1)).toEqual(['a', 'c', 'b']);
    expect(moveInTeam('a', ['a', 'b', 'c'], 1)).toEqual(['b', 'a', 'c']);
    const team = ['a', 'b'];
    expect(moveInTeam('a', team, -1)).toBe(team); // 先頭をさらに前へ → 変化なし
    expect(moveInTeam('b', team, 1)).toBe(team); // 末尾をさらに後ろへ → 変化なし
  });
});

describe('normalizeTeam', () => {
  const horses = [H('a'), H('b'), H('c')];

  it('実在しないID・重複を落とし、最大 size 頭にする', () => {
    expect(normalizeTeam(['a', 'ghost', 'a', 'b'], horses, SIZE)).toEqual(['a', 'b']);
    expect(normalizeTeam(['a', 'b', 'c'], horses, 2)).toEqual(['a', 'b']);
  });

  it('未定義は空配列', () => {
    expect(normalizeTeam(undefined, horses, SIZE)).toEqual([]);
  });
});
