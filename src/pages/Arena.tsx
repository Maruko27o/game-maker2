import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useAuth, enterArena, loadArenaPool, loadMyArenaEntry } from '../cloud';
import { COURSES } from '../data/courses';
import { statTotal } from '../logic/stats';
import { styleFor } from '../logic/runStyle';
import { playerSnapshot, snapToEntrant, fieldLooks } from '../logic/arena';
import {
  ARENA_ENTRY_FEE,
  ARENA_ADVANCE,
  ARENA_ROUND_NAMES,
  arenaOutcomeLabel,
  periodId,
  periodLabel,
  msToNextPeriod,
} from '../data/arena';
import { RUN_STYLE_LABEL } from '../types';
import type { ArenaResult, ArenaRoundResult, ArenaEntry, Horse } from '../types';
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
function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
// Resolve `p`, but never wait longer than `ms` — a flaky network must not block
// the arena sync (resolution / auto-entry / coins must happen offline too).
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p.catch(() => fallback), new Promise<T>((res) => setTimeout(() => res(fallback), ms))]);
}
function outcomeMedal(r: ArenaResult): string {
  if (r.outcome === 'champion') return '🥇';
  if (r.outcome === 'final') return r.finalRank === 2 ? '🥈' : r.finalRank === 3 ? '🥉' : '🏁';
  return '—';
}

