import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Utensils, Calendar, Sparkles, Coffee, Music, ShoppingBag, Dumbbell, Send, Trash2, Phone, Lock, Crown, Ticket, Hotel, BedDouble } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { colors, fonts, borderRadius, spacing } from '@/lib/theme';
import { useSubscription } from '@/hooks/useSubscription';
import { callAnthropic, AnthropicMessage } from '@/lib/anthropicClient';

// Category images
const CategoryImages = {
  restaurants: require('@/../assets/images/category-restaurants.png'),
  events: require('@/../assets/images/category-events.png'),
  thingsToDo: require('@/../assets/images/explore_activity.png'),
  cafes: require('@/../assets/images/category-cafes.png'),
  nightlife: require('@/../assets/images/category-nightlife.png'),
  shopping: require('@/../assets/images/category-shopping.png'),
  fitness: require('@/../assets/images/category-fitness.png'),
  hotels: require('@/../assets/images/category-hotels.png'),
};

// Buy Tickets button rendered as a standalone block element
const BuyTicketsButton = ({ url, index }: { url: string; index: number }) => (
  <Pressable
    key={index}
    style={styles.buyTicketsButton}
    onPress={() => { Linking.openURL(url); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
  >
    <View style={styles.buyTicketsBadge}>
      <Ticket size={18} color="#fff" />
    </View>
    <Text style={styles.buyTicketsButtonText}>Get Tickets</Text>
    <Text style={styles.buyTicketsArrow}>→</Text>
  </Pressable>
);

// Book a Room button rendered as a standalone block element
const BookRoomButton = ({ url, index }: { url: string; index: number }) => (
  <Pressable
    key={index}
    style={styles.bookRoomButton}
    onPress={() => { Linking.openURL(url); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
  >
    <View style={styles.bookRoomBadge}>
      <BedDouble size={18} color="#fff" />
    </View>
    <Text style={styles.bookRoomButtonText}>Book a Room</Text>
    <Text style={styles.bookRoomArrow}>→</Text>
  </Pressable>
);

// Renders assistant message content with proper Buy Tickets / Book a Room buttons and phone/URL highlighting
const renderMessageContent = (text: string, baseTextStyle: object): React.ReactNode => {
  // Split text into segments: buy-tickets blocks, book-room blocks, vs text blocks
  const actionRegex = /\[BUY TICKETS:\s*(https?:\/\/[^\]]+)\]|\[BOOK ROOM:\s*(https?:\/\/[^\]]+)\]|(https?:\/\/(?:www\.)?(?:ticketmaster|eventbrite|stubhub|axs|seatgeek|livenation|tickets|vividseats)\.com[^\s]*)/gi;

  const segments: { type: 'text' | 'buy-tickets' | 'book-room'; content: string; url?: string }[] = [];
  let lastIndex = 0;
  let match;

  while ((match = actionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    if (match[1]) {
      segments.push({ type: 'buy-tickets', content: match[0], url: match[1].trim() });
    } else if (match[2]) {
      segments.push({ type: 'book-room', content: match[0], url: match[2].trim() });
    } else {
      segments.push({ type: 'buy-tickets', content: match[0], url: match[3].trim() });
    }
    lastIndex = actionRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return (
    <View>
      {segments.map((seg, i) => {
        if (seg.type === 'buy-tickets') {
          return <BuyTicketsButton key={i} url={seg.url!} index={i} />;
        }
        if (seg.type === 'book-room') {
          return <BookRoomButton key={i} url={seg.url!} index={i} />;
        }
        // Render text segment with inline phone and URL highlighting
        return (
          <Text key={i} style={baseTextStyle}>
            {renderInlineLinks(seg.content, baseTextStyle)}
          </Text>
        );
      })}
    </View>
  );
};

// Renders inline phone numbers and URLs as touchable text within a <Text> block
const renderInlineLinks = (text: string, textStyle: object): React.ReactNode[] => {
  const inlineRegex = /(https?:\/\/[^\s\)]+)|(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      // URL
      const url = match[1];
      parts.push(
        <Text
          key={match.index}
          style={{ color: colors.accent, textDecorationLine: 'underline' }}
          onPress={() => { Linking.openURL(url); }}
        >
          {url}
        </Text>
      );
    } else if (match[2]) {
      // Phone number
      const phone = match[2];
      const cleanPhone = phone.replace(/[^\d+]/g, '');
      parts.push(
        <Text
          key={match.index}
          style={{ color: '#4CAF50', fontWeight: '600' }}
          onPress={() => { Linking.openURL(`tel:${cleanPhone}`); }}
        >
          {phone}
        </Text>
      );
    }
    lastIndex = inlineRegex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
};

interface Category {
  id: string;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  prompt: string;
  image?: any;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const CATEGORIES: Category[] = [
  { id: 'restaurants', label: 'Restaurants', icon: Utensils, image: CategoryImages.restaurants, prompt: 'What are the best restaurants near me? Give me 5 great options with different cuisines. For each restaurant, include: name, cuisine type, address, phone number, and a brief description.' },
  { id: 'events', label: 'Events', icon: Calendar, image: CategoryImages.events, prompt: 'What events are happening in my area this week? Include concerts, festivals, shows, and local happenings. For each event, include the venue address and contact info if available. If tickets are available for purchase, include the ticket URL in this exact format: [BUY TICKETS: https://ticketmaster.com/event/123] — replace the URL with the real ticket purchase link.' },
  { id: 'things-to-do', label: 'Things to Do', icon: Sparkles, image: CategoryImages.thingsToDo, prompt: 'What are fun things to do in my area? Include attractions, activities, and hidden gems. For each place, include the address and phone number. If any attraction has ticketed events or requires tickets, include the ticket URL in this exact format: [BUY TICKETS: https://ticketmaster.com/event/123] — replace the URL with the real ticket purchase link.' },
  { id: 'cafes', label: 'Cafes', icon: Coffee, image: CategoryImages.cafes, prompt: 'What are the best coffee shops and cafes near me? Include cozy spots for working or hanging out. For each cafe, include the address and phone number.' },
  { id: 'nightlife', label: 'Nightlife', icon: Music, image: CategoryImages.nightlife, prompt: 'What are the best bars, clubs, and nightlife spots in my area? For each spot, include the address and phone number. If any spot has events, concerts, or ticketed nights coming up, include the ticket URL in this exact format: [BUY TICKETS: https://ticketmaster.com/event/123] — replace the URL with the real ticket purchase link.' },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag, image: CategoryImages.shopping, prompt: 'What are the best shopping spots near me? Include malls, boutiques, and unique stores. For each place, include the address and phone number.' },
  { id: 'fitness', label: 'Fitness', icon: Dumbbell, image: CategoryImages.fitness, prompt: 'What are the best gyms, fitness studios, and workout spots in my area? For each gym, include the address and phone number.' },
  { id: 'hotels', label: 'Hotels', icon: Hotel, image: CategoryImages.hotels, prompt: 'What are 5 great hotels near me? For each hotel include: hotel name, star rating, address, phone number, and price range per night. If the hotel has a booking website, include a booking link in this exact format: [BOOK ROOM: https://hotel-website.com] — replace the URL with the real hotel booking page.' },
];

export default function ExploreScreen() {
  const router = useRouter();
  const { isPro, isLoading: isSubscriptionLoading } = useSubscription();

  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const openPaywall = () => {
    
    router.push('/paywall');
  };

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
            const locationStr = [address.city, address.region]
              .filter(Boolean)
              .join(', ');
            setUserLocation(locationStr);
          }
        } catch {
          setUserLocation('Location unavailable');
        }
      } else {
        setUserLocation('Location access denied');
      }
      setLocationLoading(false);
    })();
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText.trim(),
    };

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);
    scrollToBottom();

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    // Safety timeout to prevent infinite loading (60 seconds max)
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    loadingTimeoutRef.current = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id && m.content === ''
            ? { ...m, content: 'Request timed out. Please try again.' }
            : m
        )
      );
    }, 60000);

    try {
      const locationContext = [
        userLocation ? `User location: ${userLocation}` : null,
        coordinates ? `Coordinates: ${coordinates.latitude}, ${coordinates.longitude}` : null,
        `Timezone: ${timezone}`,
      ].filter(Boolean).join('\n');

      const systemPrompt = `You are a helpful local guide. Answer concisely about local places, restaurants, events, activities, and hotels. ${locationContext}

CRITICAL FORMATTING RULES — YOU MUST FOLLOW THESE:
- Always include phone numbers for each place in this format: (555) 123-4567
- For ANY event, concert, show, club night, or ticketed experience, you MUST place a ticket link on its OWN line using EXACTLY this format:
  [BUY TICKETS: https://ticketmaster.com/search?q=event+name+city]
  Use real search URLs from Ticketmaster, Eventbrite, or StubHub that would find this event.
  Example: [BUY TICKETS: https://www.ticketmaster.com/search?q=jazz+festival+miami]
  Example: [BUY TICKETS: https://www.eventbrite.com/d/local/nightclub-events/]
- Place the [BUY TICKETS:] line IMMEDIATELY after describing each event/venue that charges admission.
- NEVER skip ticket links for events, concerts, clubs, or shows.
- For ANY hotel listing, you MUST place a booking link on its OWN line using EXACTLY this format:
  [BOOK ROOM: https://hotel-website.com]
  Use the real hotel website or a booking page (e.g. from the hotel's own site, booking.com, or hotels.com).
  Example: [BOOK ROOM: https://www.marriott.com/en-us/hotels/miamc-miami-marriott-biscayne-bay/overview/]
  Example: [BOOK ROOM: https://www.booking.com/hotel/us/hilton-miami-downtown.html]
- Place the [BOOK ROOM:] line IMMEDIATELY after describing each hotel.
- NEVER skip booking links for hotels.`;

      const anthropicMessages: AnthropicMessage[] = [...messages, userMessage].map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const content = await callAnthropic(anthropicMessages, systemPrompt);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id ? { ...m, content } : m
        )
      );
      scrollToBottom();
      
    } catch (error: unknown) {
      // Ignore abort errors - they happen when user clears chat
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
            : m
        )
      );
      
    } finally {
      // Clear the safety timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  const handleCategoryPress = (category: Category) => {
    
    setSelectedCategory(category);
    sendMessage(category.prompt);
  };

  const handleSend = () => {
    sendMessage(input);
  };

  const clearChat = () => {
    
    // Clear safety timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Reset all state immediately
    setIsLoading(false);
    setSelectedCategory(null);
    setMessages([]);
  };

  // Clean up any stuck empty messages on mount and when loading finishes
  useEffect(() => {
    if (!isLoading) {
      setMessages((prev) => prev.filter((m) => m.content !== '' || m.role !== 'assistant'));
    }
  }, [isLoading]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Find Local Spots</Text>
          {messages.length > 0 && (
            <Pressable style={styles.clearButton} onPress={clearChat}>
              <Trash2 size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
        <View style={styles.locationRow}>
          <MapPin size={16} color={colors.accent} />
          {locationLoading ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={styles.locationText}>{userLocation || 'Unknown location'}</Text>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <>
              <Text style={styles.sectionTitle}>Quick search</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesRow}
              >
                {CATEGORIES.map((category, index) => {
                  const Icon = category.icon;
                  return (
                    <Animated.View
                      key={category.id}
                      entering={FadeInDown.delay(index * 30).springify()}
                    >
                      <Pressable
                        style={styles.categoryChip}
                        onPress={() => handleCategoryPress(category)}
                      >
                        <Icon size={18} color={colors.accent} />
                        <Text style={styles.categoryChipLabel}>{category.label}</Text>
                      </Pressable>
                    </Animated.View>
                  );
                })}
              </ScrollView>

              <Animated.View entering={FadeInDown.delay(200)} style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Discover your area</Text>
                <Text style={styles.emptySubtitle}>
                  Ask me about restaurants, events, things to do, or anything local!
                </Text>
              </Animated.View>
            </>
          ) : (
            <>
              {/* Selected category as tall column first, then others as chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesRowMixed}
              >
                {/* Render selected category first so it's always visible */}
                {selectedCategory?.image ? (() => {
                  const SelectedIcon = selectedCategory.icon;
                  return (
                    <View key={selectedCategory.id}>
                      <Pressable
                        style={styles.categoryCard}
                        onPress={() => handleCategoryPress(selectedCategory)}
                      >
                        <Image
                          source={selectedCategory.image}
                          style={styles.categoryCardImage}
                          contentFit="cover"
                        />
                        <View style={styles.categoryCardLabelContainer}>
                          <SelectedIcon size={16} color={colors.accent} />
                          <Text style={styles.categoryCardLabel}>{selectedCategory.label}</Text>
                        </View>
                      </Pressable>
                    </View>
                  );
                })() : null}

                {/* Render other categories as chips */}
                {CATEGORIES.filter(cat => cat.id !== selectedCategory?.id).map((category) => {
                  const Icon = category.icon;
                  return (
                    <Pressable
                      key={category.id}
                      style={styles.categoryChipSmall}
                      onPress={() => handleCategoryPress(category)}
                    >
                      <Icon size={16} color={colors.accent} />
                      <Text style={styles.categoryChipLabelSmall}>{category.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Messages */}
              {messages.map((message, index) => (
                <Animated.View
                  key={message.id}
                  entering={FadeInUp.delay(index * 30).springify()}
                  style={[
                    styles.messageRow,
                    message.role === 'user' ? styles.messageRowUser : styles.messageRowAssistant,
                  ]}
                >
                  <View style={styles.messageContent}>
                    {message.role === 'assistant' && message.content === '' && isLoading ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color={colors.accent} />
                        <Text style={styles.loadingText}>Finding places...</Text>
                      </View>
                    ) : message.role === 'assistant' ? (
                      renderMessageContent(message.content, { ...styles.messageText, ...styles.assistantText })
                    ) : (
                      <Text
                        style={[
                          styles.messageText,
                          styles.userText,
                        ]}
                      >
                        {message.content}
                      </Text>
                    )}
                  </View>
                </Animated.View>
              ))}
            </>
          )}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputContainer}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Ask about local places..."
              placeholderTextColor={colors.textMuted}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={500}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
            />
            <Pressable
              style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
              onPress={handleSend}
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
  lockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  lockedCard: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 320,
  },
  lockedIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  lockedTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 20,
    color: colors.text,
    marginBottom: 8,
  },
  lockedDescription: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  upgradeButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.header,
    fontSize: 24,
    color: colors.text,
    letterSpacing: 1,
  },
  clearButton: {
    padding: spacing.xs,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  locationText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexGrow: 1,
  },
  sectionTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  categoriesRow: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  categoriesRowMixed: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    alignItems: 'flex-start',
  },
  categoriesRowCompact: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  categoryImageColumn: {
    width: 120,
    height: 300,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    alignSelf: 'center',
  },
  categoryImageColumnImage: {
    width: '100%',
    height: '100%',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.text,
  },
  categoryChipLabelSmall: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.text,
  },
  categoryCard: {
    width: 140,
    height: 320,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryCardImage: {
    width: '100%',
    height: '75%',
  },
  categoryCardEmpty: {
    width: '100%',
    height: '75%',
    backgroundColor: colors.surface,
  },
  categoryCardLabelContainer: {
    height: '25%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  categoryCardLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.text,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    justifyContent: 'flex-start',
  },
  messageContent: {
    maxWidth: '85%',
    paddingVertical: 4,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
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
    padding: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    maxHeight: 100,
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
  buyTicketsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#FF4D00',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginVertical: 8,
    gap: 10,
    shadowColor: '#FF4D00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  buyTicketsBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyTicketsButtonText: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  buyTicketsArrow: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
  },
  bookRoomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#1A56DB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginVertical: 8,
    gap: 10,
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  bookRoomBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookRoomButtonText: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: '#fff',
    fontWeight: '700',
  },
  bookRoomArrow: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
  },
});
