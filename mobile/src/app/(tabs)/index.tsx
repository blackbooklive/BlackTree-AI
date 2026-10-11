import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Send, Crown, User, Plus, MessageSquare, Trash2, ChevronLeft } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { colors, fonts, borderRadius } from '@/lib/theme';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { SparklingAtmosphere } from '@/components/SparklingAtmosphere';
import { useSubscription } from '@/hooks/useSubscription';
import { useUsageStore } from '@/stores/usageStore';
import { useAISettingsStore } from '@/stores/aiSettingsStore';
import { useProfileStore } from '@/stores/profileStore';
import { useConversationStore } from '@/stores/conversationStore';
import { useSession } from '@/lib/auth/use-session';
import { BACKEND_URL } from '@/lib/config';

// Helper to render text with clickable links
const renderTextWithLinks = (text: string, textStyle: object) => {
  if (!text) return null;

  const urlRegex = /(https?:\/\/[^\s\)]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Test with a fresh regex to avoid lastIndex issues
    const isUrl = /^https?:\/\/[^\s\)]+$/.test(part);
    if (isUrl) {
      return (
        <Text
          key={index}
          style={[textStyle, { color: colors.accent, textDecorationLine: 'underline' }]}
          onPress={() => {
            
            Linking.openURL(part);
          }}
        >
          {part}
        </Text>
      );
    }
    return <Text key={index} style={textStyle}>{part}</Text>;
  });
};

const BlackTreeLogo = require('@/../assets/images/reference-tree.png');

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const baseUrl = BACKEND_URL;

