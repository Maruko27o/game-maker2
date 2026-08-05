import { useEffect, useMemo, useState } from 'react';
import type { Entrant } from '../logic/raceSim2';
import type { Course } from '../data/courses';
import type { HorseLook } from '../types';
import { raceOddsFromProbs, oddsFor, fmtOdds, pickInOddsRange, BET_KINDS, type Bet, type BetKind } from '../logic/betting';
import { CUSTOM_BET, DEFAULT_CUSTOM_BET, normalizeCustomBet, type CustomBetSpec } from '../data/customBet';
import { useStore } from '../store';
import CloseButton from './CloseButton';
import { fillPicks } from '../logic/omakase';
import { statTotal } from '../logic/stats';
import { winProbs } from '../logic/grandprix';
import { BET_AMOUNTS, MAX_BETS_PER_RACE } from '../data/coins';
import HorseView from './HorseView';
import Icon from './Icon';
import StatRadar from './StatRadar';
import CoinIcon from './CoinIcon';
import type { MoodLevel } from '../logic/mood';
import HorseStatsPopup from './HorseStatsPopup';
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
  laps?: number; // 周回数。2着3着モデルの補正の強さに効く（長いほど強く割り引く）
  moods?: MoodLevel[]; // per-entrant mood for this race (shown as a face; already priced in)
};

const KIND_LABEL: Record<BetKind, string> = { win: '単勝', place: '複勝', quinella: '馬連', wide: 'ワイド', trifecta: '3連単' };

