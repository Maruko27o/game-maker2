import { describe, it, expect } from 'vitest';
import {
  rewardForDow, rewardLabel, loginDayKey, dowOf, canClaim, rollDye,
  WEEK_ORDER, DOW_LABEL, LOGIN_COINS,
} from './loginBonus';
import { colorById, colorSlotById } from '../data/parts';
import { mulberry32 } from './stats';

// 曜日は 0=日 … 6=土
const SUN = 0, MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6;

describe('曜日ごとのごほうび', () => {
  it('月・火・木・金はコイン', () => {
    for (const d of [MON, TUE, THU, FRI]) {
      expect(rewardForDow(d)).toEqual({ kind: 'coins', amount: LOGIN_COINS });
    }
  });

  it('水は厳選チケット', () => {
    expect(rewardForDow(WED)).toEqual({ kind: 'ticket', amount: 1 });
  });

  it('土・日は染料', () => {
    expect(rewardForDow(SAT).kind).toBe('dye');
    expect(rewardForDow(SUN).kind).toBe('dye');
  });

  it('7日ぶんが過不足なく並ぶ（月はじまり）', () => {
    expect(WEEK_ORDER).toHaveLength(7);
    expect(new Set(WEEK_ORDER).size).toBe(7);
    expect(WEEK_ORDER.map((d) => DOW_LABEL[d]).join('')).toBe('月火水木金土日');
  });

  it('ラベルが出る', () => {
    expect(rewardLabel(rewardForDow(MON))).toContain('コイン');
    expect(rewardLabel(rewardForDow(WED))).toContain('チケット');
    expect(rewardLabel(rewardForDow(SAT))).toContain('染料');
  });
});

describe('1日1回の判定', () => {
  const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();

  it('同じ日は2回目を受け取れない', () => {
    const t = day(2026, 8, 3);
    const key = loginDayKey(t);
    expect(canClaim(undefined, t)).toBe(true); // 初回
    expect(canClaim(key, t)).toBe(false); // 受け取り済み
    expect(canClaim(key, t + 6 * 3600 * 1000)).toBe(false); // 同じ日の夜も不可
  });

  it('日が変われば受け取れる', () => {
    const t1 = day(2026, 8, 3, 23);
    const t2 = day(2026, 8, 4, 0);
    expect(canClaim(loginDayKey(t1), t2)).toBe(true);
  });

  it('時計を戻して前日に飛んでも、その日のキーが違えば別日として扱う', () => {
    // ※ 実際の巻き戻しは trustedClock の単調フロアで起きない。ここは
    //    「判定は日付キーの一致だけを見る」ことの確認。
    const today = day(2026, 8, 3);
    const yesterday = day(2026, 8, 2);
    expect(canClaim(loginDayKey(today), yesterday)).toBe(true);
    expect(loginDayKey(today)).not.toBe(loginDayKey(yesterday));
  });

  it('曜日は日付から引ける', () => {
    expect(dowOf(day(2026, 8, 3))).toBe(MON); // 2026-08-03 は月曜
    expect(dowOf(day(2026, 8, 5))).toBe(WED);
    expect(dowOf(day(2026, 8, 8))).toBe(SAT);
  });
});

describe('染料の抽選', () => {
  it('必ず実在する色パーツが出て、塗れる場所が決まっている', () => {
    for (let seed = 0; seed < 300; seed++) {
      const id = rollDye(mulberry32(seed));
      expect(colorById[id]).toBeTruthy();
      expect(['body', 'mane', 'hoof']).toContain(colorSlotById[id]);
    }
  });

  it('からだ・たてがみ・ひづめ どの色も出る', () => {
    const slots = new Set<string>();
    for (let seed = 0; seed < 300; seed++) slots.add(colorSlotById[rollDye(mulberry32(seed))]);
    expect(slots).toEqual(new Set(['body', 'mane', 'hoof']));
  });
});
