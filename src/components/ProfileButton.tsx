import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useAuth } from '../cloud';
import type { HorseLook } from '../types';
import HorseFace from './HorseFace';
import AvatarFrame from './AvatarFrame';
import ProfileModal from './ProfileModal';
import styles from './ProfileButton.module.css';

const DEFAULT_LOOK: HorseLook = { name: '', colors: { body: '', mane: '', hoof: '' }, decos: {} };

// Top-left player icon (改修：ユーザー独自アイコン). Tap opens the profile screen.
export default function ProfileButton() {
  const horses = useStore((s) => s.horses);
  const avatarHorseId = useStore((s) => s.avatarHorseId);
  const equippedFrame = useStore((s) => s.equippedFrame ?? null);

  const wantAccount = useAuth((s) => s.wantAccount);
  const setWantAccount = useAuth((s) => s.setWantAccount);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'profile' | 'account'>('profile');

  // A request (e.g. from the title screen "ログイン") opens the account tab.
  useEffect(() => {
    if (wantAccount) {
      setTab('account');
      setOpen(true);
      setWantAccount(false);
    }
  }, [wantAccount, setWantAccount]);

  const avatar = useMemo<HorseLook>(() => {
    const byId = avatarHorseId ? horses.find((h) => h.id === avatarHorseId) : null;
    return byId ?? horses[0] ?? DEFAULT_LOOK;
  }, [avatarHorseId, horses]);

  return (
    <>
      <button
        className={`${styles.fab} ${equippedFrame ? styles.framed : ''}`}
        onClick={() => { setTab('profile'); setOpen(true); }}
        aria-label="プロフィール"
      >
        {equippedFrame ? (
          <AvatarFrame rank={equippedFrame.rank} metric={equippedFrame.metric} period={equippedFrame.period} look={avatar} size={46} />
        ) : (
          <HorseFace horse={avatar} size={40} />
        )}
      </button>
      {open && <ProfileModal onClose={() => setOpen(false)} initialTab={tab} />}
    </>
  );
}
