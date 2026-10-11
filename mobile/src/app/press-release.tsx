import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  Sparkles,
  Copy,
  Share2,
  Mail,
  Building2,
  Newspaper,
  Target,
  User,
  Phone,
  Check,
} from 'lucide-react-native';
import { colors, fonts, borderRadius } from '@/lib/theme';
import { GlassCard } from '@/components/GlassCard';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { BACKEND_URL } from '@/lib/config';

type NewsType = 'launch' | 'funding' | 'partnership' | 'milestone' | 'event' | 'other';

interface GeneratedEmail {
  subject: string;
  body: string;
  targetOutlet: string;
}

const NEWS_TYPES: { value: NewsType; label: string; emoji: string }[] = [
  { value: 'launch', label: 'Product Launch', emoji: '🚀' },
  { value: 'funding', label: 'Funding Round', emoji: '💰' },
  { value: 'partnership', label: 'Partnership', emoji: '🤝' },
  { value: 'milestone', label: 'Milestone', emoji: '🏆' },
  { value: 'event', label: 'Event', emoji: '📅' },
  { value: 'other', label: 'Other News', emoji: '📰' },
];

const MEDIA_OUTLETS = [
  'CNN',
  'MSNBC',
  'Fox News',
  'BBC',
  'The New York Times',
  'The Washington Post',
  'TechCrunch',
  'Forbes',
  'Bloomberg',
  'Reuters',
  'Associated Press',
  'Wall Street Journal',
  'USA Today',
  'NPR',
  'ABC News',
  'CBS News',
  'NBC News',
  'The Guardian',
  'Wired',
  'The Verge',
];

const baseUrl = BACKEND_URL;

