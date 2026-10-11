import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  FlatList,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Brain, Zap, Shield, Globe, ChevronRight } from 'lucide-react-native';
import { Image } from 'expo-image';
import { colors, fonts, borderRadius, spacing } from '@/lib/theme';
import { useOnboardingStore } from '@/stores/onboardingStore';

const BlackTreeLogo = require('@/../assets/images/reference-tree.png');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface WelcomeSlide {
  id: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  title: string;
  subtitle: string;
  description: string;
}

const SLIDES: WelcomeSlide[] = [
  {
    id: '1',
    icon: Brain,
    title: 'Smarter Than the Rest',
    subtitle: 'Powered by Claude Opus',
    description: 'The most advanced AI on the planet. Get answers that other AI assistants simply can\'t match.',
  },
  {
    id: '2',
    icon: Zap,
    title: 'Ask Anything',
    subtitle: 'No Limits',
    description: 'Medicine, law, finance, cooking, relationships, business, coding - BlackTree AI handles it all with expert-level knowledge.',
  },
  {
    id: '3',
    icon: Globe,
    title: 'Your Local Expert',
    subtitle: 'Real Recommendations',
    description: 'Find the best restaurants, events, and hidden gems near you. Real addresses, phone numbers, and ticket links.',
  },
  {
    id: '4',
    icon: Shield,
    title: 'Always Honest',
    subtitle: 'No BS',
    description: 'BlackTree AI tells you the truth. No hallucinations, no made-up facts. Just real, reliable answers you can trust.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      handleGetStarted();
    }
  };

  const handleGetStarted = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeOnboarding();
    router.replace('/sign-in');
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleGetStarted();
  };

  const renderSlide = ({ item, index }: { item: WelcomeSlide; index: number }) => {
    const Icon = item.icon;
    return (
      <View style={styles.slide}>
        <Animated.View entering={FadeIn.delay(200)} style={styles.iconContainer}>
          <Icon size={60} color={colors.accent} />
        </Animated.View>
        <Animated.Text entering={FadeInDown.delay(300)} style={styles.slideTitle}>
          {item.title}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(400)} style={styles.slideSubtitle}>
          {item.subtitle}
        </Animated.Text>
        <Animated.Text entering={FadeInDown.delay(500)} style={styles.slideDescription}>
          {item.description}
        </Animated.Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header with logo */}
      <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
        <Image source={BlackTreeLogo} style={styles.logo} contentFit="contain" />
        <View style={styles.titleRow}>
          <Text style={styles.title}>BLACKTREE</Text>
          <Text style={styles.titleAi}>AI</Text>
        </View>
      </Animated.View>

      {/* Skip button */}
      <Pressable style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={styles.flatList}
      />

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>

      {/* Bottom buttons */}
      <Animated.View entering={FadeInUp.delay(600)} style={styles.bottomSection}>
        <Pressable style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {currentIndex === SLIDES.length - 1 ? "Let's Go" : 'Next'}
          </Text>
          <ChevronRight size={20} color={colors.background} />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  logo: {
    width: 80,
    height: 80,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.sm,
  },
  title: {
    fontFamily: fonts.header,
    fontSize: 20,
    color: colors.text,
    letterSpacing: 2,
  },
  titleAi: {
    fontFamily: fonts.header,
    fontSize: 20,
    color: colors.accent,
    letterSpacing: 2,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: spacing.lg,
    zIndex: 10,
  },
  skipText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textSecondary,
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  slideTitle: {
    fontFamily: fonts.header,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  slideSubtitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  slideDescription: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.accent,
  },
  bottomSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  nextButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.background,
  },
});
