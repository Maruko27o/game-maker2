import { useEffect, useRef, useState } from 'react';
import { useStore, dayKey } from '../store';
import { COURSES } from '../data/courses';
import { statTotal, mulberry32 } from '../logic/stats';
import { styleFor } from '../logic/runStyle';
import { simulate2, type Entrant, type SimResult } from '../logic/raceSim2';
import {
  buildGpField,
  computeQualifiers,
  gpItemCount,
  heatLaps,
  finalLaps,
  GP_GRADES,
  type GpGrade,
  type Qualifier,
} from '../logic/grandprix';
import { makeTrophy, rollItems } from '../logic/raceReward';
import { settle, type Bet } from '../logic/betting';
import { submitBestOdds } from '../cloud';
import { ENABLE_RANKING } from '../config';
import Paddock from '../components/Paddock';
import BetResult from '../components/BetResult';
import { GP_DAILY_LIMIT, MAX_BETS_GP, gpFinalCoins } from '../data/coins';
import { buildSubmission, bufferSubmission } from '../logic/raceSubmission';
import type { Horse, HorseLook, Trophy, TrainingItem, GpRaceReward } from '../types';
import { RUN_STYLE_LABEL, STAT_LABEL } from '../types';
import HorseView from '../components/HorseView';
import CoinIcon from '../components/CoinIcon';
import Icon from '../components/Icon';
import RaceTrack2 from '../components/RaceTrack2';
import { usePrefersReducedMotion } from '../hooks';
import styles from './Race.module.css';
import gp from './GrandPrix.module.css';

function rankColor(rank: number, total: number): { bg: string; bd: string; fg: string } {
  if (rank === 1) return { bg: '#f0c33c', bd: '#8a6410', fg: '#2b2118' };
  if (rank === 2) return { bg: '#cfd6dd', bd: '#79838d', fg: '#2b2118' };
  if (rank === 3) return { bg: '#cf8a4e', bd: '#8f5a28', fg: '#fff' };
  const f = total > 4 ? (rank - 4) / (total - 4) : 0;
  const v = Math.round(230 * (1 - f) + 40 * f);
  return { bg: `rgb(${v},${v},${v})`, bd: '#2b2118', fg: v > 140 ? '#2b2118' : '#fff' };
}
function itemLabel(it: TrainingItem): string {
  return it.kind === 'any' ? 'すきなステータス +1' : `${STAT_LABEL[it.stat]} +1`;
}

type GpState = {
  grade: GpGrade;
  course: (typeof COURSES)[number];
  seed: number;
  heats: Entrant[][];
  looks: Record<string, HorseLook>;
  playerHeat: number;
};

// Rebuild the whole grand prix from its seed (改修：レース継続②) so a resumed
// attempt is identical: course, heats, looks — all deterministic.
function buildGpState(grade: GpGrade, seed: number, player: Horse): GpState {
  const rng = mulberry32(seed ^ 0x1234);
  const course = COURSES[Math.floor(rng() * COURSES.length)];
  const playerEntrant: Entrant = { horseId: player.id, name: player.name, isPlayer: true, stats: player.stats, style: styleFor(player.id, player.stats) };
  const field = buildGpField(playerEntrant, player, grade, seed);
  return { grade, course, seed, ...field };
}
function computeHeatResults(st: GpState, mode: 30 | 60): SimResult[] {
  return st.heats.map((heat, h) => simulate2(heat, st.course, mode, st.seed + h * 101, { laps: heatLaps(mode) }));
}
// Wall-clock ms when a race's playback is fully over (mirrors RaceTrack2/Race).
function gpRaceDoneAt(anchorMs: number, durationS: number, reduced: boolean): number {
  const speed = reduced ? 4 : 1;
  const cdMs = (reduced ? 220 : 700) * 3;
  const linger = reduced ? 0.2 : 2.2;
  return anchorMs + cdMs + ((durationS + linger) / speed) * 1000;
}
const toSaved = (b: Bet) => ({ kind: b.kind, sel: b.sel, amount: b.amount, odds: b.odds });

