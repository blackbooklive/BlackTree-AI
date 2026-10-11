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

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Terms of Use</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.lastUpdated}>Last Updated: February 2025</Text>

        <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
        <Text style={styles.paragraph}>
          By downloading, installing, or using BlackTree ("the App"), you agree to be bound by these Terms of Use. If you do not agree to these terms, please do not use the App.
        </Text>

        <Text style={styles.sectionTitle}>2. Description of Service</Text>
        <Text style={styles.paragraph}>
          BlackTree is a mobile application that provides AI-powered local discovery features, including restaurant recommendations, event listings, and location-based suggestions. The App may offer both free and premium subscription features.
        </Text>

        <Text style={styles.sectionTitle}>3. Subscriptions and Payments</Text>
        <Text style={styles.paragraph}>
          • BlackTree Pro is available as an auto-renewing subscription{'\n'}
          • Payment will be charged to your Apple ID account at confirmation of purchase{'\n'}
          • Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period{'\n'}
          • Your account will be charged for renewal within 24 hours prior to the end of the current period{'\n'}
          • You can manage and cancel your subscriptions by going to your account settings on the App Store after purchase{'\n'}
          • Any unused portion of a free trial period will be forfeited when you purchase a subscription
        </Text>

        <Text style={styles.sectionTitle}>4. User Conduct</Text>
        <Text style={styles.paragraph}>
          You agree not to:{'\n'}
          • Use the App for any unlawful purpose{'\n'}
          • Attempt to gain unauthorized access to the App or its systems{'\n'}
          • Interfere with or disrupt the App or servers{'\n'}
          • Upload or transmit viruses or malicious code{'\n'}
          • Use the App to harass, abuse, or harm others
        </Text>

        <Text style={styles.sectionTitle}>5. Intellectual Property</Text>
        <Text style={styles.paragraph}>
          All content, features, and functionality of the App, including but not limited to text, graphics, logos, and software, are the exclusive property of BlackTree and are protected by copyright, trademark, and other intellectual property laws.
        </Text>

        <Text style={styles.sectionTitle}>6. Disclaimer of Warranties</Text>
        <Text style={styles.paragraph}>
          The App is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not guarantee that the App will be uninterrupted, secure, or error-free.
        </Text>

        <Text style={styles.sectionTitle}>7. Limitation of Liability</Text>
        <Text style={styles.paragraph}>
          To the fullest extent permitted by law, BlackTree shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the App.
        </Text>

        <Text style={styles.sectionTitle}>8. Changes to Terms</Text>
        <Text style={styles.paragraph}>
          We reserve the right to modify these Terms at any time. We will notify users of any material changes by posting the new Terms in the App. Your continued use of the App after such changes constitutes your acceptance of the new Terms.
        </Text>

        <Text style={styles.sectionTitle}>9. Contact Us</Text>
        <Text style={styles.paragraph}>
          If you have any questions about these Terms, please contact us at <EmailLink />
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
  spacer: {
    height: 40,
  },
  emailHighlight: {
    fontFamily: fonts.bodySemiBold,
    color: colors.accent,
    textDecorationLine: 'underline',
  },
});
