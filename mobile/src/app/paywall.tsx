import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { X, Check, MapPin, Ticket, MessageCircle, Compass, Crown } from 'lucide-react-native';

const BlackTreeLogo = require('@/../assets/images/blacktree-logo.png');
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { colors, fonts, borderRadius } from '@/lib/theme';
import { useSubscription } from '@/hooks/useSubscription';
import { isRevenueCatEnabled } from '@/lib/revenuecatClient';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import type { PurchasesPackage } from 'react-native-purchases';

const FEATURES = [
  { icon: Compass, text: 'Explorer - Discover local restaurants, events & more' },
  { icon: MapPin, text: 'Location-based recommendations' },
  { icon: MessageCircle, text: 'Unlimited AI chat conversations' },
  { icon: Crown, text: 'Access to all premium features' },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { packages, purchase, restore, isLoading, isPro } = useSubscription();
  const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  // Auto-select yearly if available
  React.useEffect(() => {
    if (packages.length > 0 && !selectedPackage) {
      const yearly = packages.find(p => p.identifier === '$rc_annual');
      setSelectedPackage(yearly || packages[0]);
    }
  }, [packages, selectedPackage]);

  // If already subscribed with a PAID subscription (not just trial), close paywall
  React.useEffect(() => {
    if (!isLoading && isPro && packages.length === 0) {
      // Only auto-close if packages finished loading and user has paid pro (not trial)
      // We check this by seeing if RevenueCat is enabled - if not, don't auto-close
    }
  }, [isPro, isLoading, packages]);

  const handlePurchase = async () => {
    if (!selectedPackage || purchasing) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPurchasing(true);

    const success = await purchase(selectedPackage);

    setPurchasing(false);

    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    }
  };

  const handleRestore = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const restoredPro = await restore();

    if (restoredPro) {
      Alert.alert('Restored!', 'Your subscription has been restored.');
      router.back();
    } else {
      Alert.alert('No purchases found', 'We couldn\'t find any previous purchases to restore.');
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const getPackagePrice = (pkg: PurchasesPackage) => {
    return pkg.product.priceString;
  };

  const getPackagePeriod = (pkg: PurchasesPackage) => {
    if (pkg.identifier === '$rc_annual') return '/year';
    if (pkg.identifier === '$rc_monthly') return '/month';
    return '';
  };

  const getSavingsText = () => {
    const monthly = packages.find(p => p.identifier === '$rc_monthly');
    const yearly = packages.find(p => p.identifier === '$rc_annual');

    if (monthly && yearly) {
      const monthlyPrice = monthly.product.price;
      const yearlyPrice = yearly.product.price;
      const yearlyMonthly = yearlyPrice / 12;
      const savings = Math.round((1 - yearlyMonthly / monthlyPrice) * 100);
      return savings > 0 ? `Save ${savings}%` : null;
    }
    return null;
  };

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.webMessage}>
          <Image source={BlackTreeLogo} style={styles.webLogo} contentFit="contain" />
          <Text style={styles.webTitle}>BlackTree AI Pro</Text>
          <Text style={styles.webText}>
            To subscribe to BlackTree AI Pro, please use the mobile app on your iPhone or Android device.
          </Text>
          <Pressable style={styles.closeButtonLarge} onPress={handleClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Close button */}
      <Pressable style={styles.closeButton} onPress={handleClose}>
        <X size={24} color={colors.textSecondary} />
      </Pressable>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <Image source={BlackTreeLogo} style={styles.logo} contentFit="contain" />
          <Text style={styles.title}>BLACKTREE AI</Text>
          <Text style={styles.proText}>PRO</Text>
          <Text style={styles.subtitle}>Unlock the full experience</Text>
        </Animated.View>

        {/* Features */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.featuresContainer}>
          {FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Check size={16} color={colors.accent} />
              </View>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Packages */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <LoadingIndicator size={32} />
          </View>
        ) : (
          <Animated.View entering={FadeInDown.delay(300)} style={styles.packagesContainer}>
            {packages.map((pkg) => {
              const isSelected = selectedPackage?.identifier === pkg.identifier;
              const isYearly = pkg.identifier === '$rc_annual';
              const savings = isYearly ? getSavingsText() : null;

              return (
                <Pressable
                  key={pkg.identifier}
                  style={[styles.packageCard, isSelected && styles.packageCardSelected]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedPackage(pkg);
                  }}
                >
                  {savings ? (
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsText}>{savings}</Text>
                    </View>
                  ) : null}
                  <View style={styles.packageRadio}>
                    <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                      {isSelected ? <View style={styles.radioInner} /> : null}
                    </View>
                  </View>
                  <View style={styles.packageInfo}>
                    <Text style={styles.packageTitle}>
                      {isYearly ? 'Yearly' : 'Monthly'}
                    </Text>
                    <Text style={styles.packagePrice}>
                      {getPackagePrice(pkg)}{getPackagePeriod(pkg)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
        )}

        {/* Subscribe button */}
        <Animated.View entering={FadeInUp.delay(400)}>
          {isPro && packages.length === 0 && isRevenueCatEnabled() ? (
            <View style={[styles.subscribeButton, { backgroundColor: colors.surface }]}>
              <Text style={[styles.subscribeButtonText, { color: colors.accent }]}>You're already subscribed!</Text>
            </View>
          ) : (
            <Pressable
              style={[styles.subscribeButton, (purchasing || !selectedPackage) && styles.subscribeButtonDisabled]}
              onPress={handlePurchase}
              disabled={purchasing || !selectedPackage}
            >
              {purchasing ? (
                <LoadingIndicator size={24} color={colors.background} />
              ) : (
                <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
              )}
            </Pressable>
          )}

          <Pressable style={styles.restoreButton} onPress={handleRestore}>
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          </Pressable>
        </Animated.View>

        {/* Terms */}
        <Text style={styles.terms}>
          Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
          Manage subscriptions in your device settings.
        </Text>

        {/* Legal Links */}
        <View style={styles.legalLinks}>
          <Pressable onPress={() => router.push('/terms')}>
            <Text style={styles.legalLinkText}>Terms of Use</Text>
          </Pressable>
          <Text style={styles.legalSeparator}>|</Text>
          <Pressable onPress={() => router.push('/privacy')}>
            <Text style={styles.legalLinkText}>Privacy Policy</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  webLogo: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  title: {
    fontFamily: fonts.header,
    fontSize: 28,
    color: colors.accent,
    letterSpacing: 3,
    marginBottom: 4,
  },
  proText: {
    fontFamily: fonts.header,
    fontSize: 24,
    color: colors.accent,
    letterSpacing: 6,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textSecondary,
  },
  featuresContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 20,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  featureIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  loadingContainer: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packagesContainer: {
    gap: 12,
    marginBottom: 24,
  },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    overflow: 'visible',
  },
  packageCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  savingsBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  savingsText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    color: colors.background,
    textTransform: 'uppercase',
  },
  packageRadio: {
    marginRight: 12,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.accent,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },
  packageInfo: {
    flex: 1,
  },
  packageTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: 2,
  },
  packagePrice: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  subscribeButton: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: 12,
  },
  subscribeButtonDisabled: {
    opacity: 0.5,
  },
  subscribeButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.background,
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  restoreButtonText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  terms: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  legalLinkText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  webMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  webTitle: {
    fontFamily: fonts.header,
    fontSize: 24,
    color: colors.text,
    marginBottom: 16,
  },
  webText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  closeButtonLarge: {
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: borderRadius.md,
  },
  closeButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.text,
  },
});
