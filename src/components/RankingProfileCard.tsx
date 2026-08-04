import { useEffect, useState } from 'react';
import { loadLifetimeBest, type ScoreRow } from '../cloud';
import type { HorseLook } from '../types';
import HorseFace from './HorseFace';
import EquippedFrame from './EquippedFrame';
import TrophyIcon from './TrophyIcon';
import CoinIcon from './CoinIcon';
import Icon from './Icon';
import { fmtOdds } from '../logic/betting';
import { courseById } from '../data/courses';
import { titleById } from '../data/titles';
import TitleBanner from './TitleBanner';
import styles from './RankingProfileCard.module.css';
import CloseButton from './CloseButton';

const DEFAULT_LOOK: HorseLook = { name: '', colors: { body: '', mane: '', hoof: '' }, decos: {} };

// 称号はプロフィールで本人が選んだものをそのまま出す（未設定なら「かけだし」）。
// 背景も称号の段に合わせて変わる ＝ 難しさと見た目の格が揃う。
function titleOf(id: string | null) {
  return (id ? titleById[id] : undefined) ?? titleById.rookie;
}

// Read-only profile shown when tapping a ranking row: the player's icon horse,
// name, and the trophies they've chosen to display. No editing / account UI —
// those are personal to each player.
export default function RankingProfileCard({ row, onClose }: { row: ScoreRow; onClose: () => void }) {
  const look: HorseLook = row.avatar
    ? { name: '', colors: row.avatar.colors, decos: row.avatar.decos }
    : DEFAULT_LOOK;
  const trophies = row.displayTrophies.filter((r) => r === 1 || r === 2 || r === 3) as (1 | 2 | 3)[];

  // ランキングの行は「その月」の記録。個人のページは今まで全部の自己ベストを見せる。
  const [life, setLife] = useState<{ bestOdds: number; bestPayout: number } | null>(null);
  useEffect(() => {
    let alive = true;
    loadLifetimeBest(row.userId).then((r) => { if (alive) setLife(r); });
    return () => { alive = false; };
  }, [row.userId]);

  const bestOdds = Math.max(row.bestOdds, life?.bestOdds ?? 0);
  const bestPayout = Math.max(row.bestPayout, life?.bestPayout ?? 0);
  const title = titleOf(row.title);
  const course = row.courseId ? courseById(row.courseId) : null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()} style={{ ['--tone' as string]: title.colors[0] }}>
        <CloseButton onClick={onClose} />
        {/* 上の帯は称号の背景そのもの（段が上がるほど作り込みが増える）。 */}
        <div className={styles.banner}><TitleBanner title={title} /></div>
        <div className={`${styles.avatarBox} ${row.equippedFrame ? styles.avatarBoxFramed : ''}`}>
          {row.equippedFrame ? (
            <EquippedFrame frame={row.equippedFrame} look={look} size={100} />
          ) : (
            <HorseFace horse={look} size={104} />
          )}
        </div>
        <div className={styles.name}>{row.username}</div>
        <div className={styles.title}>
          <Icon name="star" size={12} />
          {title.name}
        </div>

        <div className={styles.recordLabel}>通算の自己ベスト</div>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>最高的中</span>
            <span className={styles.statVal}>{fmtOdds(bestOdds)}<small>倍</small></span>
            {course && <span className={styles.statNote}>{course.name}</span>}
          </div>
          {bestPayout > 0 && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>最大獲得賞金</span>
              <span className={styles.statVal}><CoinIcon size={13} /> {bestPayout.toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className={styles.trophyLabel}>飾っているトロフィー</div>
        {trophies.length === 0 ? (
          <div className={styles.empty}>まだありません</div>
        ) : (
          <div className={styles.shelf}>
            {trophies.map((r, i) => (
              <div key={i} className={styles.slot}>
                <TrophyIcon rank={r} size={34} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
