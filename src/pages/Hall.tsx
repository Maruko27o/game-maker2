import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadLeaderboard, loadHallPeriods, type ScoreRow, type RankBy } from '../cloud';
import { monthKey, monthLabel } from '../logic/period';
import type { HorseLook } from '../types';
import AvatarFrame, { type FrameRank, type FrameMetric } from '../components/AvatarFrame';
import CoinIcon from '../components/CoinIcon';
import TrophyMark from '../components/TrophyMark';
import styles from './Hall.module.css';

const DEFAULT_LOOK: HorseLook = { name: '', colors: { body: '', mane: '', hoof: '' }, decos: {} };
const lookOf = (r: ScoreRow): HorseLook => (r.avatar ? { name: '', colors: r.avatar.colors, decos: r.avatar.decos } : DEFAULT_LOOK);

type MonthBoard = { period: string; preview: boolean; odds: ScoreRow[]; payout: ScoreRow[] };

// A metric's podium: 1位 centre (raised), 2位 left, 3位 right (empty slots stay dim).
function Podium({ rows, metric, period }: { rows: ScoreRow[]; metric: FrameMetric; period: string }) {
  const slots: (1 | 2 | 3)[] = [2, 1, 3]; // display order left→right
  const value = (r: ScoreRow) =>
    metric === 'payout' ? (
      <span className={styles.recPayout}><CoinIcon size={13} /> {r.bestPayout.toLocaleString()}</span>
    ) : (
      <span className={styles.recOdds}>{r.bestOdds.toFixed(1)}倍</span>
    );
  return (
    <div className={styles.podium}>
      {slots.map((rank) => {
        const r = rows[rank - 1];
        return (
          <div key={rank} className={`${styles.slot} ${rank === 1 ? styles.slotFirst : ''}`}>
            {r ? (
              <>
                <AvatarFrame rank={rank as FrameRank} metric={metric} period={period} look={lookOf(r)} size={rank === 1 ? 104 : 84} />
                <div className={styles.winName}>{r.username}</div>
                <div className={styles.winRec}>{value(r)}</div>
              </>
            ) : (
              <div className={styles.empty} data-rank={rank}>
                <span className={styles.emptyRing} />
                <span className={styles.emptyRank}>{rank}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Hall() {
  const navigate = useNavigate();
  const cur = monthKey();
  const [boards, setBoards] = useState<MonthBoard[] | null>(null);

  useEffect(() => {
    let live = true;
    // フェッチが詰まっても「読み込み中」で固まらないよう、一定時間で空表示にフォールバック。
    const timeout = setTimeout(() => { if (live) setBoards((b) => b ?? []); }, 8000);
    (async () => {
      const past = await loadHallPeriods(cur, 12);
      const periods: { period: string; preview: boolean }[] = [
        { period: cur, preview: true },
        ...past.map((p) => ({ period: p, preview: false })),
      ];
      const built = await Promise.all(
        periods.map(async ({ period, preview }) => {
          const [odds, payout] = await Promise.all([
            loadLeaderboard(3, 'odds' as RankBy, period),
            loadLeaderboard(3, 'payout' as RankBy, period),
          ]);
          return {
            period,
            preview,
            odds: odds.filter((r) => r.bestOdds > 0),
            payout: payout.filter((r) => r.bestPayout > 0),
          } as MonthBoard;
        }),
      );
      if (live) setBoards(built);
    })();
    return () => {
      live = false;
      clearTimeout(timeout);
    };
  }, [cur]);

  const enshrined = useMemo(() => (boards ?? []).filter((b) => !b.preview), [boards]);
  const preview = useMemo(() => (boards ?? []).find((b) => b.preview) ?? null, [boards]);

  return (
    <div className={styles.hall}>
      <div className={styles.bg} aria-hidden />
      <header className={styles.head}>
        <button className={styles.back} onClick={() => navigate('/ranking')} aria-label="ランキングへ戻る">‹ ランキング</button>
        <h1 className={styles.title}>殿堂</h1>
        <p className={styles.sub}>歴代の頂点に立ったウマたち</p>
      </header>

      {boards === null ? (
        <div className={styles.note}>読み込み中…</div>
      ) : (
        <>
          {/* 今月のノミネート（暫定・月末に殿堂入り） */}
          {preview && (
            <section className={styles.monthCard}>
              <div className={styles.monthHead}>
                <span className={styles.monthName}>{monthLabel(preview.period)}</span>
                <span className={styles.nomTag}>ノミネート中・月末に殿堂入り</span>
              </div>
              <div className={styles.metricLabel}><span className={styles.dotOdds} /> 最大オッズ</div>
              <Podium rows={preview.odds} metric="odds" period={preview.period} />
              <div className={styles.metricLabel}><span className={styles.dotPayout} /> 最大獲得賞金</div>
              <Podium rows={preview.payout} metric="payout" period={preview.period} />
            </section>
          )}

          {/* 殿堂入り（過去月） */}
          {enshrined.length === 0 ? (
            <div className={styles.emptyHall}>
              <div className={styles.crest}><TrophyMark size={52} /></div>
              <p>まだ殿堂入りはいません。</p>
              <p className={styles.emptyHallSub}>今月の上位3名が、来月ここに永久に飾られます。</p>
            </div>
          ) : (
            enshrined.map((b) => (
              <section key={b.period} className={`${styles.monthCard} ${styles.enshrined}`}>
                <div className={styles.monthHead}>
                  <span className={styles.monthName}>{monthLabel(b.period)}</span>
                  <span className={styles.enshrinedTag}>殿堂入り</span>
                </div>
                <div className={styles.metricLabel}><span className={styles.dotOdds} /> 最大オッズ</div>
                <Podium rows={b.odds} metric="odds" period={b.period} />
                <div className={styles.metricLabel}><span className={styles.dotPayout} /> 最大獲得賞金</div>
                <Podium rows={b.payout} metric="payout" period={b.period} />
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
