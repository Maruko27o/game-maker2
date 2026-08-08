// Core data model. Kept intentionally small; race/vote features will extend
// Horse later, so avoid baking in stat values now (see CLAUDE.md §6, §10).

// ショップの動物（見た目だけの品）。data/shop.ts は何も import しないので、
// ここから参照しても循環しない。
import { isAnimalId, type AnimalId } from './data/shop';
export type { AnimalId };

export type Rarity = 'N' | 'R' | 'SR';
export type ColorSlot = 'body' | 'mane' | 'hoof';
export type DecoSlot = 'head' | 'face' | 'back' | 'tail';

export type ColorPart = {
  id: string;
  name: string;
  value: string; // paint applied to the CSS variable — a hex, or url(#grad…) for gradients
  rarity: Rarity;
  swatch?: string; // CSS-background equivalent for pickers (gradients can't use url() in CSS)
};

export type DecoPart = {
  id: string;
  name: string;
  slot: DecoSlot;
  rarity: Rarity;
  svg: string; // SVG snippet in the base 0 0 520 520 coordinate space
};

// Race ability stats (RACE.md §1). Each 0..10, sum 10..30 at birth, cap 48 via training.
export type StatKey = 'spd' | 'sta' | 'pwr' | 'jmp' | 'gut' | 'wit';
export type Stats = Record<StatKey, number>;

export const STAT_KEYS: StatKey[] = ['spd', 'sta', 'pwr', 'jmp', 'gut', 'wit'];
export const STAT_LABEL: Record<StatKey, string> = {
  spd: 'スピード',
  sta: 'スタミナ',
  pwr: 'パワー',
  jmp: '脚力',
  gut: '根性',
  wit: '賢さ',
};
export const STAT_CAP = 10; // per-stat max
export const STAT_TOTAL_CAP = 48; // sum hard cap via training

// Point-buy creation (RACE_V3 §3): the player distributes exactly 40 points,
// each stat 1..10. Training then raises the sum up to STAT_TOTAL_CAP (48).
export const STAT_ALLOC_TOTAL = 40;
export const STAT_ALLOC_MIN = 1;
export const STAT_ALLOC_MAX = STAT_CAP; // 10

// Running style (脚質, RACE_V2 §4.2). Fixed per horse (derived from stats+id).
export type RunStyle = 'nige' | 'senko' | 'sashi' | 'oikomi';
export const RUN_STYLE_LABEL: Record<RunStyle, string> = {
  nige: '逃げ',
  senko: '先行',
  sashi: '差し',
  oikomi: '追込',
};

export type Horse = {
  id: string;
  name: string;
  colors: Record<ColorSlot, string>; // parts.json color part ids
  decos: Partial<Record<DecoSlot, string>>; // parts.json deco part ids; unequipped = key absent
  stats: Stats;
  createdAt: number;
  free?: boolean; // 一体目(0→1)を無料で作った馬。引退時にベース分は付かない（make→retire farm防止）
  skill?: string; // 固有スキルのID（data/skills.ts）。未設定なら ウマID から決まる固定スキル。
  apt?: Record<string, string>; // コース適性（コースID -> 'C'|'B'|'A'|'S'）。未設定はIDから決まる固定値。
  rerollsUsed?: number; // 厳選（振り直し）を使った回数。権利は活躍に応じて最大10回。
  rerollDone?: boolean; // 厳選を「確定」した。回数が余っていても、もう振り直せない。
  refineUsed?: number; // チケット厳選を使った回数（0..REFINE_MAX）。旧 rerollsUsed とは別勘定。
  locked?: boolean; // お気に入りロック。引退（＝削除）を防ぐ。大切に育てたウマの誤タップ対策。
  trainMiss?: number; // 育成で連続して失敗した回数。成功すると0に戻る（連続失敗の救済に使う）。
  gen2?: boolean; // 個体値厳選アップデート後に生まれた「新世代」のウマ。既存ウマには付かない。
  //   調整期間中は チーム/レースに入れない（既存ウマが6頭に満たない分だけ埋められる）。
  //   引退額のベースも小さい（おかわり300→引退の荒稼ぎ防止）。
};

// The minimum a Horse needs to be *drawn*. Real Horse is assignable to this, and
// cosmetic/preview horses can be built without stats.
export type HorseLook = {
  name?: string;
  colors: Record<ColorSlot, string>;
  decos: Partial<Record<DecoSlot, string>>;
};

