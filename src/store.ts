import { create } from 'zustand';
import type {
  SaveData,
  Horse,
  ColorSlot,
  DecoSlot,
  Trophy,
  Badge,
  TrainingItem,
  RaceRecord,
  Stats,
  StatKey,
  BetRecord,
  PlayerStats,
  RaceSession,
  ArenaState,
  ArenaEntry,
  ArenaResult,
  ArenaHorseSnapshot,
  MailItem,
  FrameAward,
  EquipFrame,
  AptGrade,
} from './types';
import { STREAK_MAX } from './types';
import { foldRace, achievedLevel } from './logic/streak';
import { allParts, slotOf } from './data/parts';
import { COURSES } from './data/courses';
import { spawn as gachaSpawn } from './logic/gacha';
import { ENERGY_CAP, ENERGY_REGEN_MS, spendEnergy } from './logic/energy';
import { grassRegenMs, okawariCost, trainingGain, srRateMul, prefersUnowned, g1Attempts } from './logic/weekdayEvents';
import { rescaleTo40, mulberry32, hashString } from './logic/stats';
import { rollSkill, skillForHorseId } from './logic/skill';
import { rollAptitude, aptitudeForHorseId } from './logic/aptitude';
import { makeWildHorse } from './logic/wild';
import { applyReroll } from './logic/reroll';
import { canRefine, refineState, REFINE_TICKET_COST, arenaTickets } from './logic/refine';
import { rewardForDow, loginDayKey, dowOf, canClaim, rollDye, type LoginReward } from './logic/loginBonus';
import { colorSlotById } from './data/parts';
import { applyTraining, trainingRoom } from './logic/training';
import { evaluateBadges } from './logic/badges';
import {
  GRASS_OKAWARI_COST,
  GP_DAILY_LIMIT,
  TEAM_SIZE,
  RACE_TASK_EVERY,
  RACE_TASK_REWARD,
  GRASS_TASK_EVERY,
  GRASS_TASK_REWARD,
} from './data/coins';
import { cyclesOf, newlyBanked } from './logic/tasks';
import { styleFor } from './logic/runStyle';
import { runTournament, playerSnapshot } from './logic/arena';
import { periodId, ARENA_ENTRY_FEE, ARENA_MODE, ARENA_CATCHUP_MAX, ARENA_RESULTS_CAP } from './data/arena';
import { farmRatePerHour, farmAccrued, retireValueOf, teamHorses } from './logic/farm';
import { addToTeam, removeFromTeam, moveInTeam, normalizeTeam } from './logic/team';
import { trustedNow } from './logic/trustedClock';
import { normAptFrames, newlyEarned, mergeAptFrames } from './logic/aptFrames';
import { openBox as rollBox, stackBox, takeBox, type BoxResult } from './logic/boxes';
import { type BoxKind } from './data/boxes';
import { normalizeCustomBet } from './data/customBet';

export const STORAGE_KEY = 'horse-game/v1'; // guest slot; payload is versioned inside
export const MAX_HORSES = 30; // 所持できるマイウマの上限（5×6ボックス）。全プレイヤー共通・無料開放

// Which localStorage slot we currently read/write. Guests use STORAGE_KEY; a
// signed-in user uses a per-account slot so two accounts on the same browser
// never share a local cache (ACCOUNT.md §1.6).
let activeKey = STORAGE_KEY;
function keyFor(uid: string | null): string {
  return uid ? `horse-game/v3/${uid}` : STORAGE_KEY;
}
/** Point future reads/writes at the given account's slot (null = guest). */
export function bindSaveKey(uid: string | null): void {
  activeKey = keyFor(uid);
}

// Starter parts so a brand-new player can build a horse immediately.
export const STARTER_PARTS = [
  'body_white',
  'body_chestnut',
  'body_bay',
  'body_gray',
  'mane_brown',
  'mane_black',
  'mane_cream',
  'hoof_dark',
  'hoof_stone',
  'hoof_ivory',
];

function starterOwned(): Record<string, number> {
  return Object.fromEntries(STARTER_PARTS.map((id) => [id, 1]));
}

/** Local date key (YYYY-MM-DD) for per-day counters.
 *  端末の時計ではなく trustedNow() を既定にする。Date.now() だと、日付を
 *  進めるだけで「1日1回」の制限（グランプリG1の回数など）をいくらでも
 *  リセットできてしまうため。 */
export function dayKey(now = trustedNow()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function freshDaily(): SaveData['daily'] {
  return { day: dayKey(), grassBonus: 0, okawari: 0, gp: 0 };
}

// Normalize a stored daily object, defaulting any missing counter (older saves
// predate the `gp` field).
function normDaily(v: unknown): SaveData['daily'] {
  const d = (v ?? {}) as Partial<SaveData['daily']>;
  return {
    day: typeof d.day === 'string' ? d.day : dayKey(),
    grassBonus: typeof d.grassBonus === 'number' ? d.grassBonus : 0,
    okawari: typeof d.okawari === 'number' ? d.okawari : 0,
    gp: typeof d.gp === 'number' ? d.gp : 0,
  };
}
const BETS_CAP = 50; // keep only the most recent settled bets

function freshTasks(): SaveData['tasks'] {
  return { racesFinished: 0, raceBanked: 0, grassSpawns: 0, grassBanked: 0, bank: 0 };
}
// Normalize the tasks object, defaulting any missing counter and converting the
// old {racesFinished, raceRewardClaimed} shape: any race rewards that were earned
// but not yet claimed carry over into the new shared bank.
function normTasks(v: unknown): SaveData['tasks'] {
  const t = (v ?? {}) as Record<string, unknown>;
  const num = (x: unknown): number => (typeof x === 'number' && isFinite(x) ? x : 0);
  const racesFinished = num(t.racesFinished);
  const isNew = t.bank !== undefined || t.raceBanked !== undefined || t.grassSpawns !== undefined;
  if (isNew) {
    return {
      racesFinished,
      raceBanked: num(t.raceBanked),
      grassSpawns: num(t.grassSpawns),
      grassBanked: num(t.grassBanked),
      bank: num(t.bank),
    };
  }
  // Old shape → carry any unclaimed race rewards into the bank.
  const cycles = cyclesOf(racesFinished, RACE_TASK_EVERY);
  const owed = Math.max(0, cycles - num(t.raceRewardClaimed)) * RACE_TASK_REWARD;
  return { racesFinished, raceBanked: cycles, grassSpawns: 0, grassBanked: 0, bank: owed };
}

function freshStats(): SaveData['stats'] {
  return { betsPlaced: 0, maxPayout: 0, maxRecoveryPct: 0, maxOdds: 0, totalEarned: 0, horsesFound: 0, arenaWins: 0 };
}
// Reconstruct profile stats from a player's saved bet history, so existing users
// see their past 最大オッズ / 回収率 / 獲得賞金 rather than starting at zero. Recovery
// here is per-ticket (payout ÷ stake) — the best available from saved records.
function deriveStatsFromBets(bets: SaveData['bets']): SaveData['stats'] {
  let maxOdds = 0;
  let maxPayout = 0;
  let maxRecoveryPct = 0;
  for (const b of bets) {
    if (b.won && b.odds > maxOdds) maxOdds = b.odds;
    if (b.payout > maxPayout) maxPayout = b.payout;
    if (b.amount > 0) {
      const rec = Math.round((b.payout / b.amount) * 100);
      if (rec > maxRecoveryPct) maxRecoveryPct = rec;
    }
  }
  return { betsPlaced: bets.length, maxPayout, maxRecoveryPct, maxOdds, totalEarned: 0, horsesFound: 0, arenaWins: 0 };
}
// Default any missing profile stat (older saves predate the profile-stats feature).
function normStats(v: unknown): SaveData['stats'] {
  const s = (v ?? {}) as Partial<SaveData['stats']>;
  return {
    betsPlaced: typeof s.betsPlaced === 'number' ? s.betsPlaced : 0,
    maxPayout: typeof s.maxPayout === 'number' ? s.maxPayout : 0,
    maxRecoveryPct: typeof s.maxRecoveryPct === 'number' ? s.maxRecoveryPct : 0,
    maxOdds: typeof s.maxOdds === 'number' ? s.maxOdds : 0,
    totalEarned: typeof s.totalEarned === 'number' ? s.totalEarned : 0,
    horsesFound: typeof s.horsesFound === 'number' ? s.horsesFound : 0,
    arenaWins: typeof s.arenaWins === 'number' ? s.arenaWins : 0,
  };
}

function freshSave(): SaveData {
  return {
    version: 6,
    // 新規アカウントには「総獲得賞金」のお詫びは要らない（失われた記録がない）。
    earnedNoticeDue: false,
    owned: starterOwned(),
    horses: [],
    energy: ENERGY_CAP,
    energyUpdatedAt: Date.now(),
    trophies: [],
    badges: [],
    winStreaks: {},
    soloStreak: 0,
    streakBest: 0,
    streakClaimed: 0,
    streakRuleResetDone: false,
    items: [],
    raceRecords: [],
    gpUnlocked: { g2: false, g1: false },
    freeRebalance: false,
    freeRename: true,
    coins: 0,
    bets: [],
    maxHorses: MAX_HORSES,
    team: [],
    daily: freshDaily(),
    tasks: freshTasks(),
    stats: freshStats(),
    avatarHorseId: null,
    displayTrophies: [],
    mailbox: [],
    equippedFrame: null,
    aptFrames: [],
    aptPending: [],
    boxFrames: [],
    boxTitles: [],
    // 空配列で持たせておく（undefined のままだと「まだ読み込めていない」と
    // 区別がつかず、称号の初ゲットのお知らせが一度も出なくなる）。
    seenTitles: [],
    equippedTitle: null,
    customBet: null,
    raceSession: null,
    arena: freshArena(),
    farmClaimedAt: trustedNow(),
    savedAt: 0, // untouched save loses to any real cloud data on first sync
  };
}

// Profile prefs (icon horse + trophy shelf) — default sensibly for older saves.
function normFrame(v: unknown): EquipFrame | null {
  if (!v || typeof v !== 'object') return null;
  const f = v as Record<string, unknown>;
  // 連勝フレーム（スペシャルタスク報酬）。
  // ボックス限定フレーム（1/1000・1/10000）。
  if (f.kind === 'box') {
    return f.box === 'lucky' || f.box === 'gold' ? { kind: 'box', box: f.box } : null;
  }
  // 適性フレーム（6コースすべて同じ等級のウマを手に入れた記録）。
  if (f.kind === 'apt') {
    const g = f.grade;
    return g === 'C' || g === 'B' || g === 'A' || g === 'S' ? { kind: 'apt', grade: g } : null;
  }
  if (f.kind === 'streak') {
    const level = Number(f.level);
    if (Number.isFinite(level) && level >= 1 && level <= STREAK_MAX) return { kind: 'streak', level: Math.round(level) };
    return null;
  }
  const rank = f.rank === 1 || f.rank === 2 || f.rank === 3 ? f.rank : null;
  const metric = f.metric === 'odds' || f.metric === 'payout' ? f.metric : null;
  if (typeof f.period !== 'string' || rank === null || metric === null) return null;
  return { period: f.period, rank, metric };
}
/** 読み込み時の適性フレームの足しこみ。
 *  授与は「ウマの顔ぶれが変わったとき」に走るが、それだけだとこの更新より前から
 *  オール S のウマを持っている人がいつまでももらえない。読み込みのたびに今いる
 *  ウマを見て足す（すでに持っている等級は絶対に消さない）。 */
/** ボックス限定フレームの記録。各1回きりなので種類だけを持つ。 */
/** 文字列だけを拾う ID の配列（重複は落とす）。 */
function normIdList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set((v as unknown[]).filter((x): x is string => typeof x === 'string'))];
}

