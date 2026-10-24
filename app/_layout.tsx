// LEIDO
import { useFonts, SpaceMono_400Regular } from '@expo-google-fonts/space-mono';
import { Stack, router, useRootNavigationState, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from '../presentation/store/AuthStore';
import { LEGAL_TERMS_VERSION } from '../legal/LegalTexts';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({ SpaceMono: SpaceMono_400Regular });
  const { isAuthenticated, user, isLoading } = useAuth();
  const initialize = useAuth((state) => state.initialize);
  const navigationState = useRootNavigationState();
  const segments = useSegments();
  const previousAuthState = useRef<{
    isAuthenticated: boolean;
    nivel: number | undefined;
    isEmailVerified: boolean;
    hasProfilePicture: boolean;
    hasCurrentLegalConsent: boolean;
  } | null>(null);
  const justVerified = useRef(false);
  const initialized = useRef(false);
  const handledNotificationResponses = useRef(new Set<string>());

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    } else {
      const timeout = setTimeout(() => SplashScreen.hideAsync(), 5000);
      return () => clearTimeout(timeout);
    }
  }, [loaded]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (Constants.appOwnership === 'expo') return;

    let active = true;
    let responseListener: { remove: () => void } | undefined;

    const handleNotificationResponse = async (response: {
      actionIdentifier: string;
      notification: { request: { identifier: string; content: { data?: Record<string, unknown> } } };
    }) => {
      const { request } = response.notification;
      const responseKey = `${request.identifier}:${response.actionIdentifier}`;
      if (handledNotificationResponses.current.has(responseKey)) return;
      handledNotificationResponses.current.add(responseKey);

      const data = request.content.data ?? {};
      const url = typeof data.link === 'string'
        ? data.link
        : typeof data.url === 'string'
          ? data.url
          : '';

      try {
        await (await import('expo-notifications')).clearLastNotificationResponseAsync();
      } catch (clearError) {
        console.warn('No se pudo limpiar la respuesta de notificación', clearError);
      }

      if (!/^https:\/\/\S+$/i.test(url)) return;

      try {
        await Linking.openURL(url);
      } catch (openError) {
        console.warn('No se pudo abrir el enlace de la notificación', openError);
      }
    };

    const setupNotificationResponseHandling = async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (!active) return;

        responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
          void handleNotificationResponse(response);
        });

        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (active && lastResponse) {
          await handleNotificationResponse(lastResponse);
        }
      } catch (notificationError) {
        console.warn('No se pudo inicializar la gestión de respuestas push', notificationError);
      }
    };

    void setupNotificationResponseHandling();
    return () => {
      active = false;
      responseListener?.remove();
    };
  }, []);

  useEffect(() => {
    if (!navigationState?.key || isLoading) return;

    const currentAuth = {
      isAuthenticated,
      nivel: user?.nivel,
      isEmailVerified: user?.isEmailVerified || false,
      hasProfilePicture: typeof user?.profile_pic_url === 'string' && user.profile_pic_url.trim().length > 0,
      hasCurrentLegalConsent: user?.terms_version === LEGAL_TERMS_VERSION &&
        user?.privacy_policy_version === LEGAL_TERMS_VERSION,
    };

    if (isAuthenticated && !currentAuth.hasCurrentLegalConsent) {
      if (segments[0] !== 'auth' || segments[1] !== 'legal-consent') {
        router.replace('/auth/legal-consent');
      }
      return;
    }

    if (
      isAuthenticated &&
      !currentAuth.hasProfilePicture &&
      !(user?.nivel === 2 && !currentAuth.isEmailVerified) &&
      (segments[0] !== 'auth' || segments[1] !== 'take-profile-picture')
    ) {
      router.replace('/auth/take-profile-picture');
      return;
    }

    if (justVerified.current && currentAuth.isEmailVerified) {
      justVerified.current = false;
      previousAuthState.current = currentAuth;
      return;
    }

    if (
      previousAuthState.current &&
      previousAuthState.current.isAuthenticated === currentAuth.isAuthenticated &&
      previousAuthState.current.nivel === currentAuth.nivel &&
      previousAuthState.current.isEmailVerified === currentAuth.isEmailVerified &&
      previousAuthState.current.hasProfilePicture === currentAuth.hasProfilePicture &&
      previousAuthState.current.hasCurrentLegalConsent === currentAuth.hasCurrentLegalConsent
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

      if (!currentAuth.hasProfilePicture) {
        if (segments[0] !== 'auth' || segments[1] !== 'take-profile-picture') {
          router.replace('/auth/take-profile-picture');
        }
        return;
      }

      if (user?.nivel === 4) {
        if (segments[0] !== 'merchant' || segments[1] !== 'dashboard') {
          router.replace('/merchant/dashboard');
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
  }, [
    isAuthenticated,
    isLoading,
    user?.nivel,
    user?.isEmailVerified,
    user?.isKYCVerified,
    user?.profile_pic_url,
    user?.terms_version,
    user?.privacy_policy_version,
    segments,
  ]);

  useEffect(() => {
    if (user?.isEmailVerified) {
      justVerified.current = true;
    }
  }, [user?.isEmailVerified]);

  if (!loaded && !error) return null;

  return (
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="auth/Login" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth/register" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="auth/legal-consent" options={{ animation: 'slide_from_right', gestureEnabled: false }} />
        <Stack.Screen name="auth/VerifyEmail" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="auth/forgot-password" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="auth/kyc" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth/take-profile-picture" options={{ animation: 'slide_from_right', gestureEnabled: false }} />
        <Stack.Screen name="dashboard" options={{ animation: 'fade' }} />
        <Stack.Screen name="dashboard-passenger" options={{ animation: 'fade' }} />
        <Stack.Screen name="dashboard-driver" options={{ animation: 'fade' }} />
        <Stack.Screen name="profile" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="profile/[userId]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="shared-rides/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="shared-rides/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="shared-rides/active/[reservationId]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="my-reservations" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="request-ride" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/create-ride" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/create-shared-ride" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="driver/shared-ride-active" options={{ animation: 'slide_from_right' }} />
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
        <Stack.Screen name="driver/earnings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="trip-waiting" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="marketplace/index" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="marketplace/create" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="marketplace/product/[id]" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="marketplace/chat/[orderId]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="marketplace/my-products" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="marketplace/sales" options={{ animation: 'slide_from_right' }} />

        <Stack.Screen name="restaurant-menu" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="restaurants" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="cart" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="checkout" options={{ animation: 'slide_from_right' }} />

        {/* Navegador anidado del comercio */}
        <Stack.Screen name="merchant" options={{ headerShown: false, animation: 'fade' }} />

        <Stack.Screen name="history" options={{ animation: 'slide_from_right' }} />
      </Stack>
  );
}