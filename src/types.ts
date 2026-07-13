// Core data model. Kept intentionally small; race/vote features will extend
// Horse later, so avoid baking in stat values now (see CLAUDE.md §6, §10).

export type Rarity = 'N' | 'R' | 'SR';
export type ColorSlot = 'body' | 'mane' | 'hoof';
export type DecoSlot = 'head' | 'face' | 'back' | 'tail';

export type ColorPart = {
  id: string;
  name: string;
  value: string; // paint applied to the CSS variable — a hex, or url(#grad…) for gradients
  rarity: Rarity;
  swatch?: string; // CSS-background equivalent for pickers (gradients can't use url() in CSS)
};

export type DecoPart = {
  id: string;
  name: string;
  slot: DecoSlot;
  rarity: Rarity;
  svg: string; // SVG snippet in the base 0 0 520 520 coordinate space
};

export type Horse = {
  id: string;
  name: string;
  colors: Record<ColorSlot, string>; // parts.json color part ids
  decos: Partial<Record<DecoSlot, string>>; // parts.json deco part ids; unequipped = key absent
  createdAt: number;
};

export type SaveData = {
  version: 1;
  owned: Record<string, number>; // part id -> count obtained (>=1 means owned)
  horses: Horse[]; // max 10
  lastSpawnAt: number | null; // ms of the last grass spawn
};
