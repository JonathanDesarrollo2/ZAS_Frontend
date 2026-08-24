import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts, SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { Stack, router, useRootNavigationState, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { useColorScheme } from '../presentation/hooks/use-color-scheme';
import { useAuth } from '../presentation/store/AuthStore';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts({ SpaceMono: SpaceMono_400Regular });
  const { isAuthenticated, user, isLoading } = useAuth();
  const initialize = useAuth((state) => state.initialize);
  const navigationState = useRootNavigationState();
  const segments = useSegments();
  const previousAuthState = useRef<{ isAuthenticated: boolean; isEmailVerified: boolean } | null>(null);
  const justVerified = useRef(false);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    } else {
      const timeout = setTimeout(() => SplashScreen.hideAsync(), 5000);
      return () => clearTimeout(timeout);
    }
  }, [loaded]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!navigationState?.key || isLoading) return;

    const currentAuth = {
      isAuthenticated,
      isEmailVerified: user?.isEmailVerified || false,
    };

    if (justVerified.current && currentAuth.isEmailVerified) {
      justVerified.current = false;
      previousAuthState.current = currentAuth;
      return;
    }

    if (
      previousAuthState.current &&
      previousAuthState.current.isAuthenticated === currentAuth.isAuthenticated &&
      previousAuthState.current.isEmailVerified === currentAuth.isEmailVerified
    ) {
      return;
    }

    previousAuthState.current = currentAuth;

    if (isAuthenticated) {
      if (user?.nivel === 2 && !user?.isEmailVerified) {
        if (segments[0] !== 'auth' || segments[1] !== 'VerifyEmail') {
          router.replace('/auth/VerifyEmail');
        }
        return;
      }

      if (!user?.isKYCVerified) {
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

  useEffect(() => {
    if (user?.isEmailVerified) {
      justVerified.current = true;
    }
  }, [user?.isEmailVerified]);

  if (!loaded && !error) return null;

  return (
    <ThemeProvider value={colorScheme === 'light' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="auth/Login" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth/register" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="auth/VerifyEmail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="auth/forgot-password" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="auth/kyc" options={{ animation: 'fade' }} />
        <Stack.Screen name="dashboard" options={{ animation: 'fade' }} />
        <Stack.Screen name="dashboard-passenger" options={{ animation: 'fade' }} />
        <Stack.Screen name="dashboard-driver" options={{ animation: 'fade' }} />
        <Stack.Screen name="shared-rides/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="shared-rides/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="my-reservations" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="request-ride" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/create-ride" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/my-rides" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/vehicles" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/availability" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/ride-reservation" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/active-trip" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/find-trip" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/trip-detail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/documentation" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="chat" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="add-balance" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="trip-active" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="trip-waiting" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />

        {/* NUEVAS RUTAS PARA COMERCIOS */}
        <Stack.Screen name="merchant-application" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="restaurants" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="restaurant-menu" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="cart" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="checkout" options={{ animation: 'slide_from_right' }} />

        {/* RUTAS DEL PANEL DEL COMERCIO */}
        <Stack.Screen name="merchant/dashboard" options={{ animation: 'fade' }} />
        <Stack.Screen name="merchant/restaurant-edit" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="merchant/categories" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="merchant/products" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="merchant/product-edit" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="merchant/orders" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </ThemeProvider>
  );
}