import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts, SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { Stack, router, useRootNavigationState, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { useColorScheme } from '../presentation/hooks/use-color-scheme';
import { useAuth } from '../presentation/hooks/useAuth';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts({ SpaceMono: SpaceMono_400Regular });
  const { isAuthenticated, user, isLoading } = useAuth();
  const navigationState = useRootNavigationState();
  const segments = useSegments();
  const previousAuthState = useRef<{ isAuthenticated: boolean; isEmailVerified: boolean } | null>(null);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    } else {
      const timeout = setTimeout(() => {
        SplashScreen.hideAsync();
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [loaded]);

  // Redirigir según estado de autenticación y verificación de email, solo cuando cambie el estado
  useEffect(() => {
    if (!navigationState?.key || isLoading) return;

    const currentAuth = {
      isAuthenticated,
      isEmailVerified: user?.isEmailVerified || false,
    };

    // Si el estado no ha cambiado, no hacer nada
    if (
      previousAuthState.current &&
      previousAuthState.current.isAuthenticated === currentAuth.isAuthenticated &&
      previousAuthState.current.isEmailVerified === currentAuth.isEmailVerified
    ) {
      return;
    }

    previousAuthState.current = currentAuth;

    if (isAuthenticated) {
      if (!user?.isEmailVerified) {
        // Solo redirigir si no estamos ya en la pantalla de verificación
        if (segments[0] !== 'auth' || segments[1] !== 'VerifyEmail') {
          router.replace('/auth/VerifyEmail');
        }
      } else if (!user?.isKYCVerified) {
        if (segments[0] !== 'dashboard') {
          router.replace('/dashboard');
        }
      } else {
        if (segments[0] !== 'dashboard') {
          router.replace('/dashboard');
        }
      }
    } else {
      if (segments[0] !== 'auth' || segments[1] !== 'Login') {
        router.replace('/auth/Login');
      }
    }
  }, [isAuthenticated, isLoading, user?.isEmailVerified, user?.isKYCVerified, segments]);

  if (!loaded && !error) return null;

  return (
    <ThemeProvider value={colorScheme === 'light' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="auth/Login" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth/register" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="auth/VerifyEmail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="auth/kyc" options={{ animation: 'fade' }} />
        <Stack.Screen name="dashboard" options={{ animation: 'fade' }} />
        <Stack.Screen name="shared-rides/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="shared-rides/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="my-reservations" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="request-ride" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/create-ride" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/my-rides" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/vehicles" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/availability" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/ride-reservation" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="chat" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="add-balance" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </ThemeProvider>
  );
}