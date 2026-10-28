import 'react-native-url-polyfill/auto';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { AuthProvider, useAuth } from '@/auth';
import { KeyboardProvider } from '@/lib/keyboard';
import { theme } from '@/theme';

SplashScreen.preventAutoHideAsync();
SystemUI.setBackgroundColorAsync(theme.bg);

function RootStack() {
  const { ready } = useAuth();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = theme.bg;
    }
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && ready) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError, ready]);

  if ((!fontsLoaded && !fontError) || !ready) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.bg },
          animation: 'fade',
        }}>
        <Stack.Screen name="(main)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="book" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <KeyboardProvider>
      <AuthProvider>
        <RootStack />
      </AuthProvider>
    </KeyboardProvider>
  );
}
