import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import { COURSES } from '../data/courses';
import { statTotal, mulberry32 } from '../logic/stats';
import { styleFor } from '../logic/runStyle';
import { simulate2, type Entrant, type SimResult } from '../logic/raceSim2';
import {
  buildGpField,
  computeQualifiers,
  computeOdds,
  gpItemCount,
  heatLaps,
  finalLaps,
  GP_GRADES,
  type GpGrade,
  type Qualifier,
} from '../logic/grandprix';
import { makeTrophy, rollItems } from '../logic/raceReward';
import { GP_QUALIFY_COINS, gpFinalCoins } from '../data/coins';
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

  const [screen, setScreen] = useState<'grade' | 'card' | 'odds' | 'heat' | 'qualify' | 'final' | 'podium'>('grade');
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
        {rows.map(({ g, locked, cond }) => (
          <button key={g} className={`${styles.modeCard} ${locked ? styles.modeLocked : ''}`} disabled={locked} onClick={() => !locked && startGrade(g)}>
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

  // ---- odds / paddock ----
  if (screen === 'odds') {
    const heat = state.heats[state.playerHeat];
    const odds = computeOdds(heat, state.course);
    const order = heat.map((_, i) => i).sort((a, b) => odds[a].pop - odds[b].pop);
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>パドック（{state.playerHeat + 1}組）</h1>
        <p className={styles.lead}>単勝オッズ（人気）。あなたの馬は何番人気？</p>
        <div className={gp.oddsList}>
          {order.map((i) => {
            const e = heat[i];
            return (
              <div key={e.horseId} className={`${gp.oddsRow} ${e.isPlayer ? gp.entryMe : ''}`}>
                <span className={gp.pop}>{odds[i].pop}番人気</span>
                <div className={gp.oddsThumb}><HorseView horse={state.looks[e.horseId]} size={44} /></div>
                <span className={gp.entryName}>{e.isPlayer ? 'あなた' : e.name}</span>
                <span className={gp.oddsVal}>{odds[i].odds.toFixed(1)}倍</span>
              </div>
            );
          })}
        </div>
        <div className={styles.setupActions}>
          <button className="btn neutral" onClick={() => setScreen('card')}>もどる</button>
          <button className="btn" onClick={() => setScreen('heat')}>予選スタート</button>
        </div>
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
          <button className="btn" onClick={() => setScreen('final')}>{playerIn ? '本戦へ' : '本戦を観る'}</button>
        </div>
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
