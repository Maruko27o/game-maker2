import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { submitBestOdds } from '../cloud';
import { ENABLE_RANKING } from '../config';
import { COURSES, type Course } from '../data/courses';
import { simulate2, type Entrant, type SimResult } from '../logic/raceSim2';
import { mulberry32, statTotal } from '../logic/stats';
import { styleFor } from '../logic/runStyle';
import { makeCpu } from '../logic/cpu';
import { colorById } from '../data/parts';
import { BADGES } from '../data/badges';
import type { Horse, HorseLook, Badge, Stats } from '../types';
import { RUN_STYLE_LABEL, STAT_KEYS } from '../types';
import HorseView from '../components/HorseView';
import BadgeIcon from '../components/BadgeIcon';
import CoinIcon from '../components/CoinIcon';
import Icon from '../components/Icon';
import RaceTrack2 from '../components/RaceTrack2';
import GrandPrix from './GrandPrix';
import Arena from './Arena';
import { settle, type Bet } from '../logic/betting';
import { mcWinProbsAsync } from '../logic/odds';
import { winProbs } from '../logic/grandprix';
import { assignMoods, moodMultipliers, type MoodLevel } from '../logic/mood';
import Paddock from '../components/Paddock';
import BetResult from '../components/BetResult';
import { buildSubmission, bufferSubmission } from '../logic/raceSubmission';
import { normalRaceCoins, BADGE_COINS, MAX_BETS_PER_RACE } from '../data/coins';
import { usePrefersReducedMotion } from '../hooks';
import styles from './Race.module.css';

// A short celebratory cut-in for achievement badges (ACCOUNT.md §2, 1.2s, skippable).
function BadgeCutin({ badges, onDone }: { badges: Badge[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => (i + 1 < badges.length ? setI(i + 1) : onDone()), 1200);
    return () => clearTimeout(t);
  }, [i, badges.length, onDone]);
  const b = badges[i];
  return (
    <div className={styles.cutin} onClick={onDone}>
      <div className={styles.cutinCard}>
        <BadgeIcon id={b.id} size={120} />
        <div className={styles.cutinName}>{BADGES[b.id as keyof typeof BADGES]?.name}</div>
        <div className={styles.cutinSub}>バッジ獲得！</div>
      </div>
    </div>
  );
}

function aptitude(stats: Stats, c: Course): string {
  const base = STAT_KEYS.reduce((n, k) => n + stats[k], 0);
  const w = STAT_KEYS.reduce((n, k) => n + stats[k] * c.weights[k], 0);
  const ratio = w / Math.max(1, base);
  if (ratio > 1.06) return 'この子にピッタリの得意コース！';
  if (ratio > 1.0) return 'まずまず走れそう。';
  if (ratio > 0.95) return '標準的なコース。';
  return 'ちょっと苦手なコースかも…';
}

function rankColor(rank: number, total: number): { bg: string; bd: string; fg: string } {
  if (rank === 1) return { bg: '#f0c33c', bd: '#8a6410', fg: '#2b2118' };
  if (rank === 2) return { bg: '#cfd6dd', bd: '#79838d', fg: '#2b2118' };
  if (rank === 3) return { bg: '#cf8a4e', bd: '#8f5a28', fg: '#fff' };
  const f = total > 4 ? (rank - 4) / (total - 4) : 0;
  const v = Math.round(230 * (1 - f) + 40 * f);
  return { bg: `rgb(${v},${v},${v})`, bd: '#2b2118', fg: v > 140 ? '#2b2118' : '#fff' };
}


type RaceSetup = {
  course: Course;
  mode: 30 | 60;
  seed: number;
  entrants: Entrant[];
  looks: Record<string, HorseLook>;
  grade: 'normal' | 'gp';
  moods: MoodLevel[]; // per-entrant mood for this race (shown + folded into perf)
};