function normBoxFrames(v: unknown): BoxKind[] {
  if (!Array.isArray(v)) return [];
  const out: BoxKind[] = [];
  for (const k of v) if ((k === 'lucky' || k === 'gold') && !out.includes(k)) out.push(k);
  return out;
}

// 読み込み時にも適性チャレンジの達成を拾う（前の版で条件を満たしていた人ぶん）。
// 授与ではなく「受け取り待ち」に入れる。受け取るのはタスク画面。
function profileWithAptFrames(d: Record<string, unknown>, horses: Horse[]) {
  const p = normProfile(d);
  const have = mergeAptFrames(p.aptFrames, p.aptPending);
  return { ...p, aptPending: mergeAptFrames(p.aptPending, newlyEarned(horses, have)) };
}

function normProfile(d: Record<string, unknown>): {
  avatarHorseId: string | null;
  displayTrophies: number[];
  mailbox: MailItem[];
  equippedFrame: EquipFrame | null;
  aptFrames: AptGrade[];
  aptPending: AptGrade[];
  boxFrames: BoxKind[];
  boxTitles: BoxKind[];
  seenTitles: string[];
  equippedTitle: string | null;
  customBet: SaveData['customBet'];
} {
  const avatarHorseId = typeof d.avatarHorseId === 'string' ? d.avatarHorseId : null;
  const displayTrophies = Array.isArray(d.displayTrophies)
    ? (d.displayTrophies as unknown[]).filter((n): n is number => n === 1 || n === 2 || n === 3).slice(0, 5)
    : [];
  const mailbox = Array.isArray(d.mailbox)
    ? (d.mailbox as unknown[]).filter(
        (m): m is MailItem => !!m && typeof m === 'object' && typeof (m as MailItem).id === 'string',
      )
    : [];
  const equippedTitle = typeof d.equippedTitle === 'string' ? d.equippedTitle : null;
  const cb = d.customBet as SaveData['customBet'];
  const customBet = cb && typeof cb === 'object' && typeof cb.amount === 'number' ? normalizeCustomBet(cb) : null;
  return { avatarHorseId, displayTrophies, mailbox, equippedFrame: normFrame(d.equippedFrame), aptFrames: normAptFrames(d.aptFrames), boxFrames: normBoxFrames(d.boxFrames), boxTitles: normBoxFrames(d.boxTitles), aptPending: normAptFrames(d.aptPending), seenTitles: normIdList(d.seenTitles), equippedTitle, customBet };
}

function normGp(v: unknown): { g2: boolean; g1: boolean } {
  const g = (v ?? {}) as { g2?: boolean; g1?: boolean };
  return { g2: !!g.g2, g1: !!g.g1 };
}

// Balanced 40-point spread for horses that predate any stats (v1/v2).
const BALANCED_40: Stats = { spd: 7, sta: 7, pwr: 7, jmp: 7, gut: 6, wit: 6 };

// Keep a stored in-progress race only if it's structurally sound (改修：レース継続);
// anything unexpected just drops back to "no active race".
function normRaceSession(v: unknown): RaceSession | null {
  if (!v || typeof v !== 'object') return null;
  const s = v as Record<string, unknown>;
  if (typeof s.seed !== 'number' || !s.player) return null;
  if (s.kind === 'single' && typeof s.courseId === 'string') return s as unknown as RaceSession;
  if (s.kind === 'gp' && typeof s.grade === 'string') return s as unknown as RaceSession;
  return null;
}

// 対戦（勝ち抜きトーナメント）の保存状態。壊れていれば空に戻す。旧shape（entry/result）
// は互換性を捨てて空リセット（結果は溜め直し・エントリーは無効）。
function freshArena(): ArenaState {
  return { auto: null, pending: null, lastPeriod: null, results: [] };
}
function normArena(v: unknown): ArenaState {
  if (!v || typeof v !== 'object') return freshArena();
  const a = v as Record<string, unknown>;
  if (!Array.isArray(a.results)) return freshArena(); // old/absent shape → reset
  const auto =
    a.auto && typeof a.auto === 'object' && typeof (a.auto as { horseId?: unknown }).horseId === 'string'
      ? (a.auto as ArenaState['auto'])
      : null;
  const pending =
    a.pending && typeof a.pending === 'object' && typeof (a.pending as { period?: unknown }).period === 'number'
      ? (a.pending as ArenaState['pending'])
      : null;
  const lastPeriod = typeof a.lastPeriod === 'number' ? a.lastPeriod : null;
  const results = (a.results as unknown[]).filter(
    (r): r is ArenaResult => !!r && typeof r === 'object' && Array.isArray((r as { rounds?: unknown }).rounds),
  );
  return { auto, pending, lastPeriod, results };
}

