import { useId } from 'react';

// 殿堂で使う繊細なトロフィーの絵（🏆絵文字の置き換え・案B）。金グラデのカップに
// 星と台座。単色ではなくゴールドの陰影を持たせ、上品で写実的すぎない見た目に。
export default function TrophyMark({ size = 48 }: { size?: number }) {
  const uid = useId().replace(/:/g, '');
  const gold = `url(#tm-${uid})`;
  const line = '#8a6410';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable="false">
      <defs>
        <linearGradient id={`tm-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff3c6" />
          <stop offset="45%" stopColor="#ecc865" />
          <stop offset="100%" stopColor="#b3852a" />
        </linearGradient>
      </defs>
      {/* カップの器 */}
      <path d="M14 7h20v7c0 5.5-4.5 10-10 10S14 19.5 14 14V7z" fill={gold} stroke={line} strokeWidth="1" />
      {/* 取っ手（左右） */}
      <path d="M14 9.5H8.5c0 4.5 2 7.5 6.5 8.2M34 9.5H39.5c0 4.5-2 7.5-6.5 8.2" fill="none" stroke={gold} strokeWidth="2.4" strokeLinecap="round" />
      {/* 脚 */}
      <path d="M22 23.5h4l-0.7 6.5h-2.6z" fill={gold} stroke={line} strokeWidth="1" strokeLinejoin="round" />
      {/* 台座（ドーム＋台板） */}
      <path d="M17 40c0-4.5 3-6.5 7-6.5s7 2 7 6.5z" fill={gold} stroke={line} strokeWidth="1" strokeLinejoin="round" />
      <rect x="14" y="39" width="20" height="3.4" rx="1.4" fill={gold} stroke={line} strokeWidth="1" />
      {/* 星 */}
      <path d="M24 10.5l1.3 2.7 2.9.3-2.1 2 .6 2.9-2.6-1.4-2.6 1.4.6-2.9-2.1-2 2.9-.3L24 10.5z" fill="#fff6d6" />
    </svg>
  );
}
