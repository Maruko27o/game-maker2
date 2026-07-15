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

// A trophy at a given rank (gold / silver / bronze).
export default function TrophyIcon({ rank, size = 64 }: { rank: 1 | 2 | 3; size?: number }) {
  return (
    <svg viewBox="0 0 520 520" width={size} height={size} role="img" aria-label={`${rank}位トロフィー`}>
      <g dangerouslySetInnerHTML={{ __html: BY_RANK[rank] }} />
    </svg>
  );
}
