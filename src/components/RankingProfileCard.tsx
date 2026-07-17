import type { ScoreRow } from '../cloud';
import type { HorseLook } from '../types';
import HorseFace from './HorseFace';
import TrophyIcon from './TrophyIcon';
import CoinIcon from './CoinIcon';
import styles from './RankingProfileCard.module.css';

const DEFAULT_LOOK: HorseLook = { name: '', colors: { body: '', mane: '', hoof: '' }, decos: {} };

// Read-only profile shown when tapping a ranking row: the player's icon horse,
// name, and the trophies they've chosen to display. No editing / account UI —
// those are personal to each player.
export default function RankingProfileCard({ row, onClose }: { row: ScoreRow; onClose: () => void }) {
  const look: HorseLook = row.avatar
    ? { name: '', colors: row.avatar.colors, decos: row.avatar.decos }
    : DEFAULT_LOOK;
  const trophies = row.displayTrophies.filter((r) => r === 1 || r === 2 || r === 3) as (1 | 2 | 3)[];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.avatarBox}>
          <HorseFace horse={look} size={104} />
        </div>
        <div className={styles.name}>{row.username}</div>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>最高的中</span>
            <span className={styles.statVal}>{row.bestOdds.toFixed(1)}<small>倍</small></span>
          </div>
          {row.bestPayout > 0 && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>最大獲得賞金</span>
              <span className={styles.statVal}><CoinIcon size={13} /> {row.bestPayout.toLocaleString()}</span>
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

        <button className={styles.closeLink} onClick={onClose}>とじる</button>
      </div>
    </div>
  );
}