// Migrate any stored payload up to v4, preserving collection/horses.
// Returns { data, migrated } — migrated=true when an upgrade happened.
export function migrate(parsed: unknown): { data: SaveData; migrated: boolean } | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const d = parsed as Record<string, unknown>;
  if (typeof d.owned !== 'object' || d.owned === null || !Array.isArray(d.horses)) return null;
  const owned = d.owned as Record<string, number>;
  const horses = d.horses as Horse[];

  // 固有スキルの後付け付与：既存ウマも“生まれつき持っていた”ことにして、アップデートで
  // 置いていかれないようにする。ウマIDから決まる固定スキルなので、端末やクラウド同期を
  // またいでも必ず同じものになる（＝クラウド突合でブレない）。
  for (let i = 0; i < horses.length; i++) {
    if (!horses[i]?.skill) horses[i] = { ...horses[i], skill: skillForHorseId(horses[i].id).id };
    if (!horses[i]?.apt) horses[i] = { ...horses[i], apt: aptitudeForHorseId(horses[i].id) };
  }

  const energy = typeof d.energy === 'number' ? d.energy : ENERGY_CAP;
  const energyUpdatedAt = typeof d.energyUpdatedAt === 'number' ? d.energyUpdatedAt : Date.now();
  const trophies = Array.isArray(d.trophies) ? (d.trophies as Trophy[]) : [];
  const badges = Array.isArray(d.badges) ? (d.badges as Badge[]) : [];
  const winStreaks =
    d.winStreaks && typeof d.winStreaks === 'object' ? (d.winStreaks as Record<string, number>) : {};
  const items = Array.isArray(d.items) ? (d.items as TrainingItem[]) : [];
  const raceRecords = Array.isArray(d.raceRecords) ? (d.raceRecords as RaceRecord[]) : [];
  const savedAt = typeof d.savedAt === 'number' ? d.savedAt : 0;
  // v6 (RACE_V4 §4) economy fields — default sensibly for older saves.
  const coins = typeof d.coins === 'number' ? d.coins : 0;
  // 厳選チケット（対戦の入賞でのみ増える）。旧セーブには無いので0から。
  // 染料（色パーツID -> 個数）とログインボーナスの受け取り日。旧セーブには無い。
  const dyes: Record<string, number> = {};
  if (d.dyes && typeof d.dyes === 'object') {
    for (const [k, v] of Object.entries(d.dyes as Record<string, unknown>)) {
      const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0;
      if (n > 0) dyes[k] = n;
    }
  }
  const loginRaw = (d.login ?? null) as { day?: unknown; at?: unknown } | null;
  const login =
    loginRaw && typeof loginRaw.day === 'string'
      ? { day: loginRaw.day, at: typeof loginRaw.at === 'number' ? loginRaw.at : 0 }
      : undefined;
  const refineTickets =
    typeof d.refineTickets === 'number' && Number.isFinite(d.refineTickets) && d.refineTickets > 0
      ? Math.floor(d.refineTickets)
      : 0;
  const bets = Array.isArray(d.bets) ? (d.bets as SaveData['bets']) : [];
  // 所持上限は全プレイヤー共通で MAX_HORSES（5×6ボックス）に開放。旧セーブの maxHorses
  // （6 や旧10/15）に関わらず一律で引き上げる。既存の馬は当然そのまま残る。
  const maxHorses = MAX_HORSES;
  const daily = normDaily(d.daily);
  const tasks = normTasks(d.tasks);
  // Profile stats: normalize, and one-time backfill from bet history for saves
  // that predate the feature (missing, or still all-zero) so past data shows up.
  let stats = normStats(d.stats);
  const statsEmpty = stats.betsPlaced === 0 && stats.maxOdds === 0 && stats.maxPayout === 0 && stats.maxRecoveryPct === 0;
  if ((d.stats == null || statsEmpty) && bets.length > 0) stats = deriveStatsFromBets(bets);
  // 総獲得賞金は後から足した項目なので、この項目より前から遊んでいる人には過去分の
  // 記録がまったく残っていない。0 から始めると「今まで稼いだぶんが消えた」ように
  // 見えるので、分かっている値（対戦の払戻合計 ＋ 1レースの最大獲得賞金）で下駄を
  // 履かせてから積み上げる。足りないぶんはお詫びのメールで説明する。
  // お詫びの判定に使う値。どちらも下駄を履かせる前に見る。
  //  ・hadTotalEarned … その項目をすでに積んでいたか
  //  ・hadPlayHistory … そもそも遊んだ形跡があるか（新規アカウントは false）
  const hadTotalEarned = (stats.totalEarned ?? 0) > 0;
  const hadPlayHistory =
    (tasks.racesFinished ?? 0) > 0
    || bets.length > 0
    || (Array.isArray(d.trophies) && d.trophies.length > 0)
    || (Array.isArray(d.horses) && d.horses.length > 0);
  if (!stats.totalEarned) {
    const ar = normArena(d.arena);
    const arenaPaid = (ar?.results ?? []).reduce((n, r) => n + Math.max(0, r.payout ?? 0), 0);
    const seed = arenaPaid + stats.maxPayout;
    if (seed > 0) stats = { ...stats, totalEarned: seed };
  }
  // 見つけたウマの通算数も後から足した項目。草むらの回数（grassSpawns）は 1回引くと
  // 必ず1頭出るので通算数そのものだが、もっと古いセーブでは 0 に潰れている。
  // その場合に備えて「今いるウマの数」とくらべて多い方を下駄にする。
  if (!stats.horsesFound) {
    const seed = Math.max(tasks.grassSpawns, Array.isArray(d.horses) ? d.horses.length : 0);
    if (seed > 0) stats = { ...stats, horsesFound: seed };
  }
  // 対戦の優勝回数も後から足した項目。残っている結果（最大40件）から数えて下駄にする。
  if (!stats.arenaWins) {
    const ar = normArena(d.arena);
    const seed = (ar?.results ?? []).filter((r) => r.outcome === 'champion').length;
    if (seed > 0) stats = { ...stats, arenaWins: seed };
  }
  // スペシャルタスク（連勝チャレンジ）の進捗。タスキル→再読込でも失われないよう保存値から復元。
  const nnum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const soloStreak = nnum(d.soloStreak);
  const streakBest = nnum(d.streakBest);
  const streakClaimed = Math.min(nnum(d.streakClaimed), STREAK_MAX);
  const streakRuleResetDone = !!d.streakRuleResetDone;
  // チーム編成（個体値厳選アップデートの土台）。保存値があれば実在するウマIDだけ採用、
  // 無ければ既存の所持ウマ全員をチームに（上限 maxHorses）。この時点では表示・挙動に影響しない。
  const team = Array.isArray(d.team)
    ? normalizeTeam(d.team.filter((x): x is string => typeof x === 'string'), horses, TEAM_SIZE)
    : horses.map((h) => h.id).slice(0, TEAM_SIZE);

  // お詫びメールは「総獲得賞金より前から遊んでいた人」だけに出す。新規アカウントには
  // 何も失われていないので不要。判定は初回の読み込みで一度だけ行い、以後は保存値を使う
  //（あとから走れば履歴ができてしまい、毎回判定だと新規の人にも届いてしまうため）。
  const earnedNoticeDue = typeof d.earnedNoticeDue === 'boolean'
    ? d.earnedNoticeDue
    : hadPlayHistory && !hadTotalEarned;

  if (d.version === 6) {
    return {
      data: {
        version: 6,
        earnedNoticeDue,
        owned,
        horses,
        energy,
        energyUpdatedAt,
        trophies,
        badges,
        winStreaks,
        soloStreak,
        streakBest,
        streakClaimed,
        streakRuleResetDone,
        items,
        raceRecords,
        gpUnlocked: normGp(d.gpUnlocked),
        freeRebalance: !!d.freeRebalance,
        freeRename: typeof d.freeRename === 'boolean' ? d.freeRename : true,
        coins,
        refineTickets,
        dyes,
        login,
        bets,
        maxHorses,
        team,
        daily,
        tasks,
        stats,
        ...profileWithAptFrames(d, horses),
        raceSession: normRaceSession(d.raceSession),
        arena: normArena(d.arena),
        farmClaimedAt: typeof d.farmClaimedAt === 'number' ? d.farmClaimedAt : trustedNow(),
        savedAt,
      },
      migrated: false,
    };
  }

  // v1/v2/v3 -> v4 stat rescale (RACE_V3 §3.6); v4 -> v5 just adds `badges: []`.
  const isPreV4 = d.version !== 4;
  const rescaled = isPreV4
    ? horses.map((h) => ({ ...h, stats: h.stats ? rescaleTo40(h.stats) : { ...BALANCED_40 } }))
    : horses;
  return {
    data: {
      version: 6,
      earnedNoticeDue,
      owned,
      horses: rescaled,
      energy,
      energyUpdatedAt,
      trophies,
      badges,
      winStreaks,
      soloStreak,
      streakBest,
      streakClaimed,
      streakRuleResetDone,
      items,
      raceRecords,
      gpUnlocked: normGp(d.gpUnlocked),
      freeRebalance: isPreV4 ? horses.length > 0 : !!d.freeRebalance,
      freeRename: typeof d.freeRename === 'boolean' ? d.freeRename : true,
      coins,
      refineTickets,
      dyes,
      login,
      bets,
      maxHorses,
      team,
      daily,
      tasks,
      stats,
      ...profileWithAptFrames(d, rescaled),
      savedAt,
    },
    migrated: isPreV4, // only the v3→v4 stat change warrants the one-time notice
  };
}

function loadKey(key: string): { data: SaveData; migrated: boolean } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { data: freshSave(), migrated: false };
    return migrate(JSON.parse(raw)) ?? { data: freshSave(), migrated: false };
  } catch {
    return { data: freshSave(), migrated: false };
  }
}

function load(): { data: SaveData; migrated: boolean } {
  return loadKey(activeKey);
}

