import { useId } from 'react';
import { effectById, SHAPE_PATH, type EffectDef } from '../data/effects';
import { partRarity } from '../data/parts';
import styles from './HorseEffect.module.css';

// エフェクトの描画。ウマ本体の「後ろ」に敷くのが前提（コスチュームを隠さないため）。
//
// view='body'  … マイウマの全身（viewBox 0 0 520 520・ウマは x60〜490 / y40〜470）
// view='face'  … アイコンの丸窓（同じ 520 座標系のうち、顔まわり cx382 cy130 r104）
//
// 動きはレアリティで変える（N=静止 / R=ゆっくり / SR=はっきり）。
// prefers-reduced-motion のときは CSS 側で全部止める。

type View = 'body' | 'face';

// 見た目の中心と広がり。face は丸窓の中に収まるように小さくする。
export const FRAME = {
  body: { cx: 250, cy: 268, r: 210, s: 1 },
  face: { cx: 382, cy: 130, r: 96, s: 0.46 },
} as const;

/** id から決まる擬似乱数（同じウマ・同じ装備なら毎回同じ配置になる）。 */
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
}

type Mote = { x: number; y: number; s: number; rot: number; delay: number; alt: boolean };

/** i 番目の粒に割り当てる 0..1 の値。区画に1つずつ入れてから区画の中で揺らす
 *  （層化サンプリング）。完全な乱数だと、少ない粒数では必ずどこかに固まりと
 *  すき間ができる ＝「あまいかおり」が片寄って見えていた原因。
 *  区画の中では動かすので、等間隔に整列した機械的な見た目にはならない。 */
function strat(i: number, n: number, rand: () => number, jitter = 0.8) {
  const pad = (1 - jitter) / 2;
  return (i + pad + rand() * jitter) / n;
}
/** 層化した値を軸ごとにずらすための入れ替え。x と y で同じ順に並ぶと
 *  斜めの一直線になってしまうので、互いに素な歩幅で番号を混ぜる。 */
function shuffled(i: number, n: number) {
  const step = n % 5 === 0 ? (n % 3 === 0 ? 7 : 3) : 5;
  return (i * step + 2) % n;
}

/** kind ごとの粒の置き方。view に関わらず「中心と半径」で決めるので両方で使える。 */
export function layout(def: EffectDef, f: { cx: number; cy: number; r: number }, dense: number): Mote[] {
  const n = Math.max(3, Math.round((def.count ?? 8) * dense));
  const rand = rng(def.id);
  // エフェクトごとに全体の向きを変える（層化しても全部が同じ位置から始まらない）。
  const spin = rand();
  const out: Mote[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    let x: number, y: number, s: number, rot: number;
    if (def.kind === 'orbit') {
      const a = t * Math.PI * 2;
      x = f.cx + Math.cos(a) * f.r * 0.92;
      y = f.cy + Math.sin(a) * f.r * 0.82;
      s = 0.85 + rand() * 0.4;
      rot = (a * 180) / Math.PI + 90;
    } else if (def.kind === 'petals') {
      // 上から降ってくる：左右に散らす。左右も上下も区画に割り当ててから揺らすので、
      // 「右半分だけに固まる」ような偏りが出ない。
      const ux = strat(i, n, rand);
      const uy = strat(shuffled(i, n), n, rand);
      x = f.cx + (ux * 2 - 1) * f.r * 1.02;
      y = f.cy - f.r * 0.95 + uy * f.r * 1.85;
      s = 0.7 + rand() * 0.6;
      rot = rand() * 360;
    } else if (def.kind === 'bubbles') {
      const ux = strat(i, n, rand);
      const uy = strat(shuffled(i, n), n, rand);
      x = f.cx + (ux * 2 - 1) * f.r * 1.0;
      y = f.cy + f.r * 0.9 - uy * f.r * 1.8;
      s = 0.55 + rand() * 0.7;
      rot = 0;
    } else if (def.kind === 'flames') {
      // 足もと。左右に並べ、真ん中ほど大きく
      const u = (i + 0.5) / n;
      x = f.cx + (u - 0.5) * f.r * 1.9;
      y = f.cy + f.r * 0.78 - Math.cos((u - 0.5) * Math.PI) * f.r * 0.12;
      s = 0.8 + Math.cos((u - 0.5) * Math.PI) * 0.6;
      rot = (u - 0.5) * 26;
    } else if (def.kind === 'rays') {
      const a = -Math.PI / 2 + t * Math.PI * 2;
      x = f.cx + Math.cos(a) * f.r * 0.95;
      y = f.cy + Math.sin(a) * f.r * 0.86;
      s = 0.9 + rand() * 0.3;
      rot = (a * 180) / Math.PI + 90;
    } else {
      // motes / glow：まわりにゆるく散らす（ウマに重ならないよう外周寄り）。
      // 角度は区画に1つずつ割り当ててから区画内で揺らす＝ぐるりを均等に囲みつつ、
      // 半径も回転もばらばらなので機械的な円にはならない。
      const a = (spin + strat(i, n, rand, 0.9)) * Math.PI * 2;
      const rr = f.r * (0.72 + rand() * 0.34);
      x = f.cx + Math.cos(a) * rr;
      y = f.cy + Math.sin(a) * rr * 0.9;
      s = 0.65 + rand() * 0.7;
      rot = rand() * 40 - 20;
    }
    out.push({ x, y, s, rot, delay: rand() * 2.6, alt: rand() < 0.4 });
  }
  return out;
}

