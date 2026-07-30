import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { teamHorses } from '../logic/farm';
import { skillOf } from '../logic/skill';
import { aptitudeOf } from '../logic/aptitude';
import { TEAM_SIZE } from '../data/coins';
import type { Horse, HorseLook, Badge, Stats } from '../types';
import { RUN_STYLE_LABEL, STAT_KEYS } from '../types';
import HorseView from '../components/HorseView';
import BadgeIcon from '../components/BadgeIcon';
import CoinIcon from '../components/CoinIcon';
import Icon from '../components/Icon';
import RaceTrack2 from '../components/RaceTrack2';
import CourseScene, { SceneDefs, courseTheme, THEME_LABEL } from '../components/CourseScene';
import GrandPrix from './GrandPrix';
import Arena from './Arena';
import { settle, type Bet } from '../logic/betting';
import { isStreakWin } from '../logic/streak';
import { mcWinProbsAsync } from '../logic/odds';
import { winProbs } from '../logic/grandprix';
import { assignMoods, moodMultipliers, type MoodLevel } from '../logic/mood';
import Paddock from '../components/Paddock';
import BetResult from '../components/BetResult';
import HorseStatsPopup from '../components/HorseStatsPopup';
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
  laps: number; // 周回数（1/2/3）。倍率計算・レース・再開のすべてで同じ値を使う
  seed: number;
  entrants: Entrant[];
  looks: Record<string, HorseLook>;
  grade: 'normal' | 'gp';
  moods: MoodLevel[]; // per-entrant mood for this race (shown + folded into perf)
};

// Rebuild the exact single-race field from its seed (改修：レース継続). Mirrors the
// generation in begin() so a resumed race is byte-for-byte identical. When the
// course was chosen (pickMode), pass it so the RNG isn't consumed for the draw.
// `chosenLaps` を渡さないとき（1人でレース）は、コースと同じ抽選で周回数も決める。
// seed から決まるので、中断して戻ってきても同じレースが再現される。
function buildSingleSetup(seed: number, player: Horse, mode: 30 | 60, chosenLaps?: number, chosenCourse?: Course): RaceSetup {
  const rng = mulberry32(seed ^ 0x77);
  const course = chosenCourse ?? COURSES[Math.floor(rng() * COURSES.length)];
  const laps = chosenLaps ?? LAP_CHOICES[Math.floor(rng() * LAP_CHOICES.length)];
  const pt = statTotal(player.stats);
  const band: [number, number] = [Math.max(34, pt - 4), Math.min(48, pt + 4)];
  const looks: Record<string, HorseLook> = { [player.id]: player };
  const entrants: Entrant[] = [
    {
      horseId: player.id, name: player.name, isPlayer: true, stats: player.stats,
      style: styleFor(player.id, player.stats),
      // 固有スキルと、このコースの適性をレースに持ち込む（＝倍率にも反映される）
      skill: skillOf(player).id,
      apt: aptitudeOf(player)[course.id],
    },
  ];
  const avoidBody = colorById[player.colors.body]?.value;
  for (let i = 0; i < 7; i++) {
    const cpu = makeCpu(`cpu${i}`, rng, band, 0.5, undefined, avoidBody);
    entrants.push(cpu.entrant);
    looks[cpu.entrant.horseId] = cpu.look;
  }
  const moods = assignMoods(winProbs(entrants, course), seed);
  return { course, mode, laps, seed, entrants, looks, grade: 'normal', moods };
}

// Wall-clock ms at which a race's playback is fully over (past the cool-down), so a
// long-absent player returning lands straight on the result. Mirrors RaceTrack2.
function raceDoneAt(anchorMs: number, durationS: number, reduced: boolean): number {
  const speed = reduced ? 4 : 1;
  const cdMs = (reduced ? 220 : 700) * 3;
  const linger = reduced ? 0.2 : 2.2;
  return anchorMs + cdMs + ((durationS + linger) / speed) * 1000;
}

// レースの周回数。1人でレースではコースと同じく抽選で決まる。
// 「コースを選ぶ」（練習）だけは自分で選べる。
export const LAP_CHOICES = [1, 2, 3] as const;

function surfaceLabel(s: string): string {
  return { turf: '芝', dirt: 'ダート', sand: '砂', steeple: '障害', circuit: 'ナイター', trail: '山道' }[s] ?? s;
}

