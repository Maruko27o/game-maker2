import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { COURSES, type Course } from '../data/courses';
import { colorsBySlot, decosBySlot, DECO_SLOTS } from '../data/parts';
import { type Entrant, type SimResult } from '../logic/raceSim2';
import { rollStatsTotal, mulberry32 } from '../logic/stats';
import { styleFor } from '../logic/runStyle';
import { makeTrophy, itemDropCount, rollItems } from '../logic/raceReward';
import type { Horse, HorseLook, DecoSlot, Trophy, TrainingItem, Stats } from '../types';
import { STAT_LABEL, RUN_STYLE_LABEL, STAT_KEYS } from '../types';
import HorseView from '../components/HorseView';
import RaceTrack2 from '../components/RaceTrack2';
import { usePrefersReducedMotion } from '../hooks';
import styles from './Race.module.css';

const NAME_A = ['カゼ', 'ホシ', 'ハナ', 'ユキ', 'ソラ', 'ナミ', 'ミネ', 'タキ', 'クモ', 'ツキ', 'イナ', 'アサ'];
const NAME_B = ['マル', 'ゴウ', 'オー', 'キング', 'スター', 'ボーイ', 'ヒメ', 'ナデシコ', '号', '丸'];

function pick<T>(a: T[], rng: () => number): T {
  return a[Math.floor(rng() * a.length)];
}

function makeCpu(
  id: string,
  rng: () => number,
  band: [number, number],
  decoChance: number,
): { entrant: Entrant; look: HorseLook } {
  const stats = rollStatsTotal(rng, band[0], band[1]);
  const decos: Partial<Record<DecoSlot, string>> = {};
  let chance = decoChance;
  for (const slot of DECO_SLOTS) {
    if (rng() < chance) decos[slot] = pick(decosBySlot[slot], rng).id;
    chance *= 0.5;
  }
  const look: HorseLook = {
    name: pick(NAME_A, rng) + pick(NAME_B, rng),
    colors: {
      body: pick(colorsBySlot.body, rng).id,
      mane: pick(colorsBySlot.mane, rng).id,
      hoof: pick(colorsBySlot.hoof, rng).id,
    },
    decos,
  };
  return {
    entrant: { horseId: id, name: look.name!, isPlayer: false, stats, style: styleFor(id, stats) },
    look,
  };
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

function itemLabel(it: TrainingItem): string {
  return it.kind === 'any' ? 'すきなステータス +1' : `${STAT_LABEL[it.stat]} +1`;
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
        <div className={styles.rouletteEmoji}>{shown.emoji}</div>
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
  const addTrophies = useStore((s) => s.addTrophies);
  const grantItems = useStore((s) => s.grantItems);
  const recordRace = useStore((s) => s.recordRace);

  const [screen, setScreen] = useState<'menu' | 'setup' | 'roulette' | 'race' | 'result'>('menu');
  const [grade, setGrade] = useState<'normal' | 'gp'>('normal');
  const [horseId, setHorseId] = useState<string | null>(null);
  const [mode, setMode] = useState<30 | 60>(30);
  const [setup, setSetup] = useState<RaceSetup | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [reward, setReward] = useState<{ trophy: Trophy | null; items: TrainingItem[]; rank: number } | null>(null);
  const rewardApplied = useRef(false);

  const player = horses.find((h) => h.id === horseId) ?? null;

  function begin() {
    if (!player) return;
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const rng = mulberry32(seed ^ 0x77);
    const course = COURSES[Math.floor(rng() * COURSES.length)];
    const band: [number, number] = grade === 'gp' ? [32, 44] : [20, 34];
    const looks: Record<string, HorseLook> = { [player.id]: player };
    const entrants: Entrant[] = [
      { horseId: player.id, name: player.name, isPlayer: true, stats: player.stats, style: styleFor(player.id, player.stats) },
    ];
    for (let i = 0; i < 7; i++) {
      const cpu = makeCpu(`cpu${i}`, rng, band, grade === 'gp' ? 0.8 : 0.5);
      entrants.push(cpu.entrant);
      looks[cpu.entrant.horseId] = cpu.look;
    }
    setSetup({ course, mode, seed, entrants, looks, grade });
    rewardApplied.current = false;
    setReward(null);
    setScreen('roulette');
  }

  function onFinish(result: SimResult) {
    setResult(result);
    if (!setup || rewardApplied.current) {
      setScreen('result');
      return;
    }
    rewardApplied.current = true;
    const rank = result.ranks[0];
    const trophy = makeTrophy(setup.entrants[0].horseId, rank, setup.course.id, setup.mode, setup.grade);
    let items: TrainingItem[] = [];
    if (setup.grade === 'gp') {
      items = rollItems(mulberry32((setup.seed ^ rank ^ 0x9e37) >>> 0), itemDropCount(rank, setup.mode));
    }
    if (trophy) addTrophies([trophy]);
    if (items.length) grantItems(items);
    recordRace(setup.course.id, setup.mode, rank, Math.min(...result.finishTimes));
    setReward({ trophy, items, rank });
    setScreen('result');
  }

  // --- Menu ---
  if (screen === 'menu') {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>レース 🏁</h1>
        <p className={styles.lead}>コースはランダム。あつめたウマを走らせよう！</p>
        <button className={styles.modeCard} onClick={() => { setGrade('normal'); setScreen('setup'); }}>
          <span className={styles.modeEmoji}>🏇</span>
          <span className={styles.modeText}>
            <span className={styles.modeName}>ひとりでレース</span>
            <span className={styles.modeDesc}>8頭立て・3位以内でトロフィー</span>
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

  // --- Setup (horse + time; course is random) ---
  if (screen === 'setup') {
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
              <button className="btn" onClick={begin} disabled={!player}>{player ? 'スタート' : 'ウマをえらんでね'}</button>
            </div>
          </>
        )}
      </div>
    );
  }

  // --- Roulette ---
  if (screen === 'roulette' && setup && player) {
    return (
      <div className={styles.page}>
        <Roulette course={setup.course} player={player} reduced={reduced} onDone={() => setScreen('race')} />
      </div>
    );
  }

  // --- Race ---
  if (screen === 'race' && setup) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>{setup.course.emoji} {setup.course.name}</h1>
        <RaceTrack2
          entrants={setup.entrants}
          looks={setup.looks}
          course={setup.course}
          mode={setup.mode}
          seed={setup.seed}
          reduced={reduced}
          skippable
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
          <h2 className={styles.resultTitle}>{playerRank === 1 ? '🏆 ゆうしょう！' : `${playerRank}位`}</h2>
          {reward?.trophy && (
            <p className={styles.rewardLine}>トロフィー獲得！（{reward.trophy.rank}位・{reward.trophy.grade === 'gp' ? 'GP' : '通常'}）</p>
          )}
          {reward && reward.items.length > 0 && (
            <div className={styles.itemReward}>
              <span className={styles.rewardLine}>育成アイテム × {reward.items.length}</span>
              <ul className={styles.itemList}>{reward.items.map((it, i) => <li key={i}>🎁 {itemLabel(it)}</li>)}</ul>
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
      </div>
    );
  }

  return null;
}
