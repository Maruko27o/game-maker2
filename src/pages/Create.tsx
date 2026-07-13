import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore, MAX_HORSES } from '../store';
import { colorsBySlot, decosBySlot, COLOR_SLOTS, DECO_SLOTS } from '../data/parts';
import type { ColorSlot, DecoSlot, Horse } from '../types';
import HorseView from '../components/HorseView';
import styles from './Create.module.css';

const COLOR_LABEL: Record<ColorSlot, string> = { body: 'からだ', mane: 'たてがみ', hoof: 'ひづめ' };
const DECO_LABEL: Record<DecoSlot, string> = { head: '頭', face: '顔', back: '背中', tail: 'しっぽ' };

function firstOwnedColor(owned: Record<string, number>, slot: ColorSlot): string {
  const found = colorsBySlot[slot].find((c) => (owned[c.id] ?? 0) > 0);
  return found?.id ?? '';
}

export default function Create() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('edit');

  const owned = useStore((s) => s.owned);
  const horses = useStore((s) => s.horses);
  const addHorse = useStore((s) => s.addHorse);
  const updateHorse = useStore((s) => s.updateHorse);

  const editing = editId ? horses.find((h) => h.id === editId) ?? null : null;
  const atCap = !editing && horses.length >= MAX_HORSES;

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

  const preview: Horse = useMemo(
    () => ({ id: 'preview', name, colors, decos, createdAt: 0 }),
    [name, colors, decos],
  );

  const canSave = canBuild && !atCap && COLOR_SLOTS.every((s) => colors[s]);

  function save() {
    if (!canSave) return;
    const finalName = name.trim() || 'なまえのないウマ';
    if (editing) {
      updateHorse(editing.id, { name: finalName, colors, decos });
    } else {
      addHorse({ name: finalName, colors, decos });
    }
    navigate('/stable');
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{editing ? 'ウマをなおす' : 'ウマをつくる'}</h1>

      <div className={styles.previewBox}>
        <HorseView horse={preview} size={220} shadow />
      </div>

      {!canBuild && (
        <p className={styles.warn}>
          からだ・たてがみ・ひづめの色を、それぞれ1つ以上あつめると作れます。草むらでパーツをあつめよう！
        </p>
      )}
      {atCap && (
        <p className={styles.warn}>マイウマが上限（{MAX_HORSES}体）です。マイウマで1体消すと作れます。</p>
      )}

      {/* Colors */}
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
                  style={{ background: c.value }}
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

      {/* Decorations */}
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

      <div className={styles.actions}>
        <button className="btn neutral" onClick={() => navigate(-1)}>
          もどる
        </button>
        <button className="btn" onClick={save} disabled={!canSave}>
          {editing ? 'ほぞんする' : 'このウマにする'}
        </button>
      </div>
    </div>
  );
}
