import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { BOXES, RARITY_FX, BOX_FRAME_NAME, BOX_TITLE_NAME, BOX_TITLE_ID, type BoxKind } from '../data/boxes';
import { titleById } from '../data/titles';
import type { BoxResult } from '../logic/boxes';
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
  const openWeekendBox = useStore((s) => s.openWeekendBox);
  const reduced = usePrefersReducedMotion();

  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<BoxResult | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const fx = result ? RARITY_FX[result.rarity] : RARITY_FX.normal;

  useEffect(() => {
    if (phase !== 'charging' || !result) return;
    const hold = reduced ? 200 : RARITY_FX[result.rarity].holdMs;
    const t = setTimeout(() => setPhase('done'), hold);
    return () => clearTimeout(t);
  }, [phase, result, reduced]);

  function open() {
    if (phase === 'charging') return;
    const r = openWeekendBox(kind);
    if (!r) return;
    setResult(r);
    setPhase('charging');
  }

  return (
    <div className={styles.overlay} onClick={phase === 'charging' ? undefined : onClose}>
      <div
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        style={{ ['--c1' as string]: def.colors[0], ['--c2' as string]: def.colors[1], ['--glow' as string]: fx.glow, ['--ring' as string]: fx.ring }}
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

            <p className={styles.lead}>{phase === 'done' ? 'おめでとう！' : def.lead}</p>

            <div className={styles.actions}>
              <span className={styles.left}>のこり ×{count}</span>
              <button className={styles.open} onClick={phase === 'done' ? () => { setResult(null); setPhase('idle'); } : open} disabled={phase === 'charging' || (phase !== 'done' && count <= 0)}>
                {phase === 'charging' ? '…' : phase === 'done' ? (count > 0 ? 'もう1つ開ける' : '閉じるまで待つ') : '開ける'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