export default function HorseEffect({ id, view }: { id: string | undefined; view: View }) {
  const uid = useId().replace(/:/g, '');
  const def = id ? effectById[id] : undefined;
  if (!def) return null;

  const f = FRAME[view];
  const rarity = partRarity(def.id); // N / R / SR
  const move = rarity === 'SR' ? styles.fast : rarity === 'R' ? styles.slow : '';
  const [c1, c2] = def.colors;
  // アイコンは面積が小さいので粒を減らす（顔が埋まって誰か分からなくなるため）
  const motes = def.kind === 'aurora' ? [] : layout(def, f, view === 'face' ? 0.6 : 1);
  const path = SHAPE_PATH[def.shape];
  const unit = 10; // SHAPE_PATH のだいたいの半径
  const base = (f.r / unit) * (view === 'face' ? 0.115 : 0.115); // 粒の基準倍率

  return (
    <g className={styles.wrap} aria-hidden>
      <defs>
        <radialGradient id={`eg-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={c1} stopOpacity={view === 'face' ? 0.4 : 0.45} />
          <stop offset="58%" stopColor={c1} stopOpacity={view === 'face' ? 0.2 : 0.28} />
          <stop offset="100%" stopColor={c2} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`ea-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c1} stopOpacity="0.5" />
          <stop offset="100%" stopColor={c2} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 後ろの光。どの kind でもうっすら敷いて「まとっている」感を出す。 */}
      <ellipse
        className={`${styles.halo} ${move}`}
        cx={f.cx}
        cy={f.cy}
        rx={f.r * 1.06}
        ry={f.r * 0.98}
        fill={`url(#eg-${uid})`}
      />

      {/* にじのアーチ：帯を後ろに広げる */}
      {def.kind === 'aurora' && (
        <g className={`${styles.aurora} ${move}`}>
          {['#ff6f6f', '#ffb45e', '#ffe066', '#69cf7a', '#4fb0ff', '#a06bff'].map((col, i) => (
            <path
              key={col}
              d={`M ${f.cx - f.r * 1.05},${f.cy + f.r * 0.62} A ${f.r * (1.05 - i * 0.09)},${f.r * (0.98 - i * 0.09)} 0 0,1 ${f.cx + f.r * 1.05},${f.cy + f.r * 0.62}`}
              fill="none"
              stroke={col}
              strokeOpacity="0.45"
              strokeWidth={f.r * 0.075}
              strokeLinecap="round"
            />
          ))}
        </g>
      )}

      {motes.map((m, i) => (
        <g
          key={i}
          className={`${styles.mote} ${styles[def.kind]} ${move} ${m.alt ? styles.alt : ''}`}
          style={{ animationDelay: `${m.delay.toFixed(2)}s` }}
          transform={`translate(${m.x.toFixed(1)} ${m.y.toFixed(1)}) rotate(${m.rot.toFixed(1)}) scale(${(base * m.s).toFixed(3)})`}
        >
          <path d={path} fill={m.alt ? c2 : c1} fillOpacity="0.92" stroke="#2b2118" strokeOpacity="0.35" strokeWidth={2.2} strokeLinejoin="round" />
        </g>
      ))}
    </g>
  );
}