function persist(data: SaveData): void {
  try {
    localStorage.setItem(activeKey, JSON.stringify(data));
  } catch {
    // storage full / unavailable — keep running with in-memory state
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type SpawnedPart = { id: string; isNew: boolean };
// 草むらの結果：集まったパーツと、そのまま仲間になったウマ。
// ボックスが満杯のときは召喚できない（horse は null にはならず、spawn 自体が失敗する）。
export type SpawnResult = { parts: SpawnedPart[]; horse: Horse; energyLeft: number } | null;

type Store = SaveData & {
  migrated: boolean;
  /** レース（1人でレース／グランプリ）の進行中か。賭け金を預けたまま他のタブへ
   *  移動してコインが消えるのを防ぐため、進行中はタブ移動を止める。保存しない。 */
  raceBusy: boolean;
  setRaceBusy: (v: boolean) => void; // true once, right after a save upgrade (for a one-time notice)
  clearMigrated: () => void;
  /** Replace the entire save (used when loading a cloud save on login). */
  hydrate: (data: SaveData) => void;
  /** Re-read state from an account's local slot (null = guest). Used on logout. */
  reloadFromKey: (uid: string | null) => void;
  // バックアップの書き出し／読み込み（exportSave / importSave）は撤去した。
  // 手元でセーブを編集して戻せると、コインもウマも好きなだけ増やせてしまうため。
  // 端末が壊れたときの備えはクラウド同期（アカウント作成）が担う。
  doSpawn: (rng?: () => number) => SpawnResult;
  addHorse: (h: Omit<Horse, 'id' | 'createdAt' | 'stats' | 'free'>, stats: Stats, free?: boolean) => Horse | null;
  updateHorse: (id: string, patch: Partial<Pick<Horse, 'name' | 'colors' | 'decos'>>) => void;
  renameHorse: (id: string, name: string) => void;
  freeRename: boolean;
  /** Consume the one free rename (初回改名は無料). */
  consumeFreeRename: () => void;
  removeHorse: (id: string) => void;
  /** One-time free stat re-allocation after the v4 migration. Returns success. */
  rebalanceHorse: (id: string, stats: Stats) => boolean;
  addTrophies: (t: Trophy[]) => void;
  addBadges: (b: Badge[]) => void;
  grantItems: (items: TrainingItem[]) => void;
  unlockGp: (patch: { g2?: boolean; g1?: boolean }) => void;
  /** Consume item at index and raise `target` on the horse. Returns success. */
  /** 上がったポイント数（0＝失敗）。火曜はまぐれで2になることがある。 */
  trainHorse: (horseId: string, itemIndex: number, target: StatKey) => number;
  recordRace: (courseId: string, mode: 30 | 60, rank: number, time: number) => void;
  /** Record a finished single race: updates best time, win streak, and awards
   *  badges (ACCOUNT.md §2). Returns the newly-earned badges (for the cut-in). */
  finishNormalRace: (args: {
    horseId: string;
    courseId: string;
    mode: 30 | 60;
    rank: number;
    time: number;
    isJumpCourse: boolean;
    flawless: boolean;
  }) => Badge[];
  // Coin economy (RACE_V4 §4).
  addCoins: (n: number) => void;
  /** Spend coins if affordable. Returns true on success. */
  spendCoins: (n: number) => boolean;
  /** Record a settled bet (payout already added via addCoins by the caller). */
  recordBet: (bet: BetRecord) => void;
  /** ログインボーナス（曜日制）。受け取れたらその中身を返す。今日ぶん受け取り済みなら null。 */
  claimLoginBonus: () => LoginReward | null;
  /** 染料をウマに使う。色の属する枠（からだ/たてがみ/ひづめ）が塗り替わる。 */
  /** 染料で色を塗る。slot を渡すとその部位に塗る（省略時は染料の元の部位）。
   *  色は3部位のどこにでも塗れる ＝ 手に入れた染料の使い道が狭まらない。 */
  useDye: (horseId: string, colorId: string, slot?: ColorSlot) => boolean;
  /** Buy an extra grass charge (300, repeatable). Returns true on success. */
  buyOkawari: () => boolean;
  /** Begin a grand-prix attempt, consuming one of the day's plays (max
   *  GP_DAILY_LIMIT). Returns false when the daily limit is reached. */
  startGpAttempt: (grade: 'g1' | 'g2' | 'g3') => boolean;
  // Coin-earning tasks (改修：タスク).
  /** Count one finished race toward the task (also banks a reward every N). Call
   *  ONLY on the result screen so it can't be farmed by bailing out mid-race. */
  finishRaceTask: () => void;
  /** Claim the whole task bank at once. Returns the coins granted (0 if empty). */
  claimTaskBank: () => number;
  /** Fold one race's betting outcome into the lifetime profile stats: best single
   *  payout (最大獲得賞金), best single-race 回収率 = payout ÷ staked (最高回収率),
   *  and the highest winning odds (最大オッズ). */
  recordBetStats: (r: { placed: number; staked: number; payout: number; wonOdds: number }) => void;
  /** 通算の獲得賞金に足す（レースの賞金・馬券の払戻・対戦の賞金すべて）。 */
  addEarned: (n: number) => void;
  /** Merge external maxima into the profile stats (raise-only). Used to backfill
   *  from the account's ranking history (best odds/payout) on sign-in. */
  foldStats: (p: Partial<PlayerStats>) => void;
  // Profile (avatar horse + trophy shelf).
  setAvatarHorse: (id: string | null) => void;
  setDisplayTrophies: (ranks: number[]) => void;
  // メールボックス＆アイコンフレーム（殿堂の上位3名へ毎月配布）。
  /** 受信箱にフレームを配布（同一 period+種別は重複させない）。 */
  receiveFrames: (awards: FrameAward[]) => void;
  /** 「総獲得賞金」を後から足したことへのお詫びを一度だけ受信箱に入れる。 */
  receiveNoticeOnce: (id: string, title: string, body: string) => void;
  markMailRead: (id: string) => void;
  markAllMailRead: () => void;
  /** アイコンに装備するフレーム（殿堂 or 連勝、null で外す）。 */
  /** 週末のボックスを1つ受け取る（同じ種類は1行にまとめて個数を増やす）。 */
  receiveBox: (kind: BoxKind) => void;
  /** 受信箱のボックスを1つ開ける。中身はその場で反映して結果を返す。 */
  openWeekendBox: (kind: BoxKind) => BoxResult | null;
  /** 称号の初ゲットお知らせを出しおわった印をつける。 */
  markTitlesSeen: (ids: string[]) => void;
  /** 適性フレームを受け取る。受け取り待ちに無ければ false。 */
  claimAptFrame: (grade: AptGrade) => boolean;
  equipFrame: (frame: EquipFrame | null) => void;
  /** 称号を付け替える（未達成のIDは無視される）。 */
  equipTitle: (id: string | null) => void;
  /** カスタムベットの設定を保存する（100きざみ・整数の倍率に丸めて入る）。 */
  setCustomBet: (spec: { amount: number; minOdds: number; maxOdds: number } | null) => void;
  // スペシャルタスク（連勝チャレンジ）.
  /** 1人でレース・馬券ありの結果を折り込む。win=払戻>賭け。負けで連勝リセット。
   *  馬券なし／コース選択レースでは呼ばない（何も変えない）。 */
  recordSoloStreak: (win: boolean) => void;
  /** 受け取り待ちの連勝フレームを1つ受け取る。受け取った Lv を返す（無ければ0）。 */
  claimStreakFrame: () => number;
  /** 勝利条件変更（払戻1.5倍以上）に伴い、連勝の記録を一度だけリセットする。旧条件で
   *  貯めた連勝・受け取り済みLvを 0 に戻し、装備中の連勝フレームも外す。適用済みなら何もしない。
   *  戻り値：実際にリセットしたら true。 */
  resetStreakForRuleChange: () => boolean;
  // In-progress race, kept in the save so it resumes across reloads (改修：レース継続).
  raceSession: RaceSession | null;
  setRaceSession: (s: RaceSession | null) => void;
  patchRaceSession: (patch: Partial<RaceSession>) => void;
  // 対戦（勝ち抜きトーナメント・1日2回開催）.
  arena: ArenaState | null;
  /** Manually enter the current period (spends the fee). Returns false if not allowed. */
  arenaEnterManual: (entry: ArenaEntry) => boolean;
  /** Enable/disable standing (auto) entry with a chosen horse (資金がある限り毎回参加). */
  arenaSetAuto: (horseId: string | null) => void;
  /** Advance the arena to period `cur`: resolve closed entries, run auto catch-up,
   *  award prizes, and append results. `pool` seeds opponents (best-effort). */
  arenaSync: (cur: number, pool: ArenaHorseSnapshot[]) => void;
  /** Mark a result (by period) as watched — clears its NEW badge. */
  arenaMarkSeen: (period: number) => void;
  /** Adopt an entry the cloud DB says we made (no fee) — reconciles an app-kill
   *  that lost the local entry, so the player can't enter the same period twice. */
  arenaAdoptPending: (entry: ArenaEntry) => void;
  /** 締め切り前ならエントリー中のウマを差し替える（参加費は取らない）。
   *  シード＝抽選内容は据え置きなので、差し替えで組み合わせを引き直すことはできない。 */
  arenaSwapPending: (period: number, horseId: string, snapshot: ArenaHorseSnapshot) => boolean;
  // 牧場（放置収入・引退）.
  farmClaimedAt: number;
  /** Collect the accrued idle income and reset the anchor. Returns coins granted. */
  claimFarm: () => number;
  /** Retire a horse for coins (and free its stable slot). Returns coins granted. */
  retireHorse: (id: string) => number;
  /** お気に入りロックを切り替える。ロック中のウマは引退できない。戻り値は切替後の状態。 */
  toggleLock: (id: string) => boolean;
  /** 厳選：選んだ枠だけを振り直す（権利を1消費）。既存ウマのみ。成功したら true。 */
  rerollHorse: (id: string, slots: string[]) => boolean;
  /** 厳選を確定する。回数が余っていても、もう振り直せなくなる。 */
  /** 複数のウマをまとめて引退させる。ロック中のウマは飛ばす。受け取った合計コインを返す。 */
  retireMany: (ids: string[]) => { coins: number; retired: number; skipped: number };
  /** チーム（出走・牧場収入の対象／最大 TEAM_SIZE 頭）に入れる。入れられなければ false。 */
  joinTeam: (id: string) => boolean;
  /** チームから外してボックスに戻す。 */
  leaveTeam: (id: string) => boolean;
  /** チーム内の並び順を1つ動かす（-1=前へ / +1=後ろへ）。 */
  reorderTeam: (id: string, dir: -1 | 1) => boolean;
  resetAll: () => void;
};

// 新しく手に入れたウマをチームへ自動で入れるのは「チームが空のとき」だけ。
// ウマ0頭のプレイヤーがレースに出られなくならないための救済であって、草むらで
// 厳選しているときに空き枠を勝手に埋めないようにする（チーム編成は基本ぜんぶ手動）。
function autoJoinTeam(horse: Horse, team: string[], horses: Horse[]): string[] {
  if (team.length > 0) return team;
  return addToTeam(horse, team, horses, TEAM_SIZE);
}

export const useStore = create<Store>((set, get) => {
  const { data: initial, migrated } = load();
  if (migrated) persist(initial); // save the upgraded shape immediately

  const commit = (partial: Partial<SaveData>) => {
    // ウマの顔ぶれが変わったら、適性チャレンジの達成を確かめる。
    // 「6コース全部が同じ等級」のウマを持った瞬間に “受け取り待ち” になる。
    // 実際に受け取るのは連勝チャレンジと同じくタスク画面（claimAptFrame）。
    // 待ちに入った時点で記録は等級だけなので、あとで引退させても厳選し直しても消えない。
    if (partial.horses) {
      const owned = get().aptFrames ?? [];
      const pending = get().aptPending ?? [];
      const add = newlyEarned(partial.horses, mergeAptFrames(owned, pending));
      if (add.length > 0) partial = { ...partial, aptPending: mergeAptFrames(pending, add) };
    }
    const savedAt = Date.now();
    const next = { ...get(), ...partial, savedAt } as Store;
    const data: SaveData = {
      version: 6,
      earnedNoticeDue: next.earnedNoticeDue,
      owned: next.owned,
      horses: next.horses,
      energy: next.energy,
      energyUpdatedAt: next.energyUpdatedAt,
      trophies: next.trophies,
      badges: next.badges,
      winStreaks: next.winStreaks,
      soloStreak: next.soloStreak ?? 0,
      streakBest: next.streakBest ?? 0,
      streakClaimed: next.streakClaimed ?? 0,
      streakRuleResetDone: next.streakRuleResetDone ?? false,
      items: next.items,
      raceRecords: next.raceRecords,
      gpUnlocked: next.gpUnlocked,
      freeRebalance: next.freeRebalance,
      freeRename: next.freeRename ?? true,
      coins: next.coins,
      refineTickets: next.refineTickets ?? 0,
      dyes: next.dyes ?? {},
      login: next.login,
      bets: next.bets,
      maxHorses: next.maxHorses,
      team: next.team ?? [],
      daily: next.daily,
      tasks: next.tasks,
      stats: next.stats,
      avatarHorseId: next.avatarHorseId,
      displayTrophies: next.displayTrophies,
      mailbox: next.mailbox ?? [],
      equippedFrame: next.equippedFrame ?? null,
      aptFrames: next.aptFrames ?? [],
      aptPending: next.aptPending ?? [],
      boxFrames: next.boxFrames ?? [],
      boxTitles: next.boxTitles ?? [],
      seenTitles: next.seenTitles ?? [],
      equippedTitle: next.equippedTitle ?? null,
      customBet: next.customBet ?? null,
      raceSession: next.raceSession ?? null,
      arena: next.arena ?? freshArena(),
      farmClaimedAt: next.farmClaimedAt ?? trustedNow(),
      savedAt,
    };
    persist(data);
    set({ ...(partial as Partial<Store>), savedAt });
  };

  return {
    ...initial,
    refineTickets: initial.refineTickets ?? 0,
    dyes: initial.dyes ?? {},
    raceSession: initial.raceSession ?? null,
    arena: initial.arena ?? freshArena(),
    farmClaimedAt: initial.farmClaimedAt ?? trustedNow(),
    freeRename: initial.freeRename ?? true,
    soloStreak: initial.soloStreak ?? 0,
    streakBest: initial.streakBest ?? 0,
    streakClaimed: initial.streakClaimed ?? 0,
    streakRuleResetDone: initial.streakRuleResetDone ?? false,
    team: initial.team ?? [],
    migrated,
    raceBusy: false,
    setRaceBusy: (v) => set({ raceBusy: v }),
    clearMigrated: () => set({ migrated: false }),

    hydrate: (data) => {
      persist(data); // keep cloud's savedAt as-is (do not bump)
      set({ ...data, migrated: false });
    },

    reloadFromKey: (uid) => {
      bindSaveKey(uid);
      const { data } = loadKey(activeKey);
      set({ ...data, migrated: false });
    },

    doSpawn: (rng = Math.random) => {
      // ストックの回復時間も trustedNow()。Date.now() だと端末の時計を進めるだけで
      // 何度でも引けてしまう（＝パーツもウマも無限に増やせる）。
      const now = trustedNow();
      // ボックスが満杯なら召喚できない（ストックも消費しない）。
      if (get().horses.length >= get().maxHorses) return null;
      // 月曜（草むらデー）は回復間隔が半分になる。
      const spent = spendEnergy({ energy: get().energy, energyUpdatedAt: get().energyUpdatedAt }, now, grassRegenMs(now, ENERGY_REGEN_MS));
      if (!spent) return null;

      // 1回の草むらでは同じ部位（body/mane/hoof の色・head/face/back/tail の飾り）を
      // 重複させない。→ 飛び出してくるウマは受け取ったパーツを漏れなく身に着けた姿になり、
      // 「着けていないのに入手できる」違和感を解消する。
      // 木曜（図鑑デー）は SR が2倍出やすく、未所持のパーツが優先して出る。
      const ids = gachaSpawn(rng, allParts, (e) => slotOf(e.id), {
        srMul: srRateMul(now),
        owned: prefersUnowned(now) ? get().owned : undefined,
      });
      const owned = { ...get().owned };
      const parts: SpawnedPart[] = ids.map((id) => {
        const isNew = !owned[id];
        owned[id] = (owned[id] ?? 0) + 1;
        return { id, isNew };
      });
      // Grass task (改修：タスク): every 10 draws banks a reward.
      const t = get().tasks;
      const grassSpawns = t.grassSpawns + 1;
      const gCycles = cyclesOf(grassSpawns, GRASS_TASK_EVERY);
      const tasks = {
        ...t,
        grassSpawns,
        grassBanked: Math.max(t.grassBanked, gCycles),
        bank: t.bank + newlyBanked(grassSpawns, t.grassBanked, GRASS_TASK_EVERY, GRASS_TASK_REWARD),
      };
      // 現れたウマがそのままボックスへ。姿は引いたパーツどおり（色は生まれつきで固定、
      // 飾りはあとから着せ替え可）。ステータスは合計40のランダム配分。
      const wild = makeWildHorse(ids, rng);
      const id = newId();
      const horse: Horse = {
        name: wild.name,
        colors: wild.colors,
        decos: wild.decos,
        stats: wild.stats,
        id,
        createdAt: now,
        gen2: true,
        skill: rollSkill(mulberry32(hashString(`skill:${id}`))).id,
        apt: rollAptitude(mulberry32(hashString(`apt:${id}`))),
      };
      const horses = [...get().horses, horse];
      const team = autoJoinTeam(horse, get().team ?? [], horses);
      // 「何頭見つけたか」の通算。引退させても減らない（称号の条件に使う）。
      const st = get().stats;
      const stats = { ...st, horsesFound: (st.horsesFound ?? 0) + 1 };
      commit({ owned, energy: spent.energy, energyUpdatedAt: spent.energyUpdatedAt, tasks, horses, team, stats });
      return { parts, horse, energyLeft: spent.energy };
    },

    addHorse: (h, stats, free) => {
      const s = get();
      if (s.horses.length >= s.maxHorses) return null;
      const id = newId();
      // アップデート後に生まれたウマは「新世代」。既存ウマには付かないので、
      // 既存ウマの強さ・引退額・チーム編成は一切変わらない。
      // 生まれた時点で固有スキルを1つ確定で持つ（「1回目の枠は確定」）。
      const horse: Horse = {
        ...h, id, stats, createdAt: Date.now(), gen2: true,
        skill: rollSkill(mulberry32(hashString(`skill:${id}`))).id,
        apt: rollAptitude(mulberry32(hashString(`apt:${id}`))),
        ...(free ? { free: true } : {}),
      };
      const horses = [...s.horses, horse];
      const team = autoJoinTeam(horse, s.team ?? [], horses);
      commit({ horses, team });
      return horse;
    },

    updateHorse: (id, patch) => {
      commit({ horses: get().horses.map((h) => (h.id === id ? { ...h, ...patch } : h)) });
    },

    renameHorse: (id, name) => {
      commit({ horses: get().horses.map((h) => (h.id === id ? { ...h, name } : h)) });
    },

    consumeFreeRename: () => {
      if (get().freeRename) commit({ freeRename: false });
    },

    removeHorse: (id) => {
      commit({
        horses: get().horses.filter((h) => h.id !== id),
        trophies: get().trophies.filter((t) => t.horseId !== id),
        badges: get().badges.filter((b) => b.horseId !== id),
      });
    },

    rebalanceHorse: (id, stats) => {
      if (!get().freeRebalance) return false;
      const exists = get().horses.some((h) => h.id === id);
      if (!exists) return false;
      commit({
        horses: get().horses.map((h) => (h.id === id ? { ...h, stats } : h)),
        freeRebalance: false, // consume the one-time free rebalance
      });
      return true;
    },

    addTrophies: (t) => {
      if (t.length === 0) return;
      commit({ trophies: [...get().trophies, ...t] });
    },

    addBadges: (b) => {
      if (b.length === 0) return;
      commit({ badges: [...get().badges, ...b] });
    },

    grantItems: (items) => {
      if (items.length === 0) return;
      commit({ items: [...get().items, ...items] });
    },

    unlockGp: (patch) => {
      const cur = get().gpUnlocked;
      const next = { g2: cur.g2 || !!patch.g2, g1: cur.g1 || !!patch.g1 };
      if (next.g2 === cur.g2 && next.g1 === cur.g1) return;
      commit({ gpUnlocked: next });
    },

    trainHorse: (horseId, itemIndex, target) => {
      const horse = get().horses.find((h) => h.id === horseId);
      const item = get().items[itemIndex];
      if (!horse || !item) return 0;
      if (item.kind === 'stat' && item.stat !== target) return 0; // stat items are fixed
      // 火曜（トレーニングデー）はまぐれで2つ上がる。合計48は超えない（room で切る）。
      const gain = trainingGain(trustedNow(), Math.random, trainingRoom(horse.stats, target));
      const next = applyTraining(horse.stats, target, gain);
      if (!next) return 0; // capped — item is NOT consumed
      const items = get().items.slice();
      items.splice(itemIndex, 1);
      commit({
        horses: get().horses.map((h) => (h.id === horseId ? { ...h, stats: next } : h)),
        items,
      });
      return next[target] - horse.stats[target];
    },

    recordRace: (courseId, mode, rank, time) => {
      const records = get().raceRecords.slice();
      const i = records.findIndex((r) => r.courseId === courseId && r.mode === mode);
      if (i < 0) {
        records.push({ courseId, mode, bestRank: rank, bestTime: time });
      } else {
        const cur = records[i];
        records[i] = {
          ...cur,
          bestRank: Math.min(cur.bestRank, rank),
          bestTime: Math.min(cur.bestTime, time),
        };
      }
      commit({ raceRecords: records });
    },

    finishNormalRace: ({ horseId, courseId, mode, rank, time, isJumpCourse, flawless }) => {
      const s = get();
      const prevBest = s.raceRecords.find((r) => r.courseId === courseId && r.mode === mode);
      const isNewRecord = !prevBest || time < prevBest.bestTime;

      const { badges: awarded, newStreak } = evaluateBadges(
        { horseId, rank, courseId, isJumpCourse, flawless, isNewRecord },
        {
          existing: s.badges.filter((b) => b.horseId === horseId),
          priorStreak: s.winStreaks[horseId] ?? 0,
          allCourseIds: COURSES.map((c) => c.id),
        },
      );

      // Update best time (reuse the same rule as recordRace).
      const records = s.raceRecords.slice();
      const i = records.findIndex((r) => r.courseId === courseId && r.mode === mode);
      if (i < 0) records.push({ courseId, mode, bestRank: rank, bestTime: time });
      else records[i] = { ...records[i], bestRank: Math.min(records[i].bestRank, rank), bestTime: Math.min(records[i].bestTime, time) };

      commit({
        raceRecords: records,
        badges: [...s.badges, ...awarded],
        winStreaks: { ...s.winStreaks, [horseId]: newStreak },
      });
      return awarded;
    },

    addCoins: (n) => {
      if (!n) return;
      commit({ coins: Math.max(0, get().coins + n) });
    },

    spendCoins: (n) => {
      if (get().coins < n) return false;
      commit({ coins: get().coins - n });
      return true;
    },

    recordBet: (bet) => {
      commit({ bets: [bet, ...get().bets].slice(0, BETS_CAP) });
    },

    claimLoginBonus: () => {
      const s = get();
      // 時計いじり対策：日付は必ず trustedNow() 由来（巻き戻しは単調フロア、
      // 進めるのはサーバ時刻アンカーで無効化される）。
      const now = trustedNow();
      if (!canClaim(s.login?.day, now)) return null;
      const reward = rewardForDow(dowOf(now));
      const patch: Partial<SaveData> = { login: { day: loginDayKey(now), at: now } };
      if (reward.kind === 'coins') {
        patch.coins = s.coins + reward.amount;
      } else if (reward.kind === 'ticket') {
        patch.refineTickets = (s.refineTickets ?? 0) + reward.amount;
      } else {
        const colorId = rollDye(mulberry32((Math.random() * 2 ** 31) >>> 0));
        patch.dyes = { ...(s.dyes ?? {}), [colorId]: ((s.dyes ?? {})[colorId] ?? 0) + 1 };
        reward.colorId = colorId;
      }
      commit(patch);
      return reward;
    },

    useDye: (horseId, colorId, slotArg) => {
      const s = get();
      const have = (s.dyes ?? {})[colorId] ?? 0;
      if (have <= 0) return false;
      const slot = slotArg ?? colorSlotById[colorId];
      if (!slot) return false; // 色パーツではない
      const horse = s.horses.find((h) => h.id === horseId);
      if (!horse) return false;
      if (horse.colors[slot] === colorId) return false; // すでにその色（無駄づかい防止）
      const dyes = { ...(s.dyes ?? {}) };
      if (have <= 1) delete dyes[colorId];
      else dyes[colorId] = have - 1;
      commit({
        dyes,
        horses: s.horses.map((h) => (h.id === horseId ? { ...h, colors: { ...h.colors, [slot]: colorId } } : h)),
      });
      return true;
    },

    buyOkawari: () => {
      // Repeatable now: buy an extra grass charge any time coins allow and the
      // stock isn't already full (no once-per-day cap).
      const s = get();
      const today = dayKey();
      const daily = s.daily.day === today ? s.daily : freshDaily();
      const cost = okawariCost(trustedNow(), GRASS_OKAWARI_COST); // 草むらデーは半額
      if (s.coins < cost || s.energy >= ENERGY_CAP) return false;
      commit({
        coins: s.coins - cost,
        energy: Math.min(ENERGY_CAP, s.energy + 1),
        daily: { ...daily, okawari: daily.okawari + 1 },
      });
      return true;
    },

    startGpAttempt: (grade) => {
      // 1日の回数制限は G1 のみ（G2/G3 は無制限）。予選＋本戦で1回。
      if (grade !== 'g1') return true;
      const s = get();
      const today = dayKey();
      const daily = s.daily.day === today ? s.daily : freshDaily();
      // 金曜（グランプリデー）は1日の挑戦回数が倍（3回 → 6回）。
      if (daily.gp >= g1Attempts(trustedNow(), GP_DAILY_LIMIT)) {
        if (s.daily.day !== today) commit({ daily });
        return false;
      }
      commit({ daily: { ...daily, gp: daily.gp + 1 } });
      return true;
    },

    finishRaceTask: () => {
      const t = get().tasks;
      const racesFinished = t.racesFinished + 1;
      const cycles = cyclesOf(racesFinished, RACE_TASK_EVERY);
      commit({
        tasks: {
          ...t,
          racesFinished,
          raceBanked: Math.max(t.raceBanked, cycles),
          bank: t.bank + newlyBanked(racesFinished, t.raceBanked, RACE_TASK_EVERY, RACE_TASK_REWARD),
        },
      });
    },

    claimTaskBank: () => {
      const s = get();
      const coins = s.tasks.bank;
      if (coins <= 0) return 0;
      commit({ coins: s.coins + coins, tasks: { ...s.tasks, bank: 0 } });
      return coins;
    },

    recordBetStats: ({ placed, staked, payout, wonOdds }) => {
      if (placed <= 0 && payout <= 0) return;
      const s = get().stats;
      const recovery = staked > 0 ? Math.round((payout / staked) * 100) : 0;
      commit({
        stats: {
          // ...s を必ず先に置く。ここで作り直すと、あとから足した項目
          //（horsesFound など）がレースのたびに消える＝称号が勝手に外れる。
          ...s,
          betsPlaced: s.betsPlaced + Math.max(0, placed),
          maxPayout: Math.max(s.maxPayout, payout),
          maxRecoveryPct: Math.max(s.maxRecoveryPct, recovery),
          maxOdds: Math.max(s.maxOdds, wonOdds),
          totalEarned: (s.totalEarned ?? 0) + Math.max(0, payout),
        },
      });
    },

    addEarned: (n) => {
      if (!(n > 0)) return;
      const s = get().stats;
      commit({ stats: { ...s, totalEarned: (s.totalEarned ?? 0) + n } });
    },

    foldStats: (p) => {
      const s = get().stats;
      const next: PlayerStats = {
        ...s, // 同上：作り直さず、上書きするぶんだけを重ねる
        betsPlaced: Math.max(s.betsPlaced, p.betsPlaced ?? 0),
        maxPayout: Math.max(s.maxPayout, p.maxPayout ?? 0),
        maxRecoveryPct: Math.max(s.maxRecoveryPct, p.maxRecoveryPct ?? 0),
        maxOdds: Math.max(s.maxOdds, p.maxOdds ?? 0),
        totalEarned: Math.max(s.totalEarned ?? 0, p.totalEarned ?? 0),
        horsesFound: Math.max(s.horsesFound ?? 0, p.horsesFound ?? 0),
        arenaWins: Math.max(s.arenaWins ?? 0, p.arenaWins ?? 0),
      };
      if (
        next.betsPlaced !== s.betsPlaced ||
        next.maxPayout !== s.maxPayout ||
        next.maxRecoveryPct !== s.maxRecoveryPct ||
        next.maxOdds !== s.maxOdds ||
        next.totalEarned !== (s.totalEarned ?? 0) ||
        next.horsesFound !== (s.horsesFound ?? 0) ||
        next.arenaWins !== (s.arenaWins ?? 0)
      ) {
        commit({ stats: next });
      }
    },

    setAvatarHorse: (id) => commit({ avatarHorseId: id }),
    setDisplayTrophies: (ranks) =>
      commit({
        displayTrophies: ranks.filter((n) => n === 1 || n === 2 || n === 3).slice(0, 5),
      }),

    receiveFrames: (awards) => {
      const s = get();
      const box = s.mailbox ?? [];
      const have = new Set(box.map((m) => m.id));
      const add: MailItem[] = [];
      for (const a of awards) {
        const id = `frame-${a.period}-${a.metric}`;
        if (have.has(id)) continue;
        have.add(id);
        add.push({ id, at: Date.now(), read: false, kind: 'frame', frame: a });
      }
      if (add.length) commit({ mailbox: [...add, ...box] });
    },
    receiveNoticeOnce: (id, title, body) => {
      const box = get().mailbox ?? [];
      if (box.some((m) => m.id === id)) return;
      commit({ mailbox: [{ id, at: Date.now(), read: false, kind: 'notice', title, body }, ...box] });
    },
    markMailRead: (id) => {
      const box = get().mailbox ?? [];
      commit({ mailbox: box.map((m) => (m.id === id ? { ...m, read: true } : m)) });
    },
    markAllMailRead: () => {
      const box = get().mailbox ?? [];
      if (box.some((m) => !m.read)) commit({ mailbox: box.map((m) => ({ ...m, read: true })) });
    },
    // 同じ種類は1行のまま個数だけ増える（×2 → ×4 …）。土と日は別の箱なので別の行。
    receiveBox: (kind) => {
      commit({ mailbox: stackBox(get().mailbox ?? [], kind, Date.now()) });
    },

    openWeekendBox: (kind) => {
      const s0 = get();
      const nextMail = takeBox(s0.mailbox ?? [], kind);
      if (!nextMail) return null; // 持っていない

      const res = rollBox(kind, Math.random, {
        frame: (s0.boxFrames ?? []).includes(kind),
        title: (s0.boxTitles ?? []).includes(kind),
      });

      const patch: Partial<SaveData> = { mailbox: nextMail };
      const r = res.reward;
      if (r.type === 'coins') {
        patch.coins = s0.coins + r.amount;
        patch.stats = { ...s0.stats, totalEarned: (s0.stats.totalEarned ?? 0) + r.amount };
      } else if (r.type === 'ticket') {
        patch.refineTickets = (s0.refineTickets ?? 0) + r.amount;
      } else if (r.type === 'item') {
        const add: TrainingItem[] = Array.from({ length: r.amount }, () => ({ kind: 'any' }));
        patch.items = [...s0.items, ...add];
      } else if (r.type === 'dye') {
        const colorId = rollDye(mulberry32((Math.random() * 2 ** 31) >>> 0));
        patch.dyes = { ...(s0.dyes ?? {}), [colorId]: ((s0.dyes ?? {})[colorId] ?? 0) + 1 };
      } else if (r.type === 'frame') {
        patch.boxFrames = [...(s0.boxFrames ?? []), kind];
      } else if (r.type === 'title') {
        patch.boxTitles = [...(s0.boxTitles ?? []), kind];
      }
      commit(patch);
      return res;
    },

    // 適性フレームを受け取る（タスク画面のボタン）。受け取り待ちから所持へ移す。
    claimAptFrame: (grade) => {
      const pending = get().aptPending ?? [];
      if (!pending.includes(grade)) return false;
      commit({
        aptFrames: mergeAptFrames(get().aptFrames ?? [], [grade]),
        aptPending: pending.filter((g) => g !== grade),
      });
      return true;
    },

    // 称号の「初ゲット」お知らせを出しおわった印。出した分だけ足しこむ。
    markTitlesSeen: (ids) => {
      const seen = get().seenTitles ?? [];
      const add = ids.filter((id) => !seen.includes(id));
      if (add.length === 0) return;
      commit({ seenTitles: [...seen, ...add] });
    },

    equipFrame: (frame) => commit({ equippedFrame: frame }),
    equipTitle: (id) => commit({ equippedTitle: id }),
    setCustomBet: (spec) => commit({ customBet: spec ? normalizeCustomBet(spec) : null }),

    recordSoloStreak: (win) => {
      const s = get();
      const cur = { soloStreak: s.soloStreak ?? 0, streakBest: s.streakBest ?? 0, streakClaimed: s.streakClaimed ?? 0 };
      const next = foldRace(cur, win);
      commit({ soloStreak: next.soloStreak, streakBest: next.streakBest });
    },

    claimStreakFrame: () => {
      const s = get();
      const cur = { soloStreak: s.soloStreak ?? 0, streakBest: s.streakBest ?? 0, streakClaimed: s.streakClaimed ?? 0 };
      const level = cur.streakClaimed + 1;
      if (level > achievedLevel(cur) || level > STREAK_MAX) return 0; // 受け取り待ちなし
      commit({ streakClaimed: level });
      return level;
    },

    resetStreakForRuleChange: () => {
      const s = get();
      if (s.streakRuleResetDone) return false; // 二重適用しない（一度だけ）
      const wasStreakFrame = !!s.equippedFrame && (s.equippedFrame as { kind?: string }).kind === 'streak';
      commit({
        soloStreak: 0,
        streakBest: 0,
        streakClaimed: 0,
        streakRuleResetDone: true,
        ...(wasStreakFrame ? { equippedFrame: null } : {}),
      });
      return true;
    },

    setRaceSession: (s) => commit({ raceSession: s }),
    patchRaceSession: (patch) => {
      const cur = get().raceSession;
      if (!cur) return;
      // Same-kind patch; the spread of a discriminated union needs a cast.
      commit({ raceSession: { ...cur, ...patch } as RaceSession });
    },

    arenaEnterManual: (entry) => {
      if (get().coins < ARENA_ENTRY_FEE) return false;
      const st = get().arena ?? freshArena();
      if (st.pending && st.pending.period >= entry.period) return false; // already entered
      if (st.lastPeriod != null && st.lastPeriod >= entry.period) return false;
      commit({
        coins: get().coins - ARENA_ENTRY_FEE,
        arena: { ...st, pending: entry, lastPeriod: entry.period },
      });
      return true;
    },

    arenaSetAuto: (horseId) => {
      const st = get().arena ?? freshArena();
      // Enabling starts from the current period (no retroactive back-entries):
      // bump lastPeriod to cur-1 so arenaSync then enters the current period.
      const cur = periodId();
      const lastPeriod = horseId ? Math.max(st.lastPeriod ?? cur - 1, cur - 1) : st.lastPeriod;
      commit({ arena: { ...st, auto: horseId ? { horseId } : null, lastPeriod } });
    },

    arenaSync: (cur, pool) => {
      const st = get().arena ?? freshArena();
      let coins = get().coins;
      let pending = st.pending;
      let lastPeriod = st.lastPeriod;
      let auto = st.auto;
      const results = st.results.slice();
      const horses = get().horses;

      // 賞金と一緒に厳選チケットも配る（優勝3・準優勝2・3位1）。
      let tickets = get().refineTickets ?? 0;
      let earned = 0; // このまとめて精算で得た賞金の合計
      let wins = 0; // このまとめて精算での優勝回数（通算カウンタに積む）
      const resolve = (entry: ArenaEntry) => {
        const r = runTournament(entry.snapshot, entry.seed, pool, ARENA_MODE, entry.period);
        coins += r.payout;
        earned += r.payout; // 通算の獲得賞金にも積む
        if (r.outcome === 'champion') wins += 1;
        tickets += arenaTickets(r.outcome, r.finalRank);
        results.unshift({ ...r, awarded: true, seen: false });
      };

      // 1) Resolve the pending entry once its period has closed.
      if (pending && pending.period < cur) {
        resolve(pending);
        pending = null;
      }

      // 2) Standing (auto) entry catch-up: enter each period since last, while funded.
      if (auto) {
        const horse = horses.find((h) => h.id === auto!.horseId);
        if (!horse) {
          auto = null; // entered horse is gone → turn auto off
        } else {
          const start = Math.max((lastPeriod ?? cur - 1) + 1, cur - ARENA_CATCHUP_MAX + 1);
          for (let p = start; p <= cur; p++) {
            if (lastPeriod != null && p <= lastPeriod) continue;
            if (pending && p === pending.period) continue; // already entered manually
            if (coins < ARENA_ENTRY_FEE) break;
            coins -= ARENA_ENTRY_FEE;
            const snap = playerSnapshot(
              horse.id, horse.name, horse.colors, horse.decos, horse.stats, styleFor(horse.id, horse.stats), null,
            );
            const entry: ArenaEntry = { period: p, seed: (Math.random() * 2 ** 31) >>> 0, horseId: horse.id, snapshot: snap };
            lastPeriod = p;
            if (p < cur) resolve(entry);
            else pending = entry;
          }
        }
      }

      const st0 = get().stats;
      commit({
        coins: Math.max(0, coins),
        refineTickets: tickets,
        stats: { ...st0, totalEarned: (st0.totalEarned ?? 0) + earned, arenaWins: (st0.arenaWins ?? 0) + wins },
        arena: { auto, pending, lastPeriod, results: results.slice(0, ARENA_RESULTS_CAP) },
      });
    },

    arenaMarkSeen: (period) => {
      const st = get().arena ?? freshArena();
      const results = st.results.map((r) => (r.period === period ? { ...r, seen: true } : r));
      commit({ arena: { ...st, results } });
    },

    arenaAdoptPending: (entry) => {
      const st = get().arena ?? freshArena();
      if (st.pending?.period === entry.period || (st.lastPeriod ?? -1) >= entry.period) return;
      commit({ arena: { ...st, pending: entry, lastPeriod: Math.max(st.lastPeriod ?? -1, entry.period) } });
    },

    arenaSwapPending: (period, horseId, snapshot) => {
      const st = get().arena ?? freshArena();
      const p = st.pending;
      if (!p || p.period !== period) return false; // 未エントリー／締め切り済みは差し替えできない
      // seed（＝抽選の中身）は据え置き。参加費も取らない、ウマだけを入れ替える。
      commit({ arena: { ...st, pending: { ...p, horseId, snapshot } } });
      return true;
    },

    claimFarm: () => {
      const s = get();
      // 牧場収入はチーム（最大 TEAM_SIZE 頭）だけが対象。既存ユーザーは team=所持ウマ全員
      // なので収入は従来と同一。以降に増やした新ウマは team に入るまで収入を生まない。
      const rate = farmRatePerHour(teamHorses(s.horses, s.team, TEAM_SIZE), s.trophies, s.badges);
      const now = trustedNow();
      const got = farmAccrued(s.farmClaimedAt ?? now, now, rate);
      if (got <= 0) return 0; // nothing yet — keep the anchor so fractions aren't lost
      commit({ coins: s.coins + got, farmClaimedAt: now });
      return got;
    },

    retireHorse: (id) => {
      const s = get();
      const horse = s.horses.find((h) => h.id === id);
      if (!horse) return 0;
      if (horse.locked) return 0; // お気に入りロック中は引退できない（誤タップ対策）
      const value = retireValueOf(horse, s.trophies, s.badges);
      commit({
        coins: s.coins + value,
        horses: s.horses.filter((h) => h.id !== id),
        team: removeFromTeam(id, s.team ?? []), // チームからも外す（幽霊エントリを残さない）
        trophies: s.trophies.filter((t) => t.horseId !== id),
        badges: s.badges.filter((b) => b.horseId !== id),
        avatarHorseId: s.avatarHorseId === id ? null : s.avatarHorseId,
      });
      return value;
    },

    rerollHorse: (id, slots) => {
      const s = get();
      const horse = s.horses.find((h) => h.id === id);
      // 旧厳選を使ったウマは「使い切り」扱い（中身はそのまま・導線を出さない）。
      if (!horse || !canRefine(horse)) return false;
      if (!slots || slots.length === 0) return false; // 更新する枠が無い
      if (refineState(horse).left <= 0) return false; // 3回を使い切っている
      if ((s.refineTickets ?? 0) < REFINE_TICKET_COST) return false; // チケットが無い
      const rng = mulberry32((Math.random() * 2 ** 31) >>> 0);
      const { skill, apt } = applyReroll(horse, slots, rng);
      commit({
        refineTickets: (s.refineTickets ?? 0) - REFINE_TICKET_COST,
        horses: s.horses.map((h) =>
          h.id === id ? { ...h, skill, apt, refineUsed: (h.refineUsed ?? 0) + 1 } : h,
        ),
      });
      return true;
    },

    retireMany: (ids) => {
      const s = get();
      const want = new Set(ids);
      // ロック中のウマは守る（誤操作でまとめて消えないように）。
      const targets = s.horses.filter((h) => want.has(h.id) && !h.locked);
      if (targets.length === 0) return { coins: 0, retired: 0, skipped: want.size };
      const gone = new Set(targets.map((h) => h.id));
      const coins = targets.reduce((n, h) => n + retireValueOf(h, s.trophies, s.badges), 0);
      commit({
        coins: s.coins + coins,
        horses: s.horses.filter((h) => !gone.has(h.id)),
        team: (s.team ?? []).filter((x) => !gone.has(x)),
        trophies: s.trophies.filter((t) => !gone.has(t.horseId)),
        badges: s.badges.filter((b) => !gone.has(b.horseId)),
        avatarHorseId: s.avatarHorseId && gone.has(s.avatarHorseId) ? null : s.avatarHorseId,
      });
      return { coins, retired: targets.length, skipped: want.size - targets.length };
    },

    toggleLock: (id) => {
      const s = get();
      const horse = s.horses.find((h) => h.id === id);
      if (!horse) return false;
      const next = !horse.locked;
      commit({ horses: s.horses.map((h) => (h.id === id ? { ...h, locked: next } : h)) });
      return next;
    },

    // --- チーム編成（出走・牧場収入の対象） --------------------------------
    joinTeam: (id) => {
      const s = get();
      const horse = s.horses.find((h) => h.id === id);
      if (!horse) return false;
      const next = addToTeam(horse, s.team ?? [], s.horses, TEAM_SIZE);
      if (next === (s.team ?? [])) return false;
      commit({ team: next });
      return true;
    },

    leaveTeam: (id) => {
      const s = get();
      const next = removeFromTeam(id, s.team ?? []);
      if (next.length === (s.team ?? []).length) return false;
      commit({ team: next });
      return true;
    },

    reorderTeam: (id, dir) => {
      const s = get();
      const next = moveInTeam(id, s.team ?? [], dir);
      if (next === (s.team ?? [])) return false;
      commit({ team: next });
      return true;
    },

    resetAll: () => commit({ ...freshSave() }),
  };
});

// Selector helpers -----------------------------------------------------------

export function isOwned(owned: Record<string, number>, id: string): boolean {
  return (owned[id] ?? 0) > 0;
}

export function trophyCount(trophies: Trophy[], horseId: string): number {
  return trophies.filter((t) => t.horseId === horseId).length;
}

export const COLOR_SLOTS_ORDER: ColorSlot[] = ['body', 'mane', 'hoof'];
export const DECO_SLOTS_ORDER: DecoSlot[] = ['head', 'face', 'back', 'tail'];
