// フレームの動きの部品。適性フレーム・ボックス限定フレームが共通で使う。
//
// これまではどのフレームも「光の弧が1本まわる＋オーラが明滅する」だけで、
// レア度の差が速さと数しかなく、上等なものほど雑に見えていた。
//
// ここでは動きを4種類に分け、**レア度が上がるほど種類が増える**ようにする。
//   1. Facets … リングに刻んだカット面を、光源が一周しながら順に光らせる（全等級）
//   2. Orbit  … フレームの周りを尾を引いた光の粒が巡る（B以上）
//   3. Pulse  … 外周のオーラが「ドクン・ドクン」と二段で脈打つ（A以上）
//   4. Rainbow… 虹が回る（Sとボックス限定だけ）
//
// 何が増えたかが一目で分かるので、C と S を並べたときの格の差がはっきりする。
// 部品を1か所にまとめてあるので、動きを直すときはここだけを見ればよい。

/** 動きを減らす設定のときは、位置だけ決めて動かさない（各部品が見る）。 */
export type FxProps = {
  /** 中心。どのフレームも viewBox 120 の 60。 */
  c: number;
  /** リング半径。 */
  r: number;
  /** リングの太さ。 */
  w: number;
  /** この描画のためのユニークID（defs の衝突よけ）。 */
  uid: string;
};

/**
 * カット面のきらめき。
 *
 * リングを n 枚の面に割り、光源が一周しながら面を順に光らせる。
 * 「光の弧が1本ぐるぐる回る」のと違い、宝石を傾けたときのように
 * 面ごとに順に立ち上がるので、素材の硬さと厚みが出る。
 */
export function Facets({
  c, r, w, count, color = '#fff', dur = 3.2, peak = 0.9, still,
}: FxProps & { count: number; color?: string; dur?: number; peak?: number; still?: boolean }) {
  const circ = 2 * Math.PI * r;
  const seg = circ / count;
  const lit = seg * 0.62; // 面のうち光る幅。全部光らせるとただの発光になる。
  return (
    <g>
      {Array.from({ length: count }, (_, i) => (
        <circle
          key={i}
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={w - 2.2}
          strokeLinecap="butt"
          strokeDasharray={`${lit} ${circ - lit}`}
          strokeDashoffset={-seg * i}
          opacity={still ? 0.28 : 0}
        >
          {!still && (
            <animate
              attributeName="opacity"
              values={`0;${peak};0`}
              keyTimes="0;0.5;1"
              dur={`${dur}s`}
              begin={`${(i / count) * dur}s`}
              repeatCount="indefinite"
            />
          )}
        </circle>
      ))}
      {/* 面のつなぎ目。線が入ることで「割られている」ことが伝わる。 */}
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="rgba(0,0,0,0.28)"
        strokeWidth={w}
        strokeDasharray={`1.4 ${seg - 1.4}`}
      />
    </g>
  );
}

/**
 * 巡る光の粒。
 *
 * 粒ごとに独立した輪を回し、その中で小さな円を3つ並べて尾に見せる。
 * 速さと半径を粒ごとに散らすので、そろって回る機械的な感じにならない。
 */
export function Orbit({
  c, r, count, color = '#fff', still,
}: Omit<FxProps, 'w'> & { count: number; color?: string; still?: boolean }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const ring = r + 5 + (i % 3) * 3.2; // 3層に散らす
        const dur = 4.6 + (i % 4) * 1.35;
        const from = (i / count) * 360;
        return (
          <g key={i}>
            <g transform={`rotate(${from} ${c} ${c})`}>
              {/* 尾：本体のうしろに小さく薄い粒を2つ置く */}
              <circle cx={c} cy={c - ring} r={1.5} fill={color} opacity="0.95" />
              <circle cx={c + 2.4} cy={c - ring + 0.9} r={1.05} fill={color} opacity="0.5" />
              <circle cx={c + 4.6} cy={c - ring + 2.1} r={0.7} fill={color} opacity="0.24" />
              {!still && (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from={`${from} ${c} ${c}`}
                  to={`${from + 360} ${c} ${c}`}
                  dur={`${dur}s`}
                  repeatCount="indefinite"
                />
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
}

/**
 * 外周オーラの二段脈動。
 *
 * 「ドクン、ドクン」と2回続けて強まってから休む。均等な明滅よりも生きている感が
 * 出て、上位の等級だけが持つ特別さになる。
 */
export function Pulse({
  c, r, color, uid, still,
}: Omit<FxProps, 'w'> & { color: string; still?: boolean }) {
  return (
    <>
      <defs>
        <radialGradient id={`fxpulse-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="58%" stopColor={color} stopOpacity="0" />
          <stop offset="84%" stopColor={color} stopOpacity="0.62" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={c} cy={c} r={r + 11} fill={`url(#fxpulse-${uid})`} opacity={still ? 0.6 : undefined}>
        {!still && (
          <>
            {/* 強・弱・強・弱・休み の5拍で「ドクン・ドクン…」になる */}
            <animate
              attributeName="opacity"
              values="0.35;1;0.5;0.9;0.35;0.35"
              keyTimes="0;0.12;0.24;0.36;0.5;1"
              dur="2.6s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values={`${r + 9};${r + 13};${r + 10};${r + 12.4};${r + 9};${r + 9}`}
              keyTimes="0;0.12;0.24;0.36;0.5;1"
              dur="2.6s"
              repeatCount="indefinite"
            />
          </>
        )}
      </circle>
    </>
  );
}
