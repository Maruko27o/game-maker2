import styles from './GrassRoom.module.css';

// 草むら画面を包む「ログハウスの部屋」。壁＝丸太（CSS）、床＝板張り、床には
// ラグ・観葉植物・眠る猫・積んだ本＋ランタンを配置。純装飾（pointer-events:none）。
// 窓（フレーム）は Grass 側のカード、外の眺めは GrassScene が担当する。

// 観葉植物：鉢→縁→土 の順に描き、葉は土の面から生やす（＝土に植わって見える）。
function FloorPlant({ x, baseY, s = 1 }: { x: number; baseY: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${baseY}) scale(${s})`}>
      <ellipse cx="0" cy="2" rx="26" ry="7" fill="#3a2c1c" opacity="0.18" />
      {/* pot body + rim + soil surface */}
      <path d="M-24 -30 H24 L18 20 H-18 Z" fill="url(#gr-pot)" stroke="#9a5a30" strokeWidth="1.6" />
      <path d="M-15 -22 Q-18 -4 -12 14" fill="none" stroke="#f0c79a" strokeWidth="2.2" opacity="0.55" />
      <ellipse cx="0" cy="-30" rx="24" ry="6" fill="#c9814a" />
      <ellipse cx="0" cy="-31" rx="19" ry="4.2" fill="#5b3f27" />
      {/* leaves rooted in the soil (bases sit on the soil surface) */}
      <g>
        <path d="M-8 -30 Q-28 -66 -18 -126 Q-8 -72 -2 -31 Z" fill="#4f9a37" />
        <path d="M8 -30 Q28 -64 18 -128 Q8 -74 2 -31 Z" fill="#57a83f" />
        <path d="M-4 -31 Q-16 -84 -5 -140 Q1 -86 -1 -32 Z" fill="#68b64f" />
        <path d="M4 -31 Q16 -82 5 -138 Q-1 -84 1 -32 Z" fill="#5fae46" />
        <path d="M0 -31 Q-2 -96 0 -150 Q2 -96 0 -32 Z" fill="#74c65c" />
      </g>
      {/* thin front lip so leaves read as coming out from behind the rim front */}
      <path d="M-24 -30 Q0 -24 24 -30" fill="none" stroke="#b5713f" strokeWidth="2" opacity="0.7" />
    </g>
  );
}

// ランタン：底面を baseY（＝床）にぴったり接地。
function Lantern({ x, baseY, s = 1 }: { x: number; baseY: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${baseY}) scale(${s})`}>
      <ellipse cx="0" cy="0" rx="26" ry="7" fill="#ffd77a" opacity="0.3" />
      <rect x="-15" y="-6" width="30" height="7" rx="3" fill="#8a6a3a" />
      <rect x="-13" y="-40" width="26" height="34" rx="3" fill="#caa24f" stroke="#7a5a2f" strokeWidth="1.5" />
      <rect x="-9" y="-35" width="18" height="24" rx="2" fill="#fff2b8" />
      <rect x="-9" y="-35" width="18" height="24" rx="2" fill="#ffcf5e" opacity="0.5" />
      <rect x="-14" y="-50" width="28" height="10" rx="4" fill="#8a6a3a" />
      <rect x="-3" y="-56" width="6" height="7" rx="2" fill="#7a5a34" />
    </g>
  );
}

function FloorBooks({ x, baseY }: { x: number; baseY: number }) {
  return (
    <g transform={`translate(${x} ${baseY})`}>
      <ellipse cx="30" cy="2" rx="34" ry="6" fill="#3a2c1c" opacity="0.15" />
      <rect x="0" y="-12" width="60" height="12" rx="2" fill="#93aec7" stroke="#6e88a3" strokeWidth="1" />
      <rect x="4" y="-23" width="52" height="11" rx="2" fill="#d7a58a" stroke="#b07a5f" strokeWidth="1" transform="rotate(-3 30 -18)" />
      <rect x="-2" y="-34" width="56" height="11" rx="2" fill="#9fbf9c" stroke="#6f9370" strokeWidth="1" transform="rotate(2 30 -28)" />
      <rect x="8" y="-45" width="40" height="10" rx="2" fill="#e6d08a" stroke="#c0a760" strokeWidth="1" transform="rotate(-2 30 -40)" />
    </g>
  );
}

function Rug({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {/* soft contact shadow so the rug sits ON the floor (not merged with the wall) */}
      <ellipse cx="0" cy="10" rx="168" ry="44" fill="#2e2013" opacity="0.22" />
      <ellipse cx="0" cy="0" rx="158" ry="40" fill="#b56b5a" />
      <ellipse cx="0" cy="0" rx="158" ry="40" fill="none" stroke="#8f4a3d" strokeWidth="4" />
      <ellipse cx="0" cy="-2" rx="152" ry="36" fill="none" stroke="#d99f83" strokeWidth="2" opacity="0.5" />
      <ellipse cx="0" cy="0" rx="124" ry="31" fill="none" stroke="#e8c3a0" strokeWidth="3" opacity="0.8" />
      <ellipse cx="0" cy="0" rx="88" ry="22" fill="#c98a6a" />
      <ellipse cx="0" cy="0" rx="56" ry="14" fill="none" stroke="#f0d8c0" strokeWidth="2.5" opacity="0.8" />
    </g>
  );
}