// The finishing rows of one round, sorted by rank (for the summary board).
function RoundBoard({ rr }: { rr: ArenaRoundResult }) {
  const rows = rr.field.map((s, i) => ({ s, rank: rr.ranks[i] })).sort((x, y) => x.rank - y.rank);
  const passLabel = rr.round === 2 ? (n: number) => (n === 1 ? '優勝' : '') : (n: number) => (n <= ARENA_ADVANCE ? '通過' : '');
  return (
    <div className={a.board}>
      <div className={a.boardHead}>
        <span className={a.boardName}>{ARENA_ROUND_NAMES[rr.round]}</span>
        <span className={a.boardSub}>{rr.round === 2 ? '着順で賞金' : `上位${ARENA_ADVANCE}通過`}</span>
      </div>
      {rows.map(({ s, rank }) => {
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
  const arenaEnterManual = useStore((s) => s.arenaEnterManual);
  const arenaSetAuto = useStore((s) => s.arenaSetAuto);
  const arenaSync = useStore((s) => s.arenaSync);
  const arenaMarkSeen = useStore((s) => s.arenaMarkSeen);
  const arenaAdoptPending = useStore((s) => s.arenaAdoptPending);
  const playerNo = useAuth((s) => s.playerNo);

  const st = arena ?? { auto: null, pending: null, lastPeriod: null, results: [] };
  const cur = periodId();
  const enteredThisPeriod = st.pending?.period === cur || (st.lastPeriod ?? -1) >= cur;
  const results = st.results;
  const unseen = results.filter((r) => !r.seen).length;

  const [screen, setScreen] = useState<'home' | 'playing' | 'interstitial' | 'summary'>('home');
  const [horseId, setHorseId] = useState<string>(horses[0]?.id ?? '');
  const [view, setView] = useState<ArenaResult | null>(null);
  const [round, setRound] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const selected: Horse | undefined = horses.find((h) => h.id === horseId) ?? horses[0];
  const autoHorse = st.auto ? horses.find((h) => h.id === st.auto!.horseId) : undefined;

  // Resolve closed entries + run auto catch-up on mount (and after enabling auto).
  const syncing = useRef(false);
  async function doSync() {
    if (syncing.current) return;
    syncing.current = true;
    const c = periodId();
    // Cloud DB is the authority for "already entered this period" (fixes app-kill
    // re-entry); the pool seeds opponents. Both are time-bounded so a flaky/absent
    // network can't stall resolution, auto-entry, or coin credit.
    const [mine, pool] = await Promise.all([
      withTimeout(loadMyArenaEntry(c), 2500, null),
      withTimeout(loadArenaPool(c), 2500, [] as Awaited<ReturnType<typeof loadArenaPool>>),
    ]);
    if (mine) arenaAdoptPending({ period: c, seed: (Math.random() * 2 ** 31) >>> 0, horseId: mine.horseId, snapshot: mine });
    arenaSync(c, pool);
    // Push whatever entry now stands for the current period to the shared pool.
    const p = useStore.getState().arena?.pending;
    if (p && p.period === c) void enterArena(c, p.snapshot);
    syncing.current = false;
  }
  useEffect(() => {
    void doSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!horses.find((h) => h.id === horseId)) setHorseId(horses[0]?.id ?? '');
  }, [horses, horseId]);

  function mkEntry(horse: Horse): ArenaEntry {
    const snap = playerSnapshot(horse.id, horse.name, horse.colors, horse.decos, horse.stats, styleFor(horse.id, horse.stats), playerNo);
    return { period: cur, seed: (Math.random() * 2 ** 31) >>> 0, horseId: horse.id, snapshot: snap };
  }
  function doEnter() {
    if (!selected) return;
    if (coins < ARENA_ENTRY_FEE) { setNote('コインが足りないよ'); return; }
    const e = mkEntry(selected);
    if (arenaEnterManual(e)) {
      void enterArena(cur, e.snapshot);
      setNote(null);
    }
  }
  async function enableAuto() {
    if (!selected) return;
    if (coins < ARENA_ENTRY_FEE) { setNote('コインが足りないよ'); return; }
    setNote(null);
    arenaSetAuto(selected.id);
    await doSync(); // enter the current period right away
  }
  function disableAuto() {
    arenaSetAuto(null);
  }

  function watch(r: ArenaResult) {
    arenaMarkSeen(r.period);
    setView(r);
    setRound(0);
    setScreen('playing');
  }
  function afterRound() {
    if (!view) return;
    if (round + 1 < view.rounds.length) setScreen('interstitial');
    else setScreen('summary');
  }

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
          <div className={a.resultLabel}>{view.label}</div>
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

  // ---- home ----
  const pt = selected ? statTotal(selected.stats) : 0;
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>たいせん</h1>
      <p className={styles.lead}>1日2回開催（0時・12時）・勝ち抜きトーナメント！</p>

      {/* current period + countdown */}
      <div className={a.periodBar}>
        <span><b>{periodLabel(cur)}</b> 開催中</span>
        <span className={a.countdown}>次の開催まで {fmtCountdown(msToNextPeriod())}</span>
      </div>

      {/* results list (溜まっていく) */}
      <div className={a.section}>
        <div className={a.sectionTitle}>
          対戦結果 {unseen > 0 && <span className={a.newCount}>NEW {unseen}</span>}
        </div>
        {results.length === 0 ? (
          <div className={a.emptyResults}>まだ結果はありません。エントリーして次の開催を待ってね！</div>
        ) : (
          <div className={a.resultList}>
            {results.map((r) => (
              <button key={r.period} className={`${a.resultRow} ${!r.seen ? a.resultNew : ''}`} onClick={() => watch(r)}>
                <span className={a.resMedal}>{outcomeMedal(r)}</span>
                <span className={a.resInfo}>
                  <span className={a.resLabel}>{r.label}{!r.seen && <span className={a.newDot}>NEW</span>}</span>
                  <span className={a.resOutcome}>{arenaOutcomeLabel(r.outcome, r.finalRank ?? 0)}</span>
                </span>
                <span className={a.resPay}>{r.payout > 0 ? `＋${r.payout.toLocaleString()}` : '±0'}</span>
                <span className={a.resPlay}>▶</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* entry */}
      <div className={a.section}>
        <div className={a.sectionTitle}>エントリー</div>
        {horses.length === 0 ? (
          <div className={a.empty}>
            <p>エントリーできるウマがいません。</p>
            <button className="btn" onClick={() => navigate('/create')}>ウマをつくる</button>
          </div>
        ) : st.auto ? (
          <div className={a.autoOn}>
            <div className={a.autoRow}>
              <div className={a.bface}>{autoHorse && <HorseView horse={autoHorse} size={38} />}</div>
              <div className={a.autoText}>
                <b>🔁 自動エントリー：ON</b>
                <div className={a.autoSub}>資金がある限り毎回の部に自動参加（{autoHorse?.name ?? '—'}）</div>
              </div>
            </div>
            <div className={a.autoState}>{enteredThisPeriod ? 'この部はエントリー済み' : coins < ARENA_ENTRY_FEE ? 'コイン不足で次はスキップ' : 'まもなくこの部に参加'}</div>
            <button className="btn neutral" onClick={disableAuto}>自動エントリーをやめる</button>
          </div>
        ) : enteredThisPeriod ? (
          <div className={a.entered}>
            <Icon name="medal" size={22} />
            <div>
              <b>この部はエントリー済み：{st.pending?.snapshot.name}</b>
              <div className={a.enteredSub}>結果は締め切り後に見られるよ！</div>
            </div>
          </div>
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
            <button className={`btn ${a.bigGreen}`} onClick={doEnter} disabled={!selected}>この部にエントリーする</button>
            <button className={`btn neutral ${a.autoBtn}`} onClick={enableAuto} disabled={!selected}>🔁 自動エントリーにする（毎回参加）</button>
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
        <div className={a.sectionTitle}>本線の賞金（8頭立て）</div>
        <div className={a.prizes}>
          <div className={`${a.prize} ${a.prizeTop}`}><b>🥇 優勝</b><b className={a.prizeAmt}>＋12,000</b></div>
          <div className={a.prize}><b>🥈 準優勝</b><b className={a.prizeAmt}>＋5,000</b></div>
          <div className={a.prize}><b>🥉 3位</b><b className={a.prizeAmt}>＋1,000</b></div>
          <div className={a.prize}><b>4〜8位（本線出場）</b><b className={a.prizeAmt}>＋500</b></div>
          <div className={a.prize}><b>予選で敗退</b><b className={a.prizeAmt}>±0</b></div>
        </div>
        <div className={a.balanceNote}>参加費1,000／1日2回開催。予選2連戦を勝ち抜いて優勝すると大金！</div>
      </div>

      <button className={styles.exitLink} onClick={onExit}>もどる</button>
    </div>
  );
}
