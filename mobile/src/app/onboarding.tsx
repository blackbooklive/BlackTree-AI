import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { MapPin, Phone, Ticket, MessageCircle, Camera } from 'lucide-react-native';
import { Image } from 'expo-image';
import { colors, fonts, borderRadius, spacing } from '@/lib/theme';
import { useOnboardingStore } from '@/stores/onboardingStore';

const BlackTreeLogo = require('@/../assets/images/blacktree-logo.png');

export default function OnboardingScreen() {
  const router = useRouter();
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);

  const handleGetStarted = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo and Header */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <Image source={BlackTreeLogo} style={styles.logo} contentFit="contain" />
          <View style={styles.titleRow}>
            <Text style={styles.title}>BLACKTREE</Text>
            <Text style={styles.titleAi}>AI</Text>
          </View>
          <Text style={styles.tagline}>Your AI-Powered Local Guide</Text>
        </Animated.View>

        {/* Feature Highlights */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.featuresContainer}>
          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <MapPin size={22} color={colors.accent} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Find Local Spots</Text>
              <Text style={styles.featureDescription}>Discover restaurants, events & nightlife near you</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Phone size={22} color={colors.accent} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Instant Info</Text>
              <Text style={styles.featureDescription}>Get addresses & phone numbers right away</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Ticket size={22} color={colors.accent} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Buy Tickets</Text>
              <Text style={styles.featureDescription}>Direct links to purchase event tickets</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <MessageCircle size={22} color={colors.accent} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Chat with BlackTree AI</Text>
              <Text style={styles.featureDescription}>Ask anything and get instant smart answers</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <Camera size={22} color={colors.accent} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Snap & Learn</Text>
              <Text style={styles.featureDescription}>Take a picture and AI explains what it is</Text>
            </View>
          </View>
        </Animated.View>

        {/* Bottom Section */}
        <Animated.View entering={FadeInUp.delay(500)} style={styles.bottomSection}>
          <Text style={styles.ctaText}>Find. Explore. Discover.</Text>

          <Pressable style={styles.getStartedButton} onPress={handleGetStarted}>
            <Text style={styles.getStartedButtonText}>Get Started</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginTop: spacing.xl * 2,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontFamily: fonts.header,
    fontSize: 32,
    color: colors.text,
    letterSpacing: 3,
  },
  titleAi: {
    fontFamily: fonts.header,
    fontSize: 32,
    color: colors.accent,
    letterSpacing: 3,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  featuresContainer: {
    marginTop: spacing.xl * 2,
    gap: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 17,
    color: colors.text,
    marginBottom: 2,
  },
  featureDescription: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  bottomSection: {
    marginTop: 'auto',
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: fonts.body,
    fontSize: 18,
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: spacing.lg,
  },
  getStartedButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl * 2,
    width: '100%',
    alignItems: 'center',
  },
  getStartedButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.background,
  },
});
