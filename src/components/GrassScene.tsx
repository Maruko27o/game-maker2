import styles from './GrassScene.module.css';

// Decorative outdoor backdrop for the 草むら field: a sunny sky with clouds and a
// sun up top, rolling green hills with a couple of trees below. Purely cosmetic
// (pointer-events off, sits behind the tap hint). Drifting clouds respect
// prefers-reduced-motion via the stylesheet.
export default function GrassScene() {
  return (
    <svg
      className={styles.scene}
      viewBox="0 0 400 340"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <linearGradient id="gs-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe6ff" />
          <stop offset="1" stopColor="#eaf7ff" />
        </linearGradient>
        <linearGradient id="gs-hill-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a6d86b" />
          <stop offset="1" stopColor="#8ec756" />
        </linearGradient>
        <linearGradient id="gs-hill-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8ecb52" />
          <stop offset="1" stopColor="#6fae3c" />
        </linearGradient>
        <radialGradient id="gs-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff6c0" />
          <stop offset="0.6" stopColor="#ffe479" />
          <stop offset="1" stopColor="#ffd24d" />
        </radialGradient>
      </defs>

      {/* sky */}
      <rect x="0" y="0" width="400" height="340" fill="url(#gs-sky)" />

      {/* sun with rays (top-right) */}
      <g className={styles.sun}>
        <g stroke="#ffdf6b" strokeWidth="6" strokeLinecap="round">
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * 30 * Math.PI) / 180;
            const x = 328 + Math.cos(a);
            const y = 60 + Math.sin(a);
            return (
              <line
                key={i}
                x1={x + Math.cos(a) * 40}
                y1={y + Math.sin(a) * 40}
                x2={x + Math.cos(a) * 54}
                y2={y + Math.sin(a) * 54}
              />
            );
          })}
        </g>
        <circle cx="328" cy="60" r="34" fill="url(#gs-sun)" />
      </g>

      {/* clouds */}
      <g className={styles.cloudA} fill="#ffffff">
        <ellipse cx="90" cy="70" rx="34" ry="20" />
        <ellipse cx="118" cy="62" rx="26" ry="20" />
        <ellipse cx="62" cy="66" rx="22" ry="16" />
        <rect x="60" y="70" width="70" height="16" rx="8" />
      </g>
      <g className={styles.cloudB} fill="#ffffff" opacity="0.95">
        <ellipse cx="235" cy="115" rx="26" ry="15" />
        <ellipse cx="256" cy="108" rx="20" ry="15" />
        <rect x="212" y="114" width="60" height="12" rx="6" />
      </g>

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
  );
}