// A trophy earned by finishing top-3 in a GRAND PRIX final (ACCOUNT.md §2).
// Everyday single races award badges instead.
export type Trophy = {
  id: string;
  horseId: string;
  rank: 1 | 2 | 3;
  courseId: string;
  mode: 30 | 60;
  grade: 'normal' | 'gp';
  at: number;
};

// A badge earned in everyday single races (ACCOUNT.md §2). Belongs to a horse.
// Placing badges (badge_1st/2nd/3rd) stack; achievement badges are once-only.
export type Badge = {
  id: string; // BadgeId from data/badges.ts
  horseId: string;
  courseId?: string;
  at: number;
};

// A training item (RACE.md §9.2). Applied via logic/training.ts only.
export type TrainingItem = { kind: 'stat'; stat: StatKey } | { kind: 'any' };

// Best result per course+mode (RACE.md §11).
export type RaceRecord = {
  courseId: string;
  mode: 30 | 60;
  bestRank: number;
  bestTime: number; // seconds
};

// Betting market kinds (RACE_V4 §4 / 改修①).
export type BetKind = 'win' | 'place' | 'quinella' | 'wide' | 'trifecta';

// A settled bet, kept as recent history (RACE_V4 §4).
export type BetRecord = {
  courseId: string;
  kind: BetKind; // 単勝/複勝/馬連/ワイド/3連単
  picks: number[]; // gate numbers selected (for display)
  amount: number; // stake
  odds: number;
  won: boolean;
  payout: number; // coins returned (0 if lost)
  at: number; // ms
};

// Per-day counters (local date key), for the grass bonus and おかわり limits.
export type DailyCounters = { day: string; grassBonus: number; okawari: number; gp: number };

// Coin-earning tasks (改修：タスク). Progress that only advances when a race is
// actually finished (result screen reached), so it can't be farmed by bailing out.
// Designed to grow: add more fields/tasks over time.
export type TaskProgress = {
  racesFinished: number; // total races that reached the result screen (also 総レース回数)
  raceBanked: number; // race 10-cycles already credited to the reward bank
  grassSpawns: number; // total grass draws performed
  grassBanked: number; // grass 10-cycles already credited to the reward bank
  bank: number; // coins earned by tasks, waiting to be claimed together
};

// Lifetime player stats shown on the profile (改修：プロフィール実績).
export type PlayerStats = {
  betsPlaced: number; // total bet tickets purchased (to tell "no bets yet" from 0%)
  maxPayout: number; // best single-race total payout (最大獲得賞金)
  maxRecoveryPct: number; // best single-race 回収率 = payout ÷ staked, as a % (最高回収率)
  maxOdds: number; // highest odds of a winning bet (最大オッズ)
  /** 通算で手に入れた賞金の合計（1人でレース・グランプリ・対戦の払戻と賞金）。
   *  この項目より前から遊んでいる人には過去分の記録が残っていないので、
   *  分かっている値（対戦の払戻合計＋最大獲得賞金）で埋めてから積み上げる。 */
  totalEarned?: number;
  /** 草むらで見つけたウマの通算数（引退させても減らない）。マイウマの所持数とは別物。
   *  この項目より前から遊んでいる人は記録が無いので、今いるウマの数から積み上げる。 */
  horsesFound?: number;
  /** 対戦（トーナメント）の優勝回数。arena.results は40件で打ち切るので、
   *  100勝の称号を判定するには別に通算を持つ必要がある。 */
  arenaWins?: number;
};

