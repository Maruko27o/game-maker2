import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { TITLES, titleCtx, type TitleDef } from '../data/titles';
import { TOTAL_PARTS } from '../data/parts';
import { frameCatalog, frameProgress, rankingFrames, type FrameSlot } from '../logic/frameCatalog';
import type { HorseLook } from '../types';
import { monthLabel } from '../logic/period';
import EquippedFrame from './EquippedFrame';
import TitleBanner from './TitleBanner';
import CloseButton from './CloseButton';
import styles from './CollectionModal.module.css';

// フレームと称号のコレクション画面。
//
// ねらいは「あと何をすれば埋まるか」が見えること。だから未取得も必ず並べて、
// 獲得条件を添える。装備はここではできない（アイコン設定と役割が二重になるため）
// ── ここは眺めて目標を決める場所、あちらは着替える場所、と分ける。
export default function CollectionModal({ look, onClose }: { look: HorseLook; onClose: () => void }) {
  const boxFrames = useStore((s) => s.boxFrames ?? []);
  const aptFrames = useStore((s) => s.aptFrames ?? []);
  const streakClaimed = useStore((s) => s.streakClaimed ?? 0);
  const owned = useStore((s) => s.owned);
  const mailbox = useStore((s) => s.mailbox ?? []);

  const [tab, setTab] = useState<'frame' | 'title'>('frame');

  const frames = useMemo(
    () => frameCatalog({ boxFrames, streakClaimed, aptFrames }),
    [boxFrames, streakClaimed, aptFrames],
  );
  const fp = frameProgress(frames);
  // 殿堂フレームは毎月増えるので「あと何個」の数には入れない。持っているぶんだけ
  // 下に別枠で飾る。
  const ranks = useMemo(() => rankingFrames(mailbox), [mailbox]);

  const ctx = useMemo(
    () => titleCtx(useStore.getState(), Math.round((Object.keys(owned ?? {}).length / TOTAL_PARTS) * 100)),
    [owned],
  );
  const titles = useMemo(() => TITLES.map((t) => ({ t, got: t.check(ctx) })), [ctx]);
  const titleHave = titles.filter((x) => x.got).length;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <CloseButton onClick={onClose} />
        <div className={styles.head}>
          <h2 className={styles.h2}>コレクション</h2>
          <div className={styles.counts}>
            フレーム {fp.have}/{fp.total} ・ 称号 {titleHave}/{titles.length}
          </div>
        </div>

        <div className={styles.tabs} role="tablist">
          <button role="tab" aria-selected={tab === 'frame'} className={`${styles.tab} ${tab === 'frame' ? styles.tabOn : ''}`} onClick={() => setTab('frame')}>
            フレーム <small>{fp.have}/{fp.total}</small>
          </button>
          <button role="tab" aria-selected={tab === 'title'} className={`${styles.tab} ${tab === 'title' ? styles.tabOn : ''}`} onClick={() => setTab('title')}>
            称号 <small>{titleHave}/{titles.length}</small>
          </button>
        </div>

        {tab === 'frame' ? (
          <>
            <FrameGrid rows={frames} look={look} />
            {ranks.length > 0 && (
              <>
                <div className={styles.section}>殿堂（月間トップ3）<small>持っているぶんだけ</small></div>
                <div className={styles.grid}>
                  {ranks.map((f) => (
                    <div key={`${f.period}-${f.rank}-${f.metric}`} className={styles.cell}>
                      <EquippedFrame frame={f} look={look} size={56} />
                      <span className={styles.hint}>{monthLabel(f.period)} {f.metric === 'payout' ? '最大獲得賞金' : '最大オッズ'} {f.rank}位</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <TitleList rows={titles} />
        )}

        <p className={styles.foot}>
          ぼやけているものはまだ持っていません。装備は「アイコン設定」と「名前の上のバッジ」から。
        </p>
      </div>
    </div>
  );
}

function FrameGrid({ rows, look }: { rows: FrameSlot[]; look: HorseLook }) {
  return (
    <div className={styles.grid}>
      {rows.map(({ key, frame, owned: got, hint }) => (
        <div key={key} className={`${styles.cell} ${got ? '' : styles.locked}`}>
          <span className={got ? undefined : styles.blur}>
            <EquippedFrame frame={frame} look={look} size={56} />
          </span>
          <span className={styles.hint}>{hint}</span>
        </div>
      ))}
    </div>
  );
}

function TitleList({ rows }: { rows: { t: TitleDef; got: boolean }[] }) {
  return (
    <ul className={styles.titles}>
      {rows.map(({ t, got }) => (
        <li key={t.id} className={`${styles.titleRow} ${got ? '' : styles.locked}`}>
          <span className={styles.titleArt}>
            <span className={got ? undefined : styles.blur}><TitleBanner title={t} /></span>
            <span className={styles.titleName}>{got ? t.name : '？？？'}</span>
          </span>
          <span className={styles.titleBody}>
            <span className={styles.titleDesc}>{t.desc}</span>
            <span className={styles.titleTier} aria-hidden>{'★'.repeat(t.tier)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
