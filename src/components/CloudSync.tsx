import { useEffect } from 'react';
import { useStore } from '../store';
import type { SaveData } from '../types';
import { initAuth, useAuth, cloudLoad, cloudSave, getOwner, setOwner, loadPlayerNo } from '../cloud';
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

// Headless: connects the game store to the cloud when a user is signed in.
// Last-write-wins by `savedAt`; pushes are debounced.
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
      return;
    }
    let cancelled = false;
    setSync('syncing');
    (async () => {
      const cloud = await cloudLoad(user.id);
      if (cancelled) return;
      const local = snapshot();
      // Ownership-based reconcile: cloud data is never overwritten by a local
      // save that doesn't belong to this account (fixes the overwrite bug).
      const decision = reconcile(cloud, local, getOwner(), user.id);
      if (decision.action === 'loadCloud' && cloud) {
        useStore.getState().hydrate(cloud);
        setOwner(user.id);
        if (!cancelled) setSync('saved');
      } else {
        const err = await cloudSave(user.id, local); // pushLocal / keepLocalPushCloud
        setOwner(user.id);
        if (!cancelled) setSync(err ? 'error' : 'saved');
      }
      const no = await loadPlayerNo();
      if (!cancelled) setPlayerNo(no);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Push changes up (debounced) while signed in.
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useStore.subscribe((state, prev) => {
      if (state.savedAt === prev.savedAt) return; // only real changes bump savedAt
      useAuth.getState().setSync('syncing');
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const err = await cloudSave(user.id, snapshot());
        useAuth.getState().setSync(err ? 'error' : 'saved');
      }, 1500);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [user]);

  return null;
}
