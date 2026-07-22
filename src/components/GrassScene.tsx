import type { DayNight } from '../logic/daynight';
import SkyLayers from './SkyLayers';
import styles from './GrassScene.module.css';

// 草むらの背景を「ログハウスの窓ごしの眺め」に。外の景色は共有の昼夜サイクル
// （SkyLayers＋丘＋木）、周囲は丸太壁、木製フレーム＋細い開き障子、窓台に本と
// 鉢植え、両端にスッと細いカーテン。昼夜 phase は親（Grass）が実時計から渡す。

// 質感を上げた木（樹冠を重ねる）。
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

function Books() {
  return (
    <svg className={styles.books} width="64" height="34" viewBox="0 0 64 34">
      <g transform="translate(6 24)">
        <rect x="0" y="0" width="50" height="8" rx="1.6" fill="#93aec7" stroke="#6e88a3" strokeWidth="0.7" />
        <rect x="3" y="2.2" width="44" height="1.2" fill="#c8d6e6" opacity="0.7" />
        <g transform="translate(3 -8) rotate(-2)">
          <rect x="0" y="0" width="42" height="7.5" rx="1.6" fill="#d7a58a" stroke="#b07a5f" strokeWidth="0.7" />
          <rect x="3" y="2" width="36" height="1" fill="#f0d8c8" opacity="0.7" />
        </g>
        <g transform="translate(-2 -15.5) rotate(2.5)">
          <rect x="0" y="0" width="47" height="7.5" rx="1.6" fill="#9fbf9c" stroke="#6f9370" strokeWidth="0.7" />
          <rect x="3" y="2" width="40" height="1" fill="#d6e6cf" opacity="0.7" />
        </g>
        <g transform="translate(6 -23) rotate(-3)">
          <rect x="0" y="0" width="32" height="7" rx="1.6" fill="#e6d08a" stroke="#c0a760" strokeWidth="0.7" />
          <rect x="14" y="-4" width="3" height="6" fill="#c85a52" />
        </g>
      </g>
    </svg>
  );
}

function Plant() {
  return (
    <svg className={styles.plant} width="48" height="60" viewBox="0 0 48 60">
      <g transform="translate(24 56)">
        <g stroke="#4f8f3e" strokeWidth="0.6">
          <path d="M0 -4 Q-14 -20 -18 -40 Q-6 -26 0 -8" fill="#5aa145" />
          <path d="M0 -4 Q14 -20 18 -40 Q6 -26 0 -8" fill="#5aa145" />
          <path d="M0 -4 Q-8 -26 -3 -46 Q4 -30 0 -10" fill="#6bbf52" />
          <path d="M0 -4 Q8 -26 3 -46 Q-4 -30 0 -10" fill="#63b24b" />
          <path d="M0 -6 Q-2 -34 0 -52 Q2 -34 0 -12" fill="#74c65c" />
        </g>
        <path d="M-12 0 H12 L9.5 20 H-9.5 Z" fill="#d07a48" stroke="#9a5a30" strokeWidth="1" />
        <ellipse cx="0" cy="0" rx="12" ry="3.2" fill="#e2a56f" stroke="#9a5a30" strokeWidth="1" />
        <ellipse cx="0" cy="0" rx="8.5" ry="2" fill="#6f4326" opacity="0.5" />
        <path d="M-8 3 Q-9 12 -6 18" fill="none" stroke="#f0c79a" strokeWidth="1.4" opacity="0.7" />
      </g>
    </svg>
  );
}

function Curtain({ side }: { side: 'l' | 'r' }) {
  return (
    <svg className={side === 'l' ? styles.curtainL : styles.curtainR} width="34" height="220" viewBox="0 0 34 220" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`cur-${side}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f7ecd9" /><stop offset="1" stopColor="#ead3b4" /></linearGradient>
      </defs>
      <g transform={side === 'r' ? 'translate(34,0) scale(-1,1)' : ''}>
        <path d="M0 8 L26 8 C 24 66 26 108 18 122 C 26 146 24 200 26 220 L0 220 Z" fill={`url(#cur-${side})`} />
        <path d="M12 14 C 18 66 17 100 14 120" fill="none" stroke="#d7ad81" strokeWidth="1.4" opacity="0.5" />
        <path d="M18 132 C 22 172 20 204 16 218" fill="none" stroke="#d7ad81" strokeWidth="1.4" opacity="0.45" />
        <path d="M2 122 Q16 114 30 124" fill="none" stroke="#9c5f2c" strokeWidth="4" strokeLinecap="round" />
        <path d="M30 126 l-1 12 M30 126 l1 12" stroke="#7d4a20" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export default function GrassScene({ d, reduced }: { d: DayNight; reduced: boolean }) {
  const tint = `brightness(${(1 - d.nightMix * 0.5).toFixed(3)}) saturate(${(1 - d.nightMix * 0.12).toFixed(3)})`;
  return (
    <div className={styles.scene} aria-hidden>
      {/* 丸太を積んだ壁 */}
      <svg className={styles.wall} viewBox="0 0 320 300" preserveAspectRatio="none">
        <defs>
          <linearGradient id="gs-log" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dcb680" /><stop offset="0.22" stopColor="#cba674" /><stop offset="1" stopColor="#a9814a" /></linearGradient>
          <linearGradient id="gs-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b07b45" /><stop offset="1" stopColor="#8a5a2f" /></linearGradient>
        </defs>
        {Array.from({ length: 11 }).map((_, i) => {
          const y = -6 + i * 30;
          return (
            <g key={i}>
              <rect x="-4" y={y} width="328" height="30" fill="url(#gs-log)" />
              <path d={`M-4 ${y + 15} q60 -3 120 0 t120 0 t92 0`} fill="none" stroke="#9c743e" strokeWidth="1" opacity="0.32" />
              <rect x="-4" y={y + 27} width="328" height="3" fill="#6f4e28" opacity="0.5" />
            </g>
          );
        })}
      </svg>

      {/* 木製フレーム＋窓（外の景色） */}
      <div className={styles.frameBox}>
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
            <g>
              <path d="M2 4 L15 16 L15 224 L2 236 Z" fill="#cfeaff" opacity="0.4" />
              <path d="M2 4 L15 16 L15 224 L2 236 Z" fill="none" stroke="url(#gs-wood)" strokeWidth="4" strokeLinejoin="round" />
            </g>
            <g transform="translate(320,0) scale(-1,1)">
              <path d="M2 4 L15 16 L15 224 L2 236 Z" fill="#cfeaff" opacity="0.4" />
              <path d="M2 4 L15 16 L15 224 L2 236 Z" fill="none" stroke="url(#gs-wood)" strokeWidth="4" strokeLinejoin="round" />
            </g>
          </svg>
        </div>
      </div>

      {/* 窓台と小物 */}
      <div className={styles.sill} />
      <Books />
      <Plant />
      <Curtain side="l" />
      <Curtain side="r" />
    </div>
  );
}
