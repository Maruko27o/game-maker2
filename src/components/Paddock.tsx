import { useEffect, useMemo, useState } from 'react';
import type { Entrant } from '../logic/raceSim2';
import type { Course } from '../data/courses';
import type { HorseLook } from '../types';
import { raceOdds, oddsFor, BET_KINDS, type Bet, type BetKind } from '../logic/betting';
import { winProbs } from '../logic/grandprix';
import { BET_AMOUNTS, MAX_BETS_PER_RACE } from '../data/coins';
import HorseView from './HorseView';
import CoinIcon from './CoinIcon';
import styles from './Paddock.module.css';

type Props = {
  entrants: Entrant[];
  looks: Record<string, HorseLook>;
  course: Course;
  coins: number;
  bets: Bet[];
  onAdd: (bet: Bet) => void; // parent spends the stake
  onRemove: (index: number) => void; // parent refunds the stake
  onStart: () => void;
};

const KIND_LABEL: Record<BetKind, string> = { win: '単勝', place: '複勝', quinella: '馬連', wide: 'ワイド', trifecta: '3連単' };

// Paddock: pick a market, select the horse(s), stake, and add to the bet slip —
// as many bets as you like (RACE_V4 改修①). Odds come from the same model as the
// popularity, with the 0.80 takeout. Bet on your own horse is allowed.
export default function Paddock({ entrants, looks, course, coins, bets, onAdd, onRemove, onStart }: Props) {
  const p = useMemo(() => winProbs(entrants, course), [entrants, course]);
  const rows = useMemo(() => raceOdds(entrants, course).slice().sort((a, b) => a.pop - b.pop), [entrants, course]);

  const [kind, setKind] = useState<BetKind>('win');
  const [sel, setSel] = useState<number[]>([]); // entrant indices, in tap order
  const [amount, setAmount] = useState<number>(BET_AMOUNTS[0]);
  const spec = BET_KINDS.find((k) => k.kind === kind)!;

  useEffect(() => setSel([]), [kind]); // reset selection when switching market

  const complete = sel.length === spec.pick;
  const curOdds = complete ? oddsFor(kind, sel, p) : 0;
  const staked = bets.reduce((s, b) => s + b.amount, 0);
  const full = bets.length >= MAX_BETS_PER_RACE; // slip cap reached

  function toggle(idx: number) {
    setSel((prev) => {
      const at = prev.indexOf(idx);
      if (at >= 0) return prev.filter((x) => x !== idx); // tap again to deselect
      if (prev.length >= spec.pick) return spec.pick === 1 ? [idx] : prev; // replace if single, else full
      return [...prev, idx];
    });
  }

  function add() {
    if (!complete || coins < amount || full) return;
    onAdd({ kind, sel: [...sel], amount, odds: curOdds });
    setSel([]);
  }

  return (
    <div className={styles.paddock}>
      <div className={styles.head}>
        <h2 className={styles.h2}>パドック</h2>
        <span className={styles.coins}><CoinIcon size={18} /> {coins.toLocaleString()}</span>
      </div>

      {/* market tabs */}
      <div className={styles.tabs}>
        {BET_KINDS.map((k) => (
          <button key={k.kind} className={`${styles.tab} ${kind === k.kind ? styles.tabOn : ''}`} onClick={() => setKind(k.kind)}>
            {k.label}
          </button>
        ))}
      </div>
      <p className={styles.hint}>
        {spec.hint}
        {spec.pick > 1 && `（${spec.pick}頭えらぶ）`}
      </p>

      {/* field: tap to select */}
      <ul className={styles.list}>
        {rows.map((r) => {
          const e = entrants[r.idx];
          const order = sel.indexOf(r.idx); // -1 if unselected
          const on = order >= 0;
          return (
            <li key={r.idx} className={`${styles.row} ${e.isPlayer ? styles.me : ''} ${on ? styles.on : ''}`} onClick={() => toggle(r.idx)}>
              <span className={styles.pop}>{r.pop}人気</span>
              <div className={styles.horse}><HorseView horse={looks[e.horseId]} size={32} /></div>
              <span className={styles.name}>{e.isPlayer ? 'あなた' : e.name}</span>
              <span className={styles.win}>{r.odds.toFixed(1)}倍</span>
              <span className={`${styles.mark} ${on ? styles.markOn : ''}`}>
                {on ? (spec.ordered ? order + 1 : '✓') : ''}
              </span>
            </li>
          );
        })}
      </ul>

      {/* stake + add */}
      <div className={styles.stakeRow}>
        {BET_AMOUNTS.map((a) => (
          <button key={a} className={`${styles.amt} ${amount === a ? styles.amtOn : ''}`} disabled={coins < a} onClick={() => setAmount(a)}>
            {a}
          </button>
        ))}
        <button className={styles.add} disabled={!complete || coins < amount || full} onClick={add}>
          {full ? '上限10パターン' : complete ? `${curOdds.toFixed(1)}倍で追加` : `${KIND_LABEL[kind]}を選ぶ`}
        </button>
      </div>

      {/* bet slip */}
      {bets.length > 0 && (
        <div className={styles.slip}>
          <div className={styles.slipHead}>賭け伝票 {bets.length}/{MAX_BETS_PER_RACE}（合計 <CoinIcon size={13} /> {staked}）</div>
          {bets.map((b, i) => (
            <div key={i} className={styles.slipRow}>
              <span className={styles.slipKind}>{KIND_LABEL[b.kind]}</span>
              <span className={styles.slipPicks}>{b.sel.map((idx) => (entrants[idx].isPlayer ? '自' : entrants[idx].name.slice(0, 3))).join(b.kind === 'trifecta' ? '→' : '・')}</span>
              <span className={styles.slipOdds}>{b.odds.toFixed(1)}倍</span>
              <span className={styles.slipAmt}><CoinIcon size={12} /> {b.amount}</span>
              <button className={styles.slipDel} onClick={() => onRemove(i)}>取消</button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.actions}>
        <button className="btn" onClick={onStart}>{bets.length > 0 ? '出走！' : '賭けずに出走'}</button>
      </div>
    </div>
  );
}
