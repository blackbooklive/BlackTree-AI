import { create } from 'zustand';
import { api } from '@/lib/api/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

interface ConversationState {
  conversations: Conversation[];
  currentConversationId: string | null;
  currentMessages: Message[];
  isLoading: boolean;

  // Actions
  loadConversations: () => Promise<void>;
  createConversation: (title: string) => Promise<string | null>;
  loadConversation: (id: string) => Promise<void>;
  addMessage: (conversationId: string, role: 'user' | 'assistant', content: string) => Promise<Message | null>;
  deleteConversation: (id: string) => Promise<void>;
  startNewChat: () => void;
  setCurrentMessages: (messages: Message[]) => void;
  updateLastAssistantMessage: (content: string) => void;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  currentConversationId: null,
  currentMessages: [],
  isLoading: false,

  loadConversations: async () => {
    try {
      set({ isLoading: true });
      const conversations = await api.get<Conversation[]>('/api/ai/conversations');
      set({ conversations: conversations || [] });
    } catch (error) {
      console.log('[Conversations] Failed to load:', error);
      set({ conversations: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  createConversation: async (title: string) => {
    try {
      const conversation = await api.post<Conversation>('/api/ai/conversations', { title });
      if (conversation) {
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          currentConversationId: conversation.id,
          // Keep existing messages - don't clear them when creating a new conversation
        }));
        return conversation.id;
      }
      return null;
    } catch (error) {
      console.log('[Conversations] Failed to create:', error);
      return null;
    }
  },

  loadConversation: async (id: string) => {
    try {
      set({ isLoading: true });
      const conversation = await api.get<Conversation>(`/api/ai/conversations/${id}`);
      if (conversation) {
        const messages = (conversation.messages || []).map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          createdAt: m.createdAt,
        }));
        set({
          currentConversationId: id,
          currentMessages: messages,
        });
      }
    } catch (error) {
      console.log('[Conversations] Failed to load conversation:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addMessage: async (conversationId: string, role: 'user' | 'assistant', content: string) => {
    try {
      const message = await api.post<Message>(`/api/ai/conversations/${conversationId}/messages`, {
        role,
        content,
      });
      return message || null;
    } catch (error) {
      console.log('[Conversations] Failed to add message:', error);
      return null;
    }
  },

  deleteConversation: async (id: string) => {
    try {
      await api.delete(`/api/ai/conversations/${id}`);
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        currentConversationId: state.currentConversationId === id ? null : state.currentConversationId,
        currentMessages: state.currentConversationId === id ? [] : state.currentMessages,
      }));
    } catch (error) {
      console.log('[Conversations] Failed to delete:', error);
    }
  },

  startNewChat: () => {
    set({
      currentConversationId: null,
      currentMessages: [],
    });
  },

  setCurrentMessages: (messages: Message[]) => {
    set({ currentMessages: messages });
  },

  updateLastAssistantMessage: (content: string) => {
    set((state) => {
      const messages = [...state.currentMessages];
      const lastIndex = messages.length - 1;
      if (lastIndex >= 0 && messages[lastIndex].role === 'assistant') {
        messages[lastIndex] = { ...messages[lastIndex], content };
      }
      return { currentMessages: messages };
    });
  },
}));
