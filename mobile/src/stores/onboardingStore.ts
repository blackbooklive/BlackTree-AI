import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AIFocus =
  | 'assistant'
  | 'business'
  | 'content'
  | 'growth'
  | 'community';

export const AI_FOCUS_OPTIONS: { id: AIFocus; label: string; emoji: string; description: string }[] = [
  { id: 'assistant', label: 'AI Assistant', emoji: '🤖', description: 'General purpose AI help' },
  { id: 'business', label: 'Business AI', emoji: '📈', description: 'For entrepreneurs' },
  { id: 'content', label: 'Content Creator', emoji: '🎥', description: 'AI content creation' },
  { id: 'growth', label: 'Personal Growth', emoji: '🧠', description: 'Mindset & development' },
  { id: 'community', label: 'Community AI', emoji: '🌍', description: 'Like Blackbook but smarter' },
];

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  selectedFocus: AIFocus | null;

  // Actions
  setSelectedFocus: (focus: AIFocus) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      selectedFocus: null,

      setSelectedFocus: (focus) => set({ selectedFocus: focus }),

      completeOnboarding: () => set({ hasCompletedOnboarding: true }),

      resetOnboarding: () => set({
        hasCompletedOnboarding: false,
        selectedFocus: null
      }),
    }),
    {
      name: 'blacktree-onboarding',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
