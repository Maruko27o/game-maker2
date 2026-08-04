import type { Course } from '../data/courses';

// レース名の左に出す小さな目印。以前はコースの地面色で塗っただけの丸で、
// ただの色玉に見えて雑だった。ここではそのコースの「競馬場」そのものを描く：
// 外周がコースの地面色のトラック、内側は芝の島（インフィールド）、
// 手前にゴール板。小さくても「どのコースを走っているか」が絵で分かる。
export default function CourseMark({ course, size = 22 }: { course: Course; size?: number }) {
  const infield = course.surface === 'trail' ? '#7bb04a' : '#8ec45c';
  return (
    <svg
      width={size}
      height={size * 0.72}
      viewBox="0 0 30 22"
      aria-hidden
      style={{ flex: 'none', verticalAlign: '-4px' }}
    >
      {/* 外周（走路） */}
      <rect x="1.4" y="1.4" width="27.2" height="19.2" rx="9.6" fill={course.ground} stroke="#3a2c1c" strokeWidth="2.2" />
      {/* 内側の島 */}
      <rect x="8" y="7" width="14" height="8" rx="4" fill={infield} stroke="#3a2c1c" strokeWidth="1.6" />
      {/* ゴール板（下の直線の真ん中） */}
      <rect x="13.4" y="17.4" width="3.2" height="3.2" fill="#fff" stroke="#3a2c1c" strokeWidth="0.9" />
      <rect x="13.4" y="17.4" width="1.6" height="1.6" fill="#3a2c1c" />
      <rect x="15" y="19" width="1.6" height="1.6" fill="#3a2c1c" />
    </svg>
  );
}
