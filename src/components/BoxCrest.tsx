import type { BoxFrameKind } from '../types';

// 週末ボックスの紋章：丸のなかに描いた小さなウマの顔。
//
// 限定フレームの下の銘板と、限定称号の左端で同じ絵を使う。並べたときに
// 「同じイベントのもの」だと一目で分かるようにするための共通部品。
// 原点は円の中心。r を変えるとそのまま拡大縮小できる（viewBox に依存しない）。

const TONE: Record<BoxFrameKind, { bg: string; deep: string; edge: string; face: string; ink: string }> = {
  // ラッキー＝桃。フレームの色の循環のまんなかあたりを固定で使う。
  lucky: { bg: '#ffd3e4', deep: '#e0518c', edge: '#a52f60', face: '#fff6fa', ink: '#7a1c42' },
  // ゴールド＝ダイヤ。金は使わず、クリアな水色白。
  gold: { bg: '#eaf8ff', deep: '#b9e2f2', edge: '#5f96ad', face: '#ffffff', ink: '#2f5f73' },
};

export default function BoxCrest({ box, uid, r = 13 }: { box: BoxFrameKind; uid: string; r?: number }) {
  const t = TONE[box];
  // 顔は 1 単位系で描いて、最後に r 倍する。数値を触るときはこの中だけで完結する。
  const k = r / 13;
  return (
    <g>
      <defs>
        <radialGradient id={`crest-${uid}`} cx="50%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="55%" stopColor={t.bg} />
          <stop offset="100%" stopColor={t.deep} />
        </radialGradient>
      </defs>
      <circle cx={0} cy={0} r={r} fill={`url(#crest-${uid})`} stroke={t.edge} strokeWidth={1.6 * k} />
      <circle cx={0} cy={0} r={r - 2.2 * k} fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth={0.8 * k} />
      <g transform={`scale(${k})`}>
        {/* 耳。左右に開いた細めの三角。丸い頭に丸い耳だと別の動物に見えてしまう。 */}
        <path d="M -5.2,-4.8 L -6.4,-9.4 L -2.4,-6.8 Z" fill={t.face} stroke={t.edge} strokeWidth="1" strokeLinejoin="round" />
        <path d="M 5.2,-4.8 L 6.4,-9.4 L 2.4,-6.8 Z" fill={t.face} stroke={t.edge} strokeWidth="1" strokeLinejoin="round" />
        {/* 顔。額は広く、下にいくほどすぼまって鼻先になる（ウマの輪郭）。
            ここを丸いままにすると鼻づらが「鼻」に見えてブタになる。 */}
        <path
          d="M -5.4,-4.0 C -5.4,-7.4 5.4,-7.4 5.4,-4.0
             C 5.4,-1.0 4.0,1.0 3.0,2.6
             C 2.4,3.6 2.2,5.4 1.5,6.0
             C 0.8,6.6 -0.8,6.6 -1.5,6.0
             C -2.2,5.4 -2.4,3.6 -3.0,2.6
             C -4.0,1.0 -5.4,-1.0 -5.4,-4.0 Z"
          fill={t.face}
          stroke={t.edge}
          strokeWidth="1.15"
          strokeLinejoin="round"
        />
        {/* 白い流星（額から鼻先へ）。ウマらしさがひと目で出る。 */}
        <path d="M -0.9,-5.4 C -1.5,-1.4 -1.2,2.4 -0.8,5.2 L 0.9,5.2 C 1.2,2.4 1.4,-1.4 0.9,-5.4 Z" fill="#fff" opacity="0.85" />
        {/* 目 */}
        <circle cx={-2.7} cy={-2.2} r={1.05} fill={t.ink} />
        <circle cx={2.7} cy={-2.2} r={1.05} fill={t.ink} />
        <circle cx={-2.35} cy={-2.55} r={0.38} fill="#fff" />
        <circle cx={3.05} cy={-2.55} r={0.38} fill="#fff" />
        {/* 鼻先。顔の幅よりせまく、鼻の穴は小さな縦の切れこみ。 */}
        <path d="M -1.9,4.2 C -1.9,3.3 1.9,3.3 1.9,4.2 C 1.9,5.6 1.2,6.3 0,6.3 C -1.2,6.3 -1.9,5.6 -1.9,4.2 Z" fill={t.bg} stroke={t.edge} strokeWidth="0.8" />
        <path d="M -0.85,4.5 L -0.85,5.3 M 0.85,4.5 L 0.85,5.3" stroke={t.ink} strokeWidth="0.6" strokeLinecap="round" />
        {/* 前髪。耳のあいだからひと房。 */}
        <path d="M -2.8,-5.6 C -1.4,-8.2 1.4,-8.2 2.8,-5.6 C 1.6,-6.4 -1.6,-6.4 -2.8,-5.6 Z" fill={t.deep} />
        {/* ほおの赤み（かわいらしさ） */}
        <ellipse cx={-3.6} cy={0.4} rx={1.15} ry={0.75} fill={t.deep} opacity="0.55" />
        <ellipse cx={3.6} cy={0.4} rx={1.15} ry={0.75} fill={t.deep} opacity="0.55" />
      </g>
    </g>
  );
}
