import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, dayKey } from '../store';
import { useAuth, enterArena, loadArenaPool } from '../cloud';
import { COURSES } from '../data/courses';
import { statTotal } from '../logic/stats';
import { styleFor } from '../logic/runStyle';
import { runTournament, playerSnapshot, snapToEntrant, fieldLooks } from '../logic/arena';
import {
  ARENA_ENTRY_FEE,
  ARENA_MODE,
  ARENA_ADVANCE,
  ARENA_ROUND_NAMES,
  arenaOutcomeLabel,
} from '../data/arena';
import { RUN_STYLE_LABEL } from '../types';
import type { ArenaResult, ArenaRoundResult, Horse } from '../types';
import HorseView from '../components/HorseView';
import CoinIcon from '../components/CoinIcon';
import Icon from '../components/Icon';
import RaceTrack2 from '../components/RaceTrack2';
import { usePrefersReducedMotion } from '../hooks';
import styles from './Race.module.css';
import a from './Arena.module.css';

function stars(pt: number): string {
  const n = Math.max(1, Math.min(5, Math.round((pt - 28) / 4)));
  return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
}

// The finishing rows of one round, sorted by rank (for the summary board).
function RoundBoard({ rr }: { rr: ArenaRoundResult }) {
  const rows = rr.field
    .map((s, i) => ({ s, rank: rr.ranks[i] }))
    .sort((x, y) => x.rank - y.rank);
  const passLabel = rr.round === 2 ? (n: number) => (n === 1 ? '優勝' : '') : (n: number) => (n <= ARENA_ADVANCE ? '通過' : '');
  return (
    <div className={a.board}>
      <div className={a.boardHead}>
        <span className={a.boardName}>{ARENA_ROUND_NAMES[rr.round]}</span>
        <span className={a.boardSub}>{rr.round === 2 ? '着順で賞金' : `上位${ARENA_ADVANCE}通過`}</span>
      </div>
      {rows.slice(0, rr.field.length).map(({ s, rank }) => {
        const label = passLabel(rank);
        return (
          <div key={s.horseId} className={`${a.brow} ${s.isPlayer ? a.bmine : ''}`}>
            <span className={a.bmedal}>{rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}</span>
            <div className={a.bface}><HorseView horse={s} size={30} /></div>
            <span className={a.bname}>
              {s.isPlayer ? 'あなた' : s.name}
              {s.isCom && <span className={a.tagCom}>COM</span>}
            </span>
            {label && <span className={`${a.tagPass} ${label === '通過' ? a.tagGo : a.tagWin}`}>{label}</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function Arena({ onExit }: { onExit: () => void }) {
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();
  const horses = useStore((s) => s.horses);
  const coins = useStore((s) => s.coins);
  const arena = useStore((s) => s.arena);
  const arenaEnter = useStore((s) => s.arenaEnter);
  const arenaSettle = useStore((s) => s.arenaSettle);
  const spendCoins = useStore((s) => s.spendCoins);
  const playerNo = useAuth((s) => s.playerNo);

  const today = dayKey();
  const entry = arena?.entry ?? null;
  const stored = arena?.result ?? null;
  const revealable = !!entry && entry.day < today; // yesterday(or older) → ready to reveal
  const pendingToday = !!entry && entry.day === today; // entered today, results tomorrow

  const [screen, setScreen] = useState<'home' | 'reveal' | 'playing' | 'interstitial' | 'summary'>('home');
  const [horseId, setHorseId] = useState<string>(horses[0]?.id ?? '');
  const [view, setView] = useState<ArenaResult | null>(null); // the tournament being watched
  const [round, setRound] = useState(0);
  const [note, setNote] = useState<string | null>(null);

  const selected: Horse | undefined = horses.find((h) => h.id === horseId) ?? horses[0];

  // ---- entry ----
  function doEnter() {
    if (!selected) return;
    if (coins < ARENA_ENTRY_FEE) {
      setNote('コインが足りないよ');
      return;
    }
    if (!spendCoins(ARENA_ENTRY_FEE)) return;
    const snap = playerSnapshot(
      selected.id,
      selected.name,
      selected.colors,
      selected.decos,
      selected.stats,
      styleFor(selected.id, selected.stats),
      playerNo,
    );
    const seed = (Math.random() * 2 ** 31) >>> 0;
    arenaEnter({ day: today, seed, horseId: selected.id, snapshot: snap });
    void enterArena(today, snap); // best-effort: share to the cross-user pool
    setNote(null);
  }

  // ---- reveal yesterday's entry ----
  const revealing = useRef(false);
  async function doReveal() {
    if (!entry || revealing.current) return;
    revealing.current = true;
    setScreen('reveal');
    const pool = await loadArenaPool(entry.day).catch(() => []);
    const result = runTournament(entry.snapshot, entry.seed, pool, ARENA_MODE, entry.day);
    arenaSettle(result); // credit prize once, store, clear the entry
    setView(result);
    setRound(0);
    setScreen('playing');
    revealing.current = false;
  }

  function reWatch() {
    if (!stored) return;
    setView(stored);
    setRound(0);
    setScreen('playing');
  }

  function afterRound() {
    if (!view) return;
    if (round + 1 < view.rounds.length) setScreen('interstitial');
    else setScreen('summary');
  }

  // Keep the picker pointed at a real horse if the list changes.
  useEffect(() => {
    if (!horses.find((h) => h.id === horseId)) setHorseId(horses[0]?.id ?? '');
  }, [horses, horseId]);

  // ---- playback ----
  if (screen === 'playing' && view) {
    const rr = view.rounds[round];
    const course = COURSES.find((c) => c.id === rr.courseId) ?? COURSES[0];
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>{ARENA_ROUND_NAMES[rr.round]}</h1>
        <RaceTrack2
          key={round}
          entrants={rr.field.map(snapToEntrant)}
          looks={fieldLooks(rr.field)}
          course={course}
          mode={view.mode}
          seed={rr.seed}
          reduced={reduced}
          skippable
          onFinish={afterRound}
        />
      </div>
    );
  }

  // ---- between-round interstitial ----
  if (screen === 'interstitial' && view) {
    const rr = view.rounds[round];
    return (
      <div className={styles.page}>
        <div className={a.interCard}>
          <div className={a.interBig}>{rr.playerRank}位</div>
          <div className={a.interMsg}>{ARENA_ROUND_NAMES[rr.round]} 突破！</div>
          <div className={a.interSub}>上位{ARENA_ADVANCE}に入った！ 次のレースへ</div>
          <button className="btn" onClick={() => { setRound(round + 1); setScreen('playing'); }}>
            {ARENA_ROUND_NAMES[view.rounds[round + 1].round]}へ ▶
          </button>
        </div>
      </div>
    );
  }

  // ---- summary ----
  if (screen === 'summary' && view) {
    const champ = view.outcome === 'champion';
    return (
      <div className={styles.page}>
        <div className={`${a.resultTop} ${champ ? a.resultTopWin : ''}`}>
          <div className={a.resultBig}>
            {champ && <Icon name="trophy" size={26} />} {arenaOutcomeLabel(view.outcome, view.finalRank ?? 0)}
          </div>
          <div className={a.resultPay}>
            <CoinIcon size={18} /> 賞金 ＋{view.payout.toLocaleString()}
          </div>
        </div>
        {view.rounds.map((rr) => (
          <RoundBoard key={rr.round} rr={rr} />
        ))}
        <div className={a.poolNote}>足りない分はCOMが自動で参加しているよ</div>
        <div className={styles.setupActions}>
          <button className="btn neutral" onClick={() => { setView(null); setScreen('home'); }}>とじる</button>
          <button className="btn" onClick={() => { setRound(0); setScreen('playing'); }}>もう一度見る</button>
        </div>
      </div>
    );
  }

  // ---- loading ----
  if (screen === 'reveal') {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>たいせん</h1>
        <div className={a.loading}>対戦相手を集めています…</div>
      </div>
    );
  }

  // ---- home ----
  const pt = selected ? statTotal(selected.stats) : 0;
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>たいせん</h1>
      <p className={styles.lead}>毎日開催・世界のウマと勝ち抜きトーナメント！</p>

      {/* result callout */}
      {revealable ? (
        <div className={`${a.callout} ${a.calloutNew}`}>
          <div className={a.calloutHead}>
            <span className={a.calloutTitle}><Icon name="flag" size={16} /> きのうの対戦結果</span>
            <span className={a.newBadge}>NEW</span>
          </div>
          <div className={a.calloutSub}>あなた：{entry?.snapshot.name}</div>
          <button className={`btn ${a.bigGold}`} onClick={doReveal}>▶ 結果を見る（3レース再生）</button>
        </div>
      ) : stored ? (
        <div className={a.callout}>
          <div className={a.calloutHead}>
            <span className={a.calloutTitle}><Icon name="flag" size={16} /> 前回の対戦結果</span>
          </div>
          <div className={a.calloutSub}>{arenaOutcomeLabel(stored.outcome, stored.finalRank ?? 0)}・賞金 ＋{stored.payout.toLocaleString()}</div>
          <button className="btn neutral" onClick={reWatch}>もう一度見る</button>
        </div>
      ) : null}

      {/* entry */}
      <div className={a.section}>
        <div className={a.sectionTitle}>今日のエントリー（1日1回）</div>
        {horses.length === 0 ? (
          <div className={a.empty}>
            <p>エントリーできるウマがいません。</p>
            <button className="btn" onClick={() => navigate('/create')}>ウマをつくる</button>
          </div>
        ) : pendingToday ? (
          <div className={a.entered}>
            <Icon name="medal" size={22} />
            <div>
              <b>エントリー済み：{entry?.snapshot.name}</b>
              <div className={a.enteredSub}>結果は明日みられるよ！</div>
            </div>
          </div>
        ) : revealable ? (
          <div className={a.lockedEntry}>まず「きのうの対戦結果」を見てね</div>
        ) : (
          <>
            <div className={a.pickRow}>
              {horses.map((h) => (
                <button key={h.id} className={`${a.pickCard} ${horseId === h.id ? a.pickSel : ''}`} onClick={() => setHorseId(h.id)}>
                  <HorseView horse={h} size={60} />
                  <span className={a.pickName}>{h.name}</span>
                </button>
              ))}
            </div>
            {selected && (
              <div className={a.pickInfo}>
                脚質：{RUN_STYLE_LABEL[styleFor(selected.id, selected.stats)]} ・ 総合力 <b>{stars(pt)}</b>
              </div>
            )}
            <div className={a.feeRow}>
              <span>参加費</span>
              <span className={a.fee}><CoinIcon size={16} /> {ARENA_ENTRY_FEE.toLocaleString()}</span>
            </div>
            <button className={`btn ${a.bigGreen}`} onClick={doEnter} disabled={!selected}>この馬でエントリーする</button>
            {note && <div className={a.note}>{note}</div>}
            <div className={a.hint}>持ちコイン {coins.toLocaleString()} ・ 足りない相手はCOMが入るよ</div>
          </>
        )}
      </div>

      {/* flow */}
      <div className={a.section}>
        <div className={a.sectionTitle}>トーナメントの流れ（勝ち抜き）</div>
        <div className={a.flow}>
          <div className={a.flowStep}>予選<br />1回戦<br /><span className={a.flowGo}>上位{ARENA_ADVANCE}通過</span></div>
          <span className={a.flowArrow}>▶</span>
          <div className={a.flowStep}>予選<br />2回戦<br /><span className={a.flowGo}>上位{ARENA_ADVANCE}通過</span></div>
          <span className={a.flowArrow}>▶</span>
          <div className={`${a.flowStep} ${a.flowFinal}`}>本線<br />決勝<br /><span className={a.flowWin}>着順で賞金</span></div>
        </div>
      </div>

      {/* prize table */}
      <div className={a.section}>
        <div className={a.sectionTitle}>本線の賞金</div>
        <div className={a.prizes}>
          <div className={`${a.prize} ${a.prizeTop}`}><b>🥇 優勝</b><b className={a.prizeAmt}>＋10,000</b></div>
          <div className={a.prize}><b>🥈 準優勝</b><b className={a.prizeAmt}>＋3,000</b></div>
          <div className={a.prize}><b>🥉 3位</b><b className={a.prizeAmt}>＋1,500</b></div>
          <div className={a.prize}><b>4〜8位（本線出場）</b><b className={a.prizeAmt}>＋500</b></div>
          <div className={a.prize}><b>予選で敗退</b><b className={a.prizeAmt}>＋200</b></div>
        </div>
        <div className={a.balanceNote}>1日1回・翌日開示。予選2連戦を勝ち抜いて優勝すると大金！</div>
      </div>

      <button className={styles.exitLink} onClick={onExit}>もどる</button>
    </div>
  );
}
