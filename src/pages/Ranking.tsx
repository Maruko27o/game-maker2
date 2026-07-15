import { useEffect, useState } from 'react';
import { useAuth, loadLeaderboard, type ScoreRow } from '../cloud';
import { courseById } from '../data/courses';
import CoinIcon from '../components/CoinIcon';
import styles from './Ranking.module.css';

// Max hit-odds leaderboard (改修④). One row per player — their best winning
// odds. Degrades gracefully: signed-out players are nudged to log in; if the DB
// isn't set up the list is simply empty.
export default function Ranking() {
  const user = useAuth((s) => s.user);
  const displayName = useAuth((s) => s.displayName);
  const configured = useAuth((s) => s.configured);
  const [rows, setRows] = useState<ScoreRow[] | null>(null);

  useEffect(() => {
    let live = true;
    setRows(null);
    loadLeaderboard(50).then((r) => live && setRows(r));
    return () => {
      live = false;
    };
  }, [user]);

  function medal(place: number): string {
    return place === 1 ? styles.gold : place === 2 ? styles.silver : place === 3 ? styles.bronze : '';
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>ランキング</h1>
      <p className={styles.lead}>単勝・馬連・3連単…どんな馬券でも、いちばん高い的中オッズで競争！</p>

      {!configured ? (
        <div className={styles.note}>クラウド機能が未設定です。</div>
      ) : !user ? (
        <div className={styles.note}>ランキングに載るには、右上からログインしてね。</div>
      ) : rows === null ? (
        <div className={styles.note}>読み込み中…</div>
      ) : rows.length === 0 ? (
        <div className={styles.note}>まだ記録がありません。レースで馬券を的中させよう！</div>
      ) : (
        <ol className={styles.list}>
          {rows.map((r, i) => {
            const me = r.userId === user.id;
            const course = r.courseId ? courseById(r.courseId) : null;
            return (
              <li key={r.userId} className={`${styles.row} ${me ? styles.me : ''}`}>
                <span className={`${styles.place} ${medal(i + 1)}`}>{i + 1}</span>
                <span className={styles.name}>
                  {r.username}
                  {me && <span className={styles.youTag}>あなた</span>}
                </span>
                {course && <span className={styles.course}>{course.name}</span>}
                <span className={styles.odds}>{r.bestOdds.toFixed(1)}倍</span>
              </li>
            );
          })}
        </ol>
      )}

      {user && (
        <div className={styles.self}>
          <CoinIcon size={16} /> あなたの名前：<b>{displayName ?? '—'}</b>
          <span className={styles.selfHint}>（右上のアカウントから変更できます）</span>
        </div>
      )}
    </div>
  );
}
