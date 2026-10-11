import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FREE_DAILY_MESSAGES = 5;
const FREE_DAILY_IMAGES = 5;
const FREE_TRIAL_DAYS = 10;

interface UsageState {
  messagesUsedToday: number;
  imagesUsedToday: number;
  lastResetDate: string;
  firstUseDate: string | null; // Track when user first used the app

  // Actions
  incrementMessages: () => void;
  incrementImages: () => void;
  canSendMessage: (isPro: boolean) => boolean;
  canGenerateImage: (isPro: boolean) => boolean;
  getRemainingMessages: (isPro: boolean) => number;
  getRemainingImages: (isPro: boolean) => number;
  isInFreeTrial: () => boolean;
  getTrialDaysRemaining: () => number;
}

const getTodayString = () => new Date().toISOString().split('T')[0];

// Check if user is still in free trial period
const checkFreeTrial = (firstUseDate: string | null): boolean => {
  if (!firstUseDate) return true; // First time user, will get trial

  const firstDate = new Date(firstUseDate);
  const today = new Date();
  const diffTime = today.getTime() - firstDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays < FREE_TRIAL_DAYS;
};

// Get remaining trial days
const getTrialDaysLeft = (firstUseDate: string | null): number => {
  if (!firstUseDate) return FREE_TRIAL_DAYS;

  const firstDate = new Date(firstUseDate);
  const today = new Date();
  const diffTime = today.getTime() - firstDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, FREE_TRIAL_DAYS - diffDays);
};

export const useUsageStore = create<UsageState>()(
  persist(
    (set, get) => ({
      messagesUsedToday: 0,
      imagesUsedToday: 0,
      lastResetDate: getTodayString(),
      firstUseDate: null,

      incrementMessages: () => {
        const state = get();
        const today = getTodayString();

        // Set first use date if not already set
        const firstUseDate = state.firstUseDate || today;

        if (state.lastResetDate !== today) {
          // New day, reset counters
          set({
            messagesUsedToday: 1,
            imagesUsedToday: 0,
            lastResetDate: today,
            firstUseDate,
          });
        } else {
          set({
            messagesUsedToday: state.messagesUsedToday + 1,
            firstUseDate,
          });
        }
      },

      incrementImages: () => {
        const state = get();
        const today = getTodayString();

        // Set first use date if not already set
        const firstUseDate = state.firstUseDate || today;

        if (state.lastResetDate !== today) {
          set({
            messagesUsedToday: 0,
            imagesUsedToday: 1,
            lastResetDate: today,
            firstUseDate,
          });
        } else {
          set({
            imagesUsedToday: state.imagesUsedToday + 1,
            firstUseDate,
          });
        }
      },

      canSendMessage: (_isPro: boolean) => {
        return true; // Unlimited chat for all users
      },

      canGenerateImage: (isPro: boolean) => {
        if (isPro) return true;

        const state = get();

        // Check if in free trial - unlimited during trial
        if (checkFreeTrial(state.firstUseDate)) {
          return true;
        }

        const today = getTodayString();

        if (state.lastResetDate !== today) {
          return true;
        }

        return state.imagesUsedToday < FREE_DAILY_IMAGES;
      },

      getRemainingMessages: (isPro: boolean) => {
        if (isPro) return Infinity;

        const state = get();

        // Unlimited during free trial
        if (checkFreeTrial(state.firstUseDate)) {
          return Infinity;
        }

        const today = getTodayString();

        if (state.lastResetDate !== today) {
          return FREE_DAILY_MESSAGES;
        }

        return Math.max(0, FREE_DAILY_MESSAGES - state.messagesUsedToday);
      },

      getRemainingImages: (isPro: boolean) => {
        if (isPro) return Infinity;

        const state = get();

        // Unlimited during free trial
        if (checkFreeTrial(state.firstUseDate)) {
          return Infinity;
        }

        const today = getTodayString();

        if (state.lastResetDate !== today) {
          return FREE_DAILY_IMAGES;
        }

        return Math.max(0, FREE_DAILY_IMAGES - state.imagesUsedToday);
      },

      isInFreeTrial: () => {
        const state = get();
        return checkFreeTrial(state.firstUseDate);
      },

      getTrialDaysRemaining: () => {
        const state = get();
        return getTrialDaysLeft(state.firstUseDate);
      },
    }),
    {
      name: 'blacktree-usage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
