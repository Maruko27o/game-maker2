import type { Entrant } from '../logic/raceSim2';
import type { Course } from '../data/courses';
import { oddsFor, settle, type Bet, type BetKind } from '../logic/betting';
import { winProbs } from '../logic/grandprix';
import CoinIcon from './CoinIcon';
import styles from './BetResult.module.css';

const KIND_LABEL: Record<BetKind, string> = { win: '単勝', place: '複勝', quinella: '馬連', wide: 'ワイド', trifecta: '3連単' };

type Props = {
  entrants: Entrant[];
  gate: number[]; // entrant index -> gate (zekken) number
  order: number[]; // finishing order as entrant indices (1st..last)
  bets: Bet[];
  course: Course;
  probs?: number[]; // pre-computed win probabilities (Monte-Carlo); falls back to the heuristic
};

type BoardLine = { combo: number[]; mult: number; ordered: boolean };

// Gate-number chips for a winning combination.
function Combo({ combo, ordered }: { combo: number[]; ordered: boolean }) {
  return (
    <span className={styles.combo}>
      {combo.map((g, i) => (
        <span key={i} className={styles.gchipWrap}>
          <span className={styles.gchip}>{g}</span>
          {ordered && i < combo.length - 1 && <span className={styles.arrow}>→</span>}
        </span>
      ))}
    </span>
  );
}

// Official-style payout board (払戻金) computed from the actual finishing order,
// plus the player's own slip with per-bet hit/miss and the net result. Modelled on
// a real 競馬 payout screen: 収支プラスは赤、マイナスは青。
export default function BetResult({ entrants, gate, order, bets, course, probs }: Props) {
  const p = probs ?? winProbs(entrants, course);
  const g = (idx: number) => gate[idx];
  const top = order.slice(0, 3);
  const per100 = (m: number) => Math.floor(m * 100);

  // Winning payouts for every market, from the result.
  const board: { kind: BetKind; lines: BoardLine[] }[] = [
    { kind: 'win', lines: [{ combo: [g(order[0])], mult: oddsFor('win', [order[0]], p), ordered: false }] },
    { kind: 'place', lines: top.map((idx) => ({ combo: [g(idx)], mult: oddsFor('place', [idx], p), ordered: false })) },
    { kind: 'quinella', lines: [{ combo: [g(order[0]), g(order[1])].sort((a, b) => a - b), mult: oddsFor('quinella', [order[0], order[1]], p), ordered: false }] },
    {
      kind: 'wide',
      lines: [[0, 1], [0, 2], [1, 2]].map(([a, b]) => ({
        combo: [g(order[a]), g(order[b])].sort((x, y) => x - y),
        mult: oddsFor('wide', [order[a], order[b]], p),
        ordered: false,
      })),
    },
    { kind: 'trifecta', lines: [{ combo: [g(order[0]), g(order[1]), g(order[2])], mult: oddsFor('trifecta', [order[0], order[1], order[2]], p), ordered: true }] },
  ];

  // The player's own slip.
  const slip = bets.map((b) => {
    const payout = settle(b, order);
    return { b, payout, net: payout - b.amount, hit: payout > 0 };
  });
  const staked = bets.reduce((s, b) => s + b.amount, 0);
  const returned = slip.reduce((s, r) => s + r.payout, 0);
  const net = returned - staked;
  const netCls = (v: number) => (v >= 0 ? styles.plus : styles.minus);
  const sign = (v: number) => (v >= 0 ? '+' : '−');

  return (
    <div className={styles.wrap}>
      {/* Official payout board */}
      <div className={styles.board}>
        <div className={styles.boardHead}>払戻金</div>
        {board.map(({ kind, lines }) => (
          <div key={kind} className={styles.boardRow}>
            <span className={styles.mkt}>{KIND_LABEL[kind]}</span>
            <div className={styles.boardLines}>
              {lines.map((ln, i) => (
                <div key={i} className={styles.boardLine}>
                  <Combo combo={ln.combo} ordered={ln.ordered} />
                  <span className={styles.pay}>{per100(ln.mult).toLocaleString()}<span className={styles.per}>円 /100</span></span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Player's slip */}
      {bets.length > 0 ? (
        <div className={styles.slip}>
          <div className={styles.slipHead}>あなたの馬券</div>
          {slip.map(({ b, net: bn, hit }, i) => (
            <div key={i} className={`${styles.slipRow} ${hit ? styles.rowHit : styles.rowMiss}`}>
              <span className={`${styles.badge} ${hit ? styles.badgeHit : styles.badgeMiss}`}>{hit ? '的中' : 'ハズレ'}</span>
              <span className={styles.slipKind}>{KIND_LABEL[b.kind]}</span>
              <Combo combo={b.sel.map((idx) => gate[idx])} ordered={b.kind === 'trifecta'} />
              <span className={styles.stake}><CoinIcon size={11} /> {b.amount}</span>
              <span className={`${styles.slipNet} ${netCls(bn)}`}>{sign(bn)}{Math.abs(bn).toLocaleString()}</span>
            </div>
          ))}
          <div className={styles.totals}>
            <div className={styles.totCell}><span className={styles.totLbl}>購入</span><span className={styles.totVal}><CoinIcon size={13} /> {staked.toLocaleString()}</span></div>
            <div className={styles.totCell}><span className={styles.totLbl}>払戻</span><span className={styles.totVal}><CoinIcon size={13} /> {returned.toLocaleString()}</span></div>
            <div className={styles.totCell}><span className={styles.totLbl}>収支</span><span className={`${styles.totNet} ${netCls(net)}`}>{sign(net)}{Math.abs(net).toLocaleString()}</span></div>
          </div>
        </div>
      ) : (
        <div className={styles.noBet}>馬券は購入していません</div>
      )}
    </div>
  );
}
