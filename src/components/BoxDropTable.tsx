import { useMemo } from 'react';
import { BOXES, dropTable, type BoxKind } from '../data/boxes';
import styles from './BoxDropTable.module.css';

// 「中身の出る割合」の一覧。ボックスの開封画面と、レース画面の曜日イベントの
// 詳細（i ボタン）で同じものを出す。数字は dropTable が唯一の出どころなので、
// 片方だけ古い、ということが起きない。
export default function BoxDropTable({ kind }: { kind: BoxKind }) {
  const rows = useMemo(() => dropTable(BOXES[kind]), [kind]);
  return (
    <div className={styles.table}>
      <div className={styles.lead}>{BOXES[kind].name}の中身の出る割合</div>
      {rows.map((r) => (
        <div key={r.label} className={`${styles.row} ${styles[`r_${r.rarity}`]}`}>
          <span className={styles.name}>{r.label}</span>
          <span className={styles.pct}>{r.pct >= 0.1 ? r.pct.toFixed(1) : r.pct.toFixed(3)}%</span>
        </div>
      ))}
      <p className={styles.note}>
        限定フレームと限定称号は一度きり。手に入れたあとは、そのぶん他の中身が出ます。
      </p>
    </div>
  );
}
