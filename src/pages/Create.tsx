import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../store';
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

const COLOR_LABEL: Record<ColorSlot, string> = { body: 'からだ', mane: 'たてがみ', hoof: 'ひづめ' };
const DECO_LABEL: Record<DecoSlot, string> = { head: '頭', face: '顔', back: '背中', tail: 'しっぽ' };

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

  const editing = editId ? horses.find((h) => h.id === editId) ?? null : null;
  const rebalancing = rebalanceId ? horses.find((h) => h.id === rebalanceId) ?? null : null;
  const atCap = !editing && !rebalancing && horses.length >= maxHorses;

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
      ? lookReady && remaining === 0
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
    const finalName = name.trim() || 'なまえのないウマ';
    if (rebalancing) {
      rebalanceHorse(rebalancing.id, stats);
    } else if (editing) {
      updateHorse(editing.id, { name: finalName, colors, decos });
    } else {
      addHorse({ name: finalName, colors, decos }, stats);
    }
    navigate('/stable');
  }

  function onSaveClick() {
    if (!canSave) return;
    if (allocMode) setConfirming(true); // stats are locked after save — confirm first
    else commitSave();
  }

  const title = rebalancing ? 'ステータスふりなおし' : editing ? 'ウマをなおす' : 'ウマをつくる';

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{title}</h1>

      <div className={styles.previewBox}>
        <HorseView horse={preview} size={220} shadow />
      </div>

      {rebalancing && (
        <p className={styles.warn}>
          ステータスの仕組みが変わりました。この1回だけ、無料で振り直せます（保存後は変更できません）。
        </p>
      )}
      {!rebalancing && !canBuild && (
        <p className={styles.warn}>
          からだ・たてがみ・ひづめの色を、それぞれ1つ以上あつめると作れます。草むらでパーツをあつめよう！
        </p>
      )}
      {atCap && (
        <p className={styles.warn}>マイウマが上限（{maxHorses}体）です。マイウマで1体消すと作れます。</p>
      )}

      {/* Look (colors / decorations / name) — hidden while rebalancing stats */}
      {!rebalancing && (
        <>
          {COLOR_SLOTS.map((slot) => (
            <section key={slot} className={styles.section}>
              <h2 className={styles.sectionTitle}>{COLOR_LABEL[slot]}</h2>
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
                      {!has && <span className={styles.lock}>🔒</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          {DECO_SLOTS.map((slot) => (
            <section key={slot} className={styles.section}>
              <h2 className={styles.sectionTitle}>{DECO_LABEL[slot]}</h2>
              <div className={styles.decoRow}>
                <button
                  className={`${styles.decoChip} ${!decos[slot] ? styles.selected : ''}`}
                  onClick={() => setDecos((p) => ({ ...p, [slot]: undefined }))}
                >
                  なし
                </button>
                {decosBySlot[slot].map((d) => {
                  const has = (owned[d.id] ?? 0) > 0;
                  const selected = decos[slot] === d.id;
                  return (
                    <button
                      key={d.id}
                      className={`${styles.decoChip} ${selected ? styles.selected : ''} ${
                        has ? '' : styles.lockedChip
                      }`}
                      disabled={!has}
                      onClick={() => setDecos((p) => ({ ...p, [slot]: d.id }))}
                    >
                      {has ? d.name : '🔒 ' + d.name}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>なまえ</h2>
            <input
              className={styles.nameInput}
              value={name}
              maxLength={12}
              placeholder="なまえをつけよう"
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
              のこり {remaining}
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
          もどる
        </button>
        <button className="btn" onClick={onSaveClick} disabled={!canSave}>
          {rebalancing
            ? '振り直す'
            : editing
              ? 'ほぞんする'
              : remaining === 0
                ? 'このウマにする'
                : `のこり ${remaining} ポイント`}
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
            <div className={styles.confirmActions}>
              <button className="btn neutral" onClick={() => setConfirming(false)}>
                やめる
              </button>
              <button className="btn" onClick={commitSave}>
                けってい
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
