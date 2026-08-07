import { useState } from 'react';
import { WEEK_ORDER, DOW_SHORT, eventByDow, dowOfTime, type WeeklyEvent } from '../data/events';
import { boxOfDow } from '../data/boxes';
import BoxDropTable from './BoxDropTable';
import { trustedNow } from '../logic/trustedClock';
import Icon from './Icon';
import CloseButton from './CloseButton';
import styles from './EventCalendar.module.css';

// 曜日イベントのカレンダー。レース画面のいちばん上に置く。
// 上に曜日、下にそのイベントのアイコン。タップすると詳細が出る。
// 今日の曜日は光らせて、いま何の日かがすぐ分かるようにする。
export default function EventCalendar() {
  // 端末の時計を進めても曜日が変わらないよう trustedNow()。
  const today = dowOfTime(trustedNow());
  const [open, setOpen] = useState<WeeklyEvent | null>(null);

  return (
    <section className={styles.wrap} aria-label="曜日イベント">
      <header className={styles.head}>
        <span className={styles.headIcon} aria-hidden><Icon name="sparkle" size={15} /></span>
        <h2 className={styles.headText}>曜日イベント</h2>
        <span className={styles.headHint}>タップで詳細</span>
      </header>

      <div className={styles.row}>
        {WEEK_ORDER.map((d) => {
          const ev = eventByDow[d];
          const isToday = d === today;
          const weekend = d === 0 || d === 6;
          return (
            <button
              key={d}
              className={`${styles.cell} ${isToday ? styles.today : ''}`}
              style={{ ['--c1' as string]: ev.colors[0], ['--c2' as string]: ev.colors[1] }}
              onClick={() => setOpen(ev)}
              aria-label={`${DOW_SHORT[d]}曜日：${ev.name}`}
            >
              <span className={`${styles.dow} ${weekend ? (d === 0 ? styles.sun : styles.sat) : ''}`}>
                {DOW_SHORT[d]}
              </span>
              <span className={styles.badge} aria-hidden>
                <Icon name={ev.icon} size={19} />
              </span>
              {isToday && <span className={styles.todayTag}>今日</span>}
            </button>
          );
        })}
      </div>

      {open && <EventDetail ev={open} today={today} onClose={() => setOpen(null)} />}
    </section>
  );
}

function EventDetail({ ev, today, onClose }: { ev: WeeklyEvent; today: number; onClose: () => void }) {
  // 週末（土・日）はボックスの日。中身の出る割合をここからも見られるようにする。
  const box = boxOfDow(ev.dow);
  const [showDrops, setShowDrops] = useState(false);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        style={{ ['--c1' as string]: ev.colors[0], ['--c2' as string]: ev.colors[1] }}
      >
        <CloseButton onClick={onClose} />
        <div className={styles.banner}>
          <span className={styles.bannerIcon} aria-hidden><Icon name={ev.icon} size={30} /></span>
          <span className={styles.bannerText}>
            <span className={styles.bannerDow}>{DOW_SHORT[ev.dow]}曜日{ev.dow === today ? '（今日）' : ''}</span>
            <span className={styles.bannerName}>{ev.name}</span>
          </span>
          {box && (
            <button
              className={styles.info}
              onClick={() => setShowDrops((v) => !v)}
              aria-label="中身の出る割合を見る"
            >
              i
            </button>
          )}
        </div>

        {box && showDrops ? (
          <div className={styles.drops}>
            <BoxDropTable kind={box} />
            <button className={styles.back} onClick={() => setShowDrops(false)}>イベントの説明にもどる</button>
          </div>
        ) : (
        <>
        <p className={styles.lead}>{ev.lead}</p>

        <ul className={styles.list}>
          {ev.detail.map((d) => (
            <li key={d} className={styles.li}>{d}</li>
          ))}
        </ul>

        {ev.status === 'soon' && (
          <p className={styles.soon}>
            このイベントはまだ準備中です。内容はこれから実装していきます。
          </p>
        )}
        </>
        )}
      </div>
    </div>
  );
}
