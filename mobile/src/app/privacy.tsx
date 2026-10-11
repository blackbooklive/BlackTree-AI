import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { colors, fonts, borderRadius, spacing } from '@/lib/theme';

const EMAIL = 'Blacktreeai@yahoo.com';
const EmailLink = () => (
  <Text style={styles.emailHighlight} onPress={() => Linking.openURL(`mailto:${EMAIL}`)}>
    {EMAIL}
  </Text>
);

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Privacy Policy</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.lastUpdated}>Last Updated: February 2025</Text>

        <Text style={styles.sectionTitle}>1. Introduction</Text>
        <Text style={styles.paragraph}>
          BlackTree ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.
        </Text>

        <Text style={styles.sectionTitle}>2. Information We Collect</Text>
        <Text style={styles.paragraph}>
          <Text style={styles.bold}>Location Data:</Text> With your permission, we collect your device's location to provide personalized local recommendations for restaurants, events, and activities near you.{'\n\n'}
          <Text style={styles.bold}>Usage Data:</Text> We collect information about how you interact with the App, including features used, search queries, and preferences.{'\n\n'}
          <Text style={styles.bold}>Device Information:</Text> We may collect device type, operating system, and unique device identifiers.{'\n\n'}
          <Text style={styles.bold}>Account Information:</Text> If you create an account, we collect your email address and any profile information you provide.
        </Text>

        <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          We use the information we collect to:{'\n'}
          • Provide personalized local recommendations{'\n'}
          • Improve and optimize the App{'\n'}
          • Process subscription payments{'\n'}
          • Send you updates and notifications (with your consent){'\n'}
          • Respond to your inquiries and support requests{'\n'}
          • Comply with legal obligations
        </Text>

        <Text style={styles.sectionTitle}>4. Sharing of Information</Text>
        <Text style={styles.paragraph}>
          We do not sell your personal information. We may share your information with:{'\n'}
          • Service providers who assist in operating our App{'\n'}
          • Legal authorities when required by law{'\n'}
          • Business partners with your explicit consent
        </Text>

        <Text style={styles.sectionTitle}>5. Data Security</Text>
        <Text style={styles.paragraph}>
          We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure.
        </Text>

        <Text style={styles.sectionTitle}>6. Your Rights</Text>
        <Text style={styles.paragraph}>
          You have the right to:{'\n'}
          • Access your personal data{'\n'}
          • Correct inaccurate data{'\n'}
          • Request deletion of your data{'\n'}
          • Opt-out of marketing communications{'\n'}
          • Disable location services through your device settings
        </Text>

        <Text style={styles.sectionTitle}>7. Third-Party Services</Text>
        <Text style={styles.paragraph}>
          Our App may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to read their privacy policies.
        </Text>

        <Text style={styles.sectionTitle}>8. Children's Privacy</Text>
        <Text style={styles.paragraph}>
          Our App is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe we have collected such information, please contact us immediately at <EmailLink />
        </Text>

        <Text style={styles.sectionTitle}>9. Changes to This Policy</Text>
        <Text style={styles.paragraph}>
          We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy in the App and updating the "Last Updated" date.
        </Text>

        <Text style={styles.sectionTitle}>10. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have questions or concerns about this Privacy Policy or our data practices, please contact us at <EmailLink />
        </Text>

        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  title: {
    fontFamily: fonts.header,
    fontSize: 20,
    color: colors.text,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  lastUpdated: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  paragraph: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  bold: {
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
  },
  spacer: {
    height: 40,
  },
  emailHighlight: {
    fontFamily: fonts.bodySemiBold,
    color: colors.accent,
    textDecorationLine: 'underline',
  },
});