function Cat({ x, baseY }: { x: number; baseY: number }) {
  return (
    <g transform={`translate(${x} ${baseY})`}>
      <ellipse cx="0" cy="2" rx="34" ry="8" fill="#3a2c1c" opacity="0.18" />
      <ellipse cx="0" cy="0" rx="34" ry="17" fill="#6b5442" />
      <ellipse cx="0" cy="-4" rx="30" ry="13" fill="#7d6350" />
      <circle cx="-26" cy="-8" r="12" fill="#6b5442" />
      <path d="M-34 -16 l4 -8 5 6 z" fill="#6b5442" />
      <path d="M-22 -16 l3 -8 5 7 z" fill="#6b5442" />
      <path d="M32 2 q12 -6 6 -14" fill="none" stroke="#6b5442" strokeWidth="7" strokeLinecap="round" />
      <path d="M-30 -8 q-2 2 -5 1" stroke="#3a2c22" strokeWidth="1.4" fill="none" />
    </g>
  );
}

function HangingPlant({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <line x1="0" y1="0" x2="-9" y2="58" stroke="#c9a06a" strokeWidth="1.2" />
      <line x1="0" y1="0" x2="9" y2="58" stroke="#c9a06a" strokeWidth="1.2" />
      <path d="M-13 58 H13 L9 72 H-9 Z" fill="#c67b4a" stroke="#9a5a30" strokeWidth="1" />
      <path d="M-7 60 Q-22 82 -18 106" fill="none" stroke="#5aa145" strokeWidth="3.4" />
      <path d="M0 60 Q-4 90 2 114" fill="none" stroke="#63b24b" strokeWidth="3.4" />
      <path d="M7 60 Q22 84 16 110" fill="none" stroke="#5aa145" strokeWidth="3.4" />
      {[[-18, 106], [2, 114], [16, 110]].map(([lx, ly], i) => <circle key={i} cx={lx} cy={ly} r="3.6" fill="#74c65c" />)}
    </g>
  );
}

export default function GrassRoom() {
  // 遠近感のある床板（消失点へ収束する目地）。壁と床を明確に分ける。
  const VP = { x: 200, y: -170 };
  const seams = [-40, 20, 80, 140, 200, 260, 320, 380, 440].map((bx) => {
    const f = (250 - 18) / (250 - VP.y); // y=18(幅木下) までの補間係数
    const tx = bx + (VP.x - bx) * f;
    return `M${bx} 250 L${tx} 18`;
  });
  return (
    <div className={styles.room} aria-hidden>
      <div className={styles.wall} />
      <div className={styles.floorFill} />
      {/* ceiling: hanging plants at the corners */}
      <svg className={styles.top} viewBox="0 0 400 130" preserveAspectRatio="xMidYMin slice">
        <HangingPlant x={34} />
        <HangingPlant x={366} />
      </svg>
      {/* floor: skirting + ambient occlusion + perspective boards + decor */}
      <svg className={styles.floorArt} viewBox="0 0 400 250" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="gr-pot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d98a58" /><stop offset="1" stopColor="#b96a38" /></linearGradient>
          <linearGradient id="gr-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a06e38" /><stop offset="0.5" stopColor="#b47f45" /><stop offset="1" stopColor="#c69256" /></linearGradient>
          <linearGradient id="gr-ao" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgba(50,30,10,0.5)" /><stop offset="1" stopColor="rgba(50,30,10,0)" /></linearGradient>
          <linearGradient id="gr-skirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a5763e" /><stop offset="0.35" stopColor="#7f572e" /><stop offset="1" stopColor="#6a4826" /></linearGradient>
        </defs>
        {/* floor plane */}
        <rect x="0" y="16" width="400" height="234" fill="url(#gr-floor)" />
        {/* perspective board seams */}
        <g stroke="#8a5f30" strokeWidth="1.4" opacity="0.4">{seams.map((d, i) => <path key={i} d={d} fill="none" />)}</g>
        {/* near-edge highlight for depth */}
        <rect x="0" y="238" width="400" height="12" fill="#d0a066" opacity="0.35" />
        {/* skirting board (wall/floor junction) */}
        <rect x="0" y="2" width="400" height="16" fill="url(#gr-skirt)" />
        <rect x="0" y="2" width="400" height="2.5" fill="#c79a5f" opacity="0.7" />
        {/* ambient occlusion cast by the wall onto the floor */}
        <rect x="0" y="18" width="400" height="30" fill="url(#gr-ao)" />

        {/* decor on the floor (with contact shadows) */}
        <Rug cx={200} cy={196} />
        <FloorPlant x={64} baseY={198} s={1} />
        <Cat x={196} baseY={196} />
        <FloorBooks x={250} baseY={198} />
        <Lantern x={330} baseY={198} s={1} />
      </svg>
    </div>
  );
}
