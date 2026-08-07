import { useState } from 'react';
import { useStore } from '../store';
import { setDevDow, getDevDow, DOW_SHORT, WEEK_ORDER, eventByDow } from '../data/events';
import { allParts } from '../data/parts';
import { APT_GRADES, STREAK_MAX } from '../types';
import type { TrainingItem } from '../types';
import { stackBox } from '../logic/boxes';
import { trustedNow } from '../logic/trustedClock';
import styles from './DevPanel.module.css';

// 開発用の道具箱。**開発ビルドでしか出ない**（App 側で import.meta.env.DEV を見て
// いるので、本番のバンドルにはこのファイルごと入らない）。
//
// なぜ要るか：
//  ・曜日イベントを見るのに実際の曜日を待っていた（万馬券デーは水曜だけ）
//  ・ボックスの演出やフレームを見るのに、実際に0.1%を引くまで確認できなかった
//  ・図鑑の見た目を「9割埋まった状態」で確認する手段が無かった
// どれも「確認できないまま直す」原因になっていたので、まとめてここに置く。
//
// セーブを直接いじるので、押した内容はそのまま保存される（クラウドにも上がる）。
// 本番では出ないとはいえ、自分のデータで試すときは注意すること。

export default function DevPanel() {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const s = useStore();
  const dow = getDevDow();

  function pickDow(d: number | null) {
    setDevDow(d);
    // 曜日を見ている画面は各所に散らばっているので、確実に反映するため読み直す。
    // 固定した曜日は sessionStorage に残るので、読み直しても消えない。
    location.reload();
  }

  function give(patch: Parameters<typeof useStore.setState>[0]) {
    useStore.setState(patch);
    force((n) => n + 1);
  }

  if (!open) {
    return (
      <button className={styles.tab} onClick={() => setOpen(true)} title="開発メニュー">
        DEV
      </button>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <b>開発メニュー</b>
        <button className={styles.x} onClick={() => setOpen(false)}>✕</button>
      </div>

      <div className={styles.section}>
        <span className={styles.label}>曜日を固定（イベントの確認）</span>
        <div className={styles.row}>
          <button className={`${styles.chip} ${dow === null ? styles.on : ''}`} onClick={() => pickDow(null)}>
            実際
          </button>
          {WEEK_ORDER.map((d) => (
            <button
              key={d}
              className={`${styles.chip} ${dow === d ? styles.on : ''}`}
              onClick={() => pickDow(d)}
              title={eventByDow[d]?.name}
            >
              {DOW_SHORT[d]}
            </button>
          ))}
        </div>
        <span className={styles.note}>{dow === null ? '実際の曜日で動いています' : `${eventByDow[dow]?.name ?? '—'} 固定中`}</span>
      </div>

      <div className={styles.section}>
        <span className={styles.label}>持ちもの</span>
        <div className={styles.row}>
          <button className={styles.chip} onClick={() => give({ coins: s.coins + 100_000 })}>コイン +10万</button>
          <button className={styles.chip} onClick={() => give({ items: [...s.items, ...Array.from({ length: 50 }, () => ({ kind: 'any' }) as TrainingItem)] })}>
            育成アイテム +50
          </button>
          <button className={styles.chip} onClick={() => give({ refineTickets: (s.refineTickets ?? 0) + 10 })}>厳選チケット +10</button>
        </div>
        <div className={styles.row}>
          <button
            className={styles.chip}
            onClick={() => {
              let box = s.mailbox ?? [];
              for (let i = 0; i < 10; i++) box = stackBox(box, 'lucky', trustedNow());
              for (let i = 0; i < 10; i++) box = stackBox(box, 'gold', trustedNow());
              give({ mailbox: box });
            }}
          >
            ボックス 各+10
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.label}>図鑑</span>
        <div className={styles.row}>
          <button
            className={styles.chip}
            onClick={() => give({ owned: Object.fromEntries(allParts.map((p) => [p.id, 1])) })}
          >
            全部1個ずつ
          </button>
          <button
            className={styles.chip}
            onClick={() => give({ owned: Object.fromEntries(allParts.map((p) => [p.id, 13])) })}
          >
            ダブりも大量に
          </button>
          <button
            className={styles.chip}
            onClick={() => {
              // 9割だけ埋める（未所持優先の効きを確かめるとき用）
              const n = Math.floor(allParts.length * 0.9);
              give({ owned: Object.fromEntries(allParts.slice(0, n).map((p) => [p.id, 1])) });
            }}
          >
            9割だけ
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.label}>フレーム・称号</span>
        <div className={styles.row}>
          <button
            className={styles.chip}
            onClick={() =>
              give({
                aptFrames: [...APT_GRADES],
                boxFrames: ['lucky', 'gold'],
                boxTitles: ['lucky', 'gold'],
                streakBest: STREAK_MAX,
                streakClaimed: STREAK_MAX,
              })
            }
          >
            全部そろえる
          </button>
          <button className={styles.chip} onClick={() => give({ aptFrames: [], boxFrames: [], boxTitles: [], equippedFrame: null })}>
            全部消す
          </button>
        </div>
      </div>

      <p className={styles.warn}>
        本番ビルドには入りません。押した内容はセーブに残ります。
      </p>
    </div>
  );
}