// An in-progress race kept in the save so it survives tab switches / reloads and
// resumes where it left off (改修：レース継続). The race is deterministic, so only
// the seeds/choices + a wall-clock anchor are stored; entrants/result are rebuilt.
export type SavedBet = { kind: string; sel: number[]; amount: number; odds: number };
export type SingleRaceReward = {
  rank: number;
  awarded: Badge[];
  earned: number;
  payout: number;
  /** 週末イベントで受け取ったボックスの種類（もらえなかったレースでは未設定）。 */
  box?: BoxFrameKind;
  /** 水曜（万馬券デー）の上乗せ額。payout とは別枠でコインに足している。 */
  ticketBonus?: number;
};
export type SingleRaceSession = {
  kind: 'single';
  screen: 'roulette' | 'paddock' | 'race' | 'result';
  pickMode: boolean; // chosen-course practice (no betting) vs. the betting single race
  seed: number;
  mode: 30 | 60;
  laps?: number; // 周回数（1/2/3）。未指定は従来どおりコース既定（60秒=2周）
  courseId: string; // the resolved course
  player: Horse; // snapshot at race start (for an identical deterministic rebuild)
  bets: SavedBet[];
  anchorMs: number | null; // wall-clock ms when the countdown started (playback anchor)
  rewardApplied: boolean; // rewards/coins settled exactly once
  reward: SingleRaceReward | null; // stored for the result screen after a resume
};
// Grand prix in progress (改修：レース継続②). Everything is deterministic from
// (grade, seed, player), so heats/qualifiers/results are rebuilt; only the placed
// bets, a wall-clock anchor for the current race, and the once-only settlement
// flags are stored. Persisted from the heat onward (once the daily attempt is used).
export type GpRaceReward = { trophy: Trophy | null; items: TrainingItem[]; rank: number; qualified: boolean; coins: number };
export type GpRaceSession = {
  kind: 'gp';
  screen: 'heat' | 'qualify' | 'finalPaddock' | 'final' | 'podium';
  grade: 'g3' | 'g2' | 'g1';
  seed: number;
  mode: 30 | 60;
  player: Horse;
  heatBets: SavedBet[];
  finalBets: SavedBet[];
  anchorMs: number | null; // wall-clock start of the current animating race (heat/final)
  heatSettled: boolean; // qualifier bets settled exactly once
  finalSettled: boolean; // final bets + trophies/coins/items/unlocks settled exactly once
  reward: GpRaceReward | null; // stored for the podium after a resume
};
export type RaceSession = SingleRaceSession | GpRaceSession;

// ---- 対戦（デイリー勝ち抜きトーナメント）------------------------------------
// A horse snapshot used as an arena entrant — carries everything needed to both
// simulate the race and draw the horse, so a settled tournament replays offline.
export type ArenaHorseSnapshot = {
  horseId: string; // unique within a round
  name: string;
  colors: Record<ColorSlot, string>;
  decos: Partial<Record<DecoSlot, string>>;
  stats: Stats;
  style: RunStyle;
  isPlayer: boolean;
  isCom: boolean; // true = filler CPU; false + !isPlayer = another player's horse
  playerNo: number | null; // shown for real opponents (ID-000…)
};
// One round of the tournament, stored so it can be replayed identically.
export type ArenaRoundResult = {
  round: 0 | 1 | 2; // 予選1回戦 / 予選2回戦 / 本戦
  seed: number;
  courseId: string;
  field: ArenaHorseSnapshot[]; // the 8 entrants (index-aligned with ranks/finishTimes)
  playerIdx: number;
  order: number[]; // finishing order (indices into field)
  ranks: number[]; // rank per entrant index
  finishTimes: number[];
  playerRank: number;
  advanced: boolean; // player made the cut (qualifiers only)
};
export type ArenaOutcome = 'champion' | 'final' | 'q2out' | 'q1out';
// The result of a whole tournament for one 開催「部」(period). Kept in a growing
// list so results pile up (結果が溜まっていく).
export type ArenaResult = {
  period: number; // the 12h period this tournament belongs to
  label: string; // display label (e.g. "7/18 12時の部")
  seed: number; // deterministic seed (kept for reference)
  mode: 30 | 60;
  rounds: ArenaRoundResult[]; // 1..3 rounds actually raced
  outcome: ArenaOutcome;
  finalRank: number | null; // placing in the 本戦 if reached
  payout: number;
  awarded: boolean; // coins credited exactly once
  seen: boolean; // whether the player has watched it (for the NEW badge)
};
// A pending entry: competes in `period`; resolves into a result once the period closes.
export type ArenaEntry = {
  period: number; // the 12h period this entry competes in
  seed: number; // deterministic seed for this tournament
  horseId: string; // which owned horse was entered
  snapshot: ArenaHorseSnapshot; // frozen at entry, so deletion/edits don't change it
};
export type ArenaState = {
  auto: { horseId: string } | null; // 固定/自動エントリー（資金がある限り毎回参加）
  pending: ArenaEntry | null; // entry for the current (still-open) period
  lastPeriod: number | null; // highest period an entry was made for (drives catch-up)
  results: ArenaResult[]; // resolved tournaments, newest first (capped)
};

