import { MOODS, type MoodLevel } from '../logic/mood';

// A small coloured face badge for a horse's mood (RACE §odds). Colour + expression
// both encode the level so it reads at a glance: 絶好調(橙・にっこり) … 絶不調(青・しょんぼり).
const MOUTH: Record<MoodLevel, string> = {
  0: 'M8 16.5 Q12 13.5 16 16.5', // frown
  1: 'M8 15.5 Q12 14.5 16 15.5', // slight frown
  2: 'M8.5 15 L15.5 15', // flat
  3: 'M8 14 Q12 17 16 14', // smile
  4: 'M7 13.4 Q12 19.2 17 13.4', // big smile
};

export default function MoodFace({ level, size = 24, title = true }: { level: MoodLevel; size?: number; title?: boolean }) {
  const m = MOODS[level];
  const great = level === 4;
  const awful = level === 0;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={title ? `気分：${m.label}` : undefined}>
      <rect x="1.5" y="1.5" width="21" height="21" rx="7" fill={m.color} stroke="rgba(0,0,0,0.28)" strokeWidth="1.4" />
      {/* eyes */}
      {great ? (
        <>
          <path d="M9 9.2 l0.9 1.7 1.7 0.2 -1.2 1.2 0.3 1.7 -1.5 -0.8 -1.5 0.8 0.3 -1.7 -1.2 -1.2 1.7 -0.2z" fill={m.ink} transform="translate(-0.2 0)" />
          <path d="M15 9.2 l0.9 1.7 1.7 0.2 -1.2 1.2 0.3 1.7 -1.5 -0.8 -1.5 0.8 0.3 -1.7 -1.2 -1.2 1.7 -0.2z" fill={m.ink} transform="translate(-0.2 0)" />
        </>
      ) : (
        <>
          <circle cx="9" cy={awful ? 10.6 : 10.2} r="1.25" fill={m.ink} />
          <circle cx="15" cy={awful ? 10.6 : 10.2} r="1.25" fill={m.ink} />
        </>
      )}
      <path d={MOUTH[level]} fill="none" stroke={m.ink} strokeWidth="1.5" strokeLinecap="round" />
      {great && <circle cx="19.5" cy="5" r="1.6" fill="#fff3b0" stroke="rgba(0,0,0,0.2)" strokeWidth="0.6" />}
    </svg>
  );
}
