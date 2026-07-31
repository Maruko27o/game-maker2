import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { trustedNow } from '../logic/trustedClock';
import {
  WEEK_ORDER, DOW_LABEL, rewardForDow, rewardLabel, dowOf, canClaim, type LoginReward,
} from '../logic/loginBonus';
import { colorById } from '../data/parts';
import Icon from './Icon';
import CoinIcon from './CoinIcon';
import styles from './LoginBonus.module.css';

// ログインボーナス（曜日制）。1週間ぶんを横に並べ、きょうの曜日が光る。
// 受け取りは1日1回。日付は trustedNow() 由来なので、端末の時計を進めても
// 戻しても二度取りはできない（trustedClock の単調フロア＋サーバ時刻アンカー）。

function RewardIcon({ r, size = 18 }: { r: LoginReward; size?: number }) {
  if (r.kind === 'coins') return <CoinIcon size={size} />;
  if (r.kind === 'ticket') return <Icon name="ticket" size={size} />;
  return <Icon name="palette" size={size} />;
}

function shortLabel(r: LoginReward): string {
  if (r.kind === 'coins') return `${r.amount.toLocaleString()}`;
  if (r.kind === 'ticket') return 'チケット';
  return '染料';
}

export default function LoginBonus() {
  const login = useStore((s) => s.login);
  const claimLoginBonus = useStore((s) => s.claimLoginBonus);

  // 日付は1分ごとに見直す（日をまたいだらそのまま受け取れるように）。
  const [now, setNow] = useState(() => trustedNow());
  useEffect(() => {
    const t = setInterval(() => setNow(trustedNow()), 60_000);
    return () => clearInterval(t);
  }, []);

  const [got, setGot] = useState<LoginReward | null>(null);
  const today = dowOf(now);
  const open = canClaim(login?.day, now);

  function claim() {
    const r = claimLoginBonus();
    if (!r) return;
    setGot(r);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.title}>ログインボーナス</span>
        <span className={styles.sub}>{open ? 'きょうのぶんを受け取れます' : 'また明日！'}</span>
      </div>

      <ul className={styles.week}>
        {WEEK_ORDER.map((d) => {
          const r = rewardForDow(d);
          const isToday = d === today;
          const done = isToday && !open;
          return (
            <li
              key={d}
              className={`${styles.day} ${isToday ? styles.dayToday : ''} ${done ? styles.dayDone : ''}`}
            >
              <span className={styles.dow}>{DOW_LABEL[d]}</span>
              <span className={styles.icon}><RewardIcon r={r} size={17} /></span>
              <span className={styles.amt}>{shortLabel(r)}</span>
              {done && <span className={styles.check} aria-label="受け取り済み">✓</span>}
            </li>
          );
        })}
      </ul>

      <button className={styles.claim} disabled={!open} onClick={claim}>
        {open ? (
          <>
            <RewardIcon r={rewardForDow(today)} size={17} />
            {rewardLabel(rewardForDow(today))}を受け取る
          </>
        ) : (
          '受け取り済み'
        )}
      </button>

      {/* 受け取り演出は body 直下へ出す。草むらの部屋の絵より前面に確実に出すため
          （この枠自体が z-index を持つと、その中の z-index は外に効かない）。 */}
      {got && createPortal(
        <div className={styles.gotOverlay} onClick={() => setGot(null)}>
          <div className={styles.gotCard} onClick={(e) => e.stopPropagation()}>
            <p className={styles.gotLead}>ログインボーナス</p>
            <div className={styles.gotIcon}><RewardIcon r={got} size={44} /></div>
            <p className={styles.gotName}>
              {got.kind === 'dye' && got.colorId
                ? `${colorById[got.colorId]?.name ?? ''}の染料`
                : rewardLabel(got)}
            </p>
            {got.kind === 'dye' && (
              <p className={styles.gotHint}>マイウマの「着せ替え」で、ウマの色を塗り替えられます。</p>
            )}
            <button className={styles.gotOk} onClick={() => setGot(null)}>やった！</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
