// フレームの動きの部品。適性・ボックス・殿堂・連勝のフレームが共通で使う。
//
// 決めごと：**動きはぜんぶリングの上か内側に置く**。
// 以前は「フレームの周りを白い粒が飛ぶ」「細い光の弧が1本ぐるぐる回る」で、
// どちらも枠と関係のない別物が乗っているように見えて安っぽかった。
// いまは金属・宝石そのものが光る形にしてある。
//
//   1. Facets     … リングに刻んだカット面を、光源が一周しながら順に光らせる
//   2. MetalSheen … 帯全体を斜めの光がすうっと横切る（金属の光沢）
//   3. GemFlash   … リングに埋まった石が、順にきらりと十字に光る
//
// レア度が上がるほど、面が細かくなり・光沢が速くなり・光る石が増える。
// 粒や弧のような「別物」は足さない。

/** 動きを減らす設定のときは、位置だけ決めて動かさない（各部品が見る）。 */
export type FxBase = {
  /** 中心。どのフレームも viewBox 120 の 60。 */
  c: number;
  /** リング半径。 */
  r: number;
  /** この描画のためのユニークID（defs の衝突よけ）。 */
  uid: string;
  /** 動きを止める。 */
  still?: boolean;
};

/**
 * カット面のきらめき。
 *
 * リングを n 枚の面に割り、光源が一周しながら面を順に光らせる。
 * 弧が1本回るのと違い、宝石を傾けたときのように面ごとに順に立ち上がるので、
 * 素材の硬さと厚みが出る。
 */
