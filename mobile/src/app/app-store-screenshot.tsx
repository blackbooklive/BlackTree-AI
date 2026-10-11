import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts } from '@/lib/theme';
import { MapPin, Phone, Ticket } from 'lucide-react-native';

const BlackTreeLogo = require('@/../assets/images/blacktree-logo.png');

const FEATURES = [
  { icon: MapPin, text: 'Find local restaurants, events & nightlife' },
  { icon: Phone, text: 'Get addresses & phone numbers instantly' },
  { icon: Ticket, text: 'Direct links to buy event tickets' },
];

export default function AppStoreScreenshot() {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#0A0A0A', '#111111']}
        style={StyleSheet.absoluteFill}
      />

      {/* Header Section */}
      <View style={styles.headerSection}>
        {/* Logo */}
        <Image source={BlackTreeLogo} style={styles.logo} contentFit="contain" />

        {/* Main Headline */}
        <Text style={styles.headline}>Your AI-Powered</Text>
        <Text style={styles.headlineAccent}>Local Guide</Text>

        {/* Tagline */}
        <Text style={styles.tagline}>Find. Explore. Discover.</Text>
      </View>

      {/* Feature Highlights */}
      <View style={styles.featuresSection}>
        {FEATURES.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Icon size={20} color={colors.accent} />
              </View>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          );
        })}
      </View>

      {/* Bottom accent line */}
      <View style={styles.bottomAccent}>
        <LinearGradient
          colors={['transparent', colors.accent, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.accentLine}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 24,
  },
  headline: {
    fontFamily: fonts.header,
    fontSize: 32,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 1,
  },
  headlineAccent: {
    fontFamily: fonts.header,
    fontSize: 36,
    color: colors.accent,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 12,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 3,
  },
  featuresSection: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 24,
    gap: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  bottomAccent: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  accentLine: {
    width: '60%',
    height: 2,
    borderRadius: 1,
  },
});
