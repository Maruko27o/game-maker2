import type { EquipFrame, HorseLook } from '../types';
import { isStreakFrame } from '../types';
import AvatarFrame from './AvatarFrame';
import StreakFrame from './StreakFrame';

// 装備中フレーム（殿堂フレーム or 連勝フレーム）を種類で振り分けて描画する共通部品。
export default function EquippedFrame({ frame, look, size = 104 }: { frame: EquipFrame; look: HorseLook; size?: number }) {
  if (isStreakFrame(frame)) return <StreakFrame level={frame.level} look={look} size={size} />;
  return <AvatarFrame rank={frame.rank} metric={frame.metric} period={frame.period} look={look} size={size} />;
}
