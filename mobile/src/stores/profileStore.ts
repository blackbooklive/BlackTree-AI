import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ProfileState {
  profilePictureUri: string | null;
  setProfilePicture: (uri: string | null) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profilePictureUri: null,
      setProfilePicture: (uri) => set({ profilePictureUri: uri }),
    }),
    {
      name: 'blacktree-profile',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