// うまとコースの相性を ◎/○/△ に色分けして返す。
function aptitudeInfo(stats: Stats, c: Course): { mark: string; text: string; tone: 'good' | 'ok' | 'bad' } {
  const base = STAT_KEYS.reduce((n, k) => n + stats[k], 0);
  const w = STAT_KEYS.reduce((n, k) => n + stats[k] * c.weights[k], 0);
  const r = w / Math.max(1, base);
  if (r > 1.05) return { mark: '◎', text: 'この子にピッタリの得意コース！', tone: 'good' };
  if (r > 0.99) return { mark: '○', text: 'まずまず走れそう', tone: 'ok' };
  if (r > 0.95) return { mark: '○', text: '標準的なコース', tone: 'ok' };
  return { mark: '△', text: 'ちょっと苦手なコースかも…', tone: 'bad' };
}

// 路面別の一枚絵タイル（抽選リール／結果で共用）。
function CourseTile({ course }: { course: Course }) {
  return (
    <div className={styles.tile}>
      <div className={styles.tileArt}>
        <svg className={styles.tileSvg} viewBox="0 0 220 140" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <CourseScene theme={courseTheme(course)} />
        </svg>
        <span className={styles.tileBadge}>{THEME_LABEL[courseTheme(course)]}</span>
      </div>
      <div className={styles.tileName}>{course.name}</div>
    </div>
  );
}

// ---- Course reveal roulette (RACE_V2 §10) — スロット風リール ------------------
const TILE_W = 176; // px（タイル幅）
const TILE_GAP = 10;
const STEP = TILE_W + TILE_GAP;
const REEL_LOOPS = 6; // 6周ぶんのタイルを流す
const SPIN_MS = 3200; // 決まるまで（<5秒）

function Roulette({ course, laps, player, reduced, onDone }: { course: Course; laps: number; player: Horse; reduced: boolean; onDone: () => void }) {
  const winRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [go, setGo] = useState(false);
  const [stopped, setStopped] = useState(reduced);

  const chosenIdx = COURSES.indexOf(course);
  const reel = useMemo(
    () => Array.from({ length: REEL_LOOPS * COURSES.length }, (_, i) => COURSES[i % COURSES.length]),
    [],
  );
  const startIdx = chosenIdx; // 最初の周
  const finalIdx = (REEL_LOOPS - 1) * COURSES.length + chosenIdx; // 最後の周（当たり）
  const offsetOf = (idx: number) => w / 2 - (idx * STEP + TILE_W / 2);

  useLayoutEffect(() => {
    setW(winRef.current?.clientWidth ?? 320);
  }, []);
  useEffect(() => {
    if (reduced || w === 0) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)));
    return () => cancelAnimationFrame(id);
  }, [reduced, w]);

  const apt = aptitudeInfo(player.stats, course);
  const tx = reduced ? offsetOf(finalIdx) : go ? offsetOf(finalIdx) : offsetOf(startIdx);

  return (
    <div className={styles.rouletteWrap} onClick={stopped ? onDone : undefined}>
      <SceneDefs />
      <div className={styles.slotTitle}>{stopped ? '本日のコース' : 'コース抽選中…'}</div>

      <div className={`${styles.slotWindow} ${stopped ? styles.slotWindowStop : ''}`} ref={winRef}>
        <div className={styles.pointer} aria-hidden>▼</div>
        <div
          className={styles.reel}
          style={{ transform: `translateX(${tx}px)`, transition: go && !reduced ? `transform ${SPIN_MS}ms cubic-bezier(0.09, 0.62, 0.16, 1)` : 'none' }}
          onTransitionEnd={() => setStopped(true)}
        >
          {reel.map((c, i) => (
            <div className={styles.reelCell} key={i} style={{ width: TILE_W }}>
              <CourseTile course={c} />
            </div>
          ))}
        </div>
        <div className={styles.fadeL} aria-hidden />
        <div className={styles.fadeR} aria-hidden />
        {stopped && (
          <div className={styles.centerFrame} aria-hidden>
            {['✨', '✨', '✨', '✨'].map((s, i) => <span key={i} className={styles[`spark${i}` as 'spark0']}>{s}</span>)}
          </div>
        )}
      </div>

      {stopped && (
        <div className={`${styles.result} ${reduced ? '' : styles.resultIn}`}>
          <div className={styles.resultChips}>
            <span className={styles.chipSurface}>{THEME_LABEL[courseTheme(course)]}コース</span>
            {/* 周回数もコースと一緒に抽選される */}
            <span className={styles.chipLaps}>{laps}周</span>
            <span className={`${styles.chipApt} ${styles[`apt_${apt.tone}` as 'apt_good']}`}>{apt.text} {apt.mark}</span>
          </div>
          <div className={styles.resultDesc}>{course.desc}</div>
          <button className={styles.resultBtn} onClick={onDone}>タップで進む ▶</button>
        </div>
      )}
    </div>
  );
}

