// A small self-contained coin icon (RACE_V4 §4). Hand-drawn, earthy look to match
// the rest of the game: dark rim, warm face, a tiny horseshoe. Tier only changes
// the metal colour (bronze / silver / gold).
import type { CoinTier } from '../data/coins';

const METAL: Record<CoinTier, { rim: string; face: string; mark: string }> = {
  bronze: { rim: '#b07a3e', face: '#e2a866', mark: '#7a4e1e' },
  silver: { rim: '#9aa6b0', face: '#d7dee4', mark: '#68727c' },
  gold: { rim: '#c9992a', face: '#ffe09a', mark: '#8a6410' },
};

export default function CoinIcon({ tier = 'gold', size = 20 }: { tier?: CoinTier; size?: number }) {
  const c = METAL[tier];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="20" cy="20" r="18" fill={c.rim} stroke="#2b2118" strokeWidth="2.4" />
      <circle cx="20" cy="20" r="13.5" fill={c.face} />
      {/* horseshoe */}
      <path
        d="M 15 14 C 12 18 12 24 16 27 M 25 14 C 28 18 28 24 24 27"
        fill="none"
        stroke={c.mark}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="16" cy="27.5" r="1.1" fill={c.mark} />
      <circle cx="24" cy="27.5" r="1.1" fill={c.mark} />
    </svg>
  );
}
