// Badge catalog (ACCOUNT.md §2). Award conditions live in logic/badges.ts; this
// module is just the art + labels. SVGs are inlined so they need no network.
import b1 from '../../assets/badges/badge_1st.svg?raw';
import b2 from '../../assets/badges/badge_2nd.svg?raw';
import b3 from '../../assets/badges/badge_3rd.svg?raw';
import bFirst from '../../assets/badges/badge_first_win.svg?raw';
import bStreak from '../../assets/badges/badge_streak3.svg?raw';
import bAll from '../../assets/badges/badge_all_course.svg?raw';
import bJump from '../../assets/badges/badge_jump.svg?raw';
import bRecord from '../../assets/badges/badge_record.svg?raw';

export type BadgeId =
  | 'badge_1st'
  | 'badge_2nd'
  | 'badge_3rd'
  | 'badge_first_win'
  | 'badge_streak3'
  | 'badge_all_course'
  | 'badge_jump'
  | 'badge_record';

// Strip the outer <svg> wrapper so the inner markup can go into our own sized svg.
function inner(svg: string): string {
  const open = svg.indexOf('>', svg.indexOf('<svg')) + 1;
  const close = svg.lastIndexOf('</svg>');
  return svg.slice(open, close).trim();
}

type BadgeDef = { name: string; inner: string; placing: boolean };

export const BADGES: Record<BadgeId, BadgeDef> = {
  badge_1st: { name: '1着バッジ', inner: inner(b1), placing: true },
  badge_2nd: { name: '2着バッジ', inner: inner(b2), placing: true },
  badge_3rd: { name: '3着バッジ', inner: inner(b3), placing: true },
  badge_first_win: { name: 'はつ勝利', inner: inner(bFirst), placing: false },
  badge_streak3: { name: '3れんしょう', inner: inner(bStreak), placing: false },
  badge_all_course: { name: 'コース制覇', inner: inner(bAll), placing: false },
  badge_jump: { name: '障害マスター', inner: inner(bJump), placing: false },
  badge_record: { name: 'コースレコード', inner: inner(bRecord), placing: false },
};

export const BADGE_VIEWBOX = '0 0 200 200';

export function badgeName(id: string): string {
  return (BADGES as Record<string, BadgeDef>)[id]?.name ?? id;
}