// Paddock: pick a market, select the horse(s), stake, and add to the bet slip —
// as many bets as you like (RACE_V4 改修①). Odds come from the same model as the
// popularity, with the 0.80 takeout. Bet on your own horse is allowed.
export default function Paddock({ entrants, looks, course, coins, bets, onAdd, onRemove, onStart, maxBets = MAX_BETS_PER_RACE, startLabel, probs, laps, moods }: Props) {
  const p = useMemo(() => probs ?? winProbs(entrants, course), [probs, entrants, course]);
  const rows = useMemo(() => raceOddsFromProbs(p).slice().sort((a, b) => a.pop - b.pop), [p]);

  const [kind, setKind] = useState<BetKind>('win');
  const [sel, setSel] = useState<number[]>([]); // entrant indices, in tap order
  const [amount, setAmount] = useState<number>(BET_AMOUNTS[0]);
  // カスタムベット：倍率と金額を決めておいて、ワンタップでその条件の馬券を買う。
  const customBet = useStore((st) => st.customBet);
  const setCustomBet = useStore((st) => st.setCustomBet);
  const [cbOpen, setCbOpen] = useState(false);
  const [cbDraft, setCbDraft] = useState<CustomBetSpec>(customBet ?? DEFAULT_CUSTOM_BET);
  const [cbError, setCbError] = useState<string | null>(null);
  const [openStats, setOpenStats] = useState<number | null>(null); // entrant idx whose 能力 panel is open
  const spec = BET_KINDS.find((k) => k.kind === kind)!;

  useEffect(() => setSel([]), [kind]); // reset selection when switching market

  const complete = sel.length === spec.pick;
  const curOdds = complete ? oddsFor(kind, sel, p, laps) : 0;
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

  // おまかせ: keep the currently-selected market (単勝/馬連/…) and pick the horse
  // number(s) for us at the current stake, keeping only bets at 9000倍 or below.
  // Retries until a low-enough combo is found, then falls back to the most-favoured
  // horses for that same market (always the lowest odds — never switches the type).
  //
  // 選んでいるウマがあれば、それは必ず買い目に残して残りだけを任せる
  // （「このウマは入れたい、あとはおまかせ」）。単勝で1頭選んでいれば、
  // そのまま そのウマの単勝で確定する。
  const OMAKASE_MAX_ODDS = 9000;
  function omakase() {
    if (coins < amount || full) return;
    const idxs = Array.from({ length: entrants.length }, (_, i) => i);
    for (let tries = 0; tries < 120; tries++) {
      const picks = fillPicks(sel, idxs, spec.pick, Math.random);
      const odds = oddsFor(kind, picks, p, laps);
      if (odds > 0 && odds <= OMAKASE_MAX_ODDS) {
        onAdd({ kind, sel: picks, amount, odds });
        return;
      }
    }
    // fallback: 選んだウマは残したまま、残りを人気順で埋める（この馬券で一番低い倍率）
    const favPicks = sel.slice(0, spec.pick);
    for (const r of rows) {
      if (favPicks.length >= spec.pick) break;
      if (!favPicks.includes(r.idx)) favPicks.push(r.idx);
    }
    onAdd({ kind, sel: favPicks, amount, odds: oddsFor(kind, favPicks, p, laps) });
  }

  // 設定した倍率の範囲に入る買い目を、その時のレースの倍率から探して1点買う。
  // 候補が複数あればランダムに1つ（例：3〜4倍で単勝3.2倍と3.5倍があればどちらか）。
  function placeCustom() {
    if (!customBet) { setCbDraft(DEFAULT_CUSTOM_BET); setCbOpen(true); return; }
    setCbError(null);
    if (full) { setCbError(`馬券は${maxBets}パターンまでです`); return; }
    if (coins < customBet.amount) { setCbError('コインが不足しています'); return; }
    const hit = pickInOddsRange(p, laps ?? 2, customBet.minOdds, customBet.maxOdds, Math.random);
    if (!hit) { setCbError('その倍率は組めません'); return; }
    onAdd({ kind: hit.kind, sel: hit.sel, amount: customBet.amount, odds: hit.odds });
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
        {spec.pick > 1 && `（${spec.pick}頭選ぶ）`}
      </p>

      {/* field: tap a card to select. 2頭×4列のコンパクトなグリッド（ゲート番号・名前も表示） */}
      <ul className={styles.list}>
        {rows.map((r) => {
          const e = entrants[r.idx];
          const order = sel.indexOf(r.idx); // -1 if unselected
          const on = order >= 0;
          const open = openStats === r.idx;
          const gate = r.idx + 1; // ゲート番号（馬番）
          return (
            <li key={r.idx} className={`${styles.item} ${e.isPlayer ? styles.me : ''}`}>
              <div className={`${styles.row} ${on ? styles.on : ''}`} onClick={() => toggle(r.idx)}>
                <div className={styles.horseWrap}>
                  <HorseView horse={looks[e.horseId]} size={38} />
                </div>
                {/* ゲート番号はウマの絵に重ねず名前の横に。絵の外へはみ出す余白が要らなく
                    なるぶんカードが低くなり、出走ボタンまで画面に収まる。 */}
                <div className={styles.nameRow}>
                  <span className={styles.gate} aria-label={`ゲート${gate}番`}>{gate}</span>
                  <span className={styles.name}>{e.isPlayer ? 'あなた' : e.name}</span>
                </div>
                {/* 人気順は並び順そのものが示しているので、レーダーと被る「n人気」は出さない */}
                <div className={styles.oddsRow}>
                  <span className={styles.win}>{fmtOdds(r.odds)}倍</span>
                </div>
                <button
                  className={`${styles.info} ${open ? styles.infoOn : ''}`}
                  aria-label={`能力を見る（総合${statTotal(e.stats)}）`}
                  onClick={(ev) => { ev.stopPropagation(); setOpenStats(open ? null : r.idx); }}
                >
                  <StatRadar stats={e.stats} size={20} bare />
                  <span className={styles.infoTotal}>{statTotal(e.stats)}</span>
                </button>
                <span className={`${styles.mark} ${on ? styles.markOn : ''}`}>
                  {on ? (spec.ordered ? order + 1 : '✓') : ''}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {/* おまかせ: auto-pick horses for the SELECTED market at the current stake
          (odds cap is internal — not shown). The market name is on the button so
          it's clear which 馬券 will be bought. */}
      <button className={styles.omakase} disabled={coins < amount || full} onClick={omakase}>
        <Icon name="dice" size={18} />{' '}
        {sel.length > 0
          ? `選んだウマ入りの${KIND_LABEL[kind]}をおまかせ（${amount}コインで1点）`
          : `${KIND_LABEL[kind]}をおまかせ（${amount}コインで1点）`}
      </button>

      {/* カスタムベット：設定してあれば1タップで買う。ペンで設定し直せる。 */}
      <div className={styles.customRow}>
        <button className={styles.custom} disabled={full} onClick={placeCustom}>
          {customBet
            ? `カスタム ${customBet.minOdds}〜${customBet.maxOdds}倍・${customBet.amount.toLocaleString()}コイン`
            : 'カスタムベットを設定'}
        </button>
        {customBet && (
          <button
            className={styles.customEdit}
            aria-label="カスタムベットの設定"
            onClick={() => { setCbDraft(customBet); setCbOpen(true); }}
          >
            ✎
          </button>
        )}
      </div>
      {cbError && <div className={styles.customError} role="alert">{cbError}</div>}

      {/* stake + add */}
      <div className={styles.stakeRow}>
        {BET_AMOUNTS.map((a) => (
          <button key={a} className={`${styles.amt} ${amount === a ? styles.amtOn : ''}`} disabled={coins < a} onClick={() => setAmount(a)}>
            {a}
          </button>
        ))}
        <button className={styles.add} disabled={!complete || coins < amount || full} onClick={add}>
          {full ? `上限${maxBets}パターン` : complete ? `${fmtOdds(curOdds)}倍で追加` : `${KIND_LABEL[kind]}を選ぶ`}
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
              <span className={styles.slipOdds}>{fmtOdds(b.odds)}倍</span>
              <span className={styles.slipAmt}><CoinIcon size={12} /> {b.amount}</span>
              <button className={styles.slipDel} onClick={() => onRemove(i)}>取消</button>
            </div>
          ))}
        </div>
      )}

      {/* 能力のポップアップ：画面外タップか✕で閉じる（レース中・払戻画面と共通） */}
      {openStats !== null && entrants[openStats] && (
        <HorseStatsPopup
          entrant={entrants[openStats]}
          gate={openStats + 1}
          mood={moods?.[openStats]}
          onClose={() => setOpenStats(null)}
        />
      )}

      <div className={styles.actions}>
        <button className={styles.start} onClick={onStart}>{startLabel ?? '出走'}</button>
      </div>

      {/* カスタムベットの設定 */}
      {cbOpen && (
        <div className={styles.cbOverlay} onClick={() => setCbOpen(false)}>
          <div className={styles.cbSheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="カスタムベットの設定">
            <CloseButton onClick={() => setCbOpen(false)} />
            <h3 className={styles.cbTitle}>カスタムベット</h3>

            <div className={styles.cbLabel}>賭ける金額</div>
            <div className={styles.cbStepper}>
              <button
                className={styles.cbStep}
                onClick={() => setCbDraft((d) => normalizeCustomBet({ ...d, amount: d.amount - CUSTOM_BET.amountStep }))}
                disabled={cbDraft.amount <= CUSTOM_BET.amountMin}
              >
                −
              </button>
              <span className={styles.cbValue}>{cbDraft.amount.toLocaleString()}<small>コイン</small></span>
              <button
                className={styles.cbStep}
                onClick={() => setCbDraft((d) => normalizeCustomBet({ ...d, amount: d.amount + CUSTOM_BET.amountStep }))}
                disabled={cbDraft.amount >= CUSTOM_BET.amountMax}
              >
                ＋
              </button>
            </div>
            <input
              className={styles.cbRange}
              type="range"
              min={CUSTOM_BET.amountMin}
              max={CUSTOM_BET.amountMax}
              step={CUSTOM_BET.amountStep}
              value={cbDraft.amount}
              onChange={(e) => setCbDraft((d) => normalizeCustomBet({ ...d, amount: Number(e.target.value) }))}
            />

            <div className={styles.cbLabel}>希望する倍率（整数のみ）</div>
            <div className={styles.cbOddsRow}>
              <input
                className={styles.cbNum}
                type="number"
                inputMode="numeric"
                min={CUSTOM_BET.oddsMin}
                max={CUSTOM_BET.oddsMax}
                step={1}
                value={cbDraft.minOdds}
                aria-label="倍率の下限"
                onChange={(e) => setCbDraft((d) => ({ ...d, minOdds: Math.floor(Number(e.target.value) || 0) }))}
              />
              <span className={styles.cbTilde}>〜</span>
              <input
                className={styles.cbNum}
                type="number"
                inputMode="numeric"
                min={CUSTOM_BET.oddsMin}
                max={CUSTOM_BET.oddsMax}
                step={1}
                value={cbDraft.maxOdds}
                aria-label="倍率の上限"
                onChange={(e) => setCbDraft((d) => ({ ...d, maxOdds: Math.floor(Number(e.target.value) || 0) }))}
              />
              <span className={styles.cbUnit}>倍</span>
            </div>
            <p className={styles.cbNote}>
              {CUSTOM_BET.oddsMin}〜{CUSTOM_BET.oddsMax.toLocaleString()}倍まで。範囲に入る買い目から1つを自動で選びます。
            </p>

            <button
              className={styles.cbOk}
              onClick={() => { setCustomBet(normalizeCustomBet(cbDraft)); setCbError(null); setCbOpen(false); }}
            >
              確定
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
