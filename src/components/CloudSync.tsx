import { useEffect } from 'react';
import { useStore, bindSaveKey } from '../store';
import type { SaveData } from '../types';
import {
  initAuth,
  useAuth,
  cloudLoad,
  cloudSave,
  backupSave,
  getOwner,
  setOwner,
  getRev,
  setRev,
  loadPlayerNo,
  loadDisplayName,
  saveDisplayName,
  loadMyBetScore,
  loadMyFrameAwards,
  setRankingFrame,
  syncServerClock,
} from '../cloud';
import { reconcile, resolvePushConflict, guardEmptyPush } from '../logic/cloudReconcile';
import { randomUsername } from '../logic/username';

// Extract the persisted shape from the live store state.
function snapshot(): SaveData {
  const s = useStore.getState();
  return {
    version: 6,
    owned: s.owned,
    horses: s.horses,
    energy: s.energy,
    energyUpdatedAt: s.energyUpdatedAt,
    trophies: s.trophies,
    badges: s.badges,
    winStreaks: s.winStreaks,
    soloStreak: s.soloStreak ?? 0,
    streakBest: s.streakBest ?? 0,
    streakClaimed: s.streakClaimed ?? 0,
    streakRuleResetDone: s.streakRuleResetDone ?? false,
    items: s.items,
    raceRecords: s.raceRecords,
    gpUnlocked: s.gpUnlocked,
    freeRebalance: s.freeRebalance,
    freeRename: s.freeRename,
    coins: s.coins,
    refineTickets: s.refineTickets ?? 0,
    dyes: s.dyes ?? {},
    login: s.login,
    bets: s.bets,
    maxHorses: s.maxHorses,
    team: s.team ?? [],
    daily: s.daily,
    tasks: s.tasks,
    stats: s.stats,
    avatarHorseId: s.avatarHorseId,
    displayTrophies: s.displayTrophies,
    mailbox: s.mailbox ?? [],
    equippedFrame: s.equippedFrame ?? null,
    equippedTitle: s.equippedTitle ?? null,
    raceSession: s.raceSession ?? null,
    arena: s.arena ?? null,
    farmClaimedAt: s.farmClaimedAt, // 牧場の放置収入アンカー（クラウドでも保持しオフライン加算を保つ）
    savedAt: s.savedAt,
  };
}

