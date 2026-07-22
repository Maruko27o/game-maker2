import type { DayNight } from '../logic/daynight';
import SkyLayers from './SkyLayers';
import styles from './GrassScene.module.css';

// 草むらの背景。共有の昼夜サイクルの空（SkyLayers）に、丘＋木のシルエットを重ねる。
// 昼夜の phase は親（Grass）が実時計から算出して渡す（既定1時間で一周）。
export default function GrassScene({ d, reduced }: { d: DayNight; reduced: boolean }) {
  const tint = `brightness(${(1 - d.nightMix * 0.5).toFixed(3)}) saturate(${(1 - d.nightMix * 0.12).toFixed(3)})`;
  return (
    <div className={styles.scene} aria-hidden>
      <SkyLayers d={d} reduced={reduced} />
      {/* 丘＋木（夜は暗く） */}
      <svg className={styles.hills} viewBox="0 0 400 340" preserveAspectRatio="xMidYMid slice" style={{ filter: tint }}>
        <defs>
          <linearGradient id="gs-hill-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#a6d86b" />
            <stop offset="1" stopColor="#8ec756" />
          </linearGradient>
          <linearGradient id="gs-hill-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8ecb52" />
            <stop offset="1" stopColor="#6fae3c" />
          </linearGradient>
        </defs>
        {/* back hill */}
        <path d="M0 250 Q120 200 230 236 T400 232 V340 H0 Z" fill="url(#gs-hill-back)" />
        {/* trees on the back hill */}
        <g>
          <rect x="70" y="212" width="9" height="26" rx="3" fill="#8a5a2b" />
          <circle cx="74.5" cy="206" r="22" fill="#5fa33a" />
          <circle cx="62" cy="212" r="14" fill="#6cb244" />
          <circle cx="88" cy="212" r="14" fill="#6cb244" />

          <rect x="316" y="214" width="8" height="24" rx="3" fill="#8a5a2b" />
          <circle cx="320" cy="208" r="18" fill="#5fa33a" />
          <circle cx="308" cy="214" r="11" fill="#6cb244" />
          <circle cx="332" cy="214" r="11" fill="#6cb244" />
        </g>
        {/* front hill */}
        <path d="M0 292 Q140 250 260 288 T400 286 V340 H0 Z" fill="url(#gs-hill-front)" />
      </svg>
    </div>
  );
}
