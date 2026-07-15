import { useEffect, useMemo, useRef, useState } from 'react';
import type { Course } from '../data/courses';
import { centerline, centerlinePath, toWorld, lapLength, goalS, trackBounds } from '../logic/track';
import { simulate2, type Entrant, type SimResult } from '../logic/raceSim2';
import type { HorseLook } from '../types';
import HorseDefs from './HorseDefs';
import HorseRaceView from './HorseRaceView';
import RankPanel from './RankPanel';
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

type Props = {
  entrants: Entrant[];
  looks: Record<string, HorseLook>; // horseId -> look
  course: Course;
  mode: 30 | 60;
  seed: number;
  reduced: boolean;
  skippable: boolean;
  laps?: number; // override lap count (grand-prix heats/finals)
  onFinish: (result: SimResult) => void;
};

export default function RaceTrack2({ entrants, looks, course, mode, seed, reduced, skippable, laps, onFinish }: Props) {
  const result = useMemo(
    () => simulate2(entrants, course, mode, seed, { recordFrames: true, laps }),
    [entrants, course, mode, seed, laps],
  );
  const track = course.track;
  const lap = lapLength(track);
  const totalLaps = laps ?? (mode === 30 ? course.laps30 : course.laps60);

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
    const goalPos = goalS(track);
    const goal = toWorld(track, goalPos, 0);
    const gc = centerline(track, goalPos);
    return (
      <>
        <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={course.surface === 'circuit' ? '#2b3350' : '#bfe08a'} />
        {/* stands (spectators drawn as a separate cheering layer) */}
        <rect x={vb.x} y={vb.y} width={vb.w} height={stands + 4} fill="#c8a06a" />
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
      </>
    );
  }, [track, course, lap, vb.x, vb.y, vb.w, vb.h, b.minX, b.maxX, b.minY, stands]);

  // Spectator seats (positions are static; they bob per-frame in the render).
  const crowdDots = useMemo(() => {
    const dots: { x: number; y: number; fill: string; ph: number }[] = [];
    const palette = ['#d98b8b', '#8bb7d9', '#e0c27a', '#a6d98b', '#c79bd9'];
    for (let r = 0; r < 3; r++) {
      for (let x = b.minX; x < b.maxX; x += 5) {
        dots.push({
          x: x + (r % 2) * 2.5,
          y: b.minY - stands + 4 + r * 5,
          fill: palette[(Math.abs(x) + r) % palette.length],
          ph: (Math.abs(x) * 7 + r * 3) % 100,
        });
      }
    }
    return dots;
  }, [b.minX, b.maxX, b.minY, stands]);

  // Full starting gate (§9): one numbered stall per entrant, straddling the
  // track at s=0. Oriented with the track (tangent = run direction), it fades
  // out as the field clears it.
  const startGate = useMemo(() => {
    const N = entrants.length;
    const gs = goalS(track); // gate straddles the start/finish line (home-straight centre)
    const c = centerline(track, gs);
    const P = toWorld(track, gs, 0);
    const halfW = track.width / 2;
    const gd = 4.5; // gate depth (m)
    const W = (a: number, n: number) => ({ x: P.x + c.tx * a + c.nx * n, y: P.y + c.ty * a + c.ny * n });
    const dividers = [];
    for (let i = 0; i <= N; i++) {
      const n = -halfW + (i / N) * track.width;
      const bk = W(-gd, n), fr = W(0.2, n);
      dividers.push(
        <line key={'d' + i} x1={bk.x} y1={bk.y} x2={fr.x} y2={fr.y} stroke="#48505e" strokeWidth="0.4" strokeLinecap="round" />,
      );
    }
    const nums = [];
    for (let i = 0; i < N; i++) {
      const n = -halfW + ((i + 0.5) / N) * track.width;
      const p = W(-gd - 1.3, n);
      nums.push(
        <text key={'n' + i} x={p.x} y={p.y} fontSize="1.8" fill="#f3efe0" fontWeight="900" textAnchor="middle" dominantBaseline="central">{i + 1}</text>,
      );
    }
    const b0 = W(-gd, -halfW), b1 = W(-gd, halfW);
    const f0 = W(0.2, -halfW), f1 = W(0.2, halfW);
    const roof0 = W(-gd - 2.2, -halfW), roof1 = W(-gd - 2.2, halfW);
    return (
      <g>
        {/* back frame / roof bar with stall numbers */}
        <line x1={roof0.x} y1={roof0.y} x2={roof1.x} y2={roof1.y} stroke="#2b3350" strokeWidth="2.6" strokeLinecap="round" />
        {nums}
        <line x1={b0.x} y1={b0.y} x2={b1.x} y2={b1.y} stroke="#3a4454" strokeWidth="1.0" strokeLinecap="round" />
        {dividers}
        {/* front gate line (the doors that spring open) */}
        <line x1={f0.x} y1={f0.y} x2={f1.x} y2={f1.y} stroke="#e8edf3" strokeWidth="0.7" strokeLinecap="round" strokeDasharray="0.8 0.6" />
      </g>
    );
  }, [track, entrants.length]);

  // current frame (interpolated)
  const dt = result.dt;
  const fi = Math.min(Math.floor(elapsed.current / dt), result.frames.length - 1);
  const fr = result.frames[fi];
  const nf = result.frames[Math.min(fi + 1, result.frames.length - 1)];
  const alpha = Math.min(1, Math.max(0, elapsed.current / dt - fi));

  const leaderS = Math.max(...fr.runners.map((r) => r.s));
  const travelled = leaderS - result.startS; // distance run since the start/finish line
  const curLap = Math.min(totalLaps, Math.floor(travelled / lap) + 1);
  const remaining = Math.max(0, Math.round(result.distanceS - travelled));

  // Interpolated horse world positions (also used to drive the follow camera).
  const positions = fr.runners.map((rf, i) => {
    const s = rf.s + (nf.runners[i].s - rf.s) * alpha;
    const d = rf.d + (nf.runners[i].d - rf.d) * alpha;
    const c = centerline(track, s);
    const w = toWorld(track, s, d);
    const speed = (nf.runners[i].s - rf.s) / dt; // m/s over this frame
    return {
      x: w.x,
      y: w.y,
      s,
      heading: Math.atan2(c.ty, c.tx),
      speed01: clamp(speed / 18, 0, 1),
      onCorner: c.curvature > 0,
    };
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
          {/* cheering crowd — bobs harder down the final stretch and at the finish */}
          {(() => {
            const hype = phase === 'done' ? 1 : travelled / result.distanceS > 0.85 ? 0.7 : 0.28;
            const amp = reduced ? 0 : 1.4 * hype;
            const t = elapsed.current * 7;
            return crowdDots.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y - Math.abs(Math.sin(t + d.ph)) * amp} r={1.7} fill={d.fill} />
            ));
          })()}
          {/* starting gate — fades as the field runs clear of it */}
          <g opacity={clamp(1 - travelled / 30, 0, 1)}>{startGate}</g>
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
          {/* horses — trailing runners drawn first so the player reads on top */}
          {positions
            .map((p, i) => ({ p, i }))
            .sort((a, b) => (entrants[a.i].isPlayer ? 1 : 0) - (entrants[b.i].isPlayer ? 1 : 0))
            .map(({ p, i }) => (
              <HorseRaceView
                key={i}
                look={looks[entrants[i].horseId]}
                x={p.x}
                y={p.y}
                heading={p.heading}
                legPhase={(p.s / 4.5) % 1}
                speed01={p.speed01}
                onCorner={p.onCorner}
                jumping={fr.runners[i].state === 'jump'}
                zekken={result.gate[i]}
                isPlayer={entrants[i].isPlayer}
              />
            ))}
        </svg>

        {phase === 'countdown' && <div className={styles.countdown}>{count > 0 ? count : 'GO!'}</div>}
        {travelled / result.distanceS > 0.85 && phase === 'run' && (
          <div className={styles.callout}>最後の直線！</div>
        )}
      </div>
      <RankPanel
        entrants={entrants}
        looks={looks}
        ranks={fr.runners.map((r) => r.rank)}
        finished={phase === 'done'}
      />
      {skippable && phase === 'run' && (
        <button className={styles.skip} onClick={() => { elapsed.current = result.duration; setPhase('done'); onFinish(result); }}>
          スキップ ⏭
        </button>
      )}
    </div>
  );
}
