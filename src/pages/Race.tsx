import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { COURSES, courseById, courseDistance, type Course } from '../data/courses';
import { colorsBySlot, decosBySlot, DECO_SLOTS } from '../data/parts';
import { simulate, type Entrant, type SimResult } from '../logic/raceSim';
import { rollStatsTotal, mulberry32 } from '../logic/stats';
import { makeTrophy, itemDropCount, rollItems } from '../logic/raceReward';
import type { Horse, DecoSlot, Trophy, TrainingItem } from '../types';
import { STAT_LABEL } from '../types';
import HorseView from '../components/HorseView';
import RaceHorse from '../components/RaceHorse';
import { usePrefersReducedMotion } from '../hooks';
import styles from './Race.module.css';

const CPU_NAMES = ['あらし号', 'かぜまる', 'いなずま', 'だいち', 'こまち', 'はやて', 'つむじ', 'くろがね', 'かみなり', 'そよかぜ'];
const HORSE_SIZE = 50;

function pick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}
function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function cpuHorse(id: string, name: string, rng: () => number, band: [number, number]): { horse: Horse; entrant: Entrant } {
  const decos: Partial<Record<DecoSlot, string>> = {};
  if (Math.random() < 0.5) {
    const slot = pick(DECO_SLOTS);
    decos[slot] = pick(decosBySlot[slot]).id;
  }
  const horse: Horse = {
    id,
    name,
    colors: { body: pick(colorsBySlot.body).id, mane: pick(colorsBySlot.mane).id, hoof: pick(colorsBySlot.hoof).id },
    decos,
    stats: rollStatsTotal(rng, band[0], band[1]),
    createdAt: 0,
  };
  return { horse, entrant: { horseId: id, name, isPlayer: false, stats: horse.stats } };
}

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

// ---------------------------------------------------------------------------

type RaceData = {
  result: SimResult;
  horses: Horse[]; // aligned to entrant index; index 0 = player
  course: Course;
  distance: number;
  mode: 30 | 60;
  grade: 'normal' | 'gp';
};

