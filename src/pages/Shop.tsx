import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { HorseLook } from '../types';
import {
  ANIMALS,
  ANIMAL_NAME,
  SHOP_BOXES,
  SHOP_BOX_KINDS,
  SHOP_COMPLETE_FRAME_NAME,
  SHOP_COMPLETE_TITLE_NAME,
  shopFrameName,
  shopTitleName,
  type AnimalId,
  type ShopBoxKind,
} from '../data/shop';
import type { ShopBuyResult } from '../logic/shop';
import AnimalFace from '../components/AnimalFace';
import ShopFrame from '../components/ShopFrame';
import TitleBanner from '../components/TitleBanner';
import CoinIcon from '../components/CoinIcon';
import CloseButton from '../components/CloseButton';
import { titleById } from '../data/titles';
import { shopTitleId, masterTitleId } from '../data/titles';
import styles from './Shop.module.css';

const DEFAULT_LOOK: HorseLook = { name: '', colors: { body: '', mane: '', hoof: '' }, decos: {} };

// ショップ。**売っているのは見た目だけ**。
//
// 強さ・育成・確率にかかわるものは置かない。そうしておけば値段をいくらにしても
// レースのバランス（倍率と勝率）は動かないので、コインの使い道を安心して増やせる。
export default function Shop() {
  const coins = useStore((s) => s.coins);
  const horses = useStore((s) => s.horses);
  const avatarHorseId = useStore((s) => s.avatarHorseId);
  const shopFrames = useStore((s) => s.shopFrames ?? []);
  const shopTitles = useStore((s) => s.shopTitles ?? []);
  const buyShopBox = useStore((s) => s.buyShopBox);

  const [result, setResult] = useState<{ kind: ShopBoxKind; res: ShopBuyResult } | null>(null);

  const avatar = useMemo<HorseLook>(() => {
    const byId = avatarHorseId ? horses.find((h) => h.id === avatarHorseId) : null;
    return byId ?? horses[0] ?? DEFAULT_LOOK;
  }, [avatarHorseId, horses]);

  const ownedOf = (kind: ShopBoxKind) => (kind === 'frame' ? shopFrames : shopTitles);

  function buy(kind: ShopBoxKind) {
    const res = buyShopBox(kind);
    if (res) setResult({ kind, res });
  }

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>ショップ</h2>
      <p className={styles.lead}>コインで見た目を買えるお店。強さには影響しません。</p>

      {SHOP_BOX_KINDS.map((kind) => {
        const def = SHOP_BOXES[kind];
        const owned = new Set(ownedOf(kind));
        const complete = owned.size >= ANIMALS.length;
        const afford = coins >= def.price;
        return (
          <section key={kind} className={styles.card} style={{ ['--c1' as string]: def.colors[0], ['--c2' as string]: def.colors[1] }}>
            <header className={styles.cardHead}>
              <h3 className={styles.cardName}>{def.name}</h3>
              <span className={styles.price}>
                <CoinIcon size={16} /> {def.price.toLocaleString()}
              </span>
            </header>
            <p className={styles.cardLead}>{def.lead}</p>

            {/* 見本。何が手に入るのか、買う前に実物で見せる。 */}
            <div className={styles.sample}>
              {kind === 'frame' ? (
                <ShopFrame animal={ANIMALS[0]} look={avatar} size={78} />
              ) : (
                <div className={styles.sampleTitle}>
                  {/* TitleBanner は position:absolute で親いっぱいに広がるので、
                      必ず高さを決めた入れものに入れる（そうしないとカード全体を覆う）。 */}
                  <div className={styles.bannerBox}>
                    <TitleBanner title={titleById[shopTitleId(ANIMALS[0])]} />
                  </div>
                  <span className={styles.sampleName}>{shopTitleName(ANIMALS[0])}</span>
                </div>
              )}
              <ul className={styles.detail}>
                {def.detail.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>

            {/* 集まり具合。10マスなので、あと何が足りないかがそのまま見える。 */}
            <div className={styles.progress}>
              <span className={styles.progressLabel}>
                あつめた数 {owned.size}/{ANIMALS.length}
              </span>
              <div className={styles.animalRow}>
                {ANIMALS.map((a) => (
                  <span key={a} className={owned.has(a) ? styles.got : styles.notGot} title={ANIMAL_NAME[a]}>
                    <svg viewBox="-16 -16 32 32" width="100%" height="100%">
                      <AnimalFace id={a} uid={`shop-${kind}-${a}`} r={14} />
                    </svg>
                  </span>
                ))}
              </div>
            </div>

            {complete && (
              <p className={styles.completeNote}>
                コンプリート！「{kind === 'frame' ? SHOP_COMPLETE_FRAME_NAME : SHOP_COMPLETE_TITLE_NAME}」を持っています。
                動物はプロフィールからいつでも選び直せます。
              </p>
            )}

            <button className={styles.buy} onClick={() => buy(kind)} disabled={!afford}>
              {afford ? '1回引く' : 'コインが足りません'}
            </button>
            <p className={styles.refundNote}>
              すでに持っているものが出たら {def.refund.toLocaleString()}コイン が戻ります。
            </p>
          </section>
        );
      })}

      {result && <ResultOverlay kind={result.kind} res={result.res} look={avatar} onClose={() => setResult(null)} />}
    </div>
  );
}

/** 引いた結果。新しく手に入れたか、ダブって返却されたかをはっきり出す。 */
function ResultOverlay({
  kind,
  res,
  look,
  onClose,
}: {
  kind: ShopBoxKind;
  res: ShopBuyResult;
  look: HorseLook;
  onClose: () => void;
}) {
  const def = SHOP_BOXES[kind];
  const name = kind === 'frame' ? shopFrameName(res.animal) : shopTitleName(res.animal);
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.resultCard} onClick={(e) => e.stopPropagation()}>
        <CloseButton onClick={onClose} />
        <span className={`${styles.tag} ${res.dupe ? styles.tagDupe : styles.tagNew}`}>
          {res.dupe ? 'ダブり' : 'NEW'}
        </span>
        <div className={styles.resultArt}>
          {kind === 'frame' ? (
            <ShopFrame animal={res.animal} look={look} size={132} />
          ) : (
            <div className={styles.resultBannerBox}>
              <TitleBanner title={titleById[shopTitleId(res.animal)]} />
            </div>
          )}
        </div>
        <p className={styles.resultName}>{name}</p>
        {res.dupe && (
          <p className={styles.resultRefund}>
            <CoinIcon size={15} /> {def.refund.toLocaleString()} が戻りました
          </p>
        )}
        {res.completed && (
          <div className={styles.completeBox}>
            <p className={styles.completeTitle}>10種コンプリート！</p>
            <div className={styles.completeArt}>
              {kind === 'frame' ? (
                <ShopFrame animal={res.animal} master look={look} size={112} />
              ) : (
                <div className={styles.resultBannerBox}>
                  <TitleBanner title={titleById[masterTitleId(res.animal)]} />
                </div>
              )}
            </div>
            <p className={styles.completeName}>
              {kind === 'frame' ? SHOP_COMPLETE_FRAME_NAME : SHOP_COMPLETE_TITLE_NAME} をおくります
            </p>
          </div>
        )}
        <button className={styles.close} onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}

/** テストからも使えるよう、動物の並びを外に出しておく。 */
export type { AnimalId };