// Rebuild the exact single-race field from its seed (改修：レース継続). Mirrors the
// generation in begin() so a resumed race is byte-for-byte identical. When the
// course was chosen (pickMode), pass it so the RNG isn't consumed for the draw.
function buildSingleSetup(seed: number, player: Horse, mode: 30 | 60, chosenCourse?: Course): RaceSetup {
  const rng = mulberry32(seed ^ 0x77);
  const course = chosenCourse ?? COURSES[Math.floor(rng() * COURSES.length)];
  const pt = statTotal(player.stats);
  const band: [number, number] = [Math.max(34, pt - 4), Math.min(48, pt + 4)];
  const looks: Record<string, HorseLook> = { [player.id]: player };
  const entrants: Entrant[] = [
    { horseId: player.id, name: player.name, isPlayer: true, stats: player.stats, style: styleFor(player.id, player.stats) },
  ];
  const avoidBody = colorById[player.colors.body]?.value;
  for (let i = 0; i < 7; i++) {
    const cpu = makeCpu(`cpu${i}`, rng, band, 0.5, undefined, avoidBody);
    entrants.push(cpu.entrant);
    looks[cpu.entrant.horseId] = cpu.look;
  }
  const moods = assignMoods(winProbs(entrants, course), seed);
  return { course, mode, seed, entrants, looks, grade: 'normal', moods };
}

// Wall-clock ms at which a race's playback is fully over (past the cool-down), so a
// long-absent player returning lands straight on the result. Mirrors RaceTrack2.
function raceDoneAt(anchorMs: number, durationS: number, reduced: boolean): number {
  const speed = reduced ? 4 : 1;
  const cdMs = (reduced ? 220 : 700) * 3;
  const linger = reduced ? 0.2 : 2.2;
  return anchorMs + cdMs + ((durationS + linger) / speed) * 1000;
}

// ---- Course reveal roulette (RACE_V2 §10) -------------------------------------
function Roulette({ course, player, reduced, onDone }: { course: Course; player: Horse; reduced: boolean; onDone: () => void }) {
  const [spinning, setSpinning] = useState(!reduced);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (reduced) {
      const t = setTimeout(onDone, 400);
      return () => clearTimeout(t);
    }
    let i = 0;
    let delay = 60;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i++;
      setIdx(i % COURSES.length);
      delay *= 1.12;
      if (delay < 320) timer = setTimeout(tick, delay);
      else {
        setIdx(COURSES.indexOf(course));
        setSpinning(false);
        timer = setTimeout(onDone, 1600);
      }
    };
    timer = setTimeout(tick, delay);
    return () => clearTimeout(timer);
  }, [course, reduced, onDone]);

  const shown = spinning ? COURSES[idx] : course;
  return (
    <div className={styles.rouletteWrap} onClick={!spinning ? onDone : undefined}>
      <div className={`${styles.rouletteCard} ${!spinning ? styles.rouletteStop : ''}`}>
        <div className={styles.rouletteEmoji} style={{ background: shown.ground }} aria-hidden />
        <div className={styles.rouletteName}>{shown.name}</div>
        {!spinning && (
          <>
            <div className={styles.rouletteInfo}>
              路面: {surfaceLabel(shown.surface)} ／ {shown.desc}
            </div>
            <div className={styles.rouletteApt}>{aptitude(player.stats, shown)}</div>
            <div className={styles.rouletteTap}>タップですすむ</div>
          </>
        )}
      </div>
    </div>
  );
}

function surfaceLabel(s: string): string {
  return { turf: '芝', dirt: 'ダート', sand: '砂', steeple: '障害', circuit: 'ナイター', trail: '芝' }[s] ?? s;
}

