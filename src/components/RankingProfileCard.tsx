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
import styles from './RankingProfileCard.module.css';
import CloseButton from './CloseButton';

const DEFAULT_LOOK: HorseLook = { name: '', colors: { body: '', mane: '', hoof: '' }, decos: {} };

// 称号：通算の最高的中倍率で決まる肩書き。数字だけだと味気ないので、見た人が
// 一目で「この人すごい」と分かる名前と色を付ける。名札とカードの帯に反映する。
const TITLES: { min: number; name: string; tone: string }[] = [
  { min: 10000, name: '伝説の的中王', tone: '#b06bff' },
  { min: 3000, name: '万馬券ハンター', tone: '#e0485f' },
  { min: 1000, name: '大穴の目利き', tone: '#e0a92e' },
  { min: 300, name: 'ベテラン予想家', tone: '#3f7fd6' },
  { min: 100, name: '穴党', tone: '#37b98a' },
  { min: 30, name: '見習い予想家', tone: '#8a6a3f' },
  { min: 0, name: 'かけだし', tone: '#8a7a5c' },
];
function titleOf(odds: number) {
  return TITLES.find((t) => odds >= t.min) ?? TITLES[TITLES.length - 1];
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
  const title = titleOf(bestOdds);
  const course = row.courseId ? courseById(row.courseId) : null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()} style={{ ['--tone' as string]: title.tone }}>
        <CloseButton onClick={onClose} />
        {/* 上の色帯。称号の色で塗って、アイコンが主役に見えるようにする。 */}
        <div className={styles.banner} aria-hidden><span className={styles.bannerGlow} /></div>
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