// アイコンフレーム（殿堂の上位3名に毎月配布）。獲得年月＋順位＋種別で一意。
export type FrameMetric = 'odds' | 'payout';
export type FrameRank = 1 | 2 | 3;
export type FrameAward = { period: string; rank: FrameRank; metric: FrameMetric };

// スペシャルタスク：連勝フレーム（1人でレース・馬券あり・払戻>賭けの連勝で獲得）。
// 連勝数(数のみ)を刻んだ特別フレーム。Lv1..10、重ねるほど豪華になる。
export const STREAK_MAX = 10;
export type StreakFrame = { kind: 'streak'; level: number };
// スペシャルタスク：適性フレーム。6コースすべての適性が同じ等級のウマを
// 手に入れると、その等級のフレームがもらえる（C→B→A→S の順に豪華）。
//
// 大事なのは「一度もらったら二度と取り上げない」こと。授与の記録はセーブの
// aptFrames に等級だけを残すので、そのウマを引退させても厳選で振り直しても
// フレームは残る。
export type AptGrade = 'C' | 'B' | 'A' | 'S';
export const APT_GRADES: AptGrade[] = ['C', 'B', 'A', 'S'];
export type AptFrame = { kind: 'apt'; grade: AptGrade };

// 週末のボックスから 1/1000・1/10000 で出る限定フレーム。各1回きり。
export type BoxFrameKind = 'lucky' | 'gold';
export type BoxFrame = { kind: 'box'; box: BoxFrameKind };

// ショップの「フレームボックス」から出る動物フレーム（10種）。
// コインで買うだけの見た目もので、強さにも確率にも一切かかわらない。
export type AnimalFrame = { kind: 'animal'; animal: AnimalId };
// 10種そろえた人だけがもらえるコンプリートフレーム。
// 動物は10種からいつでも選び直せるので、選んだ動物をフレーム自身が持つ。
// こうしておけば、ランキングに送る JSON だけで見た目がそのまま再現できる。
export type AnimalMasterFrame = { kind: 'animalMaster'; animal: AnimalId };

// アイコンに装備できるフレームは 殿堂 / 連勝 / 適性 / ボックス / ショップ のいずれか。
export type EquipFrame = FrameAward | StreakFrame | AptFrame | BoxFrame | AnimalFrame | AnimalMasterFrame;
export function isStreakFrame(f: EquipFrame | null | undefined): f is StreakFrame {
  return !!f && (f as StreakFrame).kind === 'streak';
}
export function isAptFrame(f: EquipFrame | null | undefined): f is AptFrame {
  return !!f && (f as AptFrame).kind === 'apt';
}
export function isBoxFrame(f: EquipFrame | null | undefined): f is BoxFrame {
  return !!f && (f as BoxFrame).kind === 'box';
}
export function isAnimalFrame(f: EquipFrame | null | undefined): f is AnimalFrame {
  return !!f && (f as AnimalFrame).kind === 'animal';
}
export function isAnimalMasterFrame(f: EquipFrame | null | undefined): f is AnimalMasterFrame {
  return !!f && (f as AnimalMasterFrame).kind === 'animalMaster';
}

/**
 * 外から来た値をフレームとして受け取ってよいか調べる。合わなければ null。
 *
 * セーブ（localStorage）とランキング（Supabase の jsonb）は、どちらも中身が
 * 保証されない外部データなので、必ずここを通してから使う。
 *
 * ここに置いてある理由：以前はセーブ用とランキング用に同じ判定が2つあり、
 * 新しい種類（ボックス限定・適性）を足したときにセーブ側だけ直してランキング側を
 * 直し忘れた。その結果、ボックス限定フレームや適性フレームを着けている人が
 * ランキングでは枠なしで表示されていた。**フレームの種類を増やすときは、
 * この関数1つだけを直せば両方に効く。**
 */
