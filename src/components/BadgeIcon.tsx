import { BADGES, BADGE_VIEWBOX, type BadgeId } from '../data/badges';

// Render a badge's inlined SVG at a given size.
export default function BadgeIcon({ id, size = 40, title }: { id: string; size?: number; title?: string }) {
  const def = (BADGES as Record<string, { inner: string; name: string }>)[id];
  if (!def) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox={BADGE_VIEWBOX}
      role="img"
      aria-label={title ?? def.name}
      xmlns="http://www.w3.org/2000/svg"
      dangerouslySetInnerHTML={{ __html: def.inner }}
    />
  );
}

export type { BadgeId };
