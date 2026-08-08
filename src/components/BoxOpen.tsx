import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { BOXES, RARITY_FX, FLASH_STEPS, ALL_FLASH_STEPS as ALL_STEPS, FLASH_MS, BOX_FRAME_NAME, BOX_TITLE_NAME, BOX_TITLE_ID, type BoxKind } from '../data/boxes';
import { titleById } from '../data/titles';
import { tallyBoxResults, type BoxResult, type BoxTally } from '../logic/boxes';
import CoinIcon from './CoinIcon';
import Icon from './Icon';
import CloseButton from './CloseButton';
import BoxFrame from './BoxFrame';
import BoxDropTable from './BoxDropTable';
import TitleBanner from './TitleBanner';
import { usePrefersReducedMotion } from '../hooks';
import type { HorseLook } from '../types';
import styles from './BoxOpen.module.css';

// ボックスを開ける画面。
//
// 演出は「溜め → 開封」の2段。溜めの長さと色はレアリティで変える
//（ノーマル0.7秒 → レジェンド3.2秒）。何が出るかは開ける前に決まっているので、
// 演出の長さでレアさが伝わる＝長いほどワクワクする、という作り。
// 動きを減らす設定のときは溜めを飛ばして結果だけ出す。

type Phase = 'idle' | 'charging' | 'done';

/** 「まとめて開ける」の1回ぶん。これ以上はレア演出のありがたみが薄れる。 */
const BULK = 10;