export function parseEquipFrame(v: unknown): EquipFrame | null {
  if (!v || typeof v !== 'object') return null;
  const f = v as Record<string, unknown>;
  // 週末ボックスの限定フレーム。
  if (f.kind === 'box') {
    return f.box === 'lucky' || f.box === 'gold' ? { kind: 'box', box: f.box } : null;
  }
  // ショップの動物フレーム／コンプリートフレーム。
  if (f.kind === 'animal') {
    return isAnimalId(f.animal) ? { kind: 'animal', animal: f.animal } : null;
  }
  if (f.kind === 'animalMaster') {
    return isAnimalId(f.animal) ? { kind: 'animalMaster', animal: f.animal } : null;
  }
  // 適性フレーム（6コースすべて同じ等級のウマを手に入れた記録）。
  if (f.kind === 'apt') {
    const g = f.grade;
    return g === 'C' || g === 'B' || g === 'A' || g === 'S' ? { kind: 'apt', grade: g } : null;
  }
  // 連勝フレーム（スペシャルタスク報酬）。
  if (f.kind === 'streak') {
    const level = Number(f.level);
    if (Number.isFinite(level) && level >= 1 && level <= STREAK_MAX) return { kind: 'streak', level: Math.round(level) };
    return null;
  }
  // 殿堂フレーム（毎月の上位3名）。kind を持たないのが目印。
  const rank = f.rank === 1 || f.rank === 2 || f.rank === 3 ? f.rank : null;
  const metric = f.metric === 'odds' || f.metric === 'payout' ? f.metric : null;
  if (typeof f.period !== 'string' || rank === null || metric === null) return null;
  return { period: f.period, rank, metric };
}

/**
 * 2つのフレームが同じものか。
 *
 * parseEquipFrame と同じ理由でここに置いてある。**種類を増やしたら、この関数と
 * parseEquipFrame の2つだけを直せばよい**ようにしておく。以前は画面側に同じ
 * 判定が散らばっていて、種類を増やしたときに「装備中」の印だけが付かなくなった。
 */
export function sameFrame(a: EquipFrame | null | undefined, b: EquipFrame | null | undefined): boolean {
  if (!a || !b) return (a ?? null) === (b ?? null);
  if (isStreakFrame(a) || isStreakFrame(b)) return isStreakFrame(a) && isStreakFrame(b) && a.level === b.level;
  if (isAptFrame(a) || isAptFrame(b)) return isAptFrame(a) && isAptFrame(b) && a.grade === b.grade;
  if (isBoxFrame(a) || isBoxFrame(b)) return isBoxFrame(a) && isBoxFrame(b) && a.box === b.box;
  if (isAnimalFrame(a) || isAnimalFrame(b)) return isAnimalFrame(a) && isAnimalFrame(b) && a.animal === b.animal;
  if (isAnimalMasterFrame(a) || isAnimalMasterFrame(b)) {
    return isAnimalMasterFrame(a) && isAnimalMasterFrame(b) && a.animal === b.animal;
  }
  return a.period === b.period && a.rank === b.rank && a.metric === b.metric;
}

// メールボックスの1通。フレーム配布のほか、今後の補填・お知らせにも使う汎用受信箱。
export type MailItem = {
  id: string; // 重複防止の安定ID（例 'frame-2026-06-odds'）
  at: number; // 受信時刻(ms)
  read: boolean;
  kind: 'frame' | 'notice' | 'box';
  frame?: FrameAward; // kind==='frame'
  title?: string; // kind==='notice'（将来用）
  body?: string;
  /** kind==='box'：週末のボックス。種類ごとに1行にまとめ、個数だけ増やす（×4 のように）。 */
  box?: BoxFrameKind;
  count?: number;
};

