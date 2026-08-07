import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { partName, colorById } from '../data/parts';
import {
  dupeRows, pickedValue, canExchange, autoPick,
  DYE_EXCHANGE_COST, DUPE_VALUE, type DupeRow,
} from '../logic/dyeExchange';
import PartThumb from './PartThumb';
import CloseButton from './CloseButton';
import Icon from './Icon';
import styles from './DyeExchange.module.css';

// ダブったパーツを染料1つに替える画面。
//
// 草むらを回すと同じパーツが何度も出て、2個目から先は使い道がなかった。
// 100個ぶんためると染料が1つできる。1個目は図鑑の記録なので絶対に使わない。
//
// 選び方は2通り：「自動でえらぶ」に任せるか、行ごとに自分で数を決めるか。
// どちらでも合計が100個ぶんに届いたら「染料をつくる」が押せるようになる。

function Row({
  row,
  picked,
  onChange,
}: {
  row: DupeRow;
  picked: number;
  onChange: (n: number) => void;
}) {
  return (
    <li className={styles.row}>
      <div className={styles.thumb}>
        <PartThumb id={row.id} size={44} />
      </div>
      <div className={styles.info}>
        <span className={styles.name}>{partName(row.id)}</span>
        <span className={styles.sub}>
          <span className={`rarity rarity-${row.rarity}`}>{row.rarity}</span>
          <span className={styles.value}>1個 = {row.value}個ぶん</span>
        </span>
      </div>
      <div className={styles.stepper}>
        <button
          className={styles.step}
          disabled={picked <= 0}
          aria-label={`${partName(row.id)}を1つ減らす`}
          onClick={() => onChange(picked - 1)}
        >
          −
        </button>
        <span className={styles.pickCount}>
          {picked}<small>/{row.dupes}</small>
        </span>
        <button
          className={styles.step}
          disabled={picked >= row.dupes}
          aria-label={`${partName(row.id)}を1つ増やす`}
          onClick={() => onChange(picked + 1)}
        >
          ＋
        </button>
      </div>
    </li>
  );
}

export default function DyeExchange({ onClose }: { onClose: () => void }) {
  const owned = useStore((s) => s.owned);
  const exchange = useStore((s) => s.exchangeDupesForDye);

  const rows = useMemo(() => dupeRows(owned), [owned]);
  const [picks, setPicks] = useState<Record<string, number>>({});
  /** できあがった染料の色ID。出ているあいだは結果のポップアップを見せる。 */
  const [made, setMade] = useState<string | null>(null);

  const total = pickedValue(rows, picks);
  const ready = canExchange(rows, picks);
  const stock = rows.reduce((n, r) => n + r.dupes * r.value, 0);
  const pct = Math.min(100, Math.round((total / DYE_EXCHANGE_COST) * 100));

  function setPick(id: string, n: number) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const v = Math.max(0, Math.min(n, row.dupes));
    setPicks((p) => ({ ...p, [id]: v }));
  }

  function make() {
    const colorId = exchange(picks);
    if (colorId) {
      setPicks({});
      setMade(colorId);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="ダブりを染料に替える">
        <CloseButton onClick={onClose} />
        <h2 className={styles.title}>
          <Icon name="dyeSwap" size={20} /> ダブりを染料に
        </h2>
        <p className={styles.lead}>
          ダブったパーツ {DYE_EXCHANGE_COST} 個ぶんで染料が1つできます。
          <br />
          N は1個ぶん・R は {DUPE_VALUE.R} 個ぶん・SR は {DUPE_VALUE.SR} 個ぶん。
          <b>1個目は図鑑の記録なので使いません。</b>
        </p>

        {rows.length === 0 ? (
          <p className={styles.empty}>
            まだダブりがありません。
            <br />
            草むらで同じパーツをもう1つ手に入れると、ここに出てきます。
          </p>
        ) : (
          <>
            {/* いくつ選んだか。バーで「あと少し」が見えるようにする。 */}
            <div className={styles.meter}>
              <div className={styles.bar}>
                <div className={`${styles.fill} ${ready ? styles.fillReady : ''}`} style={{ width: `${pct}%` }} />
              </div>
              <span className={styles.meterText}>
                {total} / {DYE_EXCHANGE_COST}
                <small>個ぶん</small>
              </span>
            </div>

            <div className={styles.tools}>
              <button
                className={styles.tool}
                disabled={stock < DYE_EXCHANGE_COST}
                onClick={() => setPicks(autoPick(rows))}
              >
                自動で選ぶ
              </button>
              <button className={styles.tool} disabled={total === 0} onClick={() => setPicks({})}>
                選び直す
              </button>
              <span className={styles.stock}>
                手持ち {stock.toLocaleString()}
                <small>個ぶん</small>
              </span>
            </div>

            {stock < DYE_EXCHANGE_COST && (
              <p className={styles.short}>
                あと {DYE_EXCHANGE_COST - stock} 個ぶんで交換できます。
              </p>
            )}

            <ul className={styles.list}>
              {rows.map((r) => (
                <Row key={r.id} row={r} picked={picks[r.id] ?? 0} onChange={(n) => setPick(r.id, n)} />
              ))}
            </ul>

            <button className={`btn ${styles.make}`} disabled={!ready} onClick={make}>
              {ready ? '染料をつくる' : `あと ${DYE_EXCHANGE_COST - total} 個ぶん`}
            </button>
          </>
        )}

        {/* できあがった染料。色は運まかせ（ログインボーナスの染料と同じ抽選）。 */}
        {made && (
          <div className={styles.gotOverlay} onClick={() => setMade(null)}>
            <div className={styles.gotCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="染料をつくった">
              <div className={styles.gotLead}>染料ができた！</div>
              <span
                className={styles.swatch}
                style={{ background: colorById[made]?.value ?? '#ccc' }}
                aria-hidden
              />
              <div className={styles.gotName}>{partName(made)}</div>
              <p className={styles.gotNote}>マイウマの「色を塗る」から使えます。</p>
              <button className="btn" onClick={() => setMade(null)}>
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
