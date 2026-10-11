import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AIPersonality = 'professional' | 'friendly' | 'casual' | 'concise';

export const AI_PERSONALITIES = [
  { id: 'professional' as AIPersonality, label: 'Professional', description: 'Formal and business-like' },
  { id: 'friendly' as AIPersonality, label: 'Friendly', description: 'Warm and conversational' },
  { id: 'casual' as AIPersonality, label: 'Casual', description: 'Relaxed and laid-back' },
  { id: 'concise' as AIPersonality, label: 'Concise', description: 'Short and to the point' },
];

interface AISettingsState {
  personality: AIPersonality;
  setPersonality: (personality: AIPersonality) => void;
}

export const useAISettingsStore = create<AISettingsState>()(
  persist(
    (set) => ({
      personality: 'friendly',
      setPersonality: (personality) => set({ personality }),
    }),
    {
      name: 'blacktree-ai-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