export default function GrandPrix({ player, mode, onExit }: { player: Horse; mode: 30 | 60; onExit: () => void }) {
  const reduced = usePrefersReducedMotion();
  const gpUnlocked = useStore((s) => s.gpUnlocked);
  const addTrophies = useStore((s) => s.addTrophies);
  const grantItems = useStore((s) => s.grantItems);
  const recordRace = useStore((s) => s.recordRace);
  const unlockGp = useStore((s) => s.unlockGp);
  const addCoins = useStore((s) => s.addCoins);
  const spendCoins = useStore((s) => s.spendCoins);
  const coins = useStore((s) => s.coins);
  const startGpAttempt = useStore((s) => s.startGpAttempt);
  const finishRaceTask = useStore((s) => s.finishRaceTask);
  const recordBetStats = useStore((s) => s.recordBetStats);
  const raceSession = useStore((s) => s.raceSession);
  const setRaceSession = useStore((s) => s.setRaceSession);
  const patchRaceSession = useStore((s) => s.patchRaceSession);
  const daily = useStore((s) => s.daily);
  const gpLeft = Math.max(0, GP_DAILY_LIMIT - (daily.day === dayKey() ? daily.gp : 0));

  // Betting (改修：グランプリでも馬券。予選＋本戦の2回・各最大 MAX_BETS_GP 通り・コイン使用)。
  const [heatBets, setHeatBets] = useState<Bet[]>([]);
  const [finalBets, setFinalBets] = useState<Bet[]>([]);

  // Settle a round's bets against its finishing order: pay out and push the best
  // winning odds to the ranking (same as a single race).
  function settleBets(bets: Bet[], order: number[], courseId: string) {
    let payout = 0;
    let best = 0;
    const staked = bets.reduce((s, b) => s + b.amount, 0);
    for (const b of bets) {
      const got = settle(b, order);
      payout += got;
      if (got > 0) best = Math.max(best, b.odds);
    }
    if (payout > 0) addCoins(payout);
    recordBetStats({ placed: bets.length, staked, payout, wonOdds: best }); // profile 実績
    if (ENABLE_RANKING && (best > 0 || payout > 0)) submitBestOdds(best, courseId, payout);
  }

  const [screen, setScreen] = useState<'grade' | 'card' | 'odds' | 'heat' | 'qualify' | 'finalPaddock' | 'final' | 'podium'>('grade');
  const [state, setState] = useState<GpState | null>(null);
  const [heatResults, setHeatResults] = useState<SimResult[] | null>(null);
  const [qualifiers, setQualifiers] = useState<Qualifier[] | null>(null);
  const [finalResult, setFinalResult] = useState<SimResult | null>(null);
  const [reward, setReward] = useState<{ trophy: Trophy | null; items: TrainingItem[]; rank: number; qualified: boolean; coins: number } | null>(null);
  const rewardApplied = useRef(false);

  // Clear any resumable session when leaving the grand prix for good.
  function exitGp() {
    setRaceSession(null);
    onExit();
  }

  function startGrade(grade: GpGrade) {
    setRaceSession(null); // drop any stale attempt
    const seed = (Math.random() * 2 ** 31) >>> 0;
    setState(buildGpState(grade, seed, player));
    setHeatResults(null);
    setQualifiers(null);
    setFinalResult(null);
    setReward(null);
    setHeatBets([]);
    setFinalBets([]);
    rewardApplied.current = false;
    setScreen('card');
  }

  // Settle the heat once (qualifier bets) and move to the board.
  function finalizeHeat(st: GpState, heatRes: SimResult[], quals: Qualifier[], heatBetsArg: Bet[]) {
    const s = useStore.getState().raceSession;
    if (!(s && s.kind === 'gp' && s.heatSettled)) settleBets(heatBetsArg, heatRes[st.playerHeat].order, st.course.id);
    setHeatResults(heatRes);
    setQualifiers(quals);
    patchRaceSession({ screen: 'qualify', heatSettled: true, anchorMs: null });
    setScreen('qualify');
  }

  // Settle the final once (bets + trophy/coins/items/records/unlocks) → podium.
  function finalizeFinal(st: GpState, quals: Qualifier[], finalBetsArg: Bet[], finalRes: SimResult) {
    setFinalResult(finalRes);
    const s = useStore.getState().raceSession;
    if (rewardApplied.current || (s && s.kind === 'gp' && s.finalSettled)) {
      if (s && s.kind === 'gp' && s.reward) setReward(s.reward);
      patchRaceSession({ screen: 'podium', anchorMs: null });
      setScreen('podium');
      return;
    }
    rewardApplied.current = true;
    finishRaceTask(); // count the grand-prix final toward the task (result reached)
    settleBets(finalBetsArg, finalRes.order, st.course.id);
    const finalists = quals.map((q) => q.entrant);
    const playerIdx = finalists.findIndex((e) => e.isPlayer);
    let reward: GpRaceReward;
    if (playerIdx < 0) {
      reward = { trophy: null, items: [], rank: 0, qualified: false, coins: 0 };
    } else {
      const rank = finalRes.ranks[playerIdx];
      // トロフィーもコインも G1 のみ（G2/G3 は育成アイテムと解放のみ）。
      const trophy = st.grade === 'g1' ? makeTrophy(player.id, rank, st.course.id, mode, 'gp') : null;
      const items = rollItems(mulberry32((st.seed ^ rank ^ 0xabc) >>> 0), gpItemCount(st.grade, rank, mode));
      if (trophy) addTrophies([trophy]);
      if (items.length) grantItems(items);
      recordRace(st.course.id, mode, rank, finalRes.finishTimes[playerIdx]);
      if (st.grade === 'g3' && rank <= 3) unlockGp({ g2: true });
      if (st.grade === 'g2' && rank === 1) unlockGp({ g1: true });
      const coinReward = st.grade === 'g1' ? gpFinalCoins(rank) : 0;
      if (coinReward > 0) addCoins(coinReward);
      bufferSubmission(buildSubmission(finalists, st.course.id, mode, st.seed ^ 0x5f, finalRes, finalists[playerIdx].horseId, finalLaps(mode)));
      reward = { trophy, items, rank, qualified: true, coins: coinReward };
    }
    setReward(reward);
    patchRaceSession({ screen: 'podium', finalSettled: true, reward, anchorMs: null });
    setScreen('podium');
  }

  function afterPlayerHeat(playerRes: SimResult) {
    if (!state) return;
    const results = computeHeatResults(state, mode);
    results[state.playerHeat] = playerRes; // the heat actually shown
    finalizeHeat(state, results, computeQualifiers(state.heats, results), heatBets);
  }

  function afterFinal(res: SimResult) {
    if (!state || !qualifiers) { setScreen('podium'); return; }
    finalizeFinal(state, qualifiers, finalBets, res);
  }

  // Resume a grand prix after a tab switch / reload (改修：レース継続②). Rebuilds the
  // whole attempt from its seed; races that already finished settle once and jump
  // ahead, otherwise playback resumes via the wall-clock anchor.
  const rehydrated = useRef(false);
  useEffect(() => {
    if (rehydrated.current) return;
    rehydrated.current = true;
    const s = useStore.getState().raceSession;
    if (!s || s.kind !== 'gp') return;
    const st = buildGpState(s.grade, s.seed, s.player);
    setState(st);
    setHeatBets(s.heatBets as unknown as Bet[]);
    setFinalBets(s.finalBets as unknown as Bet[]);
    rewardApplied.current = s.finalSettled;
    const heatRes = computeHeatResults(st, s.mode);
    const quals = computeQualifiers(st.heats, heatRes);
    if (s.screen === 'heat') {
      const done = s.anchorMs != null && Date.now() >= gpRaceDoneAt(s.anchorMs, heatRes[st.playerHeat].duration, reduced);
      if (done) finalizeHeat(st, heatRes, quals, s.heatBets as unknown as Bet[]);
      else setScreen('heat');
    } else if (s.screen === 'qualify' || s.screen === 'finalPaddock') {
      setHeatResults(heatRes);
      setQualifiers(quals);
      setScreen(s.screen);
    } else {
      // final or podium
      setHeatResults(heatRes);
      setQualifiers(quals);
      const finalists = quals.map((q) => q.entrant);
      const finalRes = simulate2(finalists, st.course, s.mode, st.seed ^ 0x5f, { laps: finalLaps(s.mode) });
      if (s.screen === 'final' && !(s.anchorMs != null && Date.now() >= gpRaceDoneAt(s.anchorMs, finalRes.duration, reduced))) {
        setScreen('final'); // resume the final animation
      } else {
        finalizeFinal(st, quals, s.finalBets as unknown as Bet[], finalRes);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- grade select ----
  if (screen === 'grade') {
    const rows: { g: GpGrade; locked: boolean; cond: string }[] = [
      { g: 'g3', locked: false, cond: 'いつでも挑戦できる' },
      { g: 'g2', locked: !gpUnlocked.g2, cond: 'G3で3位以内に入ると解放' },
      { g: 'g1', locked: !gpUnlocked.g1, cond: 'G2で優勝すると解放' },
    ];
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>グランプリ</h1>
        <p className={styles.lead}>18頭・予選3組 → 上位＋敗者復活で本戦8頭。時間: {mode}秒</p>
        {rows.map(({ g, locked, cond }) => {
          const isG1 = g === 'g1';
          const capped = isG1 && gpLeft <= 0;
          const disabled = locked || capped;
          return (
            <button
              key={g}
              className={`${styles.modeCard} ${isG1 ? gp.g1Card : ''} ${disabled ? styles.modeLocked : ''}`}
              disabled={disabled}
              onClick={() => !disabled && startGrade(g)}
            >
              <span className={styles.modeEmoji}><Icon name={isG1 ? 'crown' : 'medal'} size={30} /></span>
              <span className={styles.modeText}>
                <span className={styles.modeName}>{GP_GRADES[g].name} グランプリ</span>
                <span className={styles.modeDesc}>敵の強さ {GP_GRADES[g].band[0]}〜{GP_GRADES[g].band[1]}</span>
                {locked ? (
                  <span className={styles.modeDesc}>{cond}</span>
                ) : (
                  <span className={gp.rewards}>
                    <span className={gp.chip}><Icon name="gift" size={12} /> 育成×{GP_GRADES[g].win1Items}</span>
                    {isG1 ? (
                      <>
                        <span className={`${gp.chip} ${gp.chipGold}`}><Icon name="trophy" size={12} /> トロフィー</span>
                        <span className={`${gp.chip} ${gp.chipGold}`}><CoinIcon size={12} /> 最大10,000</span>
                        <span className={`${gp.chip} ${capped ? gp.chipEmpty : gp.chipLimit}`}>本日 {gpLeft}/{GP_DAILY_LIMIT}</span>
                      </>
                    ) : (
                      <span className={`${gp.chip} ${gp.chipFree}`}>何回でも</span>
                    )}
                  </span>
                )}
              </span>
              {locked ? <span className={styles.soon}><Icon name="lock" size={16} /></span> : <span className={styles.modeGo}>▶</span>}
            </button>
          );
        })}
        <button className={styles.exitLink} onClick={onExit}>もどる</button>
      </div>
    );
  }
  if (!state) return null;

  // ---- race card (出走表) ----
  if (screen === 'card') {
    return (
      <div className={styles.page}>
        <div className={gp.paper}>
          <div className={gp.paperHead}>{GP_GRADES[state.grade].name} グランプリ</div>
          <div className={gp.paperSub}>{state.course.name}・{mode}秒</div>
          {state.heats.map((heat, h) => (
            <div key={h} className={gp.heatBlock}>
              <div className={gp.heatTitle}>{h + 1}組{h === state.playerHeat ? '（あなたの組）' : ''}</div>
              {heat.map((e, i) => (
                <div key={e.horseId} className={`${gp.entry} ${e.isPlayer ? gp.entryMe : ''}`}>
                  <span className={gp.zekken}>{i + 1}</span>
                  <span className={gp.entryName}>{e.isPlayer ? 'あなた' : e.name}</span>
                  <span className={gp.entryStyle}>{RUN_STYLE_LABEL[e.style]}</span>
                  <span className={gp.entryStat}>合計{statTotal(e.stats)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className={styles.setupActions}>
          <button className="btn neutral" onClick={onExit}>やめる</button>
          <button className="btn" onClick={() => setScreen('odds')}>パドックへ</button>
        </div>
      </div>
    );
  }

  // ---- qualifier paddock (bet on your heat, then start) ----
  if (screen === 'odds') {
    const heat = state.heats[state.playerHeat];
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>予選パドック（{state.playerHeat + 1}組）</h1>
        <Paddock
          entrants={heat}
          looks={state.looks}
          course={state.course}
          coins={coins}
          bets={heatBets}
          maxBets={MAX_BETS_GP}
          startLabel="予選スタート"
          onAdd={(b) => { if (heatBets.length >= MAX_BETS_GP) return; if (spendCoins(b.amount)) setHeatBets((prev) => [...prev, b]); }}
          onRemove={(i) => { addCoins(heatBets[i].amount); setHeatBets((prev) => prev.filter((_, k) => k !== i)); }}
          onStart={() => {
            if (!startGpAttempt(state.grade)) { onExit(); return; }
            // The daily attempt is now spent — persist a resumable session from here on.
            setRaceSession({
              kind: 'gp', screen: 'heat', grade: state.grade, seed: state.seed, mode,
              player, heatBets: heatBets.map(toSaved), finalBets: [], anchorMs: Date.now(),
              heatSettled: false, finalSettled: false, reward: null,
            });
            setScreen('heat');
          }}
        />
        <button className={styles.exitLink} onClick={() => { heatBets.forEach((b) => addCoins(b.amount)); setHeatBets([]); setScreen('card'); }}>
          もどる（賭けを取り消す）
        </button>
      </div>
    );
  }

  // ---- player's heat ----
  if (screen === 'heat') {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>予選 {state.playerHeat + 1}組</h1>
        <RaceTrack2
          entrants={state.heats[state.playerHeat]}
          looks={state.looks}
          course={state.course}
          mode={mode}
          seed={state.seed + state.playerHeat * 101}
          reduced={reduced}
          skippable
          laps={heatLaps(mode)}
          bets={heatBets}
          anchorMs={raceSession?.anchorMs ?? undefined}
          onFinish={afterPlayerHeat}
        />
      </div>
    );
  }

  // ---- qualifier board ----
  if (screen === 'qualify' && heatResults && qualifiers) {
    const finalists = new Set(qualifiers.map((q) => q.entrant.horseId));
    const playerIn = qualifiers.some((q) => q.entrant.isPlayer);
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>予選けっか</h1>
        {state.heats.map((heat, h) => {
          const res = heatResults[h];
          const rows = heat.map((e, i) => ({ e, rank: res.ranks[i], time: res.finishTimes[i] })).sort((a, b) => a.rank - b.rank);
          return (
            <div key={h} className={gp.heatBlock}>
              <div className={gp.heatTitle}>{h + 1}組{h === state.playerHeat ? '（あなた）' : '（CPU）'}</div>
              {rows.map(({ e, rank }) => {
                const q = qualifiers.find((x) => x.entrant.horseId === e.horseId);
                return (
                  <div key={e.horseId} className={`${gp.entry} ${e.isPlayer ? gp.entryMe : ''} ${finalists.has(e.horseId) ? gp.entryQual : ''}`}>
                    <span className={gp.zekken}>{rank}</span>
                    <span className={gp.entryName}>{e.isPlayer ? 'あなた' : e.name}</span>
                    {q && <span className={q.revived ? gp.revive : gp.qual}>{q.revived ? '復活！' : '本戦へ'}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
        <p className={gp.qualNote}>{playerIn ? '本戦進出！' : '予選敗退… 本戦は観戦になります'}</p>
        {heatBets.length > 0 && (
          <BetResult
            entrants={state.heats[state.playerHeat]}
            gate={heatResults[state.playerHeat].gate}
            order={heatResults[state.playerHeat].order}
            bets={heatBets}
            course={state.course}
          />
        )}
        <div className={styles.setupActions}>
          <button className="btn neutral" onClick={exitGp}>やめる</button>
          <button className="btn" onClick={() => { patchRaceSession({ screen: 'finalPaddock' }); setScreen('finalPaddock'); }}>{playerIn ? '本戦へ' : '本戦を観る'}</button>
        </div>
      </div>
    );
  }

  // ---- final paddock (bet on the 8 finalists) ----
  if (screen === 'finalPaddock' && qualifiers) {
    const finalists = qualifiers.map((q) => q.entrant);
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>本戦パドック（決勝8頭）</h1>
        <Paddock
          entrants={finalists}
          looks={state.looks}
          course={state.course}
          coins={coins}
          bets={finalBets}
          maxBets={MAX_BETS_GP}
          startLabel="本戦スタート"
          onAdd={(b) => { if (finalBets.length >= MAX_BETS_GP) return; if (spendCoins(b.amount)) { const nb = [...finalBets, b]; setFinalBets(nb); patchRaceSession({ finalBets: nb.map(toSaved) }); } }}
          onRemove={(i) => { addCoins(finalBets[i].amount); const nb = finalBets.filter((_, k) => k !== i); setFinalBets(nb); patchRaceSession({ finalBets: nb.map(toSaved) }); }}
          onStart={() => { patchRaceSession({ screen: 'final', anchorMs: Date.now() }); setScreen('final'); }}
        />
        <button className={styles.exitLink} onClick={() => { finalBets.forEach((b) => addCoins(b.amount)); setFinalBets([]); patchRaceSession({ screen: 'qualify', finalBets: [] }); setScreen('qualify'); }}>
          もどる（賭けを取り消す）
        </button>
      </div>
    );
  }

  // ---- final ----
  if (screen === 'final' && qualifiers) {
    const finalists = qualifiers.map((q) => q.entrant);
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>本戦（決勝）</h1>
        <RaceTrack2
          entrants={finalists}
          looks={state.looks}
          course={state.course}
          mode={mode}
          seed={state.seed ^ 0x5f}
          reduced={reduced}
          skippable
          laps={finalLaps(mode)}
          bets={finalBets}
          anchorMs={raceSession?.anchorMs ?? undefined}
          onFinish={afterFinal}
        />
      </div>
    );
  }

  // ---- podium / result ----
  if (screen === 'podium' && finalResult && qualifiers) {
    const finalists = qualifiers.map((q) => q.entrant);
    const order = finalResult.order.map((idx, place) => ({ idx, rank: place + 1, time: finalResult.finishTimes[idx] }));
    return (
      <div className={styles.page}>
        <div className={styles.resultCard}>
          <h2 className={styles.resultTitle}>
            {reward?.qualified ? (reward.rank === 1 ? (<><Icon name="trophy" size={22} /> グランプリ制覇！</>) : `本戦 ${reward.rank}位`) : '予選敗退'}
          </h2>
          {reward?.trophy && <p className={styles.rewardLine}>トロフィー獲得！（{reward.trophy.rank}位・GP）</p>}
          {reward && reward.items.length > 0 && (
            <div className={styles.itemReward}>
              <span className={styles.rewardLine}>育成アイテム × {reward.items.length}</span>
              <ul className={styles.itemList}>{reward.items.map((it, i) => <li key={i}><Icon name="gift" size={13} /> {itemLabel(it)}</li>)}</ul>
            </div>
          )}
          {reward && reward.coins > 0 && (
            <p className={styles.rewardLine} style={{ color: '#8a6410' }}>
              <CoinIcon size={18} /> コイン ＋{reward.coins}
            </p>
          )}
          {state.grade === 'g3' && reward?.qualified && reward.rank <= 3 && <p className={gp.unlockMsg}>G2グランプリ解放！</p>}
          {state.grade === 'g2' && reward?.rank === 1 && <p className={gp.unlockMsg}>G1グランプリ解放！</p>}
          {finalBets.length > 0 && (
            <BetResult
              entrants={finalists}
              gate={finalResult.gate}
              order={finalResult.order}
              bets={finalBets}
              course={state.course}
            />
          )}
          <ol className={styles.ranking}>
            {order.map(({ idx, rank, time }) => {
              const rc = rankColor(rank, finalists.length);
              const e = finalists[idx];
              return (
                <li key={idx} className={`${styles.rankRow} ${e.isPlayer ? styles.rankMe : ''}`}>
                  <span className={styles.rankNo} style={{ background: rc.bg, borderColor: rc.bd, color: rc.fg }}>{rank}</span>
                  <div className={styles.rankHorse}><HorseView horse={state.looks[e.horseId]} size={34} /></div>
                  <span className={styles.rankName}>{e.isPlayer ? 'あなた' : e.name} <span className={styles.rankStyle}>{RUN_STYLE_LABEL[e.style]}</span></span>
                  <span className={styles.rankTime}>{time.toFixed(1)}s</span>
                </li>
              );
            })}
          </ol>
          <div className={styles.raceActions}>
            <button className="btn neutral" onClick={exitGp}>レースメニューへ</button>
            <button className="btn" onClick={() => { setRaceSession(null); setScreen('grade'); }}>もう一度</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