function Track({ data, onFinish }: { data: RaceData; onFinish: () => void }) {
  const reduced = usePrefersReducedMotion();
  const { result, horses, course, distance } = data;
  const [count, setCount] = useState(3); // 3,2,1,0(GO)
  const [running, setRunning] = useState(false);
  const elapsed = useRef(0);
  const [, force] = useState(0);
  const startRef = useRef(0);
  const prevRanks = useRef<number[]>(result.frames[0].runners.map((r) => r.rank));

  // Countdown then run.
  useEffect(() => {
    const step = reduced ? 250 : 800;
    const t = [
      window.setTimeout(() => setCount(2), step),
      window.setTimeout(() => setCount(1), step * 2),
      window.setTimeout(() => {
        setCount(0);
        setRunning(true);
      }, step * 3),
    ];
    return () => t.forEach(clearTimeout);
  }, [reduced]);

  useEffect(() => {
    if (!running) return;
    const speed = reduced ? 5 : 1;
    let raf = 0;
    const loop = (now: number) => {
      if (!startRef.current) startRef.current = now;
      elapsed.current = ((now - startRef.current) / 1000) * speed;
      if (elapsed.current >= result.duration) {
        elapsed.current = result.duration;
        force((x) => x + 1);
        window.setTimeout(onFinish, reduced ? 100 : 600);
        return;
      }
      force((x) => x + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, reduced, result.duration, onFinish]);

  // Sample the sim at the current time (interpolating position).
  const dt = result.dt;
  const fi = Math.min(Math.floor(elapsed.current / dt), result.frames.length - 1);
  const frame = result.frames[fi];
  const next = result.frames[Math.min(fi + 1, result.frames.length - 1)];
  const alpha = Math.min(1, Math.max(0, elapsed.current / dt - fi));

  const leaderPos = Math.max(...frame.runners.map((r) => r.pos));
  const progress = Math.min(1, leaderPos / distance);

  const ranks = frame.runners.map((r) => r.rank);
  useEffect(() => {
    prevRanks.current = ranks;
  });

  return (
    <div className={styles.raceWrap}>
      <div className={styles.hud}>
        <span className={styles.hudTime}>⏱ {elapsed.current.toFixed(1)}s</span>
        <div className={styles.hudBar}>
          <div className={styles.hudFill} style={{ width: `${progress * 100}%` }} />
        </div>
        <span className={styles.hudDist}>{Math.max(0, Math.round(distance - leaderPos))}m</span>
      </div>

      <div className={styles.trackFrame} style={{ background: course.ground }}>
        {result.frames[fi].runners.map((rf, i) => {
          const posM = rf.pos + (next.runners[i].pos - rf.pos) * alpha;
          const frac = Math.min(1, posM / distance);
          const rc = rankColor(rf.rank, horses.length);
          const isPlayer = i === 0;
          return (
            <div key={i} className={styles.lane}>
              <div className={styles.laneObjects} aria-hidden>
                {result.obstacles.map((o, k) => (
                  <span key={'o' + k} className={styles.obstacle} style={{ left: `${(o.pos / distance) * 100}%` }}>
                    {o.kind === 'rock' ? '🪨' : o.kind === 'water' ? '💧' : '🚧'}
                  </span>
                ))}
                {result.boosts.map((b, k) => (
                  <span key={'b' + k} className={styles.boostPanel} style={{ left: `${(b / distance) * 100}%` }}>
                    ⚡
                  </span>
                ))}
              </div>
              <div className={styles.finishLine} aria-hidden />
              <div
                className={styles.runner}
                style={{ left: `calc((100% - ${HORSE_SIZE}px) * ${frac})` }}
              >
                <span
                  key={rf.rank}
                  className={`${styles.rankBadge} ${isPlayer ? styles.rankBadgeMe : ''}`}
                  style={{ background: rc.bg, borderColor: rc.bd, color: rc.fg }}
                >
                  {rf.rank}
                </span>
                <RaceHorse horse={horses[i]} pos={posM} state={rf.state} size={HORSE_SIZE} reduced={reduced} />
                {isPlayer && <span className={styles.youTag}>あなた</span>}
              </div>
            </div>
          );
        })}

        {count > 0 && <div className={styles.countdown}>{count}</div>}
        {count === 0 && !running && <div className={styles.countdown}>GO!</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export default function Race() {
  const navigate = useNavigate();
  const horses = useStore((s) => s.horses);
  const addTrophies = useStore((s) => s.addTrophies);
  const grantItems = useStore((s) => s.grantItems);
  const recordRace = useStore((s) => s.recordRace);

  const [screen, setScreen] = useState<'menu' | 'setup' | 'race' | 'result'>('menu');
  const [grade, setGrade] = useState<'normal' | 'gp'>('normal');
  const [horseId, setHorseId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState('green');
  const [mode, setMode] = useState<30 | 60>(30);
  const [data, setData] = useState<RaceData | null>(null);
  const [reward, setReward] = useState<{ trophy: Trophy | null; items: TrainingItem[]; rank: number; time: number } | null>(null);
  const rewardApplied = useRef(false);

  const player = horses.find((h) => h.id === horseId) ?? null;

  function startRace() {
    if (!player) return;
    const course = courseById(courseId);
    const distance = courseDistance(course, mode);
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const band: [number, number] = grade === 'gp' ? [32, 44] : [20, 34];
    const rng = mulberry32(seed ^ 0x51ed);
    const names = shuffle(CPU_NAMES).slice(0, 5);
    const cpus = names.map((n, i) => cpuHorse(`cpu${i}`, n, rng, band));
    const entrants: Entrant[] = [
      { horseId: player.id, name: player.name, isPlayer: true, stats: player.stats },
      ...cpus.map((c) => c.entrant),
    ];
    const result = simulate(entrants, course, distance, seed);
    setData({ result, horses: [player, ...cpus.map((c) => c.horse)], course, distance, mode, grade });
    rewardApplied.current = false;
    setReward(null);
    setScreen('race');
  }

  function finishRace() {
    if (!data || rewardApplied.current) {
      setScreen('result');
      return;
    }
    rewardApplied.current = true;
    const rank = data.result.ranks[0];
    const time = data.result.finishTimes[0];
    const trophy = makeTrophy(data.horses[0].id, rank, data.course.id, data.mode, data.grade);
    let items: TrainingItem[] = [];
    if (data.grade === 'gp') {
      const n = itemDropCount(rank, data.mode);
      items = rollItems(mulberry32((data.result.duration * 1000) ^ rank ^ Date.now()), n);
    }
    if (trophy) addTrophies([trophy]);
    if (items.length) grantItems(items);
    recordRace(data.course.id, data.mode, rank, time);
    setReward({ trophy, items, rank, time });
    setScreen('result');
  }

  // --- Menu ---
  if (screen === 'menu') {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>レース 🏁</h1>
        <p className={styles.lead}>あつめたウマを走らせよう！</p>
        <button className={styles.modeCard} onClick={() => { setGrade('normal'); setScreen('setup'); }}>
          <span className={styles.modeEmoji}>🏇</span>
          <span className={styles.modeText}>
            <span className={styles.modeName}>ひとりでレース</span>
            <span className={styles.modeDesc}>CPU5頭と勝負・3位以内でトロフィー</span>
          </span>
          <span className={styles.modeGo}>▶</span>
        </button>
        <button className={styles.modeCard} onClick={() => { setGrade('gp'); setScreen('setup'); }}>
          <span className={styles.modeEmoji}>🏆</span>
          <span className={styles.modeText}>
            <span className={styles.modeName}>グランプリ</span>
            <span className={styles.modeDesc}>強敵ぞろい・入賞で育成アイテム</span>
          </span>
          <span className={styles.modeGo}>▶</span>
        </button>
        <div className={`${styles.modeCard} ${styles.modeLocked}`} aria-disabled>
          <span className={styles.modeEmoji}>⚔️</span>
          <span className={styles.modeText}>
            <span className={styles.modeName}>たいせん</span>
            <span className={styles.modeDesc}>ともだちと対戦</span>
          </span>
          <span className={styles.soon}>準備中</span>
        </div>
      </div>
    );
  }

  // --- Setup (horse / course / time) ---
  if (screen === 'setup') {
    const course = courseById(courseId);
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>{grade === 'gp' ? 'グランプリ' : 'ひとりでレース'}</h1>

        {horses.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyEmoji}>🐴</div>
            <p>走らせるウマがいません。</p>
            <button className="btn" onClick={() => navigate('/create')}>ウマをつくる</button>
          </div>
        ) : (
          <>
            <h2 className={styles.h2}>ウマをえらぶ</h2>
            <div className={styles.pickRow}>
              {horses.map((h) => (
                <button
                  key={h.id}
                  className={`${styles.pickCard} ${horseId === h.id ? styles.pickSel : ''}`}
                  onClick={() => setHorseId(h.id)}
                >
                  <HorseView horse={h} size={80} />
                  <span className={styles.pickName}>{h.name}</span>
                </button>
              ))}
            </div>

            <h2 className={styles.h2}>コース</h2>
            <div className={styles.courseList}>
              {COURSES.map((c) => (
                <button
                  key={c.id}
                  className={`${styles.courseCard} ${courseId === c.id ? styles.courseSel : ''}`}
                  onClick={() => setCourseId(c.id)}
                >
                  <span className={styles.courseEmoji}>{c.emoji}</span>
                  <span className={styles.courseText}>
                    <span className={styles.courseName}>{c.name}</span>
                    <span className={styles.courseDesc}>{c.desc}</span>
                  </span>
                </button>
              ))}
            </div>

            <h2 className={styles.h2}>レース時間</h2>
            <div className={styles.modeSwitch}>
              {([30, 60] as const).map((m) => (
                <button
                  key={m}
                  className={`${styles.modeBtn} ${mode === m ? styles.modeBtnSel : ''}`}
                  onClick={() => setMode(m)}
                >
                  {m}秒{m === 60 && grade === 'gp' ? '（報酬1.5倍）' : ''}
                </button>
              ))}
            </div>

            <div className={styles.setupActions}>
              <button className="btn neutral" onClick={() => setScreen('menu')}>もどる</button>
              <button className="btn" onClick={startRace} disabled={!player}>
                {player ? `${course.name}でスタート` : 'ウマをえらんでね'}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // --- Race playback ---
  if (screen === 'race' && data) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>
          {data.course.emoji} {data.course.name}
        </h1>
        <Track data={data} onFinish={finishRace} />
      </div>
    );
  }

  // --- Result ---
  if (screen === 'result' && data) {
    const ranks = data.result.ranks;
    const order = data.result.order;
    const playerRank = ranks[0];
    return (
      <div className={styles.page}>
        <div className={styles.resultCard}>
          <h2 className={styles.resultTitle}>
            {playerRank === 1 ? '🏆 ゆうしょう！' : `${playerRank}位`}
          </h2>

          {reward?.trophy && (
            <p className={styles.rewardLine}>
              トロフィー獲得！（{reward.trophy.rank}位・{reward.trophy.grade === 'gp' ? 'GP' : '通常'}）
            </p>
          )}
          {reward && reward.items.length > 0 && (
            <div className={styles.itemReward}>
              <span className={styles.rewardLine}>育成アイテム × {reward.items.length}</span>
              <ul className={styles.itemList}>
                {reward.items.map((it, i) => (
                  <li key={i}>🎁 {itemLabel(it)}</li>
                ))}
              </ul>
            </div>
          )}

          <ol className={styles.ranking}>
            {order.map((idx, place) => {
              const rc = rankColor(place + 1, data.horses.length);
              return (
                <li key={idx} className={`${styles.rankRow} ${idx === 0 ? styles.rankMe : ''}`}>
                  <span className={styles.rankNo} style={{ background: rc.bg, borderColor: rc.bd, color: rc.fg }}>
                    {place + 1}
                  </span>
                  <div className={styles.rankHorse}>
                    <HorseView horse={data.horses[idx]} size={40} />
                  </div>
                  <span className={styles.rankName}>{idx === 0 ? 'あなた' : data.horses[idx].name}</span>
                  <span className={styles.rankTime}>{data.result.finishTimes[idx].toFixed(1)}s</span>
                </li>
              );
            })}
          </ol>

          <div className={styles.raceActions}>
            <button className="btn neutral" onClick={() => setScreen('setup')}>コースをかえる</button>
            <button className="btn" onClick={startRace}>もう一回</button>
          </div>
          <button className={styles.exitLink} onClick={() => setScreen('menu')}>モードせんたくへ</button>
        </div>
      </div>
    );
  }

  return null;
}
