// ============================================================
// 🔧 ARCHIVO DE NOTIFICACIONES (DESARROLLO vs PRODUCCIÓN)
// ============================================================

// --- MODO ACTUAL: DESARROLLO EN EXPO GO ---
// Para probar en Expo Go, dejamos COMENTADO el bloque de producción
// y ACTIVO el export que devuelve un token falso.
// Así evitamos el error "expo-notifications was removed from Expo Go"

// ========== BLOQUE DE PRODUCCIÓN (descomentar para build) ==========



/*
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Linking } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Listener para abrir enlaces al tocar la notificación
Notifications.addNotificationResponseReceivedListener(response => {
  const data = response.notification.request.content.data;
  if (data && typeof data.link === 'string') {
    Linking.openURL(data.link);
  }
});

export async function getFCMToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Las notificaciones requieren un dispositivo físico');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('Permiso de notificaciones denegado');
    return null;
  }

  const tokenResult = await Notifications.getDevicePushTokenAsync();
  if (!tokenResult || !tokenResult.data) {
    console.warn('No se pudo obtener el token FCM');
    return null;
  }

  console.log('FCM Token:', tokenResult.data);

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00C9A7',
    });
  }

  return tokenResult.data;
}

  */
// ========== BLOQUE TEMPORAL PARA EXPO GO ==========
// Devuelve un token falso para que el resto de la app no falle.
// Cuando compiles para producción, comenta este export y descomenta el bloque de arriba.



export async function getFCMToken(): Promise<string | null> {
  return 'ExpoGoFakeToken';
}