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

// 窓台に載せる繊細な鉢植え（葉は土から生えて見えるように）。
function Plant() {
  return (
    <svg className={styles.plant} width="44" height="52" viewBox="0 0 44 52">
      <g transform="translate(22 48)">
        {/* pot body + back rim + soil, then leaves rooted in the soil */}
        <path d="M-11 -16 H11 L8.5 2 H-8.5 Z" fill="#d07a48" stroke="#9a5a30" strokeWidth="1" />
        <ellipse cx="0" cy="-16" rx="11" ry="3" fill="#c06a38" />
        <ellipse cx="0" cy="-16.5" rx="8.5" ry="2.2" fill="#5b3f27" />
        <path d="M-5 -16 Q-13 -30 -11 -44 Q-3 -30 -1 -17" fill="#5aa145" />
        <path d="M5 -16 Q13 -30 11 -44 Q3 -30 1 -17" fill="#5aa145" />
        <path d="M-2 -16.5 Q-3 -36 0 -48 Q3 -36 2 -16.5" fill="#74c65c" />
        <path d="M0 -16 Q-2 -32 -0.5 -46" fill="none" stroke="#4f8f3e" strokeWidth="0.6" opacity="0.5" />
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
    </div>
  );
}