export default function BoxOpen({
  kind,
  count,
  look,
  onClose,
}: {
  kind: BoxKind;
  count: number;
  look: HorseLook;
  onClose: () => void;
}) {
  const def = BOXES[kind];
  const openMany = useStore((s) => s.openWeekendBoxMany);
  const reduced = usePrefersReducedMotion();

  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<BoxResult | null>(null);
  // まとめ開けの結果。null のときは1個ずつ開けている。
  const [tally, setTally] = useState<BoxTally | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const fx = result ? RARITY_FX[result.rarity] : RARITY_FX.normal;

  // 光る段を1つずつ上げていく。step は「いま何段目を光らせているか」。
  // 灰→青→紫→金 と続くかどうかが、そのまま当たりの大きさになる。
  const steps = result ? FLASH_STEPS[result.rarity] : [];
  const [step, setStep] = useState(0);
  const cur = steps[step] ?? 'normal';

  useEffect(() => {
    if (phase !== 'charging' || !result) return;
    if (reduced) {
      // 動きを減らす設定：段を飛ばして結果だけ出す。
      const t = setTimeout(() => setPhase('done'), 200);
      return () => clearTimeout(t);
    }
    if (step >= steps.length) {
      const t = setTimeout(() => setPhase('done'), 260);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((n) => n + 1), FLASH_MS[steps[step]]);
    return () => clearTimeout(t);
  }, [phase, result, reduced, step, steps]);

  // 1個でも10個でも入口は同じ。溜め演出は「いちばんレアだったもの」で1回だけ流す。
  function open(n: number) {
    if (phase === 'charging') return;
    const got = openMany(kind, n);
    if (got.length === 0) return;
    const t = tallyBoxResults(got);
    setTally(n > 1 ? t : null);
    setResult(t.best);
    setStep(0);
    setPhase('charging');
  }

  function reset() {
    setResult(null);
    setTally(null);
    setStep(0);
    setPhase('idle');
  }

  return (
    <div className={styles.overlay} onClick={phase === 'charging' ? undefined : onClose}>
      <div
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        style={{
          ['--c1' as string]: def.colors[0],
          ['--c2' as string]: def.colors[1],
          // 溜めの色は「いま光っている段」のもの。灰→青→紫→金と変わっていく。
          ['--glow' as string]: (phase === 'charging' ? RARITY_FX[cur] : fx).glow,
          ['--ring' as string]: (phase === 'charging' ? RARITY_FX[cur] : fx).ring,
        }}
      >
        {phase !== 'charging' && <CloseButton onClick={onClose} />}

        <div className={styles.head}>
          <span className={styles.headName}>{def.name}</span>
          <button className={styles.info} onClick={() => setShowInfo((v) => !v)} aria-label="中身の出る割合を見る">i</button>
        </div>

        {showInfo ? (
          <BoxDropTable kind={kind} />
        ) : (
          <>
            <div className={`${styles.stage} ${phase === 'charging' ? styles.charging : ''} ${phase === 'done' ? styles.opened : ''}`}>
              <span className={styles.glow} aria-hidden />
              {/* 段が上がるたびに、外へ広がる輪と光の粒を1回ずつ出す。
                  key に step を入れているので、段が変わるたびにアニメが最初から流れる。 */}
              {phase === 'charging' && !reduced && (
                <span key={step} className={styles.burstWrap} aria-hidden>
                  <span className={styles.shock} />
                  <span className={`${styles.shock} ${styles.shock2}`} />
                  {[...Array(10)].map((_, i) => (
                    <span
                      key={i}
                      className={styles.spark}
                      style={{ ['--a' as string]: `${i * 36}deg`, ['--d' as string]: `${i * 18}ms` }}
                    />
                  ))}
                </span>
              )}
              {/* いま何段目か。光った数がそのままレアさになる。
                  ■ 点の数は**必ず全段ぶん**出す（結果によって変えない）
                  以前は「その結果の段数ぶん」だけ点を並べていたので、光り出す前に
                  点を数えるだけで当たりの大きさが分かってしまった（ノーマルなら
                  そもそも点が出ない、エピックなら4つ並ぶ）。**先が見えないこと**が
                  この演出の値打ちなので、枠は全部出しておいて、光った数だけで示す。 */}
              {phase === 'charging' && (
                <span className={styles.steps} aria-hidden>
                  {ALL_STEPS.map((r, i) => {
                    const lit = i <= step && i < steps.length;
                    return (
                      <span
                        key={r}
                        className={`${styles.stepDot} ${lit ? styles.stepOn : ''}`}
                        // 消えている点は色も伏せる（色で先が読めないように）。
                        style={{ ['--c' as string]: lit ? RARITY_FX[r].ring : 'transparent' }}
                      />
                    );
                  })}
                </span>
              )}
              {phase === 'done' && result ? (
                <div className={styles.prize}>
                  {result.reward.type === 'frame' ? (
                    <>
                      {/* フレームは銘板が枠の外まで出るので、名前と重ならないよう下に余白を取る */}
                      <div className={styles.frameArt}><BoxFrame box={kind} look={look} size={96} /></div>
                      <div className={styles.prizeName}>{BOX_FRAME_NAME[kind]}</div>
                    </>
                  ) : result.reward.type === 'title' ? (
                    <>
                      <div className={styles.titleArt}>
                        <TitleBanner title={titleById[BOX_TITLE_ID[kind]]} />
                        <span className={styles.titleText}>{BOX_TITLE_NAME[kind]}</span>
                      </div>
                      <div className={styles.prizeName}>称号「{BOX_TITLE_NAME[kind]}」</div>
                    </>
                  ) : (
                    <>
                      <div className={styles.prizeIcon} aria-hidden>
                        {result.reward.type === 'coins' ? <CoinIcon size={54} />
                          : result.reward.type === 'ticket' ? <Icon name="ticket" size={54} />
                          : result.reward.type === 'dye' ? <Icon name="palette" size={54} />
                          : <Icon name="gift" size={54} />}
                      </div>
                      <div className={styles.prizeName}>{result.label}</div>
                    </>
                  )}
                  <span className={`${styles.rarity} ${styles[`r_${result.rarity}`]}`}>{fx.label}</span>
                </div>
              ) : (
                <div className={styles.boxArt} aria-hidden>
                  <Icon name={kind === 'gold' ? 'crown' : 'gift'} size={70} />
                </div>
              )}
            </div>

            {/* まとめて開けたときは、演出のあとに中身を一覧で見せる */}
            {phase === 'done' && tally && <BulkSummary tally={tally} />}

            {/* まとめ開けは一覧そのものが結果なので、ひとことは出さない（下に浮いて見える） */}
            {!(phase === 'done' && tally) && (
              <p className={styles.lead}>{phase === 'done' ? 'おめでとう！' : def.lead}</p>
            )}

            <div className={styles.actions}>
              <span className={styles.left}>残り ×{count}</span>
              {phase === 'done' ? (
                <button className={styles.open} onClick={reset} disabled={count <= 0}>
                  {count > 0 ? '続けて開ける' : '開ける箱がありません'}
                </button>
              ) : (
                <>
                  <button className={styles.open} onClick={() => open(1)} disabled={phase === 'charging' || count <= 0}>
                    {phase === 'charging' ? '…' : '開ける'}
                  </button>
                  {count >= 2 && (
                    <button className={styles.openBulk} onClick={() => open(BULK)} disabled={phase === 'charging'}>
                      {Math.min(BULK, count)}個まとめて
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// まとめて開けたときの中身の一覧。出た順のまま、同じものは ×N でまとめる。
function BulkSummary({ tally }: { tally: BoxTally }) {
  const totals: string[] = [];
  if (tally.coins > 0) totals.push(`コイン ${tally.coins.toLocaleString()}`);
  if (tally.items > 0) totals.push(`育成アイテム ${tally.items}`);
  if (tally.tickets > 0) totals.push(`厳選チケット ${tally.tickets}`);
  if (tally.dyes > 0) totals.push(`染料 ${tally.dyes}`);

  return (
    <div className={styles.bulk}>
      <div className={styles.bulkLead}>開けた中身</div>
      <div className={styles.bulkList}>
        {tally.rows.map((r) => (
          <div key={r.label} className={`${styles.bulkRow} ${styles[`r_${r.rarity}`]}`}>
            <span className={styles.bulkName}>{r.label}</span>
            <span className={styles.bulkCount}>×{r.count}</span>
          </div>
        ))}
      </div>
      {totals.length > 0 && <div className={styles.bulkTotal}>合計：{totals.join('／')}</div>}
    </div>
  );
}
