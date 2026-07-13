import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { colorsBySlot, decosBySlot, DECO_SLOTS } from '../data/parts';
import type { Horse, DecoSlot } from '../types';
import HorseView from '../components/HorseView';
import { usePrefersReducedMotion } from '../hooks';
import styles from './Race.module.css';

const OPP_NAMES = ['あらし号', 'かぜまる', 'いなずま', 'だいち', 'こまち', 'はやて', 'つむじ', 'くろがね'];

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

function randomHorse(id: string, name: string): Horse {
  const decos: Partial<Record<DecoSlot, string>> = {};
  // ~55% chance of a single random decoration for flavor.
  if (Math.random() < 0.55) {
    const slot = pick(DECO_SLOTS);
    decos[slot] = pick(decosBySlot[slot]).id;
  }
  return {
    id,
    name,
    colors: {
      body: pick(colorsBySlot.body).id,
      mane: pick(colorsBySlot.mane).id,
      hoof: pick(colorsBySlot.hoof).id,
    },
    decos,
    createdAt: 0,
  };
}

type Racer = { horse: Horse; isPlayer: boolean; duration: number };
type Phase = 'countdown' | 'running' | 'result';

function buildRacers(player: Horse, reduced: boolean): Racer[] {
  const names = shuffle(OPP_NAMES).slice(0, 3);
  const field: Racer[] = [
    { horse: player, isPlayer: true, duration: 0 },
    ...names.map((n, i) => ({ horse: randomHorse(`opp${i}`, n), isPlayer: false, duration: 0 })),
  ];
  // Each racer gets a random finish time; the shortest wins. Reduced motion keeps
  // the ordering but collapses the animation to near-instant.
  const span = reduced ? [180, 420] : [2900, 4600];
  for (const r of field) r.duration = Math.round(span[0] + Math.random() * (span[1] - span[0]));
  return shuffle(field); // lane order independent of finish order
}

function RaceTrack({ player, onExit, onSwap }: { player: Horse; onExit: () => void; onSwap: () => void }) {
  const reduced = usePrefersReducedMotion();
  const [seed, setSeed] = useState(0); // bump to start a fresh race
  const racers = useMemo(() => buildRacers(player, reduced), [player, seed, reduced]);
  const [phase, setPhase] = useState<Phase>('countdown');
  const [count, setCount] = useState(3);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase('countdown');
    setCount(3);

    const step = reduced ? 250 : 800;
    const t: number[] = [];
    t.push(window.setTimeout(() => setCount(2), step));
    t.push(window.setTimeout(() => setCount(1), step * 2));
    t.push(
      window.setTimeout(() => {
        setCount(0); // GO!
        setPhase('running');
      }, step * 3),
    );
    const maxDur = Math.max(...racers.map((r) => r.duration));
    t.push(window.setTimeout(() => setPhase('result'), step * 3 + maxDur + 350));
    timers.current = t;
    return () => t.forEach(clearTimeout);
  }, [racers, reduced]);

  const ranking = useMemo(
    () => [...racers].sort((a, b) => a.duration - b.duration),
    [racers],
  );
  const playerRank = ranking.findIndex((r) => r.isPlayer) + 1;

  return (
    <div className={styles.raceWrap}>
      <div className={styles.trackFrame}>
        {racers.map((r, lane) => (
          <div key={lane} className={styles.lane}>
            <span className={styles.laneTag}>{r.isPlayer ? 'あなた' : r.horse.name}</span>
            <div className={styles.finishLine} aria-hidden />
            <div
              className={`${styles.runner} ${phase !== 'countdown' ? styles.run : ''} ${
                r.isPlayer ? styles.playerRunner : ''
              }`}
              style={{ transitionDuration: `${r.duration}ms` }}
            >
              <HorseView horse={r.horse} size={54} />
            </div>
          </div>
        ))}

        {phase === 'countdown' && (
          <div className={styles.countdown} aria-live="assertive">
            {count > 0 ? count : 'GO!'}
          </div>
        )}
      </div>

      {phase === 'result' && (
        <div className={styles.resultCard}>
          <h2 className={styles.resultTitle}>
            {playerRank === 1 ? '🏆 ゆうしょう！' : `${playerRank}位でした`}
          </h2>
          <ol className={styles.ranking}>
            {ranking.map((r, i) => (
              <li key={i} className={`${styles.rankRow} ${r.isPlayer ? styles.rankMe : ''}`}>
                <span className={styles.rankNo}>{i + 1}</span>
                <div className={styles.rankHorse}>
                  <HorseView horse={r.horse} size={40} />
                </div>
                <span className={styles.rankName}>{r.isPlayer ? 'あなた' : r.horse.name}</span>
                {i === 0 && <span className={styles.medal}>🥇</span>}
              </li>
            ))}
          </ol>
          <div className={styles.raceActions}>
            <button className="btn neutral" onClick={onSwap}>
              ウマをかえる
            </button>
            <button className="btn" onClick={() => setSeed((s) => s + 1)}>
              もう一回
            </button>
          </div>
          <button className={styles.exitLink} onClick={onExit}>
            モードせんたくへ
          </button>
        </div>
      )}
    </div>
  );
}

export default function Race() {
  const navigate = useNavigate();
  const horses = useStore((s) => s.horses);
  const [screen, setScreen] = useState<'menu' | 'pick' | 'race'>('menu');
  const [horseId, setHorseId] = useState<string | null>(null);
  const player = horses.find((h) => h.id === horseId) ?? null;

  // Mode selection ----------------------------------------------------------
  if (screen === 'menu') {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>レース 🏁</h1>
        <p className={styles.lead}>あつめたウマを走らせよう！</p>
        <button className={styles.modeCard} onClick={() => setScreen('pick')}>
          <span className={styles.modeEmoji}>🏇</span>
          <span className={styles.modeText}>
            <span className={styles.modeName}>ひとりでレース</span>
            <span className={styles.modeDesc}>CPUのウマ3頭と勝負</span>
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
        <div className={`${styles.modeCard} ${styles.modeLocked}`} aria-disabled>
          <span className={styles.modeEmoji}>🏆</span>
          <span className={styles.modeText}>
            <span className={styles.modeName}>グランプリ</span>
            <span className={styles.modeDesc}>連戦でチャンピオンをめざす</span>
          </span>
          <span className={styles.soon}>準備中</span>
        </div>
      </div>
    );
  }

  // Horse picker ------------------------------------------------------------
  if (screen === 'pick' || !player) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>だれで走る？</h1>
        {horses.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyEmoji}>🐴</div>
            <p>走らせるウマがいません。</p>
            <button className="btn" onClick={() => navigate('/create')}>
              ウマをつくる
            </button>
          </div>
        ) : (
          <>
            <div className={styles.pickGrid}>
              {horses.map((h) => (
                <button
                  key={h.id}
                  className={styles.pickCard}
                  onClick={() => {
                    setHorseId(h.id);
                    setScreen('race');
                  }}
                >
                  <div className={styles.pickThumb}>
                    <HorseView horse={h} size={110} shadow />
                  </div>
                  <span className={styles.pickName}>{h.name}</span>
                </button>
              ))}
            </div>
            <button className={styles.exitLink} onClick={() => setScreen('menu')}>
              もどる
            </button>
          </>
        )}
      </div>
    );
  }

  // Running a race ----------------------------------------------------------
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>ひとりでレース</h1>
      <RaceTrack player={player} onExit={() => setScreen('menu')} onSwap={() => setScreen('pick')} />
    </div>
  );
}
