import type { DayNight } from '../logic/daynight';
import SkyLayers from './SkyLayers';
import styles from './GrassScene.module.css';

// 窓の中身（外の眺め＋開き障子＋窓台＋小物＋カーテン）。木製の「窓枠」はカード
// (.field) の枠そのものが担う。周囲の部屋（丸太壁・床・小物）は GrassRoom。
// 昼夜 phase は親（Grass）が実時計から渡す。

function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-3.5" y="-2" width="7" height="20" rx="3" fill="#8a5a2b" />
      <ellipse cx="0" cy="6" rx="21" ry="8" fill="#3f7f2b" opacity="0.5" />
      <ellipse cx="0" cy="-2" rx="20" ry="17" fill="#4f9a35" />
      <ellipse cx="-11" cy="3" rx="12" ry="11" fill="#5aa83e" />
      <ellipse cx="11" cy="3" rx="12" ry="11" fill="#5aa83e" />
      <ellipse cx="0" cy="-8" rx="14" ry="12" fill="#6cbb4a" />
      <ellipse cx="-6" cy="-10" rx="7" ry="6" fill="#8ad066" opacity="0.85" />
    </g>
  );
}

// 窓台に載せる繊細な本（横積み）。
function Books() {
  return (
    <svg className={styles.books} width="60" height="30" viewBox="0 0 60 30">
      <g transform="translate(5 22)">
        <rect x="0" y="0" width="48" height="8" rx="1.6" fill="#93aec7" stroke="#6e88a3" strokeWidth="0.7" />
        <g transform="translate(3 -8) rotate(-2)"><rect x="0" y="0" width="40" height="7.5" rx="1.6" fill="#d7a58a" stroke="#b07a5f" strokeWidth="0.7" /></g>
        <g transform="translate(-2 -15) rotate(2.5)"><rect x="0" y="0" width="44" height="7.5" rx="1.6" fill="#9fbf9c" stroke="#6f9370" strokeWidth="0.7" /><rect x="18" y="-4" width="3" height="6" fill="#c85a52" /></g>
      </g>
    </svg>
  );
}

// 窓台に載せる繊細な鉢植え。
function Plant() {
  return (
    <svg className={styles.plant} width="44" height="52" viewBox="0 0 44 52">
      <g transform="translate(22 48)">
        <path d="M0 -18 Q-14 -30 -12 -46 Q-4 -32 0 -20" fill="#5aa145" />
        <path d="M0 -18 Q14 -30 12 -46 Q4 -32 0 -20" fill="#5aa145" />
        <path d="M0 -20 Q-2 -38 0 -50 Q2 -38 0 -22" fill="#74c65c" />
        <path d="M-11 -18 H11 L8.5 0 H-8.5 Z" fill="#d07a48" stroke="#9a5a30" strokeWidth="1" />
        <ellipse cx="0" cy="-18" rx="11" ry="3" fill="#e2a56f" stroke="#9a5a30" strokeWidth="1" />
        <ellipse cx="0" cy="-18" rx="7.5" ry="1.8" fill="#6f4326" opacity="0.5" />
      </g>
    </svg>
  );
}

function Curtain({ side }: { side: 'l' | 'r' }) {
  return (
    <svg className={side === 'l' ? styles.curtainL : styles.curtainR} width="30" height="220" viewBox="0 0 30 220" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`gsc-${side}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f7ecd9" /><stop offset="1" stopColor="#ead3b4" /></linearGradient>
      </defs>
      <g transform={side === 'r' ? 'translate(30,0) scale(-1,1)' : ''}>
        <path d="M0 6 L22 6 C 20 64 22 104 15 118 C 22 142 20 200 22 220 L0 220 Z" fill={`url(#gsc-${side})`} />
        <path d="M11 12 C 16 64 15 98 12 116" fill="none" stroke="#d7ad81" strokeWidth="1.4" opacity="0.5" />
        <path d="M2 118 Q15 110 27 120" fill="none" stroke="#9c5f2c" strokeWidth="3.6" strokeLinecap="round" />
        <path d="M27 122 l-1 11 M27 122 l1 11" stroke="#7d4a20" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export default function GrassScene({ d, reduced }: { d: DayNight; reduced: boolean }) {
  const tint = `brightness(${(1 - d.nightMix * 0.5).toFixed(3)}) saturate(${(1 - d.nightMix * 0.12).toFixed(3)})`;
  return (
    <div className={styles.scene} aria-hidden>
      {/* 外の眺め（昼夜サイクル） */}
      <div className={styles.window}>
        <SkyLayers d={d} reduced={reduced} />
        <svg className={styles.hills} viewBox="0 0 320 240" preserveAspectRatio="xMidYMax slice" style={{ filter: tint }}>
          <defs>
            <linearGradient id="gs-hb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a6d86b" /><stop offset="1" stopColor="#8ec756" /></linearGradient>
            <linearGradient id="gs-hf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8ecb52" /><stop offset="1" stopColor="#6fae3c" /></linearGradient>
          </defs>
          <path d="M0 150 Q90 110 180 140 T320 136 V240 H0 Z" fill="url(#gs-hb)" />
          <Tree x={64} y={132} s={0.92} />
          <Tree x={256} y={138} s={0.76} />
          <path d="M0 184 Q110 150 210 182 T320 180 V240 H0 Z" fill="url(#gs-hf)" />
        </svg>
        {d.nightMix > 0.02 && <div className={styles.nightSpill} style={{ opacity: d.nightMix }} />}
        {/* 細い開き障子（外を広く見せる） */}
        <svg className={styles.sashes} viewBox="0 0 320 240" preserveAspectRatio="none">
          <defs>
            <linearGradient id="gs-wood2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b07b45" /><stop offset="1" stopColor="#8a5a2f" /></linearGradient>
          </defs>
          <g>
            <path d="M2 4 L14 15 L14 225 L2 236 Z" fill="#cfeaff" opacity="0.4" />
            <path d="M2 4 L14 15 L14 225 L2 236 Z" fill="none" stroke="url(#gs-wood2)" strokeWidth="4" strokeLinejoin="round" />
          </g>
          <g transform="translate(320,0) scale(-1,1)">
            <path d="M2 4 L14 15 L14 225 L2 236 Z" fill="#cfeaff" opacity="0.4" />
            <path d="M2 4 L14 15 L14 225 L2 236 Z" fill="none" stroke="url(#gs-wood2)" strokeWidth="4" strokeLinejoin="round" />
          </g>
        </svg>
      </div>

      {/* 窓台（不透明の木の棚）＋小物 */}
      <div className={styles.sill} />
      <Books />
      <Plant />
      {/* 細いカーテン（両端・上から） */}
      <Curtain side="l" />
      <Curtain side="r" />
    </div>
  );
}
