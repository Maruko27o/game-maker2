import { useEffect, useMemo, useState } from 'react';
import { useStore, type SpawnedPart } from '../store';
import { ENERGY_CAP, normalizeEnergy, msUntilNextEnergy } from '../logic/energy';
import { colorsBySlot, decosBySlot, partName, partRarity, isColorId } from '../data/parts';
import type { HorseLook, DecoSlot } from '../types';
import HorseView from '../components/HorseView';
import PartThumb from '../components/PartThumb';
import { usePrefersReducedMotion } from '../hooks';
import styles from './Grass.module.css';

type Phase = 'ready' | 'searching' | 'reveal';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// A cosmetic "wild" horse that appears from the grass, wearing the decorations
// it just dropped so the reveal feels connected to the reward.
function makeWildHorse(parts: SpawnedPart[]): HorseLook {
  const decos: Partial<Record<DecoSlot, string>> = {};
  const colors: HorseLook["colors"] = {
    body: pick(colorsBySlot.body).id,
    mane: pick(colorsBySlot.mane).id,
    hoof: pick(colorsBySlot.hoof).id,
  };
  for (const p of parts) {
    if (isColorId(p.id)) continue;
    const slot = (Object.keys(decosBySlot) as DecoSlot[]).find((s) =>
      decosBySlot[s].some((d) => d.id === p.id),
    );
    if (slot && !decos[slot]) decos[slot] = p.id;
  }
  return { name: '', colors, decos };
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function Grass() {
  const doSpawn = useStore((s) => s.doSpawn);
  const energy = useStore((s) => s.energy);
  const energyUpdatedAt = useStore((s) => s.energyUpdatedAt);
  const horseCount = useStore((s) => s.horses.length);

  const reduced = usePrefersReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const [phase, setPhase] = useState<Phase>('ready');
  const [reward, setReward] = useState<SpawnedPart[]>([]);
  const [wild, setWild] = useState<HorseLook | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const state = { energy, energyUpdatedAt };
  const stock = normalizeEnergy(state, now).energy;
  const countdown = useMemo(() => fmt(msUntilNextEnergy(state, now)), [energy, energyUpdatedAt, now]);
  const available = stock > 0;

  function onTap() {
    if (phase !== 'ready' || !available) return;
    setPhase('searching');
    const run = () => {
      const res = doSpawn();
      if (!res) {
        setPhase('ready');
        return;
      }
      setReward(res.parts);
      setWild(makeWildHorse(res.parts));
      setPhase('reveal');
    };
    if (reduced) run();
    else setTimeout(run, 700);
  }

  function close() {
    setPhase('ready');
    setReward([]);
    setWild(null);
    setNow(Date.now());
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>ストック</span>
          <span className={styles.statValue}>
            <span className={styles.hearts} aria-hidden>
              {Array.from({ length: ENERGY_CAP }).map((_, i) => (
                <span key={i} className={i < stock ? styles.on : styles.off}>
                  🐴
                </span>
              ))}
            </span>
            <span className={styles.stockNum}>{stock}/{ENERGY_CAP}</span>
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{stock >= ENERGY_CAP ? 'まんタン' : 'つぎのチャージ'}</span>
          <span className={styles.statValue}>{stock >= ENERGY_CAP ? '✓' : countdown}</span>
        </div>
      </header>

      <button
        className={`${styles.field} ${available ? styles.fieldReady : ''} ${
          phase === 'searching' ? styles.searching : ''
        }`}
        onClick={onTap}
        disabled={!available || phase !== 'ready'}
        aria-label={available ? '草むらをタップしてウマをさがす' : '次のチャージまで待つ'}
      >
        <div className={styles.grassRow} aria-hidden>
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} className={styles.blade} style={{ animationDelay: `${i * 0.06}s` }}>
              🌿
            </span>
          ))}
        </div>

        {phase === 'reveal' && wild ? (
          <div className={styles.wild}>
            <HorseView horse={wild} size={200} shadow />
          </div>
        ) : (
          <div className={styles.hint}>
            {available ? (
              <>
                <div className={styles.tapEmoji}>👆</div>
                <p>草むらをタップ！</p>
                <p className={styles.hintSub}>ストック {stock}こ</p>
              </>
            ) : (
              <>
                <p className={styles.waitTitle}>草がしずかだ…</p>
                <p className={styles.waitSub}>つぎのチャージまで {countdown}</p>
                <p className={styles.waitNote}>1時間に1こ・最大{ENERGY_CAP}こまでたまる</p>
              </>
            )}
          </div>
        )}
      </button>

      <div className={styles.footRow}>
        <span className={styles.footNote}>マイウマ {horseCount}/10</span>
      </div>

      {phase === 'reveal' && (
        <div className={styles.reward}>
          <h2 className={styles.rewardTitle}>{reward.length}こ ゲット！</h2>
          <div className={styles.cards}>
            {reward.map((p, i) => (
              <div
                key={p.id}
                className={styles.card}
                style={{ animationDelay: reduced ? '0s' : `${i * 0.12}s` }}
              >
                <div className={styles.cardThumb}>
                  <PartThumb id={p.id} size={84} />
                </div>
                <div className={styles.cardName}>{partName(p.id)}</div>
                <div className={styles.cardMeta}>
                  <span className={`rarity rarity-${partRarity(p.id)}`}>{partRarity(p.id)}</span>
                  <span className={p.isNew ? styles.tagNew : styles.tagDup}>
                    {p.isNew ? 'NEW' : 'かぶり'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button className="btn" onClick={close}>
            {stock > 0 ? `つづける（あと${stock}こ）` : 'つづける'}
          </button>
        </div>
      )}
    </div>
  );
}
