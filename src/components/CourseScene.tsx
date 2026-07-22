import type { Course } from '../data/courses';

// 見た目のテーマ（sim の surface とは別。trail/circuit は surface=turf だが見た目は
// 山道／夜景）。コース id から決める。
export type CourseTheme = 'grass' | 'dirt' | 'trail' | 'sand' | 'jump' | 'night';
const THEME_BY_ID: Record<string, CourseTheme> = {
  green: 'grass', dirt: 'dirt', trail: 'trail', sand: 'sand', jump: 'jump', circuit: 'night',
};
export function courseTheme(course: Course): CourseTheme {
  return THEME_BY_ID[course.id] ?? 'grass';
}
export const THEME_LABEL: Record<CourseTheme, string> = {
  grass: '芝', dirt: 'ダート', trail: '山道', sand: '砂', jump: '障害', night: 'ナイター',
};

// コース抽選タイル用のテーマ別ミニ風景（陰影・ハイライト付きの描き込み）。グラデーションは
// SceneDefs で一度だけ定義し、各シーンは id 参照で共有する（リールで多数描画しても軽い）。

export function SceneDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <linearGradient id="cs-skyday" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7cc3ee" /><stop offset="0.6" stopColor="#a9dcf0" /><stop offset="1" stopColor="#d8eef6" /></linearGradient>
        <linearGradient id="cs-skysoft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9ad2ef" /><stop offset="1" stopColor="#e6f4f7" /></linearGradient>
        <linearGradient id="cs-skysand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3bd7e" /><stop offset="0.6" stopColor="#f7d9a8" /><stop offset="1" stopColor="#faeccf" /></linearGradient>
        <linearGradient id="cs-skynight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0d1638" /><stop offset="0.7" stopColor="#1e2550" /><stop offset="1" stopColor="#33396a" /></linearGradient>
        <radialGradient id="cs-sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#fff6c8" /><stop offset="0.6" stopColor="#ffe27a" /><stop offset="1" stopColor="#ffcb4d" /></radialGradient>
        <radialGradient id="cs-sunhot" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#fff2d0" /><stop offset="0.6" stopColor="#ffc98a" /><stop offset="1" stopColor="#ff9d5a" /></radialGradient>
        <radialGradient id="cs-moon" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stopColor="#ffffff" /><stop offset="0.7" stopColor="#e9edf7" /><stop offset="1" stopColor="#c7d0e6" /></radialGradient>
        <linearGradient id="cs-gback" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a9dc6a" /><stop offset="1" stopColor="#84c24f" /></linearGradient>
        <linearGradient id="cs-gfront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#83bd4a" /><stop offset="1" stopColor="#63a636" /></linearGradient>
        <linearGradient id="cs-dback" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b5824c" /><stop offset="1" stopColor="#9a6a38" /></linearGradient>
        <linearGradient id="cs-dfront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#93602f" /><stop offset="1" stopColor="#7a4f27" /></linearGradient>
        <linearGradient id="cs-sback" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ecca8e" /><stop offset="1" stopColor="#dcb672" /></linearGradient>
        <linearGradient id="cs-sfront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9ac66" /><stop offset="1" stopColor="#c6974f" /></linearGradient>
      </defs>
    </svg>
  );
}

function Clouds({ o = 1 }: { o?: number }) {
  return (
    <g fill="#ffffff" opacity={o}>
      <g opacity="0.95"><ellipse cx="46" cy="30" rx="20" ry="11" /><ellipse cx="64" cy="26" rx="15" ry="11" /><rect x="30" y="30" width="42" height="9" rx="4.5" /></g>
      <g opacity="0.8"><ellipse cx="150" cy="20" rx="14" ry="8" /><ellipse cx="163" cy="16" rx="10" ry="8" /><rect x="138" y="20" width="34" height="7" rx="3.5" /></g>
    </g>
  );
}

