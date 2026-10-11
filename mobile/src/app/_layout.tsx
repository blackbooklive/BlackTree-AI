import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useFonts, Orbitron_400Regular, Orbitron_700Bold } from '@expo-google-fonts/orbitron';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useEffect, useState } from 'react';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useSession } from '@/lib/auth/use-session';

export const unstable_settings = {
  initialRouteName: 'welcome',
};

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Custom dark theme with cyan accent
const AIHubTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0A0A0F',
    card: '#0A0A0F',
    primary: '#00D4FF',
    text: '#FFFFFF',
    border: 'rgba(255,255,255,0.1)',
  },
};

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const hasCompletedOnboarding = useOnboardingStore((s) => s.hasCompletedOnboarding);
  const { data: session, isLoading: isSessionLoading } = useSession();
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
    // Wait for session to load before doing anything
    if (isSessionLoading) return;

    // Small delay to ensure store is hydrated
    const timer = setTimeout(() => setIsNavigationReady(true), 100);
    return () => clearTimeout(timer);
  }, [isSessionLoading]);

  useEffect(() => {
    if (!isNavigationReady) return;

    const currentRoute = segments[0];
    const inWelcome = currentRoute === 'welcome';
    const inOnboarding = currentRoute === 'onboarding';
    const inAuth = currentRoute === 'sign-in';
    const inTerms = currentRoute === 'terms';
    const inPrivacy = currentRoute === 'privacy';

    // Development previews can enter the app without changing account access.
    if (__DEV__) {
      if (inWelcome || inOnboarding || inAuth || currentRoute === undefined) {
        router.replace('/(tabs)');
      }
      setHasNavigated(true);
      return;
    }

    // Step 1: Show welcome screen first if not completed onboarding
    if (!hasCompletedOnboarding) {
      if (!inWelcome && !inTerms && !inPrivacy) {
        router.replace('/welcome');
      }
      setHasNavigated(true);
      return;
    }

    // Step 2: Auth check - must be logged in after welcome
    if (!session?.user) {
      if (!inAuth && !inTerms && !inPrivacy) {
        router.replace('/sign-in');
      }
      setHasNavigated(true);
      return;
    }

    // Step 3: Go to main app if logged in and onboarding done
    if (inAuth || inWelcome || inOnboarding) {
      router.replace('/(tabs)');
    }
    setHasNavigated(true);
  }, [hasCompletedOnboarding, session, segments, isNavigationReady]);

  // Hide splash screen only after we've determined where to navigate
  useEffect(() => {
    if (hasNavigated) {
      SplashScreen.hideAsync();
    }
  }, [hasNavigated]);

  // Show nothing until navigation is ready (splash screen is still visible)
  if (!isNavigationReady) {
    return null;
  }

  return (
    <ThemeProvider value={AIHubTheme}>
      <Stack>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="terms" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="privacy" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="press-release" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Orbitron_400Regular,
    Orbitron_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  // Don't render anything until fonts are loaded
  // Splash screen is hidden by RootLayoutNav after navigation is determined
  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
        <KeyboardProvider>
          <StatusBar style="light" />
          <RootLayoutNav />
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