// ---- main ---------------------------------------------------------------------
export default function Race() {
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();
  const horses = useStore((s) => s.horses);
  const coins = useStore((s) => s.coins);
  const finishNormalRace = useStore((s) => s.finishNormalRace);
  const addCoins = useStore((s) => s.addCoins);
  const spendCoins = useStore((s) => s.spendCoins);
  const recordBet = useStore((s) => s.recordBet);
  const finishRaceTask = useStore((s) => s.finishRaceTask);
  const recordBetStats = useStore((s) => s.recordBetStats);
  const raceSession = useStore((s) => s.raceSession);
  const setRaceSession = useStore((s) => s.setRaceSession);
  const patchRaceSession = useStore((s) => s.patchRaceSession);

  const [screen, setScreen] = useState<'menu' | 'setup' | 'course' | 'gp' | 'arena' | 'roulette' | 'paddock' | 'race' | 'result'>('menu');
  const [grade, setGrade] = useState<'normal' | 'gp'>('normal');
  const [pickMode, setPickMode] = useState(false); // choose course, no betting
  const [horseId, setHorseId] = useState<string | null>(null);
  const [mode, setMode] = useState<30 | 60>(30);
  const [setup, setSetup] = useState<RaceSetup | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [reward, setReward] = useState<{ rank: number; awarded: Badge[]; earned: number; payout: number } | null>(null);
  const [cutin, setCutin] = useState<Badge[]>([]); // achievement badges to celebrate
  const [bets, setBets] = useState<Bet[]>([]); // the placed bets (empty = no bet)
  const [odds, setOdds] = useState<number[] | null>(null); // Monte-Carlo win probs for the paddock
  const [oddsPct, setOddsPct] = useState(0); // odds-calc progress 0..1
  const rewardApplied = useRef(false);

  const player = horses.find((h) => h.id === horseId) ?? null;

  // Price the race off the *real* simulation: run it many times and read the actual
  // win rates, so the odds match the true chances (RACE §odds整合性). Kicked off as
  // soon as the field is set (during the roulette) so it's usually ready by the paddock.
  useEffect(() => {
    if (!setup || pickMode || setup.grade === 'gp') return; // only the betting single race uses this
    let alive = true;
    setOdds(null);
    setOddsPct(0);
    mcWinProbsAsync(setup.entrants, setup.course, setup.mode, {
      moods: moodMultipliers(setup.moods),
      onProgress: (f) => { if (alive) setOddsPct(f); },
    }).then((p) => { if (alive) setOdds(p); });
    return () => { alive = false; };
  }, [setup, pickMode]);

  function begin(chosenCourse?: Course) {
    if (!player) return;
    setRaceSession(null); // drop any previous (finished/abandoned) session
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const setup0 = buildSingleSetup(seed, player, mode, chosenCourse);
    setSetup(setup0);
    rewardApplied.current = false;
    setReward(null);
    setBets([]);
    if (chosenCourse) {
      // Chosen-course mode has no betting: skip the roulette + paddock, race now,
      // opening a resumable session anchored to this moment.
      openRaceSession(setup0, [], true);
      setScreen('race');
    } else {
      setScreen('roulette'); // betting flow; the session opens when the race starts
    }
  }

  // Persist the running race so it survives tab switches / reloads (改修：レース継続).
  // The race is deterministic, so we store only the seed/choices + a wall-clock anchor.
  function openRaceSession(setup0: RaceSetup, betList: Bet[], pick: boolean) {
    if (!player) return;
    setRaceSession({
      kind: 'single',
      screen: 'race',
      pickMode: pick,
      seed: setup0.seed,
      mode: setup0.mode,
      courseId: setup0.course.id,
      player,
      bets: betList.map((b) => ({ kind: b.kind, sel: b.sel, amount: b.amount, odds: b.odds })),
      anchorMs: Date.now(),
      rewardApplied: false,
      reward: null,
    });
  }

  // Settle a finished single race exactly once: task count, badges, coins, bets,
  // ranking. Returns the reward payload + achievement badges (for the cut-in).
  function settleRace(setup0: RaceSetup, betList: Bet[], res: SimResult) {
    finishRaceTask();
    const rank = res.ranks[0]; // player is entrant 0
    const flawless = !res.frames.some((f) => f.runners[0]?.state === 'stumble');
    const awarded = finishNormalRace({
      horseId: setup0.entrants[0].horseId,
      courseId: setup0.course.id,
      mode: setup0.mode,
      rank,
      time: res.finishTimes[0],
      isJumpCourse: setup0.course.surface === 'steeple',
      flawless,
    });
    const achievements = awarded.filter((b) => !BADGES[b.id as keyof typeof BADGES]?.placing);
    const earned = normalRaceCoins(rank) + achievements.length * BADGE_COINS;
    let payout = 0;
    let bestWonOdds = 0;
    const staked = betList.reduce((s, b) => s + b.amount, 0);
    for (const b of betList) {
      const got = settle(b, res.order);
      payout += got;
      if (got > 0) bestWonOdds = Math.max(bestWonOdds, b.odds);
      recordBet({ courseId: setup0.course.id, kind: b.kind, picks: b.sel.map((i) => res.gate[i]), amount: b.amount, odds: b.odds, won: got > 0, payout: got, at: Date.now() });
    }
    addCoins(earned + payout);
    recordBetStats({ placed: betList.length, staked, payout, wonOdds: bestWonOdds });
    if (ENABLE_RANKING && (bestWonOdds > 0 || payout > 0)) submitBestOdds(bestWonOdds, setup0.course.id, payout);
    bufferSubmission(buildSubmission(setup0.entrants, setup0.course.id, setup0.mode, setup0.seed, res, setup0.entrants[0].horseId));
    return { reward: { rank, awarded, earned, payout }, achievements };
  }

  function onFinish(result: SimResult) {
    setResult(result);
    if (!setup) { setScreen('result'); return; }
    const sess = useStore.getState().raceSession;
    const single = sess && sess.kind === 'single' ? sess : null;
    if (rewardApplied.current || single?.rewardApplied) {
      if (single?.reward) setReward(single.reward);
    } else {
      rewardApplied.current = true;
      const { reward, achievements } = settleRace(setup, bets, result);
      setReward(reward);
      setCutin(achievements); // cut-in only for achievement badges (placing are everyday)
      patchRaceSession({ rewardApplied: true, reward });
    }
    patchRaceSession({ screen: 'result' });
    setScreen('result');
  }

  // Resume an in-progress race after a tab switch / reload (改修：レース継続). The
  // race is rebuilt from its seed; if the wall clock says it already finished, we
  // settle it (once) and jump to the result — otherwise playback resumes via anchor.
  const rehydrated = useRef(false);
  useEffect(() => {
    if (rehydrated.current) return;
    rehydrated.current = true;
    const s = useStore.getState().raceSession;
    if (!s) return;
    if (s.kind === 'gp') {
      // A grand prix is in progress — route to it; GrandPrix resumes its own flow.
      const horse = horses.find((h) => h.id === s.player.id);
      if (!horse) { setRaceSession(null); return; }
      setHorseId(s.player.id);
      setMode(s.mode);
      setGrade('gp');
      setScreen('gp');
      return;
    }
    if (s.kind !== 'single') return;
    const course = COURSES.find((c) => c.id === s.courseId);
    if (!course) { setRaceSession(null); return; }
    const setup0 = buildSingleSetup(s.seed, s.player, s.mode, s.pickMode ? course : undefined);
    const bets0 = s.bets as unknown as Bet[];
    setHorseId(s.player.id);
    setPickMode(s.pickMode);
    setMode(s.mode);
    setGrade('normal');
    setSetup(setup0);
    setBets(bets0);
    rewardApplied.current = s.rewardApplied;
    const res = simulate2(setup0.entrants, setup0.course, setup0.mode, setup0.seed, { recordFrames: true, moods: setup0.moods });
    const finished = s.screen === 'result' || (s.anchorMs != null && Date.now() >= raceDoneAt(s.anchorMs, res.duration, reduced));
    if (finished) {
      setResult(res);
      if (s.rewardApplied) {
        if (s.reward) setReward(s.reward);
        patchRaceSession({ screen: 'result' });
      } else {
        rewardApplied.current = true;
        const { reward, achievements } = settleRace(setup0, bets0, res);
        setReward(reward);
        setCutin(achievements);
        patchRaceSession({ rewardApplied: true, reward, screen: 'result' });
      }
      setScreen('result');
    } else {
      setScreen('race'); // still running — resume the animation from the anchor
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Menu ---
  if (screen === 'menu') {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>レース</h1>
        <p className={styles.lead}>コースはランダム。あつめたウマを走らせよう！</p>
        <button className={styles.modeCard} onClick={() => { setGrade('normal'); setPickMode(false); setMode(60); setScreen('setup'); }}>
          <span className={styles.modeEmoji}><Icon name="medal" size={30} /></span>
          <span className={styles.modeText}>
            <span className={styles.modeName}>ひとりでレース</span>
            <span className={styles.modeDesc}>8頭立て・2周・馬券あり・3位以内でメダル</span>
          </span>
          <span className={styles.modeGo}>▶</span>
        </button>
        <button className={styles.modeCard} onClick={() => { setGrade('normal'); setPickMode(true); setMode(60); setScreen('setup'); }}>
          <span className={styles.modeEmoji}><Icon name="flag" size={30} /></span>
          <span className={styles.modeText}>
            <span className={styles.modeName}>コースをえらぶ</span>
            <span className={styles.modeDesc}>好きなコースで練習（馬券なし）</span>
          </span>
          <span className={styles.modeGo}>▶</span>
        </button>
        <button className={styles.modeCard} onClick={() => { setGrade('gp'); setPickMode(false); setScreen('setup'); }}>
          <span className={styles.modeEmoji}><Icon name="trophy" size={30} /></span>
          <span className={styles.modeText}>
            <span className={styles.modeName}>グランプリ</span>
            <span className={styles.modeDesc}>強敵ぞろい・3位以内でトロフィー＋育成アイテム</span>
          </span>
          <span className={styles.modeGo}>▶</span>
        </button>
        <button className={styles.modeCard} onClick={() => setScreen('arena')}>
          <span className={styles.modeEmoji}><Icon name="swords" size={30} /></span>
          <span className={styles.modeText}>
            <span className={styles.modeName}>たいせん</span>
            <span className={styles.modeDesc}>毎日の勝ち抜きトーナメント・優勝で1万コイン</span>
          </span>
          <span className={styles.modeGo}>▶</span>
        </button>
      </div>
    );
  }

  // --- Setup (horse + time; course is random) ---
  if (screen === 'setup') {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>{grade === 'gp' ? 'グランプリ' : 'ひとりでレース'}</h1>
        {horses.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyEmoji}><Icon name="horse" size={56} /></div>
            <p>走らせるウマがいません。</p>
            <button className="btn" onClick={() => navigate('/create')}>ウマをつくる</button>
          </div>
        ) : (
          <>
            <h2 className={styles.h2}>ウマをえらぶ</h2>
            <div className={styles.pickRow}>
              {horses.map((h) => (
                <button key={h.id} className={`${styles.pickCard} ${horseId === h.id ? styles.pickSel : ''}`} onClick={() => setHorseId(h.id)}>
                  <HorseView horse={h} size={78} />
                  <span className={styles.pickName}>{h.name}</span>
                  <span className={styles.pickStyle}>{RUN_STYLE_LABEL[styleFor(h.id, h.stats)]}</span>
                </button>
              ))}
            </div>
            {grade === 'gp' ? (
              <>
                <h2 className={styles.h2}>レース時間</h2>
                <div className={styles.modeSwitch}>
                  {([30, 60] as const).map((m) => (
                    <button key={m} className={`${styles.modeBtn} ${mode === m ? styles.modeBtnSel : ''}`} onClick={() => setMode(m)}>
                      {m}秒{m === 60 ? '（報酬1.5倍）' : ''}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className={styles.h2}>2周のコースで走ります</p>
            )}
            <div className={styles.setupActions}>
              <button className="btn neutral" onClick={() => setScreen('menu')}>もどる</button>
              <button
                className="btn"
                onClick={() => (grade === 'gp' ? setScreen('gp') : pickMode ? setScreen('course') : begin())}
                disabled={!player}
              >
                {player ? 'スタート' : 'ウマをえらんでね'}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // --- Course select (chosen-course mode, no betting) ---
  if (screen === 'course') {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>コースをえらぶ</h1>
        <p className={styles.lead}>好きなコースで走ろう（馬券なし・{mode}秒）。</p>
        {COURSES.map((c) => (
          <button key={c.id} className={styles.modeCard} onClick={() => begin(c)}>
            <span className={styles.modeEmoji}><Icon name="flag" size={26} /></span>
            <span className={styles.modeText}>
              <span className={styles.modeName}>{c.name}</span>
              <span className={styles.modeDesc}>路面: {surfaceLabel(c.surface)}</span>
            </span>
            <span className={styles.modeGo}>▶</span>
          </button>
        ))}
        <button className={styles.exitLink} onClick={() => setScreen('setup')}>もどる</button>
      </div>
    );
  }

  // --- Grand prix (its own multi-stage flow) ---
  if (screen === 'gp' && player) {
    return <GrandPrix player={player} mode={mode} onExit={() => setScreen('menu')} />;
  }

  // --- 対戦（デイリー勝ち抜きトーナメント。自前でウマ選択するので player 不要） ---
  if (screen === 'arena') {
    return <Arena onExit={() => setScreen('menu')} />;
  }

  // --- Roulette ---
  if (screen === 'roulette' && setup && player) {
    return (
      <div className={styles.page}>
        <Roulette course={setup.course} player={player} reduced={reduced} onDone={() => setScreen('paddock')} />
      </div>
    );
  }

  // --- Paddock: betting (RACE_V4 §4 / 改修①) ---
  if (screen === 'paddock' && setup && player) {
    if (!odds) {
      return (
        <div className={styles.page}>
          <div className={styles.oddsLoading}>
            <div className={styles.oddsSpinner} aria-hidden />
            <p className={styles.oddsLoadingText}>オッズを計算中…</p>
            <div className={styles.oddsBar}><div className={styles.oddsBarFill} style={{ width: `${Math.round(oddsPct * 100)}%` }} /></div>
            <p className={styles.oddsLoadingSub}>本番と同じレースを何度も試して、実際の勝率からオッズを算出しています</p>
          </div>
        </div>
      );
    }
    return (
      <div className={styles.page}>
        <Paddock
          entrants={setup.entrants}
          looks={setup.looks}
          course={setup.course}
          coins={coins}
          bets={bets}
          probs={odds}
          moods={setup.moods}
          onAdd={(b) => { if (bets.length >= MAX_BETS_PER_RACE) return; if (spendCoins(b.amount)) setBets((prev) => [...prev, b]); }}
          onRemove={(i) => { addCoins(bets[i].amount); setBets((prev) => prev.filter((_, k) => k !== i)); }}
          onStart={() => { openRaceSession(setup, bets, false); setScreen('race'); }}
        />
      </div>
    );
  }

  // --- Race ---
  if (screen === 'race' && setup) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>
          <span className={styles.courseDot} style={{ background: setup.course.ground }} aria-hidden /> {setup.course.name}
        </h1>
        <RaceTrack2
          entrants={setup.entrants}
          looks={setup.looks}
          course={setup.course}
          mode={setup.mode}
          seed={setup.seed}
          reduced={reduced}
          skippable
          bets={bets}
          moods={moodMultipliers(setup.moods)}
          anchorMs={raceSession?.anchorMs ?? undefined}
          onFinish={onFinish}
        />
      </div>
    );
  }

  // --- Result ---
  if (screen === 'result' && setup && result) {
    const order = result.order.map((idx, place) => ({ idx, rank: place + 1, time: result.finishTimes[idx] }));
    const playerRank = reward?.rank ?? result.ranks[0];
    return (
      <div className={styles.page}>
        <div className={styles.resultCard}>
          <h2 className={styles.resultTitle}>{playerRank === 1 ? (<><Icon name="medal" size={22} /> ゆうしょう！</>) : `${playerRank}位`}</h2>
          {reward && reward.awarded.length > 0 && (
            <div className={styles.badgeReward}>
              {reward.awarded.map((b, i) => (
                <div key={i} className={styles.badgeGot}>
                  <BadgeIcon id={b.id} size={40} />
                  <span>{BADGES[b.id as keyof typeof BADGES]?.name}</span>
                </div>
              ))}
            </div>
          )}
          {reward && (
            <div className={`${styles.coinReward} ${reduced ? '' : styles.coinPop}`}>
              <span className={styles.coinGot}><CoinIcon size={22} /> 賞金 ＋{reward.earned}</span>
            </div>
          )}
          <BetResult entrants={setup.entrants} gate={result.gate} order={result.order} bets={bets} course={setup.course} probs={odds ?? undefined} />
          <ol className={styles.ranking}>
            {order.map(({ idx, rank, time }) => {
              const rc = rankColor(rank, setup.entrants.length);
              const e = setup.entrants[idx];
              return (
                <li key={idx} className={`${styles.rankRow} ${e.isPlayer ? styles.rankMe : ''}`}>
                  <span className={styles.rankNo} style={{ background: rc.bg, borderColor: rc.bd, color: rc.fg }}>{rank}</span>
                  <div className={styles.rankHorse}><HorseView horse={setup.looks[e.horseId]} size={36} /></div>
                  <span className={styles.rankName}>{e.isPlayer ? 'あなた' : e.name} <span className={styles.rankStyle}>{RUN_STYLE_LABEL[e.style]}</span></span>
                  <span className={styles.rankTime}>{Number.isFinite(time) ? time.toFixed(1) + 's' : '-'}</span>
                </li>
              );
            })}
          </ol>
          <div className={styles.raceActions}>
            <button className="btn neutral" onClick={() => { setRaceSession(null); setScreen('setup'); }}>ウマ・時間をかえる</button>
            <button className="btn" onClick={() => (pickMode && setup ? begin(setup.course) : begin())}>もう一回</button>
          </div>
          <button className={styles.exitLink} onClick={() => { setRaceSession(null); setScreen('menu'); }}>モードせんたくへ</button>
        </div>
        {cutin.length > 0 && <BadgeCutin badges={cutin} onDone={() => setCutin([])} />}
      </div>
    );
  }

  return null;
}
