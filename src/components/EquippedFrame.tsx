import type { EquipFrame, HorseLook } from '../types';
import { isStreakFrame, isAptFrame, isBoxFrame } from '../types';
import AvatarFrame from './AvatarFrame';
import StreakFrame from './StreakFrame';
import AptFrame from './AptFrame';
import BoxFrame from './BoxFrame';

// 装備中フレーム（殿堂 / 連勝 / 適性 / ボックス限定）を種類で振り分けて描画する共通部品。
export default function EquippedFrame({ frame, look, size = 104 }: { frame: EquipFrame; look: HorseLook; size?: number }) {
  if (isStreakFrame(frame)) return <StreakFrame level={frame.level} look={look} size={size} />;
  if (isAptFrame(frame)) return <AptFrame grade={frame.grade} look={look} size={size} />;
  if (isBoxFrame(frame)) return <BoxFrame box={frame.box} look={look} size={size} />;
  return <AvatarFrame rank={frame.rank} metric={frame.metric} period={frame.period} look={look} size={size} />;
}
