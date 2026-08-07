import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { useAuth, enterArena, loadArenaPool, loadMyArenaEntry } from '../cloud';
import { COURSES } from '../data/courses';
import { statTotal } from '../logic/stats';
import { styleFor } from '../logic/runStyle';
import { playerSnapshot, snapToEntrant, fieldLooks } from '../logic/arena';
import { teamHorses } from '../logic/farm';
import { arenaTickets } from '../logic/refine';
import { TEAM_SIZE } from '../data/coins';
import {
  ARENA_ENTRY_FEE,
  ARENA_FORM_SCALE,
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
import HorseStatsPopup from '../components/HorseStatsPopup';
import { usePrefersReducedMotion, useScrollTopOnChange } from '../hooks';
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
function RoundBoard({ rr, onPick }: { rr: ArenaRoundResult; onPick: (fieldIdx: number) => void }) {
  const rows = rr.field.map((s, i) => ({ s, i, rank: rr.ranks[i] })).sort((x, y) => x.rank - y.rank);
  const passLabel = rr.round === 2 ? (n: number) => (n === 1 ? '優勝' : '') : (n: number) => (n <= ARENA_ADVANCE ? '通過' : '');
  return (
    <div className={a.board}>
      <div className={a.boardHead}>
        <span className={a.boardName}>{ARENA_ROUND_NAMES[rr.round]}</span>
        <span className={a.boardSub}>{rr.round === 2 ? '着順で賞金' : `上位${ARENA_ADVANCE}通過`}</span>
      </div>
      {rows.map(({ s, i, rank }) => {
        const label = passLabel(rank);
        return (
          <div key={s.horseId} className={`${a.brow} ${s.isPlayer ? a.bmine : ''}`}>
            <span className={a.bmedal}>{rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}</span>
            {/* ウマをタップ → 能力ポップアップ（他のレースモードと同じ） */}
            <button className={a.bface} onClick={() => onPick(i)} aria-label={`${s.isPlayer ? 'あなた' : s.name}の能力を見る`}>
              <HorseView horse={s} size={30} />
            </button>
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
  const allHorses = useStore((s) => s.horses);
  const team = useStore((s) => s.team);
  // 対戦に出せるのもチームの6頭だけ（個体値厳選アップデート）。
  const horses = useMemo(() => teamHorses(allHorses, team, TEAM_SIZE), [allHorses, team]);
  const coins = useStore((s) => s.coins);
  const arena = useStore((s) => s.arena);
  const arenaEnterManual = useStore((s) => s.arenaEnterManual);
  const arenaSetAuto = useStore((s) => s.arenaSetAuto);
  const arenaSync = useStore((s) => s.arenaSync);
  const arenaMarkSeen = useStore((s) => s.arenaMarkSeen);
  const arenaAdoptPending = useStore((s) => s.arenaAdoptPending);
  const arenaSwapPending = useStore((s) => s.arenaSwapPending);
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
  const [changing, setChanging] = useState(false); // エントリー済みのウマを差し替え中
  const [boardStats, setBoardStats] = useState<{ round: number; i: number } | null>(null); // 結果表で能力を見ているウマ
  const [, setTick] = useState(0);

  useScrollTopOnChange(screen);

  const selected: Horse | undefined = horses.find((h) => h.id === horseId) ?? horses[0];
  // 自動エントリー中のウマは所持ウマ全体から解決（チーム編成を変えても表示が消えない）。
  const autoHorse = st.auto ? allHorses.find((h) => h.id === st.auto!.horseId) : undefined;

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

  function mkSnapshot(horse: Horse) {
    return playerSnapshot(horse.id, horse.name, horse.colors, horse.decos, horse.stats, styleFor(horse.id, horse.stats), playerNo);
  }
  function mkEntry(horse: Horse): ArenaEntry {
    return { period: cur, seed: (Math.random() * 2 ** 31) >>> 0, horseId: horse.id, snapshot: mkSnapshot(horse) };
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

  // 締め切り前ならいつでも出走ウマを変えられる。参加費は取らず、抽選のシードも
  // 据え置き（差し替えで組み合わせを引き直せないように）。
  function startChange() {
    const now = st.pending?.horseId ?? st.auto?.horseId;
    if (now && horses.some((h) => h.id === now)) setHorseId(now);
    setNote(null);
    setChanging(true);
  }
  function doChange() {
    if (!selected) return;
    if (st.auto) arenaSetAuto(selected.id); // 自動エントリー中なら次回以降のウマも変える
    const snap = mkSnapshot(selected);
    if (arenaSwapPending(cur, selected.id, snap)) void enterArena(cur, snap);
    setChanging(false);
    setNote(null);
  }

  // エントリー用のウマ選び（新規エントリーと差し替えで共通）
  function pickerUI() {
    return (
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
            脚質：{RUN_STYLE_LABEL[styleFor(selected.id, selected.stats)]} ・ 総合力 <b>{stars(statTotal(selected.stats))}</b>
          </div>
        )}
      </>
    );
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
          formScale={ARENA_FORM_SCALE}
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
          {arenaTickets(view.outcome, view.finalRank) > 0 && (
            <div className={a.resultTicket}>
              <Icon name="ticket" size={17} /> 厳選チケット ＋{arenaTickets(view.outcome, view.finalRank)}枚
            </div>
          )}
        </div>
        {view.rounds.map((rr) => (
          <RoundBoard key={rr.round} rr={rr} onPick={(i) => setBoardStats({ round: rr.round, i })} />
        ))}
        {boardStats && view.rounds[boardStats.round]?.field[boardStats.i] && (
          <HorseStatsPopup
            entrant={snapToEntrant(view.rounds[boardStats.round].field[boardStats.i])}
            look={fieldLooks(view.rounds[boardStats.round].field)[snapToEntrant(view.rounds[boardStats.round].field[boardStats.i]).horseId]}
            gate={boardStats.i + 1}
            onClose={() => setBoardStats(null)}
          />
        )}
        <div className={a.poolNote}>足りない分はCOMが自動で参加しているよ</div>
        <div className={styles.setupActions}>
          <button className="btn neutral" onClick={() => { setView(null); setScreen('home'); }}>閉じる</button>
          <button className="btn" onClick={() => { setRound(0); setScreen('playing'); }}>もう一度見る</button>
        </div>
      </div>
    );
  }

  // ---- home ----
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>対戦</h1>
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
            <button className="btn" onClick={() => navigate('/')}>草むらへ</button>
          </div>
        ) : changing ? (
          <>
            <div className={a.changeLead}>出走するウマを選び直してね（参加費はかかりません）</div>
            {pickerUI()}
            <button className={`btn ${a.bigGreen}`} onClick={doChange} disabled={!selected}>このウマに変更する</button>
            <button className={`btn neutral ${a.autoBtn}`} onClick={() => setChanging(false)}>やめる</button>
          </>
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
            <button className={`btn ${a.changeBtn}`} onClick={startChange}>出走するウマを変える</button>
            <button className="btn neutral" onClick={disableAuto}>自動エントリーをやめる</button>
          </div>
        ) : enteredThisPeriod ? (
          <div className={a.entered}>
            <div className={a.enteredRow}>
              <Icon name="medal" size={22} />
              <div>
                <b>この部はエントリー済み：{st.pending?.snapshot.name}</b>
                <div className={a.enteredSub}>締め切りまではウマを変えられるよ！</div>
              </div>
            </div>
            <button className={`btn ${a.changeBtn}`} onClick={startChange} disabled={!st.pending}>
              出走するウマを変える
            </button>
          </div>
        ) : (
          <>
            {pickerUI()}
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
          <div className={`${a.flowStep} ${a.flowFinal}`}>本戦<br />決勝<br /><span className={a.flowWin}>着順で賞金</span></div>
        </div>
      </div>

      {/* prize table */}
      <div className={a.section}>
        <div className={a.sectionTitle}>本戦の賞金（8頭立て）</div>
        <div className={a.prizes}>
          <div className={`${a.prize} ${a.prizeTop}`}>
            <b>🥇 優勝</b>
            <b className={a.prizeAmt}>＋12,000<span className={a.prizeTicket}><Icon name="ticket" size={13} />3</span></b>
          </div>
          <div className={a.prize}>
            <b>🥈 準優勝</b>
            <b className={a.prizeAmt}>＋5,000<span className={a.prizeTicket}><Icon name="ticket" size={13} />2</span></b>
          </div>
          <div className={a.prize}>
            <b>🥉 3位</b>
            <b className={a.prizeAmt}>＋1,000<span className={a.prizeTicket}><Icon name="ticket" size={13} />1</span></b>
          </div>
          <div className={a.prize}><b>4〜8位（本戦出場）</b><b className={a.prizeAmt}>＋500</b></div>
          <div className={a.prize}><b>予選で敗退</b><b className={a.prizeAmt}>±0</b></div>
        </div>
        <div className={a.balanceNote}>
          参加費1,000／1日2回開催。予選2連戦を勝ち抜いて優勝すると大金！
          <br />入賞でもらえる<b>厳選チケット</b>は、マイウマの「厳選」でつかえます。
        </div>
      </div>

      <button className={styles.exitLink} onClick={onExit}>戻る</button>
    </div>
  );
}
