import type { Horse } from '../types';
import { colorById, colorSlotById, decoById } from '../data/parts';
import HorseView from './HorseView';

// A consistent thumbnail for any part: a neutral horse that shows the part in
// context — the color applied to its slot, or the decoration equipped. Used by
// the collection, the grass reward cards and the create picker. Empty color ids
// make HorseView fall back to its neutral defaults.
const NEUTRAL: Horse['colors'] = { body: '', mane: '', hoof: '' };

export default function PartThumb({ id, size = 96 }: { id: string; size?: number }) {
  const color = colorById[id];
  const deco = decoById[id];

  const horse: Horse = {
    id: `thumb_${id}`,
    name: '',
    colors: color ? { ...NEUTRAL, [colorSlotById[id]]: id } : { ...NEUTRAL },
    decos: deco ? { [deco.slot]: id } : {},
    createdAt: 0,
  };

  return <HorseView horse={horse} size={size} />;
}
