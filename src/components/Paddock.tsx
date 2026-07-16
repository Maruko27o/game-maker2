import { useEffect, useMemo, useState } from 'react';
import type { Entrant } from '../logic/raceSim2';
import type { Course } from '../data/courses';
import type { HorseLook, StatKey } from '../types';
import { STAT_KEYS, STAT_LABEL, RUN_STYLE_LABEL } from '../types';
import { raceOddsFromProbs, oddsFor, BET_KINDS, type Bet, type BetKind } from '../logic/betting';
import { statTotal } from '../logic/stats';
import { winProbs } from '../logic/grandprix';
import { BET_AMOUNTS, MAX_BETS_PER_RACE } from '../data/coins';
import HorseView from './HorseView';
import StatRadar from './StatRadar';
import MoodFace from './MoodFace';
import CoinIcon from './CoinIcon';
import { MOODS, type MoodLevel } from '../logic/mood';
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
  maxBets?: number; // slip cap (default MAX_BETS_PER_RACE); grand-prix passes MAX_BETS_GP
  startLabel?: string; // override the start button label (e.g. "予選スタート")
  probs?: number[]; // pre-computed win probabilities (Monte-Carlo); falls back to the heuristic
  moods?: MoodLevel[]; // per-entrant mood for this race (shown as a face; already priced in)
};

const KIND_LABEL: Record<BetKind, string> = { win: '単勝', place: '複勝', quinella: '馬連', wide: 'ワイド', trifecta: '3連単' };

// Paddock: pick a market, select the horse(s), stake, and add to the bet slip —
// as many bets as you like (RACE_V4 改修①). Odds come from the same model as the
// popularity, with the 0.80 takeout. Bet on your own horse is allowed.
export default function Paddock({ entrants, looks, course, coins, bets, onAdd, onRemove, onStart, maxBets = MAX_BETS_PER_RACE, startLabel, probs, moods }: Props) {
  const p = useMemo(() => probs ?? winProbs(entrants, course), [probs, entrants, course]);
  const rows = useMemo(() => raceOddsFromProbs(p).slice().sort((a, b) => a.pop - b.pop), [p]);

  const [kind, setKind] = useState<BetKind>('win');
  const [sel, setSel] = useState<number[]>([]); // entrant indices, in tap order
  const [amount, setAmount] = useState<number>(BET_AMOUNTS[0]);
  const [openStats, setOpenStats] = useState<number | null>(null); // entrant idx whose 能力 panel is open
  const spec = BET_KINDS.find((k) => k.kind === kind)!;

  useEffect(() => setSel([]), [kind]); // reset selection when switching market

  const complete = sel.length === spec.pick;
  const curOdds = complete ? oddsFor(kind, sel, p) : 0;
  const staked = bets.reduce((s, b) => s + b.amount, 0);
  const full = bets.length >= maxBets; // slip cap reached

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
        <span className={styles.coins}><CoinIcon size={16} /> {coins.toLocaleString()}</span>
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
          const open = openStats === r.idx;
          return (
            <li key={r.idx} className={`${styles.item} ${e.isPlayer ? styles.me : ''}`}>
              <div className={`${styles.row} ${on ? styles.on : ''}`} onClick={() => toggle(r.idx)}>
                <span className={styles.pop}>{r.pop}人気</span>
                <div className={styles.horse}>
                  <HorseView horse={looks[e.horseId]} size={32} />
                  {moods && <span className={styles.moodBadge}><MoodFace level={moods[r.idx]} size={17} title={false} /></span>}
                </div>
                <span className={styles.name}>{e.isPlayer ? 'あなた' : e.name}</span>
                <button
                  className={`${styles.info} ${open ? styles.infoOn : ''}`}
                  aria-label="能力を見る"
                  onClick={(ev) => { ev.stopPropagation(); setOpenStats(open ? null : r.idx); }}
                >
                  <StatRadar stats={e.stats} size={22} bare />
                  <span className={styles.infoTxt}>能力<span className={styles.infoTotal}>総合 {statTotal(e.stats)}</span></span>
                </button>
                <span className={styles.win}>{r.odds.toFixed(1)}倍</span>
                <span className={`${styles.mark} ${on ? styles.markOn : ''}`}>
                  {on ? (spec.ordered ? order + 1 : '✓') : ''}
                </span>
              </div>
              {open && (
                <div className={styles.stats}>
                  <StatRadar stats={e.stats} size={132} />
                  <div className={styles.statMeta}>
                    <div className={styles.chipRow}>
                      <span className={styles.styleChip}>{RUN_STYLE_LABEL[e.style]}</span>
                      {moods && (
                        <span className={styles.moodChip} style={{ background: MOODS[moods[r.idx]].color, color: MOODS[moods[r.idx]].ink }}>
                          <MoodFace level={moods[r.idx]} size={16} title={false} /> {MOODS[moods[r.idx]].label}
                        </span>
                      )}
                    </div>
                    <dl className={styles.statNums}>
                      {STAT_KEYS.map((k: StatKey) => (
                        <div key={k} className={styles.statNum}>
                          <dt>{STAT_LABEL[k]}</dt>
                          <dd>{e.stats[k]}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </div>
              )}
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
          {full ? `上限${maxBets}パターン` : complete ? `${curOdds.toFixed(1)}倍で追加` : `${KIND_LABEL[kind]}を選ぶ`}
        </button>
      </div>

      {/* bet slip */}
      {bets.length > 0 && (
        <div className={styles.slip}>
          <div className={styles.slipHead}>賭け伝票 {bets.length}/{maxBets}（合計 <CoinIcon size={13} /> {staked}）</div>
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
        <button className="btn" onClick={onStart}>{startLabel ?? (bets.length > 0 ? '出走！' : '賭けずに出走')}</button>
      </div>
    </div>
  );
}