// 220×140。上=空、下=地面。陰影とハイライトを重ねる。
export default function CourseScene({ theme }: { theme: CourseTheme }) {
  if (theme === 'grass')
    return (
      <g>
        <rect width="220" height="140" fill="url(#cs-skyday)" />
        <g><circle cx="184" cy="30" r="15" fill="url(#cs-sun)" />
          <g stroke="#ffdf6b" strokeWidth="2.4" strokeLinecap="round" opacity="0.8">{Array.from({ length: 8 }).map((_, i) => { const a = (i * 45 * Math.PI) / 180; return <line key={i} x1={184 + Math.cos(a) * 19} y1={30 + Math.sin(a) * 19} x2={184 + Math.cos(a) * 25} y2={30 + Math.sin(a) * 25} />; })}</g></g>
        <Clouds />
        <path d="M0 92 Q70 70 130 86 T220 84 V140 H0 Z" fill="url(#cs-gback)" />
        <path d="M0 92 Q70 70 130 86 T220 84" fill="none" stroke="#bde78a" strokeWidth="2" opacity="0.6" />
        <path d="M0 114 Q90 94 160 110 T220 108 V140 H0 Z" fill="url(#cs-gfront)" />
        {/* rail with shadows */}
        {[18, 62, 106, 150, 194].map((x) => <g key={x}><rect x={x} y="107" width="4" height="17" rx="2" fill="#7a5230" opacity="0.25" transform={`translate(2 1)`} /><rect x={x} y="104" width="4" height="18" rx="2" fill="#f4ecd6" /><rect x={x - 6} y="106" width="16" height="3.4" rx="1.7" fill="#f4ecd6" /><rect x={x - 6} y="109" width="16" height="1.4" rx="0.7" fill="#c9b98f" /></g>)}
        {/* grass tufts */}
        {[[30, 130], [110, 134], [190, 130]].map(([x, y], i) => <g key={i} stroke="#4f8f2e" strokeWidth="2" strokeLinecap="round"><path d={`M${x} ${y} l-4 -8 M${x} ${y} l0 -10 M${x} ${y} l4 -8`} /></g>)}
      </g>
    );
  if (theme === 'dirt')
    return (
      <g>
        <rect width="220" height="140" fill="url(#cs-skysoft)" />
        <Clouds o={0.9} />
        <path d="M0 86 Q70 72 140 82 T220 80 V140 H0 Z" fill="url(#cs-dback)" />
        <path d="M0 104 Q90 94 150 102 T220 100 V140 H0 Z" fill="url(#cs-dfront)" />
        {/* puddle with reflection + rim */}
        <ellipse cx="150" cy="120" rx="36" ry="9" fill="#3f4a52" opacity="0.35" />
        <ellipse cx="150" cy="118" rx="33" ry="8" fill="#8fb6cf" />
        <ellipse cx="150" cy="117" rx="24" ry="5" fill="#cfe6f2" opacity="0.8" />
        <ellipse cx="144" cy="116" rx="8" ry="1.8" fill="#ffffff" opacity="0.7" />
        {/* mud clumps + hoof marks */}
        {[[36, 112, 4], [58, 124, 3], [92, 116, 3.4], [116, 128, 2.6]].map(([x, y, r], i) => <g key={i}><ellipse cx={x} cy={y as number} rx={r as number} ry={(r as number) * 0.6} fill="#5f3f20" /><ellipse cx={x} cy={(y as number) - 1} rx={(r as number) * 0.6} ry={(r as number) * 0.3} fill="#8a5f30" /></g>)}
        {/* fence */}
        <g transform="translate(30 78)"><rect x="-3" y="0" width="5" height="22" fill="#8a6a3a" /><rect x="34" y="0" width="5" height="22" fill="#8a6a3a" /><rect x="-4" y="4" width="44" height="4" rx="2" fill="#a9865a" /><rect x="-4" y="12" width="44" height="4" rx="2" fill="#a9865a" /></g>
      </g>
    );
  if (theme === 'trail')
    return (
      <g>
        <rect width="220" height="140" fill="url(#cs-skysoft)" />
        {/* mountains with shaded sides + snow caps */}
        <g><path d="M-14 96 L40 38 L94 96 Z" fill="#8b9a72" /><path d="M40 38 L94 96 L40 96 Z" fill="#75855f" /><path d="M26 52 L40 38 L54 54 L46 58 L40 50 L34 58 Z" fill="#ffffff" /></g>
        <g><path d="M56 96 L124 30 L192 96 Z" fill="#7d8c62" /><path d="M124 30 L192 96 L124 96 Z" fill="#697855" /><path d="M108 46 L124 30 L142 50 L132 55 L124 44 L118 55 Z" fill="#ffffff" /></g>
        <g><path d="M150 96 L206 48 L250 96 Z" fill="#93a074" /><path d="M206 48 L250 96 L206 96 Z" fill="#7f8d63" /></g>
        <path d="M0 108 Q60 96 110 108 T220 106 V140 H0 Z" fill="url(#cs-gfront)" />
        {/* winding path with soft edges */}
        <path d="M28 140 Q118 104 214 122" fill="none" stroke="#7a5c34" strokeWidth="13" strokeLinecap="round" opacity="0.35" />
        <path d="M28 140 Q118 104 214 122" fill="none" stroke="#cdb083" strokeWidth="9" strokeLinecap="round" />
        <path d="M28 140 Q118 104 214 122" fill="none" stroke="#e4cfa4" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        {/* pines */}
        {[[150, 108, 1], [176, 112, 0.8]].map(([x, y, s], i) => <g key={i} transform={`translate(${x} ${y}) scale(${s})`}><rect x="-2.5" y="0" width="5" height="12" fill="#7a5230" /><path d="M0 -20 l12 18 h-24 z" fill="#3f7f2b" /><path d="M0 -20 l12 18 h-12 z" fill="#357026" /><path d="M0 -12 l9 14 h-18 z" fill="#468e32" /></g>)}
      </g>
    );
  if (theme === 'sand')
    return (
      <g>
        <rect width="220" height="140" fill="url(#cs-skysand)" />
        <circle cx="150" cy="44" r="30" fill="url(#cs-sunhot)" opacity="0.35" />
        <circle cx="150" cy="44" r="21" fill="url(#cs-sunhot)" />
        <path d="M0 92 Q60 76 120 88 T220 86 V140 H0 Z" fill="url(#cs-sback)" />
        <path d="M0 92 Q60 76 120 88 T220 86" fill="none" stroke="#f5e2b8" strokeWidth="2" opacity="0.7" />
        <path d="M0 112 Q80 96 150 108 T220 106 V140 H0 Z" fill="url(#cs-sfront)" />
        <path d="M0 112 Q80 96 150 108 T220 106" fill="none" stroke="#e8cd94" strokeWidth="2" opacity="0.6" />
        {/* ripples */}
        <g stroke="#c6974f" strokeWidth="1.2" opacity="0.4">{[[24, 126], [70, 132], [120, 128], [170, 134]].map(([x, y], i) => <path key={i} d={`M${x} ${y} q8 -3 16 0`} fill="none" />)}</g>
        {/* cactus with shading */}
        <g transform="translate(42 92)"><ellipse cx="0" cy="6" rx="14" ry="4" fill="#6f4a24" opacity="0.25" /><rect x="-6" y="-32" width="12" height="38" rx="6" fill="#4f9a45" /><rect x="-6" y="-32" width="4" height="38" rx="2" fill="#5fb051" /><rect x="-18" y="-20" width="12" height="9" rx="4.5" fill="#4f9a45" /><rect x="-18" y="-26" width="7" height="18" rx="3.5" fill="#4f9a45" /><rect x="6" y="-24" width="12" height="9" rx="4.5" fill="#4f9a45" /><rect x="11" y="-32" width="7" height="18" rx="3.5" fill="#4f9a45" /></g>
      </g>
    );
  if (theme === 'jump')
    return (
      <g>
        <rect width="220" height="140" fill="url(#cs-skyday)" />
        <Clouds />
        <path d="M0 90 Q70 70 140 84 T220 82 V140 H0 Z" fill="url(#cs-gback)" />
        <path d="M0 112 Q90 94 160 108 T220 106 V140 H0 Z" fill="url(#cs-gfront)" />
        {/* dashed jump arc */}
        <path d="M56 120 Q110 86 166 120" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeDasharray="6 6" opacity="0.75" />
        {/* hurdle with posts + shadow */}
        <g transform="translate(110 86)">
          <ellipse cx="0" cy="30" rx="46" ry="6" fill="#3f5f2a" opacity="0.3" />
          <rect x="-42" y="2" width="6" height="26" rx="2" fill="#7a5230" /><rect x="36" y="2" width="6" height="26" rx="2" fill="#7a5230" />
          <rect x="-44" y="-6" width="88" height="10" rx="3" fill="#efe8d6" stroke="#b7ac90" strokeWidth="1.4" />
          <g fill="#d0483f">{[-38, -18, 2, 22].map((x) => <rect key={x} x={x} y="-6" width="10" height="10" />)}</g>
          <rect x="-44" y="-6" width="88" height="3" rx="1.5" fill="#ffffff" opacity="0.4" />
        </g>
      </g>
    );
  // circuit (night)
  return (
    <g>
      <rect width="220" height="140" fill="url(#cs-skynight)" />
      {[[16, 12], [54, 24], [92, 10], [128, 22], [170, 12], [202, 26]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 1 : 1.5} fill="#fff" opacity="0.85" />)}
      <circle cx="188" cy="26" r="12" fill="url(#cs-moon)" />
      <circle cx="188" cy="26" r="16" fill="#cdd7f0" opacity="0.18" />
      {/* skyline: two depth layers */}
      <g fill="#232a52">{[[4, 70, 22, 40], [70, 74, 26, 36], [180, 66, 34, 44]].map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} />)}</g>
      <g fill="#2c3462">{[[28, 58, 20, 52], [50, 66, 18, 44], [98, 62, 24, 48], [124, 70, 20, 40], [150, 54, 22, 56]].map(([x, y, w, h], i) => <rect key={i} x={x} y={y} width={w} height={h} />)}</g>
      {/* windows */}
      <g fill="#ffd66b">{[[33, 64], [40, 74], [56, 72], [104, 68], [112, 80], [128, 76], [156, 60], [163, 74], [156, 88]].map(([x, y], i) => <rect key={i} x={x} y={y} width="4" height="5" opacity={0.9} />)}</g>
      {/* track */}
      <path d="M0 110 Q110 100 220 110 V140 H0 Z" fill="#3a4068" />
      <path d="M0 114 Q110 105 220 114" fill="none" stroke="#ffe27a" strokeWidth="2.4" strokeDasharray="16 12" opacity="0.9" />
      <path d="M0 128 Q110 121 220 128" fill="none" stroke="#8a93bd" strokeWidth="1.6" strokeDasharray="10 10" opacity="0.6" />
      {/* lamp posts with glow */}
      {[34, 110, 186].map((x) => <g key={x}><rect x={x - 1} y="92" width="2" height="20" fill="#99a1c6" /><circle cx={x} cy="90" r="6" fill="#fff3b0" opacity="0.35" /><circle cx={x} cy="90" r="3" fill="#fff6c8" /></g>)}
    </g>
  );
}
