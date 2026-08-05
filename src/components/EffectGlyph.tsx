import { effectById, SHAPE_PATH } from '../data/effects';

// エフェクトの小さな見本。エフェクト枠のパーツはウマ本体に描くものが無い（＝生の
// SVG が空）ので、着せ替えや図鑑の一覧では何も出ずに真っ白に見えていた。
// ここでは「色の玉＋その粒の形」を並べて、どのエフェクトかが一目で分かるようにする。
export default function EffectGlyph({ id, className }: { id: string; className?: string }) {
  const def = effectById[id];
  if (!def) return null;
  const [c1, c2] = def.colors;
  const path = SHAPE_PATH[def.shape];
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <radialGradient id={`gl-${id}`} cx="50%" cy="46%" r="52%">
          <stop offset="0%" stopColor={c2} stopOpacity="0.95" />
          <stop offset="62%" stopColor={c1} stopOpacity="0.65" />
          <stop offset="100%" stopColor={c1} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill={`url(#gl-${id})`} />
      {/* 中央に大きく1つ、まわりに小さく2つ */}
      <g transform="translate(50 50) scale(2.1)">
        <path d={path} fill={c1} stroke="#2b2118" strokeOpacity="0.4" strokeWidth="2.2" strokeLinejoin="round" />
      </g>
      <g transform="translate(22 26) scale(1.1)">
        <path d={path} fill={c2} stroke="#2b2118" strokeOpacity="0.35" strokeWidth="2.6" strokeLinejoin="round" />
      </g>
      <g transform="translate(78 72) scale(1.1)">
        <path d={path} fill={c2} stroke="#2b2118" strokeOpacity="0.35" strokeWidth="2.6" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
