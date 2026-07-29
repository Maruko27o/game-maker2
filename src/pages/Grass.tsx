import { useEffect, useMemo, useState } from 'react';
import { useStore, type SpawnedPart } from '../store';
import { ENERGY_CAP, normalizeEnergy, msUntilNextEnergy } from '../logic/energy';
import { partName, partRarity } from '../data/parts';
import { GRASS_OKAWARI_COST } from '../data/coins';
import type { Horse } from '../types';
import HorseView from '../components/HorseView';
import GrassScene from '../components/GrassScene';
import GrassRoom from '../components/GrassRoom';
import { sampleDayNight, clockPhase, lightPool, horseGlowFilter } from '../logic/daynight';
import CoinIcon from '../components/CoinIcon';
import Icon from '../components/Icon';
import PartThumb from '../components/PartThumb';
import { usePrefersReducedMotion } from '../hooks';
import SkillBook from '../components/SkillBook';
import { skillOf } from '../logic/skill';
import { aptitudeOf } from '../logic/aptitude';
import { GRADE_STYLE } from '../data/aptitude';
import { COURSES } from '../data/courses';
import styles from './Grass.module.css';

type Phase = 'ready' | 'searching' | 'reveal';

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
  const maxHorses = useStore((s) => s.maxHorses);
  const coins = useStore((s) => s.coins);
  const claimGrassBonus = useStore((s) => s.claimGrassBonus);
  const buyOkawari = useStore((s) => s.buyOkawari);

  const reduced = usePrefersReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const [phase, setPhase] = useState<Phase>('ready');
  const [reward, setReward] = useState<SpawnedPart[]>([]);
  const [wild, setWild] = useState<Horse | null>(null); // 仲間になったウマ
  const [revealed, setRevealed] = useState(false); // 登場演出が終わってから確認欄を出す
  const [bookOpen, setBookOpen] = useState(false); // 固有スキル図鑑
  const [bonus, setBonus] = useState(0); // grass first-of-day coin bonus toast

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // First couple of grass visits each day pay a small coin bonus (RACE_V4 §4.2).
  useEffect(() => {
    const got = claimGrassBonus();
    if (got > 0) {
      setBonus(got);
      const t = setTimeout(() => setBonus(0), 2600);
      return () => clearTimeout(t);
    }
  }, [claimGrassBonus]);

  const state = { energy, energyUpdatedAt };
  const stock = normalizeEnergy(state, now).energy;
  const countdown = useMemo(() => fmt(msUntilNextEnergy(state, now)), [energy, energyUpdatedAt, now]);
  const boxFull = horseCount >= maxHorses;
  const available = stock > 0 && !boxFull; // 箱が満杯なら草むらに行けない

  // 昼夜サイクル（草むらは実時計で1時間かけて一周。reduced は昼で固定）。
  const dn = sampleDayNight(reduced ? 0 : clockPhase(now, 3_600_000));
  const isDark = dn.nightMix > 0.5;

  function onTap() {
    if (phase !== 'ready' || !available) return;
    setRevealed(false);
    setPhase('searching');
    const run = () => {
      const res = doSpawn();
      if (!res) {
        setPhase('ready');
        return;
      }
      setReward(res.parts);
      setWild(res.horse);
      setPhase('reveal');
      // reduced motion では登場演出（runIn）が無いので、すぐ確認欄を出す。
      if (reduced) setRevealed(true);
    };
    if (reduced) run();
    else setTimeout(run, 700);
  }

  function close() {
    setPhase('ready');
    setReward([]);
    setWild(null);
    setRevealed(false);
    setNow(Date.now());
  }

  return (
    <div className={styles.page}>
      <GrassRoom />
      <header className={styles.header}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>ストック</span>
          <span className={styles.statValue}>
            <span className={styles.hearts} aria-hidden>
              {Array.from({ length: ENERGY_CAP }).map((_, i) => (
                <span key={i} className={i < stock ? styles.on : styles.off}>
                  <Icon name="horse" size={16} />
                </span>
              ))}
            </span>
            <span className={styles.stockNum}>{stock}/{ENERGY_CAP}</span>
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{stock >= ENERGY_CAP ? '満タン' : '次のチャージ'}</span>
          <span className={styles.statValue}>{stock >= ENERGY_CAP ? '✓' : countdown}</span>
        </div>
      </header>

      <button
        className={`${styles.field} ${available ? styles.fieldReady : ''} ${
          phase === 'searching' ? styles.searching : ''
        }`}
        onClick={onTap}
        disabled={!available || phase !== 'ready'}
        aria-label={boxFull ? 'ボックスがいっぱい' : available ? '草むらをタップしてウマを探す' : '次のチャージまで待つ'}
      >
        <GrassScene d={dn} reduced={reduced} />

        {phase === 'reveal' && wild ? (
          <>
            {dn.lightStrength > 0.05 && <div className={styles.wildLight} style={{ background: lightPool(dn) }} aria-hidden />}
            <div
              className={`${styles.wild} ${reduced ? '' : styles.runIn}`}
              style={{ filter: horseGlowFilter(dn) }}
              onAnimationEnd={(e) => {
                // 登場演出（runIn）が終わったら確認欄を出す。子要素のアニメは無視。
                if (e.currentTarget === e.target) setRevealed(true);
              }}
            >
              <HorseView horse={wild} size={200} shadow />
            </div>
          </>
        ) : boxFull ? (
          // ボックスが満杯：新しいウマを迎えられない。
          <div className={`${styles.hint} ${isDark ? styles.nightText : ''}`}>
            <p>ボックスがいっぱい！</p>
            <p className={styles.hintSub}>マイウマで引退させると草むらに行けるよ</p>
          </div>
        ) : available ? (
          // ストック有り：タップを促す（外を眺める窓の中央に軽く重ねる）。
          <div className={`${styles.hint} ${isDark ? styles.nightText : ''}`}>
            <p>草むらをタップ！</p>
            <p className={styles.hintSub}>ストック {stock}個</p>
          </div>
        ) : null}
      </button>

      <div className={styles.footRow}>
        <span className={styles.footNote}>マイウマ {horseCount}/{maxHorses}</span>
        <button className={styles.skillBookBtn} onClick={() => setBookOpen(true)} aria-label="ウマのとくちょう図鑑を見る">
          i
        </button>
        {stock < ENERGY_CAP && (
          <button
            className={styles.okawari}
            onClick={() => { if (buyOkawari()) setNow(Date.now()); }}
            disabled={coins < GRASS_OKAWARI_COST}
            title={`${GRASS_OKAWARI_COST}コインでストック+1（何回でもOK）`}
          >
            <CoinIcon size={16} /> 草をおかわり（{GRASS_OKAWARI_COST}）
          </button>
        )}
      </div>

      {bookOpen && <SkillBook onClose={() => setBookOpen(false)} />}

      {bonus > 0 && (
        <div className={styles.bonusToast} role="status">
          <CoinIcon size={18} /> ログインボーナス ＋{bonus}
        </div>
      )}

      {phase === 'reveal' && revealed && (
        // 馬の登場演出を見終えてから、下の方に小さめの「確認欄」として表示。
        // 画面下のタブには重ねない（ナビの上に固定）。1タップ最大4個なので4枚まで。
        <div className={styles.reward} role="status">
          <button className={styles.rewardClose} onClick={close} aria-label="閉じる">✕</button>
          <div className={styles.rewardTitle}>
            {wild ? `${wild.name} が仲間になった！` : 'ゲット！'}
            {stock > 0 && <span className={styles.rewardSub}>あと{stock}個</span>}
          </div>
          {wild && (
            <div className={styles.wildSkill}>
              <span className={styles.wildSkillName}>{skillOf(wild).name}</span>
              <span className={styles.wildStars}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Icon key={i} name="star" size={11} className={i < skillOf(wild).star ? styles.starOn : styles.starOff} />
                ))}
              </span>
            </div>
          )}
          {wild && (
            <div className={styles.wildApt}>
              {COURSES.map((c) => {
                const g = aptitudeOf(wild)[c.id];
                const st = GRADE_STYLE[g];
                return (
                  <span key={c.id} className={styles.wildAptCell} title={`${c.name} ${g}`}>
                    <span className={styles.wildAptName}>{c.name.slice(0, 4)}</span>
                    <span
                      className={styles.wildAptGrade}
                      style={{ background: st.background, color: st.ink, borderColor: st.border }}
                    >
                      {g}
                    </span>
                  </span>
                );
              })}
            </div>
          )}
          <div className={styles.rewardParts}>パーツ {reward.length}個 ゲット</div>
          <div className={styles.cards}>
            {reward.slice(0, 4).map((p, i) => (
              <div
                key={p.id}
                className={styles.card}
                style={{ animationDelay: reduced ? '0s' : `${i * 0.1}s` }}
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
        </div>
      )}
    </div>
  );
}
