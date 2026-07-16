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
} from '../cloud';
import { reconcile } from '../logic/cloudReconcile';
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
    items: s.items,
    raceRecords: s.raceRecords,
    gpUnlocked: s.gpUnlocked,
    freeRebalance: s.freeRebalance,
    coins: s.coins,
    bets: s.bets,
    maxHorses: s.maxHorses,
    daily: s.daily,
    tasks: s.tasks,
    stats: s.stats,
    avatarHorseId: s.avatarHorseId,
    displayTrophies: s.displayTrophies,
    savedAt: s.savedAt,
  };
}

// Headless: connects the game store to the cloud when signed in. Optimistic
// locking by `rev`; a real conflict is surfaced to <SyncConflictModal> instead
// of silently overwriting (ACCOUNT.md §1.6).
export default function CloudSync() {
  const user = useAuth((s) => s.user);
  const configured = useAuth((s) => s.configured);

  useEffect(() => {
    if (configured) initAuth();
  }, [configured]);

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
      const local = snapshot();
      const decision = reconcile(cloud ? cloud.data : null, local, getOwner(), user.id);

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

      // Backfill profile stats from the account's ranking history so an existing
      // player's past 最大オッズ / 最大獲得賞金 show up (raise-only merge).
      const my = await loadMyBetScore();
      if (my && !cancelled) useStore.getState().foldStats({ maxOdds: my.bestOdds, maxPayout: my.bestPayout });

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
        const res = await cloudSave(user.id, snapshot(), getRev());
        if (res.ok) {
          setRev(res.rev);
          useAuth.getState().setSync('saved');
        } else if (res.conflict) {
          // Another device moved ahead: re-read and ask the player.
          const loaded = await cloudLoad(user.id);
          if (loaded.status === 'ok') {
            useAuth.getState().setConflict({ userId: user.id, cloud: loaded.save, local: snapshot() });
          }
          useAuth.getState().setSync('idle');
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
