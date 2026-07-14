import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Entrant } from '../logic/raceSim2';
import type { HorseLook } from '../types';
import HorseFace from './HorseFace';
import styles from './RankPanel.module.css';

// Rank → medal colour (RACE.md §6): gold / silver / bronze, then white→black.
function rankColor(rank: number, total: number): { bg: string; fg: string; bd: string } {
  if (rank === 1) return { bg: '#f0c33c', fg: '#2b2118', bd: '#8a6410' };
  if (rank === 2) return { bg: '#cfd6dd', fg: '#2b2118', bd: '#79838d' };
  if (rank === 3) return { bg: '#cf8a4e', fg: '#fff', bd: '#8f5a28' };
  const f = total > 4 ? (rank - 4) / (total - 4) : 0;
  const v = Math.round(230 * (1 - f) + 40 * f);
  return { bg: `rgb(${v},${v},${v})`, fg: v > 140 ? '#2b2118' : '#fff', bd: '#2b2118' };
}

function shortName(n: string): string {
  return n.length > 4 ? n.slice(0, 4) + '…' : n;
}

type Props = {
  entrants: Entrant[];
  looks: Record<string, HorseLook>;
  ranks: number[]; // current rank per entrant index (1..n), updated every frame
  finished: boolean;
};

// The always-visible order strip under the track (RACE_V3 §1). Cards keep a fixed
// DOM slot (keyed by horseId) and only slide via transform — a FLIP reorder that
// never re-mounts the portrait. Rank sampling is throttled to ~10Hz with a short
// hysteresis so photo-finishes don't make the cards jitter.
export default function RankPanel({ entrants, looks, ranks, finished }: Props) {
  const n = entrants.length;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Throttled + hysteretic display ranks.
  const [disp, setDisp] = useState<number[]>(ranks);
  const lastApply = useRef(0);
  const lastChange = useRef(0);
  const prevDisp = useRef<number[]>(ranks);

  useEffect(() => {
    if (finished) {
      setDisp(ranks);
      prevDisp.current = ranks;
      return;
    }
    const now = performance.now();
    if (now - lastApply.current < 100) return; // 10Hz sampling
    lastApply.current = now;
    const changed = ranks.some((r, i) => r !== prevDisp.current[i]);
    if (!changed) return;
    if (now - lastChange.current < 200) return; // 0.2s hysteresis between swaps
    lastChange.current = now;
    prevDisp.current = ranks;
    setDisp(ranks);
  }, [ranks, finished]);

  const gap = 4;
  const cardW = n > 0 && w > 0 ? (w - gap * (n - 1)) / n : 0;

  return (
    <div className={styles.panel} ref={wrapRef} style={{ height: 66 }}>
      {entrants.map((e, i) => {
        const rank = disp[i] ?? i + 1;
        const rc = rankColor(rank, n);
        const x = (rank - 1) * (cardW + gap);
        const improved = rank < (prevDisp.current[i] ?? rank);
        const trophy = finished && rank <= 3;
        return (
          <div
            key={e.horseId}
            className={`${styles.card} ${e.isPlayer ? styles.me : ''} ${improved ? styles.rose : ''}`}
            style={{
              width: cardW || undefined,
              transform: `translateX(${x}px)`,
              borderColor: trophy ? rc.bd : undefined,
              boxShadow: trophy ? `0 0 0 2px ${rc.bg}` : undefined,
            }}
          >
            <span className={styles.rankNo} style={{ background: rc.bg, color: rc.fg, borderColor: rc.bd }}>
              {rank}
            </span>
            {e.isPlayer && <span className={styles.you}>YOU</span>}
            <HorseFace horse={looks[e.horseId]} size={32} className={styles.face} />
            <span className={styles.name}>{e.isPlayer ? 'あなた' : shortName(e.name)}</span>
          </div>
        );
      })}
    </div>
  );
}
