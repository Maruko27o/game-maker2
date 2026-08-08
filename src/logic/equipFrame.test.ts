import { describe, it, expect } from 'vitest';
import { parseEquipFrame, sameFrame, STREAK_MAX, APT_GRADES } from '../types';
import type { EquipFrame } from '../types';
import { ANIMALS } from '../data/shop';

// フレームの検証は1か所（types.ts の parseEquipFrame）に集約している。
//
// もともとセーブ用（store.ts）とランキング用（cloud.ts）に同じ判定が2つあり、
// ボックス限定フレームと適性フレームを足したときにランキング側を直し忘れた。
// その結果、それらを着けている人はランキングでフレームが出ていなかった。
// ここでは「装備できる全種類が、通したあとも同じものとして戻ってくる」ことを
// 見張る。新しい種類を足すとこのテストが落ちるので、直し忘れに気づける。

describe('装備フレームの検証（セーブとランキングで共通）', () => {
  const all: EquipFrame[] = [
    { period: '2026-06', rank: 1, metric: 'odds' },
    { period: '2026-06', rank: 2, metric: 'odds' },
    { period: '2026-12', rank: 3, metric: 'payout' },
    ...Array.from({ length: STREAK_MAX }, (_, i) => ({ kind: 'streak', level: i + 1 }) as EquipFrame),
    ...APT_GRADES.map((grade) => ({ kind: 'apt', grade }) as EquipFrame),
    { kind: 'box', box: 'lucky' },
    { kind: 'box', box: 'gold' },
    ...ANIMALS.map((animal) => ({ kind: 'animal', animal }) as EquipFrame),
    ...ANIMALS.map((animal) => ({ kind: 'animalMaster', animal }) as EquipFrame),
  ];

  it('装備できる全種類がそのまま通る（往復して同じもの）', () => {
    for (const f of all) {
      // JSON を経由するのは、実際に localStorage と Supabase の jsonb を通るため
      expect(parseEquipFrame(JSON.parse(JSON.stringify(f)))).toEqual(f);
    }
  });

  it('ボックス限定と適性は必ず残る（ランキングで消えていた2種類）', () => {
    expect(parseEquipFrame({ kind: 'box', box: 'lucky' })).toEqual({ kind: 'box', box: 'lucky' });
    expect(parseEquipFrame({ kind: 'box', box: 'gold' })).toEqual({ kind: 'box', box: 'gold' });
    for (const grade of APT_GRADES) {
      expect(parseEquipFrame({ kind: 'apt', grade })).toEqual({ kind: 'apt', grade });
    }
  });

  it('おかしな値は受け取らない（外から来たデータをそのまま信じない）', () => {
    const bad: unknown[] = [
      null, undefined, 0, '', 'streak', [], {},
      { kind: 'box' }, { kind: 'box', box: 'silver' },
      { kind: 'apt' }, { kind: 'apt', grade: 'Z' }, { kind: 'apt', grade: 's' },
      { kind: 'streak' }, { kind: 'streak', level: 0 }, { kind: 'streak', level: STREAK_MAX + 1 },
      { kind: 'streak', level: 'あ' },
      { period: '2026-06' }, { period: '2026-06', rank: 4, metric: 'odds' },
      { period: '2026-06', rank: 1, metric: 'coins' }, { rank: 1, metric: 'odds' },
      { kind: 'unknown-future-frame' },
      // ショップのフレーム：動物IDが知らない値ならはじく。
      { kind: 'animal' }, { kind: 'animal', animal: 'dragon' }, { kind: 'animal', animal: 1 },
      { kind: 'animalMaster' }, { kind: 'animalMaster', animal: 'CAT' },
    ];
    for (const v of bad) expect(parseEquipFrame(v)).toBeNull();
  });

  // sameFrame も parseEquipFrame と同じ場所に置いてある。種類を増やしたときに
  // 「装備中」の印だけ付かなくなる事故を防ぐため、全種類で見張る。
  it('同一判定は全種類で成り立つ（自分自身とだけ一致する）', () => {
    for (let i = 0; i < all.length; i++) {
      expect(sameFrame(all[i], all[i])).toBe(true);
      for (let j = 0; j < all.length; j++) {
        if (i !== j) expect(sameFrame(all[i], all[j])).toBe(false);
      }
    }
    expect(sameFrame(null, null)).toBe(true);
    expect(sameFrame(null, all[0])).toBe(false);
    expect(sameFrame(undefined, null)).toBe(true);
  });

  it('動物フレームとコンプリートフレームは、動物が同じでも別物として扱う', () => {
    const a = ANIMALS[0];
    expect(sameFrame({ kind: 'animal', animal: a }, { kind: 'animalMaster', animal: a })).toBe(false);
  });

  it('連勝レベルは整数に丸める（DBに小数が入っていても壊れない）', () => {
    expect(parseEquipFrame({ kind: 'streak', level: 3.4 })).toEqual({ kind: 'streak', level: 3 });
    expect(parseEquipFrame({ kind: 'streak', level: '5' })).toEqual({ kind: 'streak', level: 5 });
  });
});
