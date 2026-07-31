// 草むらに現れた野生のウマを1頭ぶん組み立てる。
//
// 草むらで引いたパーツがそのままそのウマの姿になる。色（からだ・たてがみ・ひづめ）が
// 引けなかったスロットは、その場でレア度どおりに抽選して埋める（＝必ず完成した姿で
// 現れる）。色は生まれつきで変えられない。飾り（頭・顔・背中・しっぽ）は後から
// 着せ替えできる。
//
// ステータスは脚質テンプレートに沿ってランダムに配分する。合計はこれまでの
// 「自分で割り振る」ときと同じ STAT_ALLOC_TOTAL(40) なので、ウマ1頭あたりの
// 強さの総量は変わらない＝レースの倍率バランスに影響しない。
import type { ColorSlot, DecoSlot, HorseLook, RunStyle, Stats } from '../types';
import { STAT_ALLOC_TOTAL } from '../types';
import { colorsBySlot, colorSlotById, decoById, isColorId, COLOR_SLOTS } from '../data/parts';
import { pickOne } from './gacha';
import { rollStatsForStyle, type RNG } from './stats';

const STYLES: RunStyle[] = ['nige', 'senko', 'sashi', 'oikomi'];

/** 草むらから来たばかりのウマの名前。
 *  以前はランダムな名前を付けていたが、それだと「もう名前がある」ように見えて
 *  改名されないまま埋もれてしまう。名無しで出すことで、名前を付ける行為が
 *  プレイヤーの手に残る（改名はマイウマの詳細からいつでもできる）。 */
export const WILD_NAME = '(名無し)';

/** 引いたパーツから見た目を組む。色の空きはレア度どおりに抽選して埋める。 */
export function lookFromParts(partIds: string[], rng: RNG): HorseLook {
  const decos: Partial<Record<DecoSlot, string>> = {};
  const colors: Partial<Record<ColorSlot, string>> = {};
  for (const id of partIds) {
    if (isColorId(id)) {
      const slot = colorSlotById[id];
      if (slot && !colors[slot]) colors[slot] = id;
    } else {
      const slot = decoById[id]?.slot;
      if (slot && !decos[slot]) decos[slot] = id;
    }
  }
  // 引けなかった色は抽選して埋める（必ず完成した姿にする）
  for (const slot of COLOR_SLOTS) {
    if (!colors[slot]) colors[slot] = pickOne(rng, colorsBySlot[slot]).id;
  }
  return { colors: colors as Record<ColorSlot, string>, decos };
}

/** ランダムなステータス（合計は従来と同じ40）。 */
export function rollWildStats(rng: RNG): Stats {
  const style = STYLES[Math.floor(rng() * STYLES.length) % STYLES.length];
  return rollStatsForStyle(rng, STAT_ALLOC_TOTAL, style);
}

/** 草むらのウマ1頭ぶん（名前・見た目・ステータス）。 */
export function makeWildHorse(partIds: string[], rng: RNG): {
  name: string;
  colors: Record<ColorSlot, string>;
  decos: Partial<Record<DecoSlot, string>>;
  stats: Stats;
} {
  const look = lookFromParts(partIds, rng);
  return { name: WILD_NAME, colors: look.colors, decos: look.decos, stats: rollWildStats(rng) };
}
