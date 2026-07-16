import { useMemo, useRef, useState } from 'react';
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
import { GP_QUALIFY_COINS, GP_DAILY_LIMIT, MAX_BETS_GP, gpFinalCoins } from '../data/coins';
import { buildSubmission, bufferSubmission } from '../logic/raceSubmission';
import type { Horse, HorseLook, Trophy, TrainingItem } from '../types';
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
  const daily = useStore((s) => s.daily);
  const gpLeft = Math.max(0, GP_DAILY_LIMIT - (daily.day === dayKey() ? daily.gp : 0));

  // Betting (改修：グランプリでも馬券。予選＋本戦の2回・各最大 MAX_BETS_GP 通り・コイン使用)。
  const [heatBets, setHeatBets] = useState<Bet[]>([]);
  const [finalBets, setFinalBets] = useState<Bet[]>([]);
  const [betPayout, setBetPayout] = useState(0); // total bet winnings this attempt (for the podium)

  // Settle a round's bets against its finishing order: pay out and push the best
  // winning odds to the ranking (same as a single race).
  function settleBets(bets: Bet[], order: number[], courseId: string) {
    let payout = 0;
    let best = 0;
    for (const b of bets) {
      const got = settle(b, order);
      payout += got;
      if (got > 0) best = Math.max(best, b.odds);
    }
    if (payout > 0) {
      addCoins(payout);
      setBetPayout((p) => p + payout);
    }
    if (ENABLE_RANKING && (best > 0 || payout > 0)) submitBestOdds(best, courseId, payout);
  }

  const [screen, setScreen] = useState<'grade' | 'card' | 'odds' | 'heat' | 'qualify' | 'finalPaddock' | 'final' | 'podium'>('grade');
  const [state, setState] = useState<GpState | null>(null);
  const [heatResults, setHeatResults] = useState<SimResult[] | null>(null);
  const [qualifiers, setQualifiers] = useState<Qualifier[] | null>(null);
  const [finalResult, setFinalResult] = useState<SimResult | null>(null);
  const [reward, setReward] = useState<{ trophy: Trophy | null; items: TrainingItem[]; rank: number; qualified: boolean; coins: number } | null>(null);
  const rewardApplied = useRef(false);

  const playerEntrant: Entrant = useMemo(
    () => ({ horseId: player.id, name: player.name, isPlayer: true, stats: player.stats, style: styleFor(player.id, player.stats) }),
    [player],
  );

  function startGrade(grade: GpGrade) {
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const rng = mulberry32(seed ^ 0x1234);
    const course = COURSES[Math.floor(rng() * COURSES.length)];
    const field = buildGpField(playerEntrant, player, grade, seed);
    setState({ grade, course, seed, ...field });
    setHeatResults(null);
    setQualifiers(null);
    setFinalResult(null);
    setReward(null);
    setHeatBets([]);
    setFinalBets([]);
    setBetPayout(0);
    rewardApplied.current = false;
    setScreen('card');
  }

  // After the player's heat: simulate the other heats, compute the 8 finalists.
  function afterPlayerHeat(playerRes: SimResult) {
    if (!state) return;
    const results: SimResult[] = [];
    state.heats.forEach((heat, h) => {
      if (h === state.playerHeat) results[h] = playerRes;
      else results[h] = simulate2(heat, state.course, mode, state.seed + h * 101, { laps: heatLaps(mode) });
    });
    // Settle the qualifier bets against the player's heat result.
    settleBets(heatBets, playerRes.order, state.course.id);
    setHeatResults(results);
    setQualifiers(computeQualifiers(state.heats, results));
    setScreen('qualify');
  }

  function afterFinal(res: SimResult) {
    setFinalResult(res);
    if (!state || !qualifiers || rewardApplied.current) {
      setScreen('podium');
      return;
    }
    rewardApplied.current = true;
    finishRaceTask(); // count the grand-prix final toward the task (result reached)
    // Settle the final bets against the final result (runs even if the player
    // didn't qualify — they can still bet on the final as a spectator).
    settleBets(finalBets, res.order, state.course.id);
    const finalists = qualifiers.map((q) => q.entrant);
    const playerIdx = finalists.findIndex((e) => e.isPlayer);
    if (playerIdx < 0) {
      setReward({ trophy: null, items: [], rank: 0, qualified: false, coins: 0 });
      setScreen('podium');
      return;
    }
    const rank = res.ranks[playerIdx];
    const trophy = makeTrophy(player.id, rank, state.course.id, mode, 'gp');
    const items = rollItems(mulberry32((state.seed ^ rank ^ 0xabc) >>> 0), gpItemCount(state.grade, rank, mode));
    if (trophy) addTrophies([trophy]);
    if (items.length) grantItems(items);
    recordRace(state.course.id, mode, rank, res.finishTimes[playerIdx]);
    if (state.grade === 'g3' && rank <= 3) unlockGp({ g2: true });
    if (state.grade === 'g2' && rank === 1) unlockGp({ g1: true });
    // Coins (RACE_V4 §4.2): reaching the final pays a qualifying bonus, plus a
    // top-3 placing reward.
    const coinReward = GP_QUALIFY_COINS + gpFinalCoins(rank);
    addCoins(coinReward);
    // Ranking foundation (RACE_V4 §5): buffer the final locally (upload gated off).
    bufferSubmission(
      buildSubmission(finalists, state.course.id, mode, state.seed ^ 0x5f, res, finalists[playerIdx].horseId, finalLaps(mode)),
    );
    setReward({ trophy, items, rank, qualified: true, coins: coinReward });
    setScreen('podium');
  }

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
        <p className={styles.lead}>
          本日ののこり: <b>{gpLeft}</b> / {GP_DAILY_LIMIT} 回（予選＋本戦で1回・毎日リセット）
        </p>
        {gpLeft <= 0 && (
          <p className={styles.lead}>本日のグランプリは上限に達しました。また明日挑戦してね。</p>
        )}
        {rows.map(({ g, locked, cond }) => (
          <button key={g} className={`${styles.modeCard} ${locked || gpLeft <= 0 ? styles.modeLocked : ''}`} disabled={locked || gpLeft <= 0} onClick={() => !locked && gpLeft > 0 && startGrade(g)}>
            <span className={styles.modeEmoji}><Icon name={g === 'g1' ? 'crown' : 'medal'} size={30} /></span>
            <span className={styles.modeText}>
              <span className={styles.modeName}>{GP_GRADES[g].name} グランプリ</span>
              <span className={styles.modeDesc}>敵の強さ {GP_GRADES[g].band[0]}〜{GP_GRADES[g].band[1]}／{locked ? cond : `1着で育成アイテム${GP_GRADES[g].win1Items}個`}</span>
            </span>
            {locked ? <span className={styles.soon}><Icon name="lock" size={16} /></span> : <span className={styles.modeGo}>▶</span>}
          </button>
        ))}
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
          onStart={() => { if (startGpAttempt()) setScreen('heat'); else onExit(); }}
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
        <div className={styles.setupActions}>
          <button className="btn neutral" onClick={onExit}>やめる</button>
          <button className="btn" onClick={() => setScreen('finalPaddock')}>{playerIn ? '本戦へ' : '本戦を観る'}</button>
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
          onAdd={(b) => { if (finalBets.length >= MAX_BETS_GP) return; if (spendCoins(b.amount)) setFinalBets((prev) => [...prev, b]); }}
          onRemove={(i) => { addCoins(finalBets[i].amount); setFinalBets((prev) => prev.filter((_, k) => k !== i)); }}
          onStart={() => setScreen('final')}
        />
        <button className={styles.exitLink} onClick={() => { finalBets.forEach((b) => addCoins(b.amount)); setFinalBets([]); setScreen('qualify'); }}>
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
          {betPayout > 0 && (
            <p className={styles.rewardLine} style={{ color: '#8a6410' }}>
              <CoinIcon size={18} /> 馬券の払戻 ＋{betPayout}
            </p>
          )}
          {state.grade === 'g3' && reward?.qualified && reward.rank <= 3 && <p className={gp.unlockMsg}>G2グランプリ解放！</p>}
          {state.grade === 'g2' && reward?.rank === 1 && <p className={gp.unlockMsg}>G1グランプリ解放！</p>}
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
            <button className="btn neutral" onClick={onExit}>レースメニューへ</button>
            <button className="btn" onClick={() => setScreen('grade')}>もう一度</button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
