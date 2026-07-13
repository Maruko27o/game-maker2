import { useEffect, useMemo, useRef, useState } from 'react';
import type { Course } from '../data/courses';
import { centerline, centerlinePath, toWorld, lapLength, trackBounds } from '../logic/track';
import { simulate2, type Entrant, type SimResult, type RunnerState } from '../logic/raceSim2';
import { colorById } from '../data/parts';
import type { HorseLook } from '../types';
import HorseDefs from './HorseDefs';
import styles from './RaceTrack2.module.css';

const SURFACE_COLOR: Record<string, string> = {
  turf: '#8cc264',
  dirt: '#b98a5a',
  sand: '#e0c48a',
  steeple: '#8cc264',
  circuit: '#6d7ea0',
  trail: '#8cc264',
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function rankColor(rank: number, total: number): { bg: string; fg: string; bd: string } {
  if (rank === 1) return { bg: '#f0c33c', fg: '#2b2118', bd: '#8a6410' };
  if (rank === 2) return { bg: '#cfd6dd', fg: '#2b2118', bd: '#79838d' };
  if (rank === 3) return { bg: '#cf8a4e', fg: '#fff', bd: '#8f5a28' };
  const f = total > 4 ? (rank - 4) / (total - 4) : 0;
  const v = Math.round(230 * (1 - f) + 40 * f);
  return { bg: `rgb(${v},${v},${v})`, fg: v > 140 ? '#2b2118' : '#fff', bd: '#2b2118' };
}

type Props = {
  entrants: Entrant[];
  looks: Record<string, HorseLook>; // horseId -> look
  course: Course;
  mode: 30 | 60;
  seed: number;
  reduced: boolean;
  skippable: boolean;
  onFinish: (result: SimResult) => void;
};

// A simplified, rounder race horse (RACE_V2 §5.1) drawn in meter coordinates,
// oriented along the track. Body diameter ≈ the collision size so it reads true.
function RaceHorseMark({
  look,
  x,
  y,
  heading,
  legPhase,
  state,
  isPlayer,
}: {
  look: HorseLook;
  x: number;
  y: number;
  heading: number;
  legPhase: number;
  state: RunnerState;
  isPlayer: boolean;
}) {
  const body = colorById[look.colors.body]?.value ?? '#f6f2ea';
  const mane = colorById[look.colors.mane]?.value ?? '#6b4326';
  const deg = (heading * 180) / Math.PI;
  const bob = state === 'stumble' ? 0.15 : Math.sin(legPhase * Math.PI * 4) * 0.08;
  const legSwing = Math.sin(legPhase * Math.PI * 2) * 0.35;
  return (
    <g transform={`translate(${x} ${y}) rotate(${deg})`}>
      {isPlayer && <ellipse cx="0" cy="0" rx="1.5" ry="1.2" fill="rgba(63,127,214,0.35)" />}
      {/* legs */}
      <g stroke={colorById[look.colors.hoof]?.value ?? '#3a2c1c'} strokeWidth="0.28" strokeLinecap="round">
        <line x1={-0.4} y1={0.3} x2={-0.4 - legSwing} y2={0.9} />
        <line x1={0.5} y1={0.3} x2={0.5 + legSwing} y2={0.9} />
      </g>
      <g transform={`translate(0 ${-bob})`} stroke="#2b2118" strokeWidth={isPlayer ? 0.26 : 0.18} strokeLinejoin="round">
        <ellipse cx="0" cy="0" rx="1.1" ry="0.72" fill={body} />
        {/* mane along the back */}
        <path d="M -0.9,-0.5 Q -0.2,-1.0 0.5,-0.55" fill="none" stroke={mane} strokeWidth="0.5" strokeLinecap="round" />
        {/* head at the front (+x) */}
        <circle cx="1.15" cy="-0.15" r="0.45" fill={body} />
        <circle cx="1.4" cy="-0.2" r="0.09" fill="#2b2118" stroke="none" />
      </g>
    </g>
  );
}

export default function RaceTrack2({ entrants, looks, course, mode, seed, reduced, skippable, onFinish }: Props) {
  const result = useMemo(
    () => simulate2(entrants, course, mode, seed, { recordFrames: true }),
    [entrants, course, mode, seed],
  );
  const track = course.track;
  const lap = lapLength(track);
  const totalLaps = mode === 30 ? course.laps30 : course.laps60;

  const [phase, setPhase] = useState<'countdown' | 'run' | 'done'>('countdown');
  const [count, setCount] = useState(3);
  const elapsed = useRef(0);
  const [, force] = useState(0);
  const startRef = useRef(0);
  const cam = useRef<{ x: number; y: number; span: number } | null>(null);

  useEffect(() => {
    const step = reduced ? 220 : 700;
    const t = [
      window.setTimeout(() => setCount(2), step),
      window.setTimeout(() => setCount(1), step * 2),
      window.setTimeout(() => {
        setCount(0);
        setPhase('run');
      }, step * 3),
    ];
    return () => t.forEach(clearTimeout);
  }, [reduced]);

  useEffect(() => {
    if (phase !== 'run') return;
    const speed = reduced ? 4 : 1;
    let raf = 0;
    const loop = (now: number) => {
      if (!startRef.current) startRef.current = now;
      elapsed.current = ((now - startRef.current) / 1000) * speed;
      if (elapsed.current >= result.duration) {
        elapsed.current = result.duration;
        setPhase('done');
        window.setTimeout(() => onFinish(result), reduced ? 100 : 700);
        return;
      }
      force((x) => x + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, reduced, result, onFinish]);

  // viewport (meter coords) with room for stands above.
  const b = trackBounds(track);
  const pad = 6;
  const stands = track.radius * 0.55;
  const vb = {
    x: b.minX - pad,
    y: b.minY - stands - pad,
    w: b.maxX - b.minX + pad * 2,
    h: b.maxY - b.minY + stands + pad * 2,
  };

  // static track + stands (memoised so only horses update per frame).
  const scenery = useMemo(() => {
    const path = centerlinePath(track);
    const surface = SURFACE_COLOR[course.surface] ?? '#8cc264';
    const gate = toWorld(track, 0, 0);
    const goal = toWorld(track, lap * 0.12, 0);
    const gc = centerline(track, lap * 0.12);
    const dots = [];
    for (let r = 0; r < 3; r++) {
      for (let x = b.minX; x < b.maxX; x += 6) {
        dots.push(<circle key={`${r}-${x}`} cx={x + (r % 2) * 3} cy={b.minY - stands + 4 + r * 5} r="1.8" fill={['#d98b8b', '#8bb7d9', '#e0c27a', '#a6d98b'][(x + r) % 4]} />);
      }
    }
    return (
      <>
        <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={course.surface === 'circuit' ? '#2b3350' : '#bfe08a'} />
        {/* stands */}
        <rect x={vb.x} y={vb.y} width={vb.w} height={stands + 4} fill="#c8a06a" />
        {dots}
        {/* outer rail (white ring) then running surface */}
        <path d={path} fill="none" stroke="#f3efe0" strokeWidth={track.width + 2.4} strokeLinejoin="round" />
        <path d={path} fill="none" stroke={surface} strokeWidth={track.width} strokeLinejoin="round" />
        {/* infield */}
        <path d={path} fill="#a9d46a" stroke="none" transform="scale(1)" opacity="0" />
        {/* goal line */}
        <line
          x1={goal.x + gc.nx * track.width * 0.5}
          y1={goal.y + gc.ny * track.width * 0.5}
          x2={goal.x - gc.nx * track.width * 0.5}
          y2={goal.y - gc.ny * track.width * 0.5}
          stroke="#d64b45"
          strokeWidth="1.2"
        />
        <text x={goal.x + 4} y={goal.y} fontSize="4" fill="#d64b45" fontWeight="900">GOAL</text>
        {/* gate marker */}
        <circle cx={gate.x} cy={gate.y} r="1.4" fill="#3a2c1c" opacity="0.5" />
      </>
    );
  }, [track, course, lap, vb.x, vb.y, vb.w, vb.h, b.minX, b.maxX, b.minY, stands]);

  // current frame (interpolated)
  const dt = result.dt;
  const fi = Math.min(Math.floor(elapsed.current / dt), result.frames.length - 1);
  const fr = result.frames[fi];
  const nf = result.frames[Math.min(fi + 1, result.frames.length - 1)];
  const alpha = Math.min(1, Math.max(0, elapsed.current / dt - fi));

  const leaderS = Math.max(...fr.runners.map((r) => r.s));
  const curLap = Math.min(totalLaps, Math.floor(leaderS / lap) + 1);
  const remaining = Math.max(0, Math.round(result.distanceS - leaderS));

  // Interpolated horse world positions (also used to drive the follow camera).
  const positions = fr.runners.map((rf, i) => {
    const s = rf.s + (nf.runners[i].s - rf.s) * alpha;
    const d = rf.d + (nf.runners[i].d - rf.d) * alpha;
    const c = centerline(track, s);
    const w = toWorld(track, s, d);
    return { x: w.x, y: w.y, s, heading: Math.atan2(c.ty, c.tx) };
  });

  // Smoothed auto-fit camera: keep every horse (incl. the player) in frame,
  // zoomed as close as the spread allows (RACE_V2 §2.3).
  const AR = vb.w / vb.h;
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const p of positions) {
    minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x);
    miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y);
  }
  const padM = 16;
  const targetSpan = Math.min(vb.w, Math.max(48, (maxx - minx) + padM * 2, ((maxy - miny) + padM * 2) * AR));
  const targetX = (minx + maxx) / 2;
  const targetY = (miny + maxy) / 2;
  if (!cam.current) cam.current = { x: vb.x + vb.w / 2, y: vb.y + vb.h / 2, span: vb.w };
  const k = reduced ? 1 : 0.1;
  cam.current.span += (targetSpan - cam.current.span) * k;
  cam.current.x += (targetX - cam.current.x) * k;
  cam.current.y += (targetY - cam.current.y) * k;
  const cw = cam.current.span;
  const ch = cw / AR;
  const camX = cw >= vb.w ? vb.x + (vb.w - cw) / 2 : clamp(cam.current.x - cw / 2, vb.x, vb.x + vb.w - cw);
  const camY = ch >= vb.h ? vb.y + (vb.h - ch) / 2 : clamp(cam.current.y - ch / 2, vb.y, vb.y + vb.h - ch);
  const viewBox = `${camX} ${camY} ${cw} ${ch}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.hud}>
        <span>
          {curLap}/{totalLaps}周 {totalLaps - curLap === 0 ? '（ラスト！）' : ''}
        </span>
        <span className={styles.remain}>のこり {remaining}m</span>
      </div>
      <div className={styles.stage}>
        <svg viewBox={viewBox} className={styles.svg} preserveAspectRatio="xMidYMid meet">
          <HorseDefs />
          {scenery}
          {/* boost panels + obstacles */}
          {result.boosts.map((bp, i) => {
            const w = toWorld(track, bp.s, bp.d);
            return <text key={'b' + i} x={w.x} y={w.y} fontSize="3.4" textAnchor="middle" dominantBaseline="middle">⚡</text>;
          })}
          {result.obstacles.map((o, i) => {
            const c = centerline(track, o.s);
            const w = toWorld(track, o.s, 0);
            return (
              <line key={'o' + i} x1={w.x + c.nx * track.width * 0.5} y1={w.y + c.ny * track.width * 0.5}
                x2={w.x - c.nx * track.width * 0.5} y2={w.y - c.ny * track.width * 0.5}
                stroke={o.kind === 'water' ? '#79c8ea' : o.kind === 'bamboo' ? '#b7913f' : '#4d7c3a'} strokeWidth="1.6" />
            );
          })}
          {/* horses */}
          {positions.map((p, i) => (
            <RaceHorseMark
              key={i}
              look={looks[entrants[i].horseId]}
              x={p.x}
              y={p.y}
              heading={p.heading}
              legPhase={(p.s / 4.5) % 1}
              state={fr.runners[i].state}
              isPlayer={entrants[i].isPlayer}
            />
          ))}
          {/* rank labels (upright) */}
          {positions.map((p, i) => {
            const rc = rankColor(fr.runners[i].rank, entrants.length);
            return (
              <g key={'l' + i} transform={`translate(${p.x} ${p.y - 2.6})`}>
                <circle r="1.4" fill={rc.bg} stroke={rc.bd} strokeWidth="0.3" />
                <text fontSize="1.9" fill={rc.fg} fontWeight="900" textAnchor="middle" dominantBaseline="central">
                  {fr.runners[i].rank}
                </text>
              </g>
            );
          })}
        </svg>

        {phase === 'countdown' && <div className={styles.countdown}>{count > 0 ? count : 'GO!'}</div>}
        {leaderS / result.distanceS > 0.85 && phase === 'run' && (
          <div className={styles.callout}>最後の直線！</div>
        )}
      </div>
      {skippable && phase === 'run' && (
        <button className={styles.skip} onClick={() => { elapsed.current = result.duration; setPhase('done'); onFinish(result); }}>
          スキップ ⏭
        </button>
      )}
    </div>
  );
}