// Headless: connects the game store to the cloud when signed in. Optimistic
// locking by `rev`; a real conflict is surfaced to <SyncConflictModal> instead
// of silently overwriting (ACCOUNT.md §1.6).
export default function CloudSync() {
  // 「総獲得賞金」を後から足したので、それ以前の記録は残っていない。
  // 事情を一度だけ受信箱で説明する（配布は id で重複しない）。
  const receiveNoticeOnce = useStore((st) => st.receiveNoticeOnce);
  useEffect(() => {
    receiveNoticeOnce(
      'notice-total-earned',
      'お詫び',
      'プロフィールに「総獲得賞金」を追加しました。ただ、この項目より前のレースは記録が残っていないため、'
        + '分かっているぶん（対戦の賞金と、1レースの最大獲得賞金）だけを入れた状態から始まります。'
        + 'これから稼いだぶんは正しく積み上がります。数字が実際より少なくなってしまい申し訳ありません。',
    );
  }, [receiveNoticeOnce]);

  const user = useAuth((s) => s.user);
  const configured = useAuth((s) => s.configured);

  useEffect(() => {
    if (configured) initAuth();
  }, [configured]);

  // 端末時計に頼らない「信頼できる時刻」をサーバ時刻でアンカーする。起動時＋復帰時＋
  // オンライン復帰時に更新すれば、時計を進めても牧場収入・対戦の「部」は先取りできない。
  useEffect(() => {
    const resync = () => void syncServerClock();
    const onVisible = () => {
      if (document.visibilityState === 'visible') resync();
    };
    resync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', resync);
    window.addEventListener('focus', resync);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', resync);
      window.removeEventListener('focus', resync);
    };
  }, []);

  // On sign-in: reconcile local vs cloud, and fetch the player number.
  useEffect(() => {
    const { setSync, setPlayerNo, setDisplayName } = useAuth.getState();
    if (!user) {
      setPlayerNo(null);
      setDisplayName(null);
      setRev(null);
      // Signing out: revert to the guest slot so the next person doesn't see
      // this account's data.
      useStore.getState().reloadFromKey(null);
      return;
    }
    let cancelled = false;
    setSync('syncing');
    // Until we have SUCCESSFULLY read the cloud, we must not write to it: a null
    // rev blocks the debounced push (below), so a failed read can never lead to
    // the local save overwriting real cloud data.
    setRev(null);
    (async () => {
      const loaded = await cloudLoad(user.id);
      if (cancelled) return;

      // Could not read the cloud (network/RLS/corrupt). Treat its state as
      // unknown: keep the local save, surface the error, and DON'T push. The
      // account's data is left untouched. A later reload retries.
      if (loaded.status === 'error') {
        setSync('error');
        const no = await loadPlayerNo();
        if (!cancelled) setPlayerNo(no);
        return;
      }

      const cloud = loaded.status === 'ok' ? loaded.save : null;

      // 突合の前に、端末の保存先をこのアカウントの枠へ向け直す。
      //
      // ストアはモジュール読み込み時に activeKey（＝起動直後は必ずゲスト枠）から
      // 初期化される。bindSaveKey が呼ばれるのはこの突合のあとなので、ここで
      // snapshot() を取ると「アカウントの端末データ」ではなく“ゲスト枠の中身”を
      // 見てしまう。owner は前回ログイン時のまま user.id なので、reconcile は
      // それを同じアカウントのデータだと信じて last-write-wins に入る。
      // 草むらのログインボーナスなど起動時の commit がゲスト枠の savedAt を
      // 「いま」に更新するため、ゲスト枠がほぼ必ず“新しい方”になり、
      // 中身の少ないゲストデータでアカウントのクラウドを上書きしてしまっていた
      // （＝ぎっつまさんのデータが消えた経路。バックアップは取られるので
      //   saves_backup には上書き前の本物が残る）。
      const owner = getOwner();
      if (owner === user.id) useStore.getState().reloadFromKey(user.id);

      const local = snapshot();
      const decision = reconcile(cloud ? cloud.data : null, local, owner, user.id);

      if (decision.action === 'conflict' && cloud) {
        // Let the player choose which save wins; do not touch anything yet.
        useAuth.getState().setConflict({ userId: user.id, cloud, local });
        if (!cancelled) setSync('idle');
      } else if (decision.action === 'loadCloud' && cloud) {
        bindSaveKey(user.id);
        useStore.getState().hydrate(cloud.data);
        setOwner(user.id);
        setRev(cloud.rev);
        if (!cancelled) setSync('saved');
      } else {
        // pushLocal (empty account) / keepLocalPushCloud (same account, newer here).
        // Stash the existing cloud copy first so any overwrite is recoverable.
        if (cloud) await backupSave(user.id, cloud.data, cloud.rev);
        bindSaveKey(user.id);
        const res = await cloudSave(user.id, local, cloud ? cloud.rev : null);
        setOwner(user.id);
        if (res.ok) setRev(res.rev);
        if (!cancelled) setSync(res.ok ? 'saved' : 'error');
      }

      const no = await loadPlayerNo();
      if (!cancelled) setPlayerNo(no);

      // 連勝の勝利条件変更（払戻1.5倍以上）に伴い、旧条件で連勝記録を貯めた ID=1（まるこ）の
      // 記録を一度だけリセットする。適用済みフラグ（保存＆同期）で二度目以降は何もしない。
      if (no === 1 && !cancelled) {
        const didReset = useStore.getState().resetStreakForRuleChange();
        if (didReset) void setRankingFrame(useStore.getState().equippedFrame ?? null);
      }

      // Backfill profile stats from the account's ranking history so an existing
      // player's past 最大オッズ / 最大獲得賞金 show up (raise-only merge).
      const my = await loadMyBetScore();
      if (my && !cancelled) useStore.getState().foldStats({ maxOdds: my.bestOdds, maxPayout: my.bestPayout });

      // 殿堂フレームの配布：過去月で上位3位に入っていたら受信箱へ（重複は無視）。
      const awards = await loadMyFrameAwards(user.id);
      if (awards.length && !cancelled) useStore.getState().receiveFrames(awards);

      // 装備中フレームを当月のランキング行へ同期（他プレイヤーにも表示されるように）。
      if (!cancelled) void setRankingFrame(useStore.getState().equippedFrame ?? null);

      // Ranking username (改修④): load it; if the account has none yet, assign a
      // friendly default and save it. Best-effort — no-ops without the DB.
      let name = await loadDisplayName();
      if (!name) {
        const gen = randomUsername();
        name = (await saveDisplayName(gen)) ?? gen;
      }
      if (!cancelled) setDisplayName(name);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Push changes up (debounced) while signed in. Pauses while a conflict is open.
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useStore.subscribe((state, prev) => {
      if (state.savedAt === prev.savedAt) return; // only real changes bump savedAt
      if (useAuth.getState().conflict) return; // don't sync while resolving a conflict
      // Never write before we've read: a null rev means the initial cloud load
      // failed or hasn't finished, so pushing now could clobber unread data.
      if (getRev() === null) return;
      useAuth.getState().setSync('syncing');
      clearTimeout(timer);
      timer = setTimeout(async () => {
        if (getRev() === null) return; // re-check after the debounce
        // 端末側が空（ウマ0頭）になっているときは、そのまま押し上げるとバックアップも
        // 取らずに本体を消してしまう。ウマを手放す操作は無いので、これは端末側の異常。
        // クラウドに中身が残っていればそれを正として端末を直す（自己修復）。
        if (snapshot().horses.length === 0) {
          const loaded = await cloudLoad(user.id);
          if (loaded.status === 'error') {
            useAuth.getState().setSync('error'); // 読めない＝上書きしない
            return;
          }
          if (loaded.status === 'ok' && guardEmptyPush(snapshot(), loaded.save.data) === 'adoptCloud') {
            useStore.getState().hydrate(loaded.save.data);
            setRev(loaded.save.rev);
            useAuth.getState().setSync('saved');
            return;
          }
        }
        const res = await cloudSave(user.id, snapshot(), getRev());
        if (res.ok) {
          setRev(res.rev);
          useAuth.getState().setSync('saved');
        } else if (res.conflict) {
          // The server rev advanced since we read it — another tab / device / reload
          // of THIS SAME account wrote in the meantime. Don't prompt (that made two
          // open instances ping-pong the conflict modal); resolve by last-write-wins,
          // the same policy sign-in already uses for the same account.
          const loaded = await cloudLoad(user.id);
          if (loaded.status !== 'ok') {
            useAuth.getState().setSync('error');
            return;
          }
          const cloud = loaded.save;
          const local = snapshot();
          if (resolvePushConflict(cloud.data.savedAt, local.savedAt) === 'adoptCloud') {
            useStore.getState().hydrate(cloud.data); // cloud is newer → take it
            setRev(cloud.rev);
            useAuth.getState().setSync('saved');
          } else {
            const retry = await cloudSave(user.id, local, cloud.rev); // local is newer → re-push on top
            if (retry.ok) {
              setRev(retry.rev);
              useAuth.getState().setSync('saved');
            } else {
              setRev(cloud.rev);
              useAuth.getState().setSync(retry.conflict ? 'idle' : 'error');
            }
          }
        } else {
          useAuth.getState().setSync('error');
        }
      }, 1500);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [user]);

  return null;
}
