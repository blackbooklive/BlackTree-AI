import { create } from 'zustand';

// Deliberately session-only: no account identity, persistence, or entitlements.
interface GuestState {
  isGuest: boolean;
  enterGuest: () => void;
  exitGuest: () => void;
}

export const useGuestStore = create<GuestState>((set) => ({
  isGuest: false,
  enterGuest: () => set({ isGuest: true }),
  exitGuest: () => set({ isGuest: false }),
}));
