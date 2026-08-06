import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { titleCtx, activeTitle, titleById } from './data/titles';

// バグ調査：称号をつけてレースを走ると外れて、つけ直せなくなる。
// 称号は「装備した ID」と「その条件を満たしているか」の2つで決まるので、
// レースまわりの処理がどちらかを壊していないかを1手ずつ確かめる。
function ctx() {
  return titleCtx(useStore.getState(), 0);
}

describe('称号：レースを走っても外れない', () => {
  beforeEach(() => {
    useStore.getState().resetAll();
    useStore.setState({
      stats: { betsPlaced: 0, maxPayout: 0, maxRecoveryPct: 0, maxOdds: 0, totalEarned: 0, horsesFound: 600 },
    });
    useStore.getState().equipTitle('plains_lord');
  });

  it('装備できている（前提）', () => {
    expect(useStore.getState().equippedTitle).toBe('plains_lord');
    expect(titleById.plains_lord.check(ctx())).toBe(true);
    expect(activeTitle(useStore.getState().equippedTitle, ctx()).id).toBe('plains_lord');
  });

  // 実際のバグ：recordBetStats が stats を作り直していたので、レースで馬券を
  // 買うたびに horsesFound が消え、「ウマを◯頭見つける」系の称号が全部外れていた。
  it('馬券の成績を記録しても、あとから足した項目が消えない', () => {
    useStore.getState().recordBetStats({ placed: 1, staked: 100, payout: 500, wonOdds: 5 });
    expect(useStore.getState().stats.horsesFound).toBe(600);
    expect(titleById.plains_lord.check(ctx())).toBe(true);
  });

  it('端末間のマージ（foldStats）でも消えない', () => {
    useStore.getState().foldStats({ betsPlaced: 9, maxPayout: 1, maxRecoveryPct: 1, maxOdds: 1 });
    expect(useStore.getState().stats.horsesFound).toBe(600);
  });

  it('万一 horsesFound が欠けても、草むらの回数から称号が生き残る', () => {
    // 二重の保険。片方だけ壊れても称号が外れないことを保証する。
    useStore.setState({
      stats: { betsPlaced: 0, maxPayout: 0, maxRecoveryPct: 0, maxOdds: 0, totalEarned: 0 },
      tasks: { racesFinished: 0, raceBanked: 0, grassSpawns: 600, grassBanked: 0, bank: 0 },
    });
    expect(ctx().horsesFound).toBe(600);
    expect(titleById.plains_lord.check(ctx())).toBe(true);
    expect(activeTitle('plains_lord', ctx()).id).toBe('plains_lord');
  });

  it('レース終了の各処理を通しても、装備IDも条件も生きている', () => {
    const st = useStore.getState();
    st.finishRaceTask();
    st.recordSoloStreak(true);
    st.recordBetStats({ placed: 1, staked: 100, payout: 500, wonOdds: 5 });
    st.addCoins(500);
    st.addEarned(500);
    st.finishNormalRace({
      horseId: 'H0', courseId: 'green', mode: 30, rank: 1, time: 30, isJumpCourse: false, flawless: true,
    });
    const s = useStore.getState();
    expect(s.equippedTitle).toBe('plains_lord');
    expect(s.stats.horsesFound).toBe(600);
    expect(titleById.plains_lord.check(ctx())).toBe(true);
    expect(activeTitle(s.equippedTitle, ctx()).id).toBe('plains_lord');
  });
});