// ---- main ---------------------------------------------------------------------
export default function Race() {
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();
  const allHorses = useStore((s) => s.horses);
  const team = useStore((s) => s.team);
  // 出走できるのはチームの6頭だけ（個体値厳選アップデート）。
  const horses = useMemo(() => teamHorses(allHorses, team, TEAM_SIZE), [allHorses, team]);
  const coins = useStore((s) => s.coins);
  const finishNormalRace = useStore((s) => s.finishNormalRace);
  const addCoins = useStore((s) => s.addCoins);
  const spendCoins = useStore((s) => s.spendCoins);
  const recordBet = useStore((s) => s.recordBet);
  const finishRaceTask = useStore((s) => s.finishRaceTask);
  const recordBetStats = useStore((s) => s.recordBetStats);
  const recordSoloStreak = useStore((s) => s.recordSoloStreak);
  const raceSession = useStore((s) => s.raceSession);
  const setRaceSession = useStore((s) => s.setRaceSession);
  const patchRaceSession = useStore((s) => s.patchRaceSession);
  const setRaceBusy = useStore((s) => s.setRaceBusy);

  const [screen, setScreen] = useState<'menu' | 'setup' | 'course' | 'gp' | 'arena' | 'roulette' | 'paddock' | 'race' | 'result'>('menu');
  const [grade, setGrade] = useState<'normal' | 'gp'>('normal');
  const [pickMode, setPickMode] = useState(false); // choose course, no betting
  const [horseId, setHorseId] = useState<string | null>(null);
  const [mode, setMode] = useState<30 | 60>(30);
  const [laps, setLaps] = useState<number>(2); // 1人でレースの周回数（1/2/3）
  const [setup, setSetup] = useState<RaceSetup | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [reward, setReward] = useState<{ rank: number; awarded: Badge[]; earned: number; payout: number } | null>(null);
  const [cutin, setCutin] = useState<Badge[]>([]); // achievement badges to celebrate
  const [bets, setBets] = useState<Bet[]>([]); // the placed bets (empty = no bet)
  const [odds, setOdds] = useState<number[] | null>(null); // Monte-Carlo win probs for the paddock
  const [oddsPct, setOddsPct] = useState(0); // odds-calc progress 0..1
  const [resultStats, setResultStats] = useState<number | null>(null); // 払戻画面で能力を見ているウマ
  const rewardApplied = useRef(false);

  // 出走中のウマは所持ウマ全体から解決する（レース中にチームを編成し直しても壊れない）。
  // 「ウマを選ぶ」の一覧だけがチーム限定（horses）。
  const player = allHorses.find((h) => h.id === horseId) ?? null;

  // パドックに入ってから結果を見るまでは、賭け金を預けている状態。ここで他のタブへ
  // 移動されるとコインだけ減って馬券が消えるので、タブ移動を止める。
  // ロックするのはコインを預ける「1人でレース」の賭け導線と「グランプリ」だけ。
  // 対戦（arena）とコースを選ぶレース（pickMode）は馬券が絡まないので、
  // レース中でも他のタブへ自由に移動できる。
  const busy =
    screen === 'paddock' ||
    screen === 'roulette' ||
    screen === 'gp' ||
    (screen === 'race' && !pickMode);
  useEffect(() => {
    setRaceBusy(busy);
    return () => setRaceBusy(false);
  }, [busy, setRaceBusy]);

  // 画面が切り替わったら本文を一番上に戻す。たくさん賭けて伝票が伸びていると、
  // そのままの位置ではレース画面が見えないまま始まってしまうため。
  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'auto' });
  }, [screen]);

  // Price the race off the *real* simulation: run it many times and read the actual
  // win rates, so the odds match the true chances (RACE §odds整合性). Kicked off as
  // soon as the field is set (during the roulette) so it's usually ready by the paddock.
  useEffect(() => {
    if (!setup || pickMode || setup.grade === 'gp') return; // only the betting single race uses this
    let alive = true;
    setOdds(null);
    setOddsPct(0);
    mcWinProbsAsync(setup.entrants, setup.course, setup.mode, {
      laps: setup.laps,
      moods: moodMultipliers(setup.moods),
      onProgress: (f) => { if (alive) setOddsPct(f); },
    }).then((p) => { if (alive) setOdds(p); });
    return () => { alive = false; };
  }, [setup, pickMode]);

  function begin(chosenCourse?: Course) {
    if (!player) return;
    setRaceSession(null); // drop any previous (finished/abandoned) session
    const seed = (Math.random() * 2 ** 31) >>> 0;
    // 賭けありの1人でレースは抽選任せ。コースを選ぶ練習だけ選んだ周回数を使う。
    const setup0 = buildSingleSetup(seed, player, mode, chosenCourse ? laps : undefined, chosenCourse);
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
      laps: setup0.laps,
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
    // スペシャルタスク（連勝チャレンジ）：馬券を賭けた1人でレースのみ対象。払戻が賭け金の
    // 1.5倍以上で連勝を1つ伸ばし、そうでなければ連勝リセット。レースは開始時に確定(seed)＆
    // セッション保持なので、タブを離れても結果は変わらず連勝を稼ぎ直せない。
    if (betList.length > 0) recordSoloStreak(isStreakWin(payout, staked));
    if (ENABLE_RANKING && (bestWonOdds > 0 || payout > 0)) submitBestOdds(bestWonOdds, setup0.course.id, payout);
    bufferSubmission(buildSubmission(setup0.entrants, setup0.course.id, setup0.mode, setup0.seed, res, setup0.entrants[0].horseId, setup0.laps));
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
      // 再開時は所持ウマ全体から探す（チーム編成を変えても進行中のレースを捨てない）。
      const horse = allHorses.find((h) => h.id === s.player.id);
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
    const setup0 = buildSingleSetup(s.seed, s.player, s.mode, s.laps, s.pickMode ? course : undefined);
    const bets0 = s.bets as unknown as Bet[];
    setHorseId(s.player.id);
    setPickMode(s.pickMode);
    setMode(s.mode);
    setLaps(s.laps ?? 2);
    setGrade('normal');
    setSetup(setup0);
    setBets(bets0);
    rewardApplied.current = s.rewardApplied;
    const res = simulate2(setup0.entrants, setup0.course, setup0.mode, setup0.seed, { recordFrames: true, laps: setup0.laps, moods: setup0.moods });
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
        <p className={styles.lead}>育てたウマを走らせよう！</p>
        <button className={styles.modeCard} onClick={() => { setGrade('normal'); setPickMode(false); setMode(60); setScreen('setup'); }}>
          <span className={styles.modeEmoji}><Icon name="medal" size={30} /></span>
          <span className={styles.modeText}>
            <span className={styles.modeName}>一人でレース</span>
            <span className={styles.modeDesc}>8頭立て・2周・馬券あり・3位以内でメダル</span>
          </span>
          <span className={styles.modeGo}>▶</span>
        </button>
        <button className={styles.modeCard} onClick={() => { setGrade('normal'); setPickMode(true); setMode(60); setScreen('setup'); }}>
          <span className={styles.modeEmoji}><Icon name="flag" size={30} /></span>
          <span className={styles.modeText}>
            <span className={styles.modeName}>コースを選ぶ</span>
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
            <span className={styles.modeName}>対戦</span>
            <span className={styles.modeDesc}>毎日の勝ち抜きトーナメント・優勝で1.2万コイン</span>
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
        <h1 className={styles.title}>{grade === 'gp' ? 'グランプリ' : '一人でレース'}</h1>
        {horses.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyEmoji}><Icon name="horse" size={56} /></div>
            {allHorses.length === 0 ? (
              <>
                <p>走らせるウマがいません。</p>
                <button className="btn" onClick={() => navigate('/')}>草むらへ</button>
              </>
            ) : (
              <>
                <p>チームにウマがいません。</p>
                <p className={styles.emptySub}>レースに出られるのはチームのウマだけです。マイウマでチームに入れてね。</p>
                <button className="btn" onClick={() => navigate('/stable')}>チームを編成する</button>
              </>
            )}
          </div>
        ) : (
          <>
            <h2 className={styles.h2}>ウマを選ぶ（チーム）</h2>
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
            ) : pickMode ? (
              <>
                {/* 練習は自分で選ぶ。どれも1周を走り終えたらスキップできる。 */}
                <h2 className={styles.h2}>レースの長さ</h2>
                <div className={styles.modeSwitch}>
                  {LAP_CHOICES.map((l) => (
                    <button
                      key={l}
                      className={`${styles.modeBtn} ${laps === l ? styles.modeBtnSel : ''}`}
                      onClick={() => setLaps(l)}
                    >
                      {l}周
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className={styles.h2}>コースと周回数は抽選で決まります</p>
            )}
            <div className={styles.setupActions}>
              <button className="btn neutral" onClick={() => setScreen('menu')}>戻る</button>
              <button
                className="btn"
                onClick={() => (grade === 'gp' ? setScreen('gp') : pickMode ? setScreen('course') : begin())}
                disabled={!player}
              >
                {player ? 'スタート' : 'ウマを選んでね'}
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
        <h1 className={styles.title}>コースを選ぶ</h1>
        <p className={styles.lead}>好きなコースで走ろう（馬券なし・{laps}周）。</p>
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
        <button className={styles.exitLink} onClick={() => setScreen('setup')}>戻る</button>
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
        <Roulette course={setup.course} laps={setup.laps} player={player} reduced={reduced} onDone={() => setScreen('paddock')} />
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
          laps={setup.laps}
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
          laps={setup.laps}
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
    const staked = bets.reduce((s, b) => s + b.amount, 0);
    const betPayout = bets.reduce((s, b) => s + settle(b, result.order), 0);
    const betNet = betPayout - staked;
    return (
      <div className={styles.page}>
        <div className={styles.resultCard}>
          <h2 className={styles.resultTitle}>{playerRank === 1 ? (<><Icon name="medal" size={22} /> 優勝！</>) : `${playerRank}位`}</h2>
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
          {/* 賞金＋馬券収支をコンパクトに（ぱっと確認）*/}
          <div className={`${styles.resultSummary} ${reduced ? '' : styles.coinPop}`}>
            {reward && <span className={styles.coinGot}><CoinIcon size={20} /> 賞金 ＋{reward.earned}</span>}
            {bets.length > 0 && (
              <span className={`${styles.betNet} ${betNet >= 0 ? styles.betPlus : styles.betMinus}`}>
                馬券 {betNet >= 0 ? '＋' : '−'}{Math.abs(betNet).toLocaleString()}
              </span>
            )}
          </div>
          {/* スクロール不要ですぐ次の動作へ */}
          <div className={styles.resultActions}>
            <button className="btn" onClick={() => (pickMode && setup ? begin(setup.course) : begin())}>もう一回</button>
            <button className="btn neutral" onClick={() => { setRaceSession(null); setScreen('menu'); }}>モードせんたくへ</button>
          </div>
          <button className={styles.exitLink} onClick={() => { setRaceSession(null); setScreen('setup'); }}>ウマ・時間を変える</button>
          {/* くわしい払戻・着順は下に */}
          <BetResult entrants={setup.entrants} gate={result.gate} order={result.order} bets={bets} course={setup.course} probs={odds ?? undefined} laps={setup.laps} />
          <ol className={styles.ranking}>
            {order.map(({ idx, rank, time }) => {
              const rc = rankColor(rank, setup.entrants.length);
              const e = setup.entrants[idx];
              return (
                <li key={idx} className={`${styles.rankRow} ${e.isPlayer ? styles.rankMe : ''}`}>
                  <span className={styles.rankNo} style={{ background: rc.bg, borderColor: rc.bd, color: rc.fg }}>{rank}</span>
                  {/* ウマをタップ → 能力ポップアップ（レース中の順位カードと同じもの） */}
                  <button
                    className={styles.rankHorse}
                    onClick={() => setResultStats(idx)}
                    aria-label={`${e.isPlayer ? 'あなた' : e.name}の能力を見る`}
                  >
                    <HorseView horse={setup.looks[e.horseId]} size={36} />
                  </button>
                  <span className={styles.rankName}>{e.isPlayer ? 'あなた' : e.name} <span className={styles.rankStyle}>{RUN_STYLE_LABEL[e.style]}</span></span>
                  <span className={styles.rankTime}>{Number.isFinite(time) ? time.toFixed(1) + 's' : '-'}</span>
                </li>
              );
            })}
          </ol>
        </div>
        {resultStats !== null && setup.entrants[resultStats] && (
          <HorseStatsPopup
            entrant={setup.entrants[resultStats]}
            gate={result.gate[resultStats]}
            onClose={() => setResultStats(null)}
          />
        )}
        {cutin.length > 0 && <BadgeCutin badges={cutin} onDone={() => setCutin([])} />}
      </div>
    );
  }

  return null;
}