export default function ChatScreen() {
  const router = useRouter();
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

  const { isPro, isLoading: isSubscriptionLoading } = useSubscription();
  const canSendMessage = useUsageStore((s) => s.canSendMessage);
  const incrementMessages = useUsageStore((s) => s.incrementMessages);
  const getRemainingMessages = useUsageStore((s) => s.getRemainingMessages);
  const personality = useAISettingsStore((s) => s.personality);
  const profilePictureUri = useProfileStore((s) => s.profilePictureUri);

  // Conversation store
  const conversations = useConversationStore((s) => s.conversations);
  const currentConversationId = useConversationStore((s) => s.currentConversationId);
  const currentMessages = useConversationStore((s) => s.currentMessages);
  const loadConversations = useConversationStore((s) => s.loadConversations);
  const createConversation = useConversationStore((s) => s.createConversation);
  const loadConversation = useConversationStore((s) => s.loadConversation);
  const addMessage = useConversationStore((s) => s.addMessage);
  const deleteConversation = useConversationStore((s) => s.deleteConversation);
  const startNewChat = useConversationStore((s) => s.startNewChat);
  const setCurrentMessages = useConversationStore((s) => s.setCurrentMessages);
  const updateLastAssistantMessage = useConversationStore((s) => s.updateLastAssistantMessage);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const remaining = getRemainingMessages(isPro);

  // Get user's timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Load conversations when logged in
  useEffect(() => {
    if (isLoggedIn) {
      loadConversations();
    }
  }, [isLoggedIn]);

  // Request location permission and get location on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({});
          setCoordinates({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          const [address] = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          if (address) {
            const locationStr = [address.city, address.region, address.country]
              .filter(Boolean)
              .join(', ');
            setUserLocation(locationStr);
          }
        } catch {
          // Location not available
        }
      }
    })();
  }, []);

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated });
    }, animated ? 50 : 0);
  }, []);

  const openPaywall = () => {
    
    router.push('/paywall');
  };

  const handleNewChat = () => {
    
    startNewChat();
    setShowHistory(false);
  };

  const handleSelectConversation = async (id: string) => {
    
    await loadConversation(id);
    setShowHistory(false);
    scrollToBottom();
  };

  const handleDeleteConversation = async (id: string) => {
    
    await deleteConversation(id);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // Only check limits if subscription status is loaded
    if (!isSubscriptionLoading && !canSendMessage(isPro)) {
      openPaywall();
      return;
    }

    try {
      incrementMessages();

      const userMessageContent = input.trim();
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: userMessageContent,
      };

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
      };

      // Update local state
      const newMessages = [...currentMessages, userMessage, assistantMessage];
      setCurrentMessages(newMessages);
      setInput('');
      setIsLoading(true);
      Keyboard.dismiss();
      scrollToBottom(false); // snap instantly, no animation

      // Create conversation if needed (only for logged-in users)
      let conversationId = currentConversationId;
      if (isLoggedIn && !conversationId) {
        // Use first few words of user message as title
        const title = userMessageContent.slice(0, 50) + (userMessageContent.length > 50 ? '...' : '');
        conversationId = await createConversation(title);
      }

      // Save user message to backend (if logged in and has conversation)
      if (isLoggedIn && conversationId) {
        await addMessage(conversationId, 'user', userMessageContent);
      }

      try {
        const apiMessages = [...currentMessages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        console.log('[Chat] Sending request to API...');

        // React Native's fetch does not support response.body streaming.
        // Use XMLHttpRequest with onprogress for real-time SSE streaming.
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${baseUrl}/api/ai/chat`);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.timeout = 60000;

          let processed = 0;
          let accumulatedContent = '';
          let lastRenderedContent = '';

          // Throttle UI updates to ~20fps instead of every character
          const flushInterval = setInterval(() => {
            if (accumulatedContent !== lastRenderedContent) {
              lastRenderedContent = accumulatedContent;
              updateLastAssistantMessage(accumulatedContent);
              scrollToBottom();
            }
          }, 50);

          const processChunk = (chunk: string) => {
            const lines = chunk.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data: ')) continue;
              const payload = trimmed.slice(6);
              if (payload === '[DONE]') return;
              try {
                const parsed = JSON.parse(payload) as { type: string; delta: string };
                if (parsed.type === 'response.output_text.delta' && parsed.delta) {
                  accumulatedContent += parsed.delta;
                  // Don't update UI here - let the interval handle it
                }
              } catch {
                // ignore malformed lines
              }
            }
          };

          xhr.onprogress = () => {
            const newText = xhr.responseText.slice(processed);
            processed = xhr.responseText.length;
            processChunk(newText);
          };

          xhr.onload = () => {
            clearInterval(flushInterval);
            // Process any remaining text
            const remaining = xhr.responseText.slice(processed);
            if (remaining) processChunk(remaining);

            if (xhr.status < 200 || xhr.status >= 300) {
              reject(new Error(`Server error: ${xhr.status}`));
              return;
            }

            const content = accumulatedContent || 'Sorry, I could not generate a response.';
            console.log('[Chat] Stream complete, length:', content.length);
            updateLastAssistantMessage(content);
            scrollToBottom();

            if (isLoggedIn && conversationId) {
              addMessage(conversationId, 'assistant', content).then(() => resolve()).catch(() => resolve());
            } else {
              resolve();
            }
          };

          xhr.ontimeout = () => {
            clearInterval(flushInterval);
            reject(Object.assign(new Error('AbortError'), { name: 'AbortError' }));
          };

          xhr.onerror = () => {
            clearInterval(flushInterval);
            reject(new TypeError('Network request failed'));
          };

          xhr.send(JSON.stringify({
            messages: apiMessages,
            stream: true,
            timezone,
            location: userLocation || undefined,
            coordinates: coordinates || undefined,
            personality,
          }));
        });
      } catch (error: unknown) {
        console.error('[Chat] Exception:', error);
        const isAbort = error instanceof Error && error.name === 'AbortError';
        const isNetwork = error instanceof TypeError && error.message === 'Network request failed';
        const msg = isAbort
          ? 'The request timed out. Please try again.'
          : isNetwork
          ? 'Network error. Please check your connection and try again.'
          : 'Sorry, something went wrong. Please try again.';
        updateLastAssistantMessage(msg);
      } finally {
        setIsLoading(false);
      }
    } catch (outerError) {
      console.error('[Chat] Outer exception:', outerError);
      setIsLoading(false);
    }
  };

  // History sidebar
  if (showHistory) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.historyHeader}>
          <Pressable style={styles.backButton} onPress={() => setShowHistory(false)}>
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.historyTitle}>Chat History</Text>
          <Pressable style={styles.newChatButton} onPress={handleNewChat}>
            <Plus size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.historyList}>
          {conversations.length === 0 ? (
            <View style={styles.emptyHistory}>
              <MessageSquare size={48} color={colors.textMuted} />
              <Text style={styles.emptyHistoryText}>No conversations yet</Text>
              <Text style={styles.emptyHistorySubtext}>Your chat history will appear here</Text>
            </View>
          ) : (
            conversations.map((conv) => (
              <Animated.View key={conv.id} entering={FadeIn}>
                <Pressable
                  style={[
                    styles.conversationItem,
                    conv.id === currentConversationId && styles.conversationItemActive,
                  ]}
                  onPress={() => handleSelectConversation(conv.id)}
                >
                  <View style={styles.conversationInfo}>
                    <MessageSquare size={18} color={colors.textSecondary} />
                    <Text style={styles.conversationTitle} numberOfLines={1}>
                      {conv.title}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => handleDeleteConversation(conv.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 size={16} color={colors.error} />
                  </Pressable>
                </Pressable>
              </Animated.View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with Pro badge or remaining count */}
      <View style={styles.header}>
        {isLoggedIn ? (
          <Pressable
            style={styles.historyButton}
            onPress={() => {
              
              setShowHistory(true);
            }}
          >
            <MessageSquare size={18} color={colors.text} />
          </Pressable>
        ) : null}
        <View style={styles.headerRight}>
          {isLoggedIn && currentConversationId ? (
            <Pressable style={styles.newChatHeaderButton} onPress={handleNewChat}>
              <Plus size={18} color={colors.text} />
            </Pressable>
          ) : null}
          {isSubscriptionLoading ? null : isPro ? (
            <View style={styles.proBadge}>
              <Crown size={14} color={colors.background} />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.flex}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
        >
          {currentMessages.length === 0 ? (
            <Animated.View entering={FadeInDown.delay(200)} style={styles.emptyState}>
              <SparklingAtmosphere />
              <View style={styles.titleOverlay}>
                <Image source={BlackTreeLogo} style={styles.heroLogo} contentFit="contain" />
                <View style={styles.titleRow}>
                  <Text style={styles.emptyTitle}>BLACKTREE</Text>
                  <Text style={styles.emptyTitleAi}>AI</Text>
                </View>
                <Text style={styles.emptySubtitle}>Sharp. Professional. Direct.</Text>
              </View>
            </Animated.View>
          ) : null}

          {currentMessages.map((message, index) => (
            <Animated.View
              key={message.id}
              entering={FadeInUp.delay(index * 50).springify()}
              style={[
                styles.messageRow,
                message.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant,
              ]}
            >
              {message.role === 'assistant' ? (
                <View style={styles.avatarAssistant}>
                  <Image source={BlackTreeLogo} style={styles.avatarImage} contentFit="contain" />
                </View>
              ) : null}

              <View style={styles.messageContent}>
                {message.role === 'assistant' && !message.content ? (
                  <LoadingIndicator size={24} />
                ) : message.role === 'assistant' ? (
                  <Text style={[styles.messageText, styles.assistantText]}>
                    {renderTextWithLinks(message.content || '', { ...styles.messageText, ...styles.assistantText })}
                  </Text>
                ) : (
                  <Text style={[styles.messageText, styles.userText]}>
                    {message.content || ''}
                  </Text>
                )}
              </View>

              {message.role === 'user' ? (
                profilePictureUri ? (
                  <Image source={{ uri: profilePictureUri }} style={styles.avatarUserImage} contentFit="cover" />
                ) : (
                  <View style={styles.avatarUser}>
                    <User size={14} color={colors.textMuted} />
                  </View>
                )
              ) : null}
            </Animated.View>
          ))}
        </ScrollView>

        <View style={styles.inputContainer}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Type your message..."
              placeholderTextColor={colors.textMuted}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
              onSubmitEditing={sendMessage}
              blurOnSubmit={false}
            />
            <Pressable
              style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
              onPress={sendMessage}
              disabled={!input.trim() || isLoading}
            >
              <Send size={20} color={!input.trim() || isLoading ? colors.textMuted : colors.background} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  proBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.background,
  },
  usageBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  usageBadgeText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  heroLogo: {
    width: 400,
    height: 400,
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: fonts.header,
    fontSize: 22,
    color: colors.text,
    letterSpacing: 2,
  },
  emptyTitleAi: {
    fontFamily: fonts.header,
    fontSize: 22,
    color: colors.accent,
    letterSpacing: 2,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  avatarAssistant: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 20,
    height: 20,
  },
  avatarUser: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUserImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginLeft: 8,
  },
  messageContent: {
    maxWidth: '75%',
    paddingVertical: 4,
  },
  messageText: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#FFD700',
  },
  assistantText: {
    color: colors.text,
  },
  inputContainer: {
    overflow: 'hidden',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    maxHeight: 120,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#00D4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.surface,
  },
  titleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // History styles
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.text,
  },
  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyList: {
    padding: 16,
    gap: 8,
  },
  emptyHistory: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyHistoryText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.text,
    marginTop: 16,
  },
  emptyHistorySubtext: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  conversationItemActive: {
    borderColor: colors.accent,
    backgroundColor: colors.primaryDim,
  },
  conversationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  conversationTitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
