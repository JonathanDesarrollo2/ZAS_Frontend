import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts, SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from '../presentation/hooks/use-color-scheme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({ SpaceMono: SpaceMono_400Regular });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'light' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="loading/index" options={{ animation: 'none' }} />
        <Stack.Screen name="auth/Login" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth/register" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="auth/verify-email" options={{ animation: 'slide_from_right' }} />
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
        <Stack.Screen name="verification/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="bank-account/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="payment/index" options={{ animation: 'slide_from_right' }} />
        {/* ✅ Nuevas pantallas del conductor */}
        <Stack.Screen name="driver/find-trips" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/trip-detail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/active-trip" options={{ animation: 'slide_from_right' }} />
        {/* ✅ Nuevas pantallas del pasajero */}
        <Stack.Screen name="trip-waiting" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="trip-active" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </ThemeProvider>
  );
}