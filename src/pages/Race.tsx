import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useAuth, submitBetScore } from '../cloud';
import { ENABLE_RANKING } from '../config';
import { COURSES, type Course } from '../data/courses';
import { type Entrant, type SimResult } from '../logic/raceSim2';
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
import { settle, type Bet } from '../logic/betting';
import Paddock from '../components/Paddock';
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
};

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

  const [screen, setScreen] = useState<'menu' | 'setup' | 'gp' | 'roulette' | 'paddock' | 'race' | 'result'>('menu');
  const [grade, setGrade] = useState<'normal' | 'gp'>('normal');
  const [horseId, setHorseId] = useState<string | null>(null);
  const [mode, setMode] = useState<30 | 60>(30);
  const [setup, setSetup] = useState<RaceSetup | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [reward, setReward] = useState<{ rank: number; awarded: Badge[]; earned: number; payout: number } | null>(null);
  const [cutin, setCutin] = useState<Badge[]>([]); // achievement badges to celebrate
  const [bets, setBets] = useState<Bet[]>([]); // the placed bets (empty = no bet)
  const rewardApplied = useRef(false);

  const player = horses.find((h) => h.id === horseId) ?? null;

  function begin() {
    if (!player) return;
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const rng = mulberry32(seed ^ 0x77);
    const course = COURSES[Math.floor(rng() * COURSES.length)];
    // Keep CPUs within ±4 of the player's total so single races stay close
    // (RACE_V3 §3.5, user preference: 接戦に寄せる).
    const pt = statTotal(player.stats);
    const band: [number, number] = [Math.max(34, pt - 4), Math.min(48, pt + 4)];
    const looks: Record<string, HorseLook> = { [player.id]: player };
    const entrants: Entrant[] = [
      { horseId: player.id, name: player.name, isPlayer: true, stats: player.stats, style: styleFor(player.id, player.stats) },
    ];
    const avoidBody = colorById[player.colors.body]?.value;
    for (let i = 0; i < 7; i++) {
      const cpu = makeCpu(`cpu${i}`, rng, band, grade === 'gp' ? 0.8 : 0.5, undefined, avoidBody);
      entrants.push(cpu.entrant);
      looks[cpu.entrant.horseId] = cpu.look;
    }
    setSetup({ course, mode, seed, entrants, looks, grade });
    rewardApplied.current = false;
    setReward(null);
    setBets([]);
    setScreen('roulette');
  }

  function onFinish(result: SimResult) {
    setResult(result);
    if (!setup || rewardApplied.current) {
      setScreen('result');
      return;
    }
    rewardApplied.current = true;
    const rank = result.ranks[0]; // player is entrant 0
    const flawless = !result.frames.some((f) => f.runners[0]?.state === 'stumble');
    const awarded = finishNormalRace({
      horseId: setup.entrants[0].horseId,
      courseId: setup.course.id,
      mode: setup.mode,
      rank,
      time: result.finishTimes[0],
      isJumpCourse: setup.course.surface === 'steeple',
      flawless,
    });
    // Coins (RACE_V4 §4): placing reward + a bonus per achievement badge, then
    // settle the win bet (stake was already taken when it was placed).
    const achievements = awarded.filter((b) => !BADGES[b.id as keyof typeof BADGES]?.placing);
    const earned = normalRaceCoins(rank) + achievements.length * BADGE_COINS;
    // Settle every bet against the finishing order and sum the payouts.
    let payout = 0;
    let bestWonOdds = 0;
    for (const b of bets) {
      const got = settle(b, result.order);
      payout += got;
      if (got > 0) bestWonOdds = Math.max(bestWonOdds, b.odds);
      recordBet({
        courseId: setup.course.id,
        kind: b.kind,
        picks: b.sel.map((i) => result.gate[i]),
        amount: b.amount,
        odds: b.odds,
        won: got > 0,
        payout: got,
        at: Date.now(),
      });
    }
    addCoins(earned + payout);
    // Ranking (改修④): submit the best winning odds; the server keeps each
    // account's max. Best-effort — no-op when signed out or the DB isn't set up.
    if (ENABLE_RANKING && bestWonOdds > 0) {
      const name = useAuth.getState().displayName;
      if (useAuth.getState().user && name) {
        // Include the player's avatar horse so it shows next to their ranking row.
        const st = useStore.getState();
        const av = st.avatarHorseId ? st.horses.find((h) => h.id === st.avatarHorseId) : st.horses[0];
        submitBetScore(bestWonOdds, setup.course.id, name, av ? { colors: av.colors, decos: av.decos } : null);
      }
    }
    setReward({ rank, awarded, earned, payout });
    setCutin(achievements); // cut-in only for achievement badges (placing are everyday)
    // Ranking foundation (RACE_V4 §5): buffer a verifiable submission locally.
    // Nothing is uploaded while ENABLE_RANKING is off.
    bufferSubmission(
      buildSubmission(setup.entrants, setup.course.id, setup.mode, setup.seed, result, setup.entrants[0].horseId),
    );
    setScreen('result');
  }

  // --- Menu ---
  if (screen === 'menu') {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>レース</h1>
        <p className={styles.lead}>コースはランダム。あつめたウマを走らせよう！</p>
        <button className={styles.modeCard} onClick={() => { setGrade('normal'); setScreen('setup'); }}>
          <span className={styles.modeEmoji}><Icon name="medal" size={30} /></span>
          <span className={styles.modeText}>
            <span className={styles.modeName}>ひとりでレース</span>
            <span className={styles.modeDesc}>8頭立て・3位以内でメダル</span>
          </span>
          <span className={styles.modeGo}>▶</span>
        </button>
        <button className={styles.modeCard} onClick={() => { setGrade('gp'); setScreen('setup'); }}>
          <span className={styles.modeEmoji}><Icon name="trophy" size={30} /></span>
          <span className={styles.modeText}>
            <span className={styles.modeName}>グランプリ</span>
            <span className={styles.modeDesc}>強敵ぞろい・3位以内でトロフィー＋育成アイテム</span>
          </span>
          <span className={styles.modeGo}>▶</span>
        </button>
        <div className={`${styles.modeCard} ${styles.modeLocked}`} aria-disabled>
          <span className={styles.modeEmoji}><Icon name="swords" size={30} /></span>
          <span className={styles.modeText}>
            <span className={styles.modeName}>たいせん</span>
            <span className={styles.modeDesc}>ともだちと対戦</span>
          </span>
          <span className={styles.soon}>準備中</span>
        </div>
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
            <h2 className={styles.h2}>レース時間</h2>
            <div className={styles.modeSwitch}>
              {([30, 60] as const).map((m) => (
                <button key={m} className={`${styles.modeBtn} ${mode === m ? styles.modeBtnSel : ''}`} onClick={() => setMode(m)}>
                  {m}秒{m === 60 && grade === 'gp' ? '（報酬1.5倍）' : ''}{m === 30 ? '（約1周）' : '（約2周）'}
                </button>
              ))}
            </div>
            <div className={styles.setupActions}>
              <button className="btn neutral" onClick={() => setScreen('menu')}>もどる</button>
              <button
                className="btn"
                onClick={() => (grade === 'gp' ? setScreen('gp') : begin())}
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

  // --- Grand prix (its own multi-stage flow) ---
  if (screen === 'gp' && player) {
    return <GrandPrix player={player} mode={mode} onExit={() => setScreen('menu')} />;
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
    return (
      <div className={styles.page}>
        <Paddock
          entrants={setup.entrants}
          looks={setup.looks}
          course={setup.course}
          coins={coins}
          bets={bets}
          onAdd={(b) => { if (bets.length >= MAX_BETS_PER_RACE) return; if (spendCoins(b.amount)) setBets((prev) => [...prev, b]); }}
          onRemove={(i) => { addCoins(bets[i].amount); setBets((prev) => prev.filter((_, k) => k !== i)); }}
          onStart={() => setScreen('race')}
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
              <span className={styles.coinGot}><CoinIcon size={22} /> ＋{reward.earned}</span>
              {bets.length > 0 && (
                <span className={reward.payout > 0 ? styles.betHit : styles.betMiss}>
                  {reward.payout > 0
                    ? `馬券的中！ 払戻 ＋${reward.payout}`
                    : `馬券ハズレ… −${bets.reduce((s, b) => s + b.amount, 0)}`}
                </span>
              )}
            </div>
          )}
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
            <button className="btn neutral" onClick={() => setScreen('setup')}>ウマ・時間をかえる</button>
            <button className="btn" onClick={begin}>もう一回</button>
          </div>
          <button className={styles.exitLink} onClick={() => setScreen('menu')}>モードせんたくへ</button>
        </div>
        {cutin.length > 0 && <BadgeCutin badges={cutin} onDone={() => setCutin([])} />}
      </div>
    );
  }

  return null;
}
