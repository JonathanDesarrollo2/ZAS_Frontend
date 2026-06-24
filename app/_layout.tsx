import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts, SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from '../presentation/hooks/use-color-scheme';
import { useAuth } from '../presentation/hooks/useAuth';
import { router, useRootNavigationState } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts({ SpaceMono: SpaceMono_400Regular });
  const { isAuthenticated, user, isLoading } = useAuth();
  const navigationState = useRootNavigationState();

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

  // Redirigir según estado de autenticación y verificación de email
  useEffect(() => {
    if (!navigationState?.key) return; // esperar a que el navegador esté listo
    if (isLoading) return;

    if (isAuthenticated) {
      if (!user?.isEmailVerified) {
        router.replace('/auth/VerifyEmail');
      } else if (!user?.isKYCVerified) {
        router.replace('/dashboard'); // puede ver menú limitado
      } else {
        router.replace('/dashboard');
      }
    } else {
      router.replace('/auth/Login');
    }
  }, [isAuthenticated, isLoading, user?.isEmailVerified]);

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
        <Stack.Screen name="driver/ride-reservations" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="chat" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="add-balance" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </ThemeProvider>
  );
}