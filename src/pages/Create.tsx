import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../store';
import Icon from '../components/Icon';
import CoinIcon from '../components/CoinIcon';
import { CREATE_COST } from '../data/coins';
import { colorsBySlot, decosBySlot, COLOR_SLOTS, DECO_SLOTS } from '../data/parts';
import { predictStyle } from '../logic/runStyle';
import type { ColorSlot, DecoSlot, HorseLook, Stats, StatKey } from '../types';
import {
  STAT_KEYS,
  STAT_LABEL,
  STAT_ALLOC_TOTAL,
  STAT_ALLOC_MIN,
  STAT_ALLOC_MAX,
  RUN_STYLE_LABEL,
} from '../types';
import HorseView from '../components/HorseView';
import styles from './Create.module.css';

const COLOR_LABEL: Record<ColorSlot, string> = { body: '体', mane: 'たてがみ', hoof: 'ひづめ' };
const DECO_LABEL: Record<DecoSlot, string> = { head: '頭', face: '顔', back: '背中', tail: 'しっぽ' };

// Where each slot's decorations live on the horse — so the picker can show the part
// itself (no horse), cropped to its region, instead of just a text label.
const DECO_VIEWBOX: Record<DecoSlot, string> = {
  head: '346 -6 134 120',
  face: '356 96 148 90',
  back: '80 108 250 244',
  tail: '32 248 120 162',
};
const GLYPH_VARS = { ['--body']: '#e8e2d6', ['--mane']: '#8a6b4a', ['--hoof']: '#3a2c1c' } as CSSProperties;

// A small standalone illustration of a decoration (改修：部品を絵で選ぶ). Renders the
// deco's own SVG cropped to its slot region; --body/--mane let body-matched parts
// (ねこみみ等) show in a neutral colour.
function DecoGlyph({ slot, svg, className }: { slot: DecoSlot; svg: string; className?: string }) {
  return (
    <svg className={className ?? styles.decoGlyph} viewBox={DECO_VIEWBOX[slot]} style={GLYPH_VARS} aria-hidden>
      <g dangerouslySetInnerHTML={{ __html: svg }} />
    </svg>
  );
}

// Starting spreads offered so a new player isn't stuck on a blank allocation
// (RACE_V3 §3.3). Each sums to exactly STAT_ALLOC_TOTAL (40).
const PRESETS: { key: string; label: string; stats: Stats }[] = [
  { key: 'balance', label: 'バランス', stats: { spd: 7, sta: 7, pwr: 7, jmp: 7, gut: 6, wit: 6 } },
  { key: 'speed', label: 'スピード', stats: { spd: 10, sta: 6, pwr: 8, jmp: 4, gut: 5, wit: 7 } },
  { key: 'nebari', label: 'ねばり', stats: { spd: 6, sta: 10, pwr: 7, jmp: 3, gut: 9, wit: 5 } },
];

function firstOwnedColor(owned: Record<string, number>, slot: ColorSlot): string {
  const found = colorsBySlot[slot].find((c) => (owned[c.id] ?? 0) > 0);
  return found?.id ?? '';
}

function statSum(s: Stats): number {
  return STAT_KEYS.reduce((n, k) => n + s[k], 0);
}

export default function Create() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const rebalanceId = params.get('rebalance');

  const owned = useStore((s) => s.owned);
  const horses = useStore((s) => s.horses);
  const addHorse = useStore((s) => s.addHorse);
  const updateHorse = useStore((s) => s.updateHorse);
  const rebalanceHorse = useStore((s) => s.rebalanceHorse);
  const freeRebalance = useStore((s) => s.freeRebalance);
  const maxHorses = useStore((s) => s.maxHorses);
  const coins = useStore((s) => s.coins);
  const spendCoins = useStore((s) => s.spendCoins);

  const editing = editId ? horses.find((h) => h.id === editId) ?? null : null;
  const rebalancing = rebalanceId ? horses.find((h) => h.id === rebalanceId) ?? null : null;
  const isNew = !editing && !rebalancing; // brand-new horse
  const atCap = isNew && horses.length >= maxHorses;
  const createCost = horses.length === 0 ? 0 : CREATE_COST; // 一体目(0→1)は無料
  const poor = isNew && createCost > 0 && coins < createCost; // can't afford to create

  // Whether the player owns at least one color in every color slot.
  const canBuild = COLOR_SLOTS.every((s) => colorsBySlot[s].some((c) => (owned[c.id] ?? 0) > 0));

  const [colors, setColors] = useState<Record<ColorSlot, string>>(() =>
    editing
      ? { ...editing.colors }
      : {
          body: firstOwnedColor(owned, 'body'),
          mane: firstOwnedColor(owned, 'mane'),
          hoof: firstOwnedColor(owned, 'hoof'),
        },
  );
  const [decos, setDecos] = useState<Partial<Record<DecoSlot, string>>>(() =>
    editing ? { ...editing.decos } : {},
  );
  const [name, setName] = useState(editing?.name ?? '');

  // Stat allocation state. Seeded from the horse when rebalancing, else the
  // balanced preset. Not shown when only editing a horse's look.
  const [stats, setStats] = useState<Stats>(() =>
    rebalancing ? { ...rebalancing.stats } : { ...PRESETS[0].stats },
  );
  const [confirming, setConfirming] = useState(false);

  // Each colour/deco group collapses behind a ▼ header so you don't scroll the
  // whole picker every time (改修：色/パーツごとに▼でまとめる). Closed by default;
  // the header shows the current selection so you can tell at a glance.
  const [openSlots, setOpenSlots] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpenSlots((p) => ({ ...p, [k]: !p[k] }));

  const allocMode = !editing; // creating a new horse, or rebalancing an existing one
  const remaining = STAT_ALLOC_TOTAL - statSum(stats);
  const predicted = predictStyle(stats);

  const preview: HorseLook = useMemo(
    () => (rebalancing ? rebalancing : { name, colors, decos }),
    [rebalancing, name, colors, decos],
  );

  const lookReady = canBuild && !atCap && COLOR_SLOTS.every((s) => colors[s]);
  const canSave = rebalancing
    ? freeRebalance && remaining === 0
    : allocMode
      ? lookReady && remaining === 0 && !poor
      : lookReady;

  function bump(k: StatKey, dir: 1 | -1) {
    setStats((p) => {
      const v = p[k] + dir;
      if (v < STAT_ALLOC_MIN || v > STAT_ALLOC_MAX) return p;
      if (dir === 1 && remaining <= 0) return p; // no points left to spend
      return { ...p, [k]: v };
    });
  }

  function commitSave() {
    const finalName = name.trim() || '名前のないウマ';
    if (rebalancing) {
      rebalanceHorse(rebalancing.id, stats);
    } else if (editing) {
      updateHorse(editing.id, { name: finalName, colors, decos });
    } else {
      if (createCost > 0 && !spendCoins(createCost)) return; // 有料作成（一体目のみ無料）
      addHorse({ name: finalName, colors, decos }, stats, createCost === 0); // free horse → 引退ベース無し
    }
    navigate('/stable');
  }

  function onSaveClick() {
    if (!canSave) return;
    if (allocMode) setConfirming(true); // stats are locked after save — confirm first
    else commitSave();
  }

  const title = rebalancing ? 'ステータス振り直し' : editing ? 'ウマを直す' : 'ウマを作る';

  return (
    <div className={styles.page}>
      {/* Title + horse stay pinned at the top as an opaque band, so the colour /
          decoration pickers scroll *under* it and the whole horse is always
          visible while editing (改修③). */}
      <div className={styles.stickyHead}>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.previewBox}>
          <HorseView horse={preview} size={190} shadow />
        </div>
      </div>

      {rebalancing && (
        <p className={styles.warn}>
          ステータスの仕組みが変わりました。この1回だけ、無料で振り直せます（保存後は変更できません）。
        </p>
      )}
      {!rebalancing && !canBuild && (
        <p className={styles.warn}>
          体・たてがみ・ひづめの色を、それぞれ1つ以上集めると作れます。草むらでパーツを集めよう！
        </p>
      )}
      {atCap && (
        <p className={styles.warn}>マイウマが上限（{maxHorses}体）です。マイウマで1体消すと作れます。</p>
      )}

      {/* Look (colors / decorations / name) — hidden while rebalancing stats */}
      {!rebalancing && (
        <>
          {COLOR_SLOTS.map((slot) => {
            const isOpen = openSlots[slot] ?? false;
            const sel = colorsBySlot[slot].find((c) => c.id === colors[slot]);
            return (
              <section key={slot} className={styles.section}>
                <button
                  type="button"
                  className={styles.sectionHead}
                  onClick={() => toggle(slot)}
                  aria-expanded={isOpen}
                >
                  <h2 className={styles.sectionTitle}>{COLOR_LABEL[slot]}</h2>
                  <span className={styles.sectionPreview}>
                    {sel && (
                      <span
                        className={styles.previewSwatch}
                        style={{ background: sel.swatch ?? sel.value }}
                      />
                    )}
                    <span className={`${styles.caret} ${isOpen ? styles.caretOpen : ''}`}>▼</span>
                  </span>
                </button>
                {isOpen && (
                  <div className={styles.sectionBody}>
                    <div className={styles.swatchRow}>
                      {colorsBySlot[slot].map((c) => {
                        const has = (owned[c.id] ?? 0) > 0;
                        const selected = colors[slot] === c.id;
                        return (
                          <button
                            key={c.id}
                            className={`${styles.swatch} ${selected ? styles.selected : ''} ${
                              has ? '' : styles.lockedSwatch
                            }`}
                            style={{ background: c.swatch ?? c.value }}
                            disabled={!has}
                            onClick={() => setColors((p) => ({ ...p, [slot]: c.id }))}
                            aria-label={c.name}
                            title={has ? c.name : '未所持'}
                          >
                            {!has && <span className={styles.lock}><Icon name="lock" size={13} /></span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            );
          })}

          {DECO_SLOTS.map((slot) => {
            const isOpen = openSlots[slot] ?? false;
            const selDeco = decos[slot] ? decosBySlot[slot].find((d) => d.id === decos[slot]) : undefined;
            const selOwned = selDeco && (owned[selDeco.id] ?? 0) > 0;
            return (
              <section key={slot} className={styles.section}>
                <button
                  type="button"
                  className={styles.sectionHead}
                  onClick={() => toggle(slot)}
                  aria-expanded={isOpen}
                >
                  <h2 className={styles.sectionTitle}>{DECO_LABEL[slot]}</h2>
                  <span className={styles.sectionPreview}>
                    {selDeco && selOwned ? (
                      <DecoGlyph slot={slot} svg={selDeco.svg} className={styles.previewGlyph} />
                    ) : (
                      <span>なし</span>
                    )}
                    <span className={`${styles.caret} ${isOpen ? styles.caretOpen : ''}`}>▼</span>
                  </span>
                </button>
                {isOpen && (
                  <div className={styles.sectionBody}>
                    <div className={styles.decoRow}>
                      <button
                        className={`${styles.decoChip} ${styles.decoNone} ${!decos[slot] ? styles.selected : ''}`}
                        onClick={() => setDecos((p) => ({ ...p, [slot]: undefined }))}
                        title="なし"
                      >
                        なし
                      </button>
                      {decosBySlot[slot].map((d) => {
                        const has = (owned[d.id] ?? 0) > 0;
                        const selected = decos[slot] === d.id;
                        // Unowned decorations are a secret (改修：未所持はシークレット): hide the
                        // art behind a "？" tile so owned (illustrated) vs not is obvious.
                        return (
                          <button
                            key={d.id}
                            className={`${styles.decoChip} ${selected ? styles.selected : ''} ${has ? '' : styles.secretChip}`}
                            disabled={!has}
                            onClick={() => setDecos((p) => ({ ...p, [slot]: d.id }))}
                            title={has ? d.name : 'シークレット（未所持）'}
                            aria-label={has ? d.name : 'シークレット'}
                          >
                            {has ? <DecoGlyph slot={slot} svg={d.svg} /> : <span className={styles.secretMark}>？</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            );
          })}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>名前</h2>
            <input
              className={styles.nameInput}
              value={name}
              maxLength={12}
              placeholder="名前をつけよう"
              onChange={(e) => setName(e.target.value)}
            />
          </section>
        </>
      )}

      {/* Stat allocation (creating or rebalancing) */}
      {allocMode && (
        <section className={styles.section}>
          <div className={styles.allocHead}>
            <h2 className={styles.sectionTitle}>ステータス</h2>
            <span className={`${styles.allocRemain} ${remaining === 0 ? styles.allocDone : ''}`}>
              残り {remaining}
            </span>
          </div>

          <div className={styles.presetRow}>
            {PRESETS.map((p) => (
              <button key={p.key} className={styles.presetBtn} onClick={() => setStats({ ...p.stats })}>
                {p.label}
              </button>
            ))}
          </div>

          {STAT_KEYS.map((k) => (
            <div key={k} className={styles.statRow}>
              <span className={styles.statName}>{STAT_LABEL[k]}</span>
              <button
                className={styles.stepBtn}
                onClick={() => bump(k, -1)}
                disabled={stats[k] <= STAT_ALLOC_MIN}
                aria-label={`${STAT_LABEL[k]}を下げる`}
              >
                −
              </button>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${(stats[k] / STAT_ALLOC_MAX) * 100}%` }} />
              </div>
              <span className={styles.statVal}>{stats[k]}</span>
              <button
                className={styles.stepBtn}
                onClick={() => bump(k, 1)}
                disabled={stats[k] >= STAT_ALLOC_MAX || remaining <= 0}
                aria-label={`${STAT_LABEL[k]}を上げる`}
              >
                ＋
              </button>
            </div>
          ))}

          <p className={styles.stylePredict}>
            この配分だと <b>{RUN_STYLE_LABEL[predicted]}</b> タイプになりそう
          </p>
        </section>
      )}

      <div className={styles.actions}>
        <button className="btn neutral" onClick={() => navigate(-1)}>
          戻る
        </button>
        <button className="btn" onClick={onSaveClick} disabled={!canSave}>
          {rebalancing
            ? '振り直す'
            : editing
              ? '保存する'
              : remaining !== 0
                ? `残り ${remaining} ポイント`
                : poor
                  ? 'コインが足りません'
                  : createCost === 0
                    ? 'このウマにする（無料）'
                    : `このウマにする（${CREATE_COST}）`}
        </button>
      </div>

      {confirming && (
        <div className={styles.confirmOverlay} onClick={() => setConfirming(false)}>
          <div className={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
            <p className={styles.confirmMsg}>
              ステータスは保存後に変更できません（育成アイテムでのみ伸ばせます）。この配分で決定しますか？
            </p>
            <div className={styles.statSummary}>
              {STAT_KEYS.map((k) => (
                <span key={k}>
                  {STAT_LABEL[k]} {stats[k]}
                </span>
              ))}
            </div>
            <p className={styles.confirmMsg} style={{ textAlign: 'center', margin: '0 0 12px' }}>
              {createCost === 0 ? (
                <>一体目のウマは <strong>無料</strong> で作れます！</>
              ) : (
                <>作成に <CoinIcon size={15} /> <strong>{CREATE_COST.toLocaleString()}</strong> コインかかります</>
              )}
            </p>
            <div className={styles.confirmActions}>
              <button className="btn neutral" onClick={() => setConfirming(false)}>
                やめる
              </button>
              <button className="btn" onClick={commitSave}>
                決定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
