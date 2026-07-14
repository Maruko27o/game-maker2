import { useEffect } from 'react';
import { useStore, bindSaveKey } from '../store';
import type { SaveData } from '../types';
import {
  initAuth,
  useAuth,
  cloudLoad,
  cloudSave,
  getOwner,
  setOwner,
  getRev,
  setRev,
  loadPlayerNo,
} from '../cloud';
import { reconcile } from '../logic/cloudReconcile';

// Extract the persisted shape from the live store state.
function snapshot(): SaveData {
  const s = useStore.getState();
  return {
    version: 4,
    owned: s.owned,
    horses: s.horses,
    energy: s.energy,
    energyUpdatedAt: s.energyUpdatedAt,
    trophies: s.trophies,
    items: s.items,
    raceRecords: s.raceRecords,
    gpUnlocked: s.gpUnlocked,
    freeRebalance: s.freeRebalance,
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
    const { setSync, setPlayerNo } = useAuth.getState();
    if (!user) {
      setPlayerNo(null);
      setRev(null);
      // Signing out: revert to the guest slot so the next person doesn't see
      // this account's data.
      useStore.getState().reloadFromKey(null);
      return;
    }
    let cancelled = false;
    setSync('syncing');
    (async () => {
      const cloud = await cloudLoad(user.id);
      if (cancelled) return;
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
        // pushLocal / keepLocalPushCloud
        bindSaveKey(user.id);
        const res = await cloudSave(user.id, local, cloud ? cloud.rev : null);
        setOwner(user.id);
        if (res.ok) setRev(res.rev);
        if (!cancelled) setSync(res.ok ? 'saved' : 'error');
      }

      const no = await loadPlayerNo();
      if (!cancelled) setPlayerNo(no);
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
      useAuth.getState().setSync('syncing');
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const res = await cloudSave(user.id, snapshot(), getRev());
        if (res.ok) {
          setRev(res.rev);
          useAuth.getState().setSync('saved');
        } else if (res.conflict) {
          // Another device moved ahead: re-read and ask the player.
          const cloud = await cloudLoad(user.id);
          if (cloud) useAuth.getState().setConflict({ userId: user.id, cloud, local: snapshot() });
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