export default function PressReleaseScreen() {
  const router = useRouter();

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [newsType, setNewsType] = useState<NewsType>('launch');
  const [headline, setHeadline] = useState('');
  const [details, setDetails] = useState('');
  const [targetOutlet, setTargetOutlet] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showOutletPicker, setShowOutletPicker] = useState(false);

  const canGenerate = companyName.trim() && headline.trim() && details.trim() &&
                      targetOutlet.trim() && contactName.trim() && contactEmail.trim();

  const generatePressRelease = async () => {
    if (!canGenerate || isLoading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    setError(null);
    setGeneratedEmail(null);

    try {
      const response = await fetch(`${baseUrl}/api/ai/press-release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          newsType,
          headline: headline.trim(),
          details: details.trim(),
          targetOutlet: targetOutlet.trim(),
          contactInfo: {
            name: contactName.trim(),
            email: contactEmail.trim(),
            phone: contactPhone.trim() || undefined,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || 'Failed to generate press release');
      }

      const result = await response.json();
      setGeneratedEmail(result.data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedEmail) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const fullEmail = `Subject: ${generatedEmail.subject}\n\n${generatedEmail.body}`;
    await Clipboard.setStringAsync(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareEmail = async () => {
    if (!generatedEmail) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `Subject: ${generatedEmail.subject}\n\n${generatedEmail.body}`,
        title: 'Press Release Email',
      });
    } catch {
      Alert.alert('Error', 'Failed to share');
    }
  };

  const startNewDraft = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGeneratedEmail(null);
    setError(null);
  };

  // Outlet picker modal
  if (showOutletPicker) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => setShowOutletPicker(false)}>
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Select Media Outlet</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.outletList}>
          {MEDIA_OUTLETS.map((outlet) => (
            <Pressable
              key={outlet}
              style={[
                styles.outletOption,
                targetOutlet === outlet && styles.outletOptionActive,
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setTargetOutlet(outlet);
                setShowOutletPicker(false);
              }}
            >
              <Text style={[
                styles.outletOptionText,
                targetOutlet === outlet && styles.outletOptionTextActive,
              ]}>
                {outlet}
              </Text>
              {targetOutlet === outlet && (
                <Check size={20} color={colors.accent} />
              )}
            </Pressable>
          ))}

          <Text style={styles.customOutletLabel}>Or enter custom outlet:</Text>
          <TextInput
            style={styles.customOutletInput}
            placeholder="Enter outlet name..."
            placeholderTextColor={colors.textMuted}
            value={targetOutlet}
            onChangeText={setTargetOutlet}
            onSubmitEditing={() => setShowOutletPicker(false)}
            returnKeyType="done"
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Show generated email result
  if (generatedEmail) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Press Release</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.delay(100)}>
            <GlassCard style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <View style={styles.targetBadge}>
                  <Target size={14} color={colors.accent} />
                  <Text style={styles.targetBadgeText}>{generatedEmail.targetOutlet}</Text>
                </View>
              </View>

              <Text style={styles.subjectLabel}>Subject Line</Text>
              <Text style={styles.subjectText}>{generatedEmail.subject}</Text>

              <View style={styles.divider} />

              <Text style={styles.bodyLabel}>Email Body</Text>
              <Text style={styles.bodyText}>{generatedEmail.body}</Text>
            </GlassCard>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200)} style={styles.actionButtons}>
            <Pressable style={styles.actionButton} onPress={copyToClipboard}>
              {copied ? (
                <Check size={20} color={colors.success} />
              ) : (
                <Copy size={20} color={colors.text} />
              )}
              <Text style={styles.actionButtonText}>
                {copied ? 'Copied!' : 'Copy Email'}
              </Text>
            </Pressable>

            <Pressable style={styles.actionButton} onPress={shareEmail}>
              <Share2 size={20} color={colors.text} />
              <Text style={styles.actionButtonText}>Share</Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300)}>
            <Pressable style={styles.newDraftButton} onPress={startNewDraft}>
              <Sparkles size={18} color={colors.accent} />
              <Text style={styles.newDraftButtonText}>Generate Another</Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(400)}>
            <Text style={styles.instructionText}>
              Copy this email and send it to {generatedEmail.targetOutlet} journalists via your email app.
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Press Release</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.delay(100)}>
            <Text style={styles.sectionTitle}>
              <Newspaper size={16} color={colors.accent} /> AI will draft a professional press release email for you
            </Text>
          </Animated.View>

          {/* Company Name */}
          <Animated.View entering={FadeInDown.delay(150)}>
            <GlassCard style={styles.inputCard}>
              <View style={styles.inputLabel}>
                <Building2 size={16} color={colors.textSecondary} />
                <Text style={styles.inputLabelText}>Company / Product Name</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="e.g., BlackTree Technologies"
                placeholderTextColor={colors.textMuted}
                value={companyName}
                onChangeText={setCompanyName}
                maxLength={100}
              />
            </GlassCard>
          </Animated.View>

          {/* News Type */}
          <Animated.View entering={FadeInDown.delay(200)}>
            <Text style={styles.label}>Type of News</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.newsTypeScroll}
              contentContainerStyle={styles.newsTypeContainer}
            >
              {NEWS_TYPES.map((type) => (
                <Pressable
                  key={type.value}
                  style={[
                    styles.newsTypeOption,
                    newsType === type.value && styles.newsTypeOptionActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setNewsType(type.value);
                  }}
                >
                  <Text style={styles.newsTypeEmoji}>{type.emoji}</Text>
                  <Text style={[
                    styles.newsTypeLabel,
                    newsType === type.value && styles.newsTypeLabelActive,
                  ]}>
                    {type.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>

          {/* Headline */}
          <Animated.View entering={FadeInDown.delay(250)}>
            <GlassCard style={styles.inputCard}>
              <View style={styles.inputLabel}>
                <Sparkles size={16} color={colors.textSecondary} />
                <Text style={styles.inputLabelText}>News Headline</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="e.g., BlackTree AI Launches Revolutionary Mobile Platform"
                placeholderTextColor={colors.textMuted}
                value={headline}
                onChangeText={setHeadline}
                maxLength={200}
              />
            </GlassCard>
          </Animated.View>

          {/* Details */}
          <Animated.View entering={FadeInDown.delay(300)}>
            <GlassCard style={styles.inputCard}>
              <View style={styles.inputLabel}>
                <Newspaper size={16} color={colors.textSecondary} />
                <Text style={styles.inputLabelText}>Details</Text>
              </View>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Provide key details: what happened, why it matters, key quotes, numbers, etc."
                placeholderTextColor={colors.textMuted}
                value={details}
                onChangeText={setDetails}
                multiline
                numberOfLines={5}
                maxLength={2000}
                textAlignVertical="top"
              />
            </GlassCard>
          </Animated.View>

          {/* Target Outlet */}
          <Animated.View entering={FadeInDown.delay(350)}>
            <GlassCard style={styles.inputCard}>
              <View style={styles.inputLabel}>
                <Target size={16} color={colors.textSecondary} />
                <Text style={styles.inputLabelText}>Target Media Outlet</Text>
              </View>
              <Pressable
                style={styles.outletSelector}
                onPress={() => setShowOutletPicker(true)}
              >
                <Text style={targetOutlet ? styles.outletSelectorText : styles.outletSelectorPlaceholder}>
                  {targetOutlet || 'Select media outlet...'}
                </Text>
                <ChevronLeft size={20} color={colors.textMuted} style={{ transform: [{ rotate: '-90deg' }] }} />
              </Pressable>
            </GlassCard>
          </Animated.View>

          {/* Contact Info */}
          <Animated.View entering={FadeInDown.delay(400)}>
            <Text style={styles.label}>Contact Information</Text>
            <GlassCard style={styles.inputCard}>
              <View style={styles.inputLabel}>
                <User size={16} color={colors.textSecondary} />
                <Text style={styles.inputLabelText}>Your Name</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="John Smith"
                placeholderTextColor={colors.textMuted}
                value={contactName}
                onChangeText={setContactName}
                maxLength={100}
              />

              <View style={[styles.inputLabel, { marginTop: 16 }]}>
                <Mail size={16} color={colors.textSecondary} />
                <Text style={styles.inputLabelText}>Email</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="press@company.com"
                placeholderTextColor={colors.textMuted}
                value={contactEmail}
                onChangeText={setContactEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                maxLength={100}
              />

              <View style={[styles.inputLabel, { marginTop: 16 }]}>
                <Phone size={16} color={colors.textSecondary} />
                <Text style={styles.inputLabelText}>Phone (optional)</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="+1 (555) 123-4567"
                placeholderTextColor={colors.textMuted}
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
                maxLength={20}
              />
            </GlassCard>
          </Animated.View>

          {error ? (
            <Animated.View entering={FadeIn}>
              <GlassCard style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
              </GlassCard>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(450)}>
            <Pressable
              style={[
                styles.generateButton,
                (!canGenerate || isLoading) && styles.generateButtonDisabled,
              ]}
              onPress={generatePressRelease}
              disabled={!canGenerate || isLoading}
            >
              {isLoading ? (
                <LoadingIndicator size={24} color={colors.background} />
              ) : (
                <>
                  <Sparkles size={20} color={colors.background} />
                  <Text style={styles.generateButtonText}>Generate Press Release</Text>
                </>
              )}
            </Pressable>
          </Animated.View>

          {isLoading ? (
            <Animated.View entering={FadeInUp.springify()}>
              <GlassCard style={styles.loadingCard}>
                <LoadingIndicator size={48} color={colors.accent} />
                <Text style={styles.loadingTitle}>Crafting your press release...</Text>
                <Text style={styles.loadingSubtitle}>AI is writing a professional email</Text>
              </GlassCard>
            </Animated.View>
          ) : null}
        </ScrollView>
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
  header: {
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
  headerTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    color: colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputCard: {
    marginBottom: 16,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  inputLabelText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  input: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    padding: 0,
  },
  textArea: {
    minHeight: 100,
  },
  newsTypeScroll: {
    marginBottom: 16,
    marginHorizontal: -20,
  },
  newsTypeContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  newsTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  newsTypeOptionActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  newsTypeEmoji: {
    fontSize: 16,
  },
  newsTypeLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  newsTypeLabelActive: {
    color: colors.accent,
  },
  outletSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  outletSelectorText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  outletSelectorPlaceholder: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMuted,
  },
  outletList: {
    padding: 20,
    gap: 8,
  },
  outletOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  outletOptionActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.accent,
  },
  outletOptionText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  outletOptionTextActive: {
    color: colors.accent,
    fontFamily: fonts.bodyMedium,
  },
  customOutletLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 20,
    marginBottom: 10,
  },
  customOutletInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    marginTop: 8,
  },
  generateButtonDisabled: {
    backgroundColor: colors.surface,
  },
  generateButtonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.background,
  },
  errorCard: {
    marginBottom: 16,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
  loadingCard: {
    alignItems: 'center',
    paddingVertical: 40,
    marginTop: 16,
  },
  loadingTitle: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.text,
    marginTop: 16,
  },
  loadingSubtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  // Result styles
  resultCard: {
    marginBottom: 20,
  },
  resultHeader: {
    marginBottom: 16,
  },
  targetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.accentDim,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.sm,
  },
  targetBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.accent,
  },
  subjectLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subjectText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
  },
  bodyLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  bodyText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.text,
  },
  newDraftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  newDraftButtonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.accent,
  },
  instructionText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
});
