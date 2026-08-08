import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { TITLES, titleCtx, earnedTitles, titleById, collapseMasters, TIER_INFO } from '../data/titles';
import { ANIMALS } from '../data/shop';
import { setRankingTitle } from '../cloud';
import { TOTAL_PARTS } from '../data/parts';
import TitleBanner from './TitleBanner';
import styles from './TitleUnlock.module.css';

// 称号の「初ゲット」のお知らせ。
//
// 称号は条件を満たした瞬間にセーブへ入るのではなく、そのつどセーブ全体から
// 計算している（＝取りこぼしも取り上げもない）。そのぶん「いま新しく取れた」
// タイミングが分からないので、出しおわった称号IDを seenTitles に覚えておき、
// そこに無いものが現れたらお知らせする。
//
// はじめて遊ぶ人には最初から取れている称号（かけだし など）がある。それを全部
// 出すとうるさいので、seenTitles が空のときは「今取れているぶんは既読」にして
// 静かに始める。以後に増えたものだけが出る。
export default function TitleUnlock() {
  const owned = useStore((s) => s.owned);
  const seen = useStore((s) => s.seenTitles);
  const markTitlesSeen = useStore((s) => s.markTitlesSeen);
  const equippedTitle = useStore((s) => s.equippedTitle);
  const equipTitle = useStore((s) => s.equipTitle);
  // 称号の判定材料はセーブのあちこちにあるので、変化を拾うために代表値を購読する。
  const stats = useStore((s) => s.stats);
  const tasks = useStore((s) => s.tasks);
  const badges = useStore((s) => s.badges);
  const trophies = useStore((s) => s.trophies);
  const boxTitles = useStore((s) => s.boxTitles);
  const streakBest = useStore((s) => s.streakBest);
  const shopTitles = useStore((s) => s.shopTitles);
  const shopTitlePick = useStore((s) => s.shopTitlePick ?? ANIMALS[0]);

  const [queue, setQueue] = useState<string[]>([]);

  const earned = useMemo(() => {
    const dexPct = Math.round((Object.keys(owned ?? {}).length / TOTAL_PARTS) * 100);
    return earnedTitles(titleCtx(useStore.getState(), dexPct));
    // 依存に並べた値のどれかが動いたら計算し直す（称号の材料はこの範囲に収まる）。
  }, [owned, stats, tasks, badges, trophies, boxTitles, streakBest, shopTitles]);

  useEffect(() => {
    if (seen === undefined) return; // まだセーブを読み込んでいない
    if (seen.length === 0) {
      // 初回：いま取れているぶんは黙って既読にする。
      markTitlesSeen(earned);
      return;
    }
    const fresh = earned.filter((id) => !seen.includes(id));
    if (fresh.length === 0) return;
    // 既読には全部入れる（コンプリート称号は動物ちがいで10件ある。1件しか
    // 入れないと、動物を選び直すたびに「新しく取れた」とお知らせが出てしまう）。
    markTitlesSeen(fresh);
    // お知らせに出すのは1件だけ。同じ称号のお知らせが10回続くのを防ぐ。
    const show = collapseMasters(fresh, shopTitlePick);
    setQueue((q) => [...q, ...show.filter((id) => !q.includes(id))]);
  }, [earned, seen, markTitlesSeen, shopTitlePick]);

  const id = queue[0];
  const title = id ? titleById[id] : null;
  if (!title) return null;

  const next = () => setQueue((q) => q.slice(1));
  const wear = () => {
    equipTitle(title.id);
    void setRankingTitle(title.id);
    next();
  };

  return (
    <div className={styles.overlay} onClick={next}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.burst} aria-hidden />
        <div className={styles.kicker}>称号を手に入れた！</div>
        <div className={styles.bannerWrap}>
          <TitleBanner title={title} />
          <span className={styles.bannerText}>{title.name}</span>
        </div>
        <div className={styles.stars} aria-hidden>{'★'.repeat(title.tier)}</div>
        <div className={styles.desc}>{title.desc}</div>
        <div className={styles.tier}>{TIER_INFO[title.tier].label}（{TIER_INFO[title.tier].share}）</div>
        <div className={styles.actions}>
          {equippedTitle === title.id ? (
            <button className="btn neutral" onClick={next}>つけている</button>
          ) : (
            <button className="btn" onClick={wear}>つける</button>
          )}
          <button className="btn neutral" onClick={next}>
            {queue.length > 1 ? `つぎへ（あと${queue.length - 1}）` : '閉じる'}
          </button>
        </div>
      </div>
    </div>
  );
}

// TITLES を参照しているのを型検査に見せるための再輸出（データの取り違え防止）。
export const ALL_TITLE_COUNT = TITLES.length;
