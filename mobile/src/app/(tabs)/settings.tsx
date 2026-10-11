import React from "react";
import { View, Text, Pressable, StyleSheet, Alert, Linking, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogOut, User, Trash2, Info, Mail, FileText, Star, Shield, ChevronRight, Crown, Camera, Newspaper } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { colors, fonts, borderRadius, spacing } from "@/lib/theme";
import { authClient } from "@/lib/auth/auth-client";
import { useSession, useInvalidateSession } from "@/lib/auth/use-session";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useSubscription } from "@/hooks/useSubscription";
import { useProfileStore } from "@/stores/profileStore";

const APP_VERSION = "1.0.0";

export default function SettingsScreen() {
  const router = useRouter();
  const { data: session } = useSession();
  const invalidateSession = useInvalidateSession();
  const resetOnboarding = useOnboardingStore((s) => s.resetOnboarding);
  const { isPro, isLoading: isSubscriptionLoading } = useSubscription();
  const profilePictureUri = useProfileStore((s) => s.profilePictureUri);
  const setProfilePicture = useProfileStore((s) => s.setProfilePicture);

  // Sync profile picture from backend on mount
  React.useEffect(() => {
    if (session?.user?.image && !profilePictureUri) {
      setProfilePicture(session.user.image);
    }
  }, [session?.user?.image]);

  const handlePickProfilePicture = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library to set a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      // Show immediately in UI with local URI
      setProfilePicture(asset.uri);

      try {
        // Upload to storage
        const { uploadFile } = await import('@/lib/upload');
        const filename = asset.uri.split('/').pop() ?? 'profile.jpg';
        const mimeType = asset.mimeType ?? 'image/jpeg';
        const uploadResult = await uploadFile(asset.uri, filename, mimeType);

        // Save URL to backend user profile
        const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL!;
        await fetch(`${baseUrl}/api/user/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ image: uploadResult.url }),
        });

        // Update local store with permanent URL
        setProfilePicture(uploadResult.url);
      } catch {
        // Keep local URI if upload fails
      }
    }
  };

  const handleSubscription = () => {
    
    router.push("/paywall");
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            
            try {
              await authClient.signOut();
            } catch {
              // Ignore server errors
            }
            resetOnboarding();
            invalidateSession();
          },
        },
      ]
    );
  };

  const handleClearHistory = () => {
    Alert.alert(
      "Clear Chat History",
      "This will delete all your chat messages. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            
            Alert.alert("Done", "Chat history has been cleared.");
          },
        },
      ]
    );
  };

  const handleContact = () => {
    
    Linking.openURL("mailto:blacktreeai@yahoo.com");
  };

  const handlePrivacyPolicy = () => {
    
    router.push("/privacy");
  };

  const handleTermsOfService = () => {
    
    router.push("/terms");
  };

  const handlePressRelease = () => {
    
    router.push("/press-release");
  };

  const handleRateApp = () => {
    
    Linking.openURL("https://apps.apple.com/app/id123456789?action=write-review");
  };

  const SettingsRow = ({
    icon: Icon,
    iconColor = colors.text,
    label,
    onPress,
    showChevron = true,
    destructive = false
  }: {
    icon: React.ComponentType<{ size: number; color: string }>;
    iconColor?: string;
    label: string;
    onPress: () => void;
    showChevron?: boolean;
    destructive?: boolean;
  }) => (
    <Pressable style={styles.settingsRow} onPress={onPress}>
      <View style={styles.settingsRowLeft}>
        <Icon size={20} color={destructive ? colors.error : iconColor} />
        <Text style={[styles.settingsRowText, destructive && styles.destructiveText]}>
          {label}
        </Text>
      </View>
      {showChevron ? <ChevronRight size={20} color={colors.textMuted} /> : null}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* User Info */}
        <View style={styles.userCard}>
          <Pressable style={styles.userAvatarContainer} onPress={handlePickProfilePicture}>
            {profilePictureUri ? (
              <Image source={{ uri: profilePictureUri }} style={styles.userAvatarImage} contentFit="cover" />
            ) : (
              <View style={styles.userAvatar}>
                <User size={24} color={colors.text} />
              </View>
            )}
            <View style={styles.cameraIconContainer}>
              <Camera size={12} color={colors.text} />
            </View>
          </Pressable>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{session?.user?.name || "User"}</Text>
            <Text style={styles.userEmail}>{session?.user?.email || ""}</Text>
            <Text style={styles.tapToChange}>Tap photo to change</Text>
          </View>
        </View>

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          <View style={styles.sectionContent}>
            <Pressable style={styles.subscriptionRow} onPress={handleSubscription}>
              <View style={styles.settingsRowLeft}>
                <Crown size={20} color={isPro ? colors.accent : colors.text} />
                <View>
                  <Text style={styles.settingsRowText}>
                    {isSubscriptionLoading ? "Loading..." : isPro ? "Pro Member" : "Upgrade to Pro"}
                  </Text>
                  <Text style={styles.subscriptionSubtext}>
                    {isPro ? "Manage your subscription" : "Unlimited messages & features"}
                  </Text>
                </View>
              </View>
              {isPro ? (
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              ) : (
                <ChevronRight size={20} color={colors.textMuted} />
              )}
            </Pressable>
          </View>
        </View>

        {/* General Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon={Trash2}
              label="Clear Chat History"
              onPress={handleClearHistory}
            />
          </View>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon={Mail}
              label="Contact Us"
              onPress={handleContact}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon={Star}
              iconColor={colors.accent}
              label="Rate the App"
              onPress={handleRateApp}
            />
          </View>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon={Shield}
              label="Privacy Policy"
              onPress={handlePrivacyPolicy}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon={FileText}
              label="Terms of Service"
              onPress={handleTermsOfService}
            />
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.sectionContent}>
            <View style={styles.aboutRow}>
              <View style={styles.settingsRowLeft}>
                <Info size={20} color={colors.text} />
                <Text style={styles.settingsRowText}>Version</Text>
              </View>
              <Text style={styles.versionText}>{APP_VERSION}</Text>
            </View>
          </View>
        </View>

        {/* Sign Out Button */}
        <View style={styles.section}>
          <View style={styles.sectionContent}>
            <SettingsRow
              icon={LogOut}
              label="Sign Out"
              onPress={handleSignOut}
              showChevron={false}
              destructive
            />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>BlackTree AI</Text>
          <Text style={styles.footerSubtext}>Powered by Claude Opus 4</Text>
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontFamily: fonts.header,
    fontSize: 24,
    color: colors.text,
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userAvatarContainer: {
    position: "relative",
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryDim,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  cameraIconContainer: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  userName: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
    color: colors.text,
  },
  userEmail: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.accent,
    marginTop: 2,
  },
  tapToChange: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginLeft: spacing.xs,
  },
  sectionContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  settingsRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  settingsRowText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  destructiveText: {
    color: colors.error,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 20 + spacing.sm,
  },
  aboutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  versionText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textSecondary,
  },
  footer: {
    alignItems: "center",
    paddingVertical: spacing.lg,
    gap: 4,
  },
  footerText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
    color: colors.textMuted,
  },
  footerSubtext: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textMuted,
  },
  subscriptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  subscriptionSubtext: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  proBadge: {
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
});
