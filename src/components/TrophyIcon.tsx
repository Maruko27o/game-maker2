import goldRaw from '../../assets/trophy_gold.svg?raw';
import silverRaw from '../../assets/trophy_silver.svg?raw';
import bronzeRaw from '../../assets/trophy_bronze.svg?raw';

function inner(svg: string): string {
  const open = svg.indexOf('>', svg.indexOf('<svg')) + 1;
  return svg.slice(open, svg.lastIndexOf('</svg>')).trim();
}

const BY_RANK: Record<1 | 2 | 3, string> = {
  1: inner(goldRaw),
  2: inner(silverRaw),
  3: inner(bronzeRaw),
};

// A trophy at a given rank. Grand-prix trophies get a star on the base (RACE.md §8).
export default function TrophyIcon({
  rank,
  gp,
  size = 64,
}: {
  rank: 1 | 2 | 3;
  gp?: boolean;
  size?: number;
}) {
  return (
    <svg viewBox="0 0 520 520" width={size} height={size} role="img" aria-label={`${rank}位トロフィー`}>
      <g dangerouslySetInnerHTML={{ __html: BY_RANK[rank] }} />
      {gp && (
        <g transform="translate(307,432) scale(1.9)" aria-hidden>
          <path
            d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 21.4l1.4-6.8L2.2 9.9l6.9-.8L12 2z"
            fill="#f6c945"
            stroke="#2b2118"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </g>
      )}
    </svg>
  );
}
