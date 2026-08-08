import { describe, it, expect } from 'vitest';
import { toSaveData } from '../store';
import type { SaveData } from '../types';

// セーブの「保存する形」を作る場所が2つあったせいで起きた事故の再発防止。
//
// store.ts と CloudSync.tsx に、同じ項目を並べた表が別々にあった。ショップを足した
// とき store 側だけ直してクラウド側を直し忘れ、**端末には保存されるのにクラウドには
// 送られない**状態になった。次の同期で古い中身に上書きされ、買ったフレーム・称号と
// カスタムベットが消えた（コインは両方の表にあったので減ったまま残り、
// 「買ったのに無くなった」形になった）。
//
// いまは toSaveData ひとつに集約してある。このテストは
// **「セーブに入れたものが、必ずそのまま出てくる」**ことだけを見張る。
// 新しい項目を足して toSaveData に書き忘れると、ここが落ちる。

/** すべての項目に「見分けのつく値」を入れたセーブ。 */
function filled(): SaveData {
  return {
    version: 6,
    earnedNoticeDue: true,
    owned: { p_a: 3 },
    horses: [
      {
        id: 'h1',
        name: 'テスト',
        colors: { body: 'c1', mane: 'm1', hoof: 'f1' },
        decos: { head: 'd1' },
        stats: { spd: 7, sta: 7, pwr: 7, jmp: 6, gut: 6, wit: 7 },
        createdAt: 111,
      },
    ],
    energy: 2,
    energyUpdatedAt: 222,
    trophies: [{ id: 't1', horseId: 'h1', rank: 1, courseId: 'green', mode: 60, grade: 'gp', at: 333 }],
    badges: [{ id: 'badge_1st', horseId: 'h1', at: 444 }],
    winStreaks: { h1: 4 },
    soloStreak: 5,
    streakBest: 6,
    streakClaimed: 3,
    streakRuleResetDone: true,
    items: [{ kind: 'stat', stat: 'spd' }],
    raceRecords: [{ courseId: 'green', mode: 60, bestRank: 1, bestTime: 62.5 }],
    gpUnlocked: { g2: true, g1: true },
    freeRebalance: true,
    freeRename: false,
    coins: 123_456,
    refineTickets: 7,
    dyes: { c_red: 2 },
    login: { day: '2026-08-08', at: 555 },
    bets: [{ courseId: 'green', kind: 'win', picks: [1], amount: 100, odds: 3.2, won: true, payout: 320, at: 666 }],
    maxHorses: 30,
    team: ['h1'],
    daily: { day: '2026-08-08', grassBonus: 1, okawari: 2, gp: 1 },
    tasks: { racesFinished: 9, raceBanked: 1, grassSpawns: 8, grassBanked: 1, bank: 500 },
    stats: { betsPlaced: 11, maxPayout: 999, maxRecoveryPct: 250, maxOdds: 88, totalEarned: 7777, horsesFound: 12, arenaWins: 3 },
    avatarHorseId: 'h1',
    displayTrophies: [1, 2],
    mailbox: [{ id: 'm1', at: 777, read: false, kind: 'notice', title: 'お知らせ' }],
    equippedFrame: { kind: 'animalMaster', animal: 'penguin' },
    aptFrames: ['S'],
    aptPending: ['A'],
    boxFrames: ['gold'],
    boxTitles: ['lucky'],
    shopFrames: ['cat', 'frog'],
    shopTitles: ['bear'],
    shopFramePick: 'penguin',
    shopTitlePick: 'frog',
    gallery: [{ k: 'title', id: 'rookie' }, { k: 'trophy', rank: 1 }],
    seenTitles: ['rookie'],
    equippedTitle: 'shop_master_frog',
    customBets: [{ amount: 500, minOdds: 3, maxOdds: 10 }, null],
    raceSession: null,
    // arena は null で渡すと空の形に整えられる（保存の形として null を残さない）。
    // ここで見たいのは「項目が落ちないこと」なので、実体を入れて比べる。
    arena: { auto: null, pending: null, lastPeriod: null, results: [] },
    farmClaimedAt: 888,
    savedAt: 999,
  };
}

describe('セーブの作り方は1か所（toSaveData）', () => {
  it('入れた項目がひとつ残らずそのまま出てくる', () => {
    const src = filled();
    const out = toSaveData(src, src.savedAt);
    for (const key of Object.keys(src) as (keyof SaveData)[]) {
      expect(out[key], `「${key}」が保存の形から抜け落ちています（toSaveData に足してください）`).toEqual(src[key]);
    }
  });

  it('項目の数も同じ（余分に増えても減ってもいない）', () => {
    const src = filled();
    const out = toSaveData(src, src.savedAt);
    expect(new Set(Object.keys(out))).toEqual(new Set(Object.keys(src)));
  });

  it('ショップの品とカスタムベットは必ず残る（実際に消えた項目）', () => {
    const src = filled();
    const out = toSaveData(src, src.savedAt);
    expect(out.shopFrames).toEqual(['cat', 'frog']);
    expect(out.shopTitles).toEqual(['bear']);
    expect(out.shopFramePick).toBe('penguin');
    expect(out.shopTitlePick).toBe('frog');
    expect(out.customBets).toEqual([{ amount: 500, minOdds: 3, maxOdds: 10 }, null]);
    expect(out.gallery).toEqual([{ k: 'title', id: 'rookie' }, { k: 'trophy', rank: 1 }]);
  });

  it('JSON を往復しても変わらない（localStorage と Supabase の両方を通るため）', () => {
    const src = filled();
    const out = toSaveData(src, src.savedAt);
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });

  it('savedAt は渡した値になる', () => {
    const src = filled();
    expect(toSaveData(src, 4242).savedAt).toBe(4242);
  });
});