export function Facets({
  c, r, w, count, color = '#fff', dur = 3.2, peak = 0.9, still,
}: FxBase & { w: number; count: number; color?: string; dur?: number; peak?: number }) {
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
 * 金属の光沢。
 *
 * 斜めのハイライト帯が、リング全体をすうっと横切る。細い弧が回るのではなく
 * **帯そのものが明るくなって流れる**ので、磨いた金属に光が走ったように見える。
 * 殿堂フレームの「金属らしさ」もこれで出す。
 *
 * 実装は、白い帯のグラデーションの位置（x1/x2）を動かすだけ。要素を回さないので
 * どの向きから見ても破綻せず、重ねてもリングの形を壊さない。
 */
export function MetalSheen({
  c, r, w, uid, dur = 3.6, strength = 0.75, still,
}: FxBase & { w: number; dur?: number; strength?: number }) {
  const id = `sheen-${uid}`;
  return (
    <>
      <defs>
        <linearGradient id={id} x1="-0.6" y1="-0.6" x2="0" y2="0">
          <stop offset="0%" stopColor="#fff" stopOpacity="0" />
          <stop offset="42%" stopColor="#fff" stopOpacity={strength * 0.55} />
          <stop offset="52%" stopColor="#fff" stopOpacity={strength} />
          <stop offset="62%" stopColor="#fff" stopOpacity={strength * 0.55} />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          {!still && (
            <>
              <animate attributeName="x1" values="-0.8;1.0;1.0" keyTimes="0;0.45;1" dur={`${dur}s`} repeatCount="indefinite" />
              <animate attributeName="y1" values="-0.8;1.0;1.0" keyTimes="0;0.45;1" dur={`${dur}s`} repeatCount="indefinite" />
              <animate attributeName="x2" values="-0.2;1.6;1.6" keyTimes="0;0.45;1" dur={`${dur}s`} repeatCount="indefinite" />
              <animate attributeName="y2" values="-0.2;1.6;1.6" keyTimes="0;0.45;1" dur={`${dur}s`} repeatCount="indefinite" />
            </>
          )}
        </linearGradient>
      </defs>
      <circle cx={c} cy={c} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={w} />
    </>
  );
}

/**
 * 石のきらめき。
 *
 * リングに埋まった石が順にきらりと光る。光り方は「十字の輝き＋にじみ」で、
 * 明滅ではなく“きらっ”と立ち上がって消える。`count` を増やすほど賑やかになるので、
 * レア度の差をそのまま数で出せる。
 *
 * @param angles 石を置く角度（度・真上が -90）。渡さなければ均等割り。
 */
export function GemFlash({
  c, r, count, angles, color = '#fff', size = 4.4, dur = 2.8, still,
}: FxBase & { count: number; angles?: number[]; color?: string; size?: number; dur?: number }) {
  const at = angles ?? Array.from({ length: count }, (_, i) => (i / count) * 360 - 90);
  return (
    <g>
      {at.slice(0, count).map((deg, i) => {
        const a = (deg * Math.PI) / 180;
        const x = c + Math.cos(a) * r;
        const y = c + Math.sin(a) * r;
        const begin = `${(i / Math.max(1, count)) * dur}s`;
        return (
          <g key={i} transform={`translate(${x} ${y})`} opacity={still ? 0.5 : 0}>
            {/* にじみ */}
            <circle r={size * 0.62} fill={color} opacity="0.55" />
            {/* 十字の輝き */}
            <path
              d={`M 0,${-size} L ${size * 0.22},${-size * 0.22} L ${size},0 L ${size * 0.22},${size * 0.22} L 0,${size} L ${-size * 0.22},${size * 0.22} L ${-size},0 L ${-size * 0.22},${-size * 0.22} Z`}
              fill={color}
            />
            {!still && (
              <>
                <animate attributeName="opacity" values="0;1;0.25;0" keyTimes="0;0.12;0.4;1" dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
                <animateTransform
                  attributeName="transform"
                  type="scale"
                  additive="sum"
                  values="0.3;1.15;0.85;0.3"
                  keyTimes="0;0.12;0.4;1"
                  dur={`${dur}s`}
                  begin={begin}
                  repeatCount="indefinite"
                />
              </>
            )}
          </g>
        );
      })}
    </g>
  );
}

/**
 * 連勝フレーム専用：勝った数だけ石が順に灯る。
 *
 * ほかのフレームと動きの意味がはっきり違うようにした部品。リングに並ぶ石が
 * **1個目から順に灯っていき、レベルの数まで点いたら少し見せて、また消えて数え直す**。
 * つまりアニメーションそのものが「何連勝か」を数えている。
 * Lv が上がるほど灯る数が増えるので、上位ほど画面が満ちて美しくなる。
 *
 * 光は石の位置（＝リングの上）だけで、外へは一切出さない。
 */
export function CountUpGems({
  c, r, level, max = 10, color, glow = '#fff', size = 2.6, still,
}: FxBase & { level: number; max?: number; color: string; glow?: string; size?: number }) {
  const n = Math.max(1, Math.min(max, level));
  /** 1個あたりの間 + 全部灯ったあとの余韻。 */
  const step = 0.42;
  const hold = 1.5;
  const dur = n * step + hold;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        // 真上から時計回りに、その連勝数ぶんだけ等間隔に並べる
        const deg = -90 + (i / n) * 360;
        const a = (deg * Math.PI) / 180;
        const x = c + Math.cos(a) * r;
        const y = c + Math.sin(a) * r;
        const on = (i * step) / dur; // 灯る瞬間（0..1）
        const off = (n * step + hold * 0.75) / dur; // 数え終わって消える瞬間
        return (
          <g key={i} transform={`translate(${x} ${y})`}>
            {/* 消えているときの受け皿（石の座）。これがあると点いていない場所も分かる */}
            <circle r={size * 0.72} fill={color} opacity="0.35" stroke="rgba(0,0,0,0.35)" strokeWidth="0.5" />
            <g opacity={still ? 1 : 0}>
              <circle r={size * 1.5} fill={glow} opacity="0.4" />
              <circle r={size} fill={glow} />
              <circle r={size * 0.44} fill="#fff" />
              {!still && (
                <animate
                  attributeName="opacity"
                  values="0;0;1;1;0;0"
                  keyTimes={`0;${on.toFixed(4)};${Math.min(off, on + 0.06).toFixed(4)};${off.toFixed(4)};${Math.min(1, off + 0.08).toFixed(4)};1`}
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
