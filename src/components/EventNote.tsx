import { eventByDow, dowOfTime } from '../data/events';
import { trustedNow } from '../logic/trustedClock';
import Icon from './Icon';
import styles from './EventNote.module.css';

// 「今日はイベントデーだから、いつもと違うよ」を各画面で知らせる小さな帯。
//
// 常設の仕様とイベント中の一時的な優遇を取り違えないよう、効果が乗っている画面には
// 必ずこれを出す（草むら・トレーニング・馬券・図鑑・グランプリ・週末ボックス）。
// dow を指定した曜日と今日が一致するときだけ出るので、呼ぶ側は条件を書かなくていい。
export default function EventNote({ dow, text }: { dow: number; text: string }) {
  const today = dowOfTime(trustedNow());
  if (today !== dow) return null;
  const ev = eventByDow[dow];
  if (!ev || ev.status !== 'live') return null;

  return (
    <div
      className={styles.note}
      style={{ ['--c1' as string]: ev.colors[0], ['--c2' as string]: ev.colors[1] }}
    >
      <span className={styles.icon} aria-hidden><Icon name={ev.icon} size={17} /></span>
      <span className={styles.text}>
        <span className={styles.name}>今日は{ev.name}！</span>
        <span className={styles.body}>{text}</span>
      </span>
    </div>
  );
}
