import { useEffect } from 'react';
import { useStore } from '../store';
import type { SaveData } from '../types';
import { initAuth, useAuth, cloudLoad, cloudSave } from '../cloud';

// Extract the persisted shape from the live store state.
function snapshot(): SaveData {
  const s = useStore.getState();
  return {
    version: 3,
    owned: s.owned,
    horses: s.horses,
    energy: s.energy,
    energyUpdatedAt: s.energyUpdatedAt,
    trophies: s.trophies,
    items: s.items,
    raceRecords: s.raceRecords,
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

  // On sign-in: reconcile local vs cloud.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const { setSync } = useAuth.getState();
    setSync('syncing');
    (async () => {
      const cloud = await cloudLoad(user.id);
      if (cancelled) return;
      const local = snapshot();
      if (!cloud) {
        const err = await cloudSave(user.id, local); // first login on this account
        if (!cancelled) setSync(err ? 'error' : 'saved');
      } else if ((cloud.savedAt ?? 0) >= (local.savedAt ?? 0)) {
        useStore.getState().hydrate(cloud);
        if (!cancelled) setSync('saved');
      } else {
        const err = await cloudSave(user.id, local); // local is newer
        if (!cancelled) setSync(err ? 'error' : 'saved');
      }
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