export type SaveData = {
  version: 6;
  owned: Record<string, number>; // part id -> count obtained (>=1 means owned)
  horses: Horse[]; // up to `maxHorses`
  energy: number; // grass spawn stock (0..3), charges 1 per hour
  energyUpdatedAt: number; // ms anchor for energy regen
  trophies: Trophy[]; // grand-prix only
  badges: Badge[]; // everyday single-race rewards (ACCOUNT.md §2)
  winStreaks: Record<string, number>; // horseId -> current consecutive 1st count
  // スペシャルタスク（連勝チャレンジ）。1人でレース・馬券ありで払戻>賭けなら1勝。
  soloStreak?: number; // 現在の連勝数（負け＝払戻<1.5倍で0にリセット）
  streakBest?: number; // これまでの最高連勝数（達成済みLv = 1..min(streakBest,STREAK_MAX)）
  streakClaimed?: number; // 受け取り済みのLv数（0..STREAK_MAX）
  streakRuleResetDone?: boolean; // 勝利条件変更(1.5倍)に伴う連勝リセットを適用済みか（一度だけ）
  items: TrainingItem[]; // owned training items (unused inventory)
  raceRecords: RaceRecord[];
  gpUnlocked: { g2: boolean; g1: boolean }; // grand-prix grade unlocks
  freeRebalance: boolean; // one free stat re-allocation after the v4 migration (RACE_V3 §3.6)
  freeRename?: boolean; // 初回の改名は無料（1回だけ）。既定 true、使うと false
  coins: number; // soft currency (RACE_V4 §4)
  refineTickets?: number; // 厳選チケット。対戦の入賞とログインボーナス（水曜）で増える
  dyes?: Record<string, number>; // 染料：色パーツID -> 個数。ウマの色を塗り替えられる
  login?: { day: string; at: number }; // ログインボーナスを最後に受け取った日（trustedNow 由来）
  bets: BetRecord[]; // recent settled bets (capped)
  maxHorses: number; // stable slot cap (10, expandable to 15)
  team?: string[]; // 出走・牧場収入の対象となるチーム（最大 maxHorses 頭。horse id の並び）
  //   個体値厳選アップデートの土台。既存セーブは所持ウマ全員がチームに入る形で移行する。
  daily: DailyCounters; // per-day bonus/おかわり counters
  tasks: TaskProgress; // coin-earning task progress (改修：タスク)
  stats: PlayerStats; // lifetime profile stats (改修：プロフィール実績)
  avatarHorseId: string | null; // profile: which owned horse is the player's icon
  displayTrophies: number[]; // profile: trophy ranks (1|2|3) shown on the shelf (max 5)
  mailbox?: MailItem[]; // 受信箱（フレーム配布・補填など）
  equippedFrame?: EquipFrame | null; // アイコンに装備中のフレーム（殿堂 / 連勝 / 適性）
  /** 適性フレームを授与された等級。等級だけを持つので、そのウマを引退させても
   *  厳選で振り直しても取り上げられない（スペシャルタスクの約束）。 */
  aptFrames?: AptGrade[];
  /** 条件は満たしたが、まだタスク画面で受け取っていない等級。
   *  ここに入った時点で「取り上げない」約束は成立している（ウマを引退させてもよい）。 */
  aptPending?: AptGrade[];
  /** ボックスの限定フレームを引き当てた種類。各1回きりなので記録だけ残す。 */
  boxFrames?: BoxFrameKind[];
  /** ボックスから出た限定称号（1度きり）。称号IDではなく箱の種類で持つ。 */
  boxTitles?: BoxFrameKind[];
  /** ショップのフレームボックスで当てた動物（10種そろうとコンプリートフレーム）。 */
  shopFrames?: AnimalId[];
  /** ショップの称号ボックスで当てた動物（10種そろうとコンプリート称号）。 */
  shopTitles?: AnimalId[];
  /** コンプリートフレームでいま選んでいる動物。10種からいつでも選び直せる。 */
  shopFramePick?: AnimalId;
  /** コンプリート称号でいま選んでいる動物。 */
  shopTitlePick?: AnimalId;
  /** 「初ゲット」のお知らせを出しおわった称号ID。出したものを覚えておくだけ。 */
  seenTitles?: string[];
  /** 「総獲得賞金」のお詫びを出す対象か。この項目より前から遊んでいた人だけ true。
   *  新規アカウントには無関係なので届かない。判定は初回の読み込みで一度だけ。 */
  earnedNoticeDue?: boolean;
  equippedTitle?: string | null; // 装備中の称号ID（data/titles.ts）。未設定なら達成済みで一番上の段
  /** カスタムベットの設定。2パターンまで決めておける。
   *  旧セーブはオブジェクト1個で入っているので、読み込み時に配列へそろえる。 */
  /** 空の枠は null。**枠の数ぶん必ず並ぶ**（詰めない）。詰めてしまうと、
   *  1つめが空のまま2つめを決めたときに位置がずれて「消えた」ように見える。 */
  customBets?: ({ amount: number; minOdds: number; maxOdds: number } | null)[];
  /** 旧・カスタムベット（1パターンだけだったころ）。読み込みの互換のためだけに残す。 */
  customBet?: { amount: number; minOdds: number; maxOdds: number } | null;
  raceSession?: RaceSession | null; // in-progress race, resumable across reloads
  arena?: ArenaState | null; // 対戦: pending entry + last revealed tournament
  farmClaimedAt?: number; // 牧場の放置収入を最後に回収した時刻（ms）
  savedAt: number; // ms of the last change — used for cloud last-write-wins sync
};
