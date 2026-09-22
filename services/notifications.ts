// LEIDO
// Este archivo soporta dos entornos sin tener que comentar/descomentar código:
//
// 1) Expo Go: no se intenta obtener un token FCM real. Se devuelve el token
//    falso que el backend ya conoce y descarta para no romper las pruebas.
// 2) AAB/APK nativo: expo-notifications usa los módulos incluidos por el
//    plugin de app.json y obtiene el token FCM real de Firebase.
//
// Las notificaciones locales sí se incluyen en el build nativo. Si Expo Go no
// puede ejecutar alguna operación nativa, los catch de este archivo evitan que
// eso afecte el flujo de viajes.
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERSISTENT_NOTIFICATION_KEY = 'persistent_trip_notification_id';
const readPersistentIds = async (): Promise<string[]> => {
  const raw = await AsyncStorage.getItem(PERSISTENT_NOTIFICATION_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    // Compatibilidad con el único ID almacenado por versiones anteriores.
  }
  return [raw];
};

const removeAllTripNotifications = async (Notifications: NotificationsModule) => {
  const storedIds = await readPersistentIds();
  const presented = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  const ids = new Set(storedIds);

  presented.forEach((item) => {
    if (item.request.content.data?.type === 'trip-tracking') ids.add(item.request.identifier);
  });
  scheduled.forEach((item) => {
    if (item.content.data?.type === 'trip-tracking') ids.add(item.identifier);
  });

  for (const id of ids) {
    await Notifications.dismissNotificationAsync(id).catch(() => undefined);
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  }
};

// Constants.appOwnership identifica Expo Go. En un AAB esta condición es falsa,
// por lo que el mismo código continúa hacia el registro FCM real.
const isExpoGo = Constants.appOwnership === 'expo';

type NotificationsModule = typeof import('expo-notifications');
let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;

// Expo Go SDK 53 ya no incluye el módulo nativo de notificaciones remotas.
// La carga diferida evita que esa limitación derribe todo Expo Router.
const getNotifications = async (): Promise<NotificationsModule | null> => {
  if (isExpoGo) return null;
  if (!notificationsModulePromise) {
    notificationsModulePromise = import('expo-notifications')
      .then((Notifications) => {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
        Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data;
          if (data && typeof data.link === 'string') {
            Linking.openURL(data.link).catch(() => undefined);
          }
        });
        return Notifications;
      })
      .catch(() => null);
  }
  return notificationsModulePromise;
};

export async function getFCMToken(): Promise<string | null> {
  // En Expo Go no hay un token FCM utilizable para producción. El valor falso
  // evita que AuthStore intente registrar un token que no existe realmente.
  if (isExpoGo) return 'ExpoGoFakeToken';

  // Un simulador/emulador puede compilar, pero no siempre puede recibir push.
  // El AAB instalado en un teléfono físico sí continúa con el registro.
  if (!Device.isDevice) {
    console.warn('Las notificaciones requieren un dispositivo físico');
    return null;
  }

  try {
    const Notifications = await getNotifications();
    if (!Notifications) return null;

    // Primero se reutiliza el permiso existente para no preguntar repetidamente.
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

    if (Platform.OS === 'android') {
      // El canal es obligatorio en Android moderno para controlar prioridad,
      // sonido y comportamiento de las notificaciones push.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00C9A7',
      });
    }

    // En Android, Firebase entrega el token nativo que el backend usa con FCM.
    // No usamos un Expo Push Token porque el backend envía directamente por FCM.
    const tokenResult = await Notifications.getDevicePushTokenAsync();
    return tokenResult?.data ? String(tokenResult.data) : null;
  } catch (error) {
    console.warn('No se pudo obtener el token FCM', error);
    return null;
  }
}

const configureNotificationChannel = async () => {
  // El canal especial se usa para el aviso persistente de seguimiento. El
  // canal "default" anterior queda destinado a los avisos push generales.
  if (process.env.EXPO_OS !== 'android') return;
  const Notifications = await getNotifications();
  if (!Notifications) return;
  await Notifications.setNotificationChannelAsync('trip-tracking', {
    name: 'Seguimiento de viajes',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: undefined,
  });
};

const requestLocalPermission = async () => {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  // Las notificaciones locales también requieren permiso en Android 13+.
  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
};

export const showPersistentTripNotification = async (
  tripId: string,
  title: string,
  body: string,
) => {
  try {
    const Notifications = await getNotifications();
    if (!Notifications) return;

    // Esta función se usa para búsqueda y viaje activo. Es local: no depende
    // del backend ni de FCM para permanecer visible mientras la app está fuera.
    await requestLocalPermission();
    await configureNotificationChannel();

    // También limpia duplicados creados por versiones anteriores.
    await removeAllTripNotifications(Notifications);

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { tripId, type: 'trip-tracking' },
        // Android mantiene el aviso hasta que clearPersistentTripNotification
        // lo quite explícitamente al cancelar o finalizar el viaje.
        sticky: true,
        autoDismiss: false,
      },
      trigger: null,
    });
    await AsyncStorage.setItem(PERSISTENT_NOTIFICATION_KEY, JSON.stringify([identifier]));
  } catch {
    // Expo Go y dispositivos sin permiso no deben romper el flujo del viaje.
  }
};

export const clearPersistentTripNotification = async () => {
  try {
    const Notifications = await getNotifications();
    if (!Notifications) {
      await AsyncStorage.removeItem(PERSISTENT_NOTIFICATION_KEY);
      await AsyncStorage.removeItem('persistent_trip_notice');
      return;
    }

    // Se elimina tanto el aviso visible del sistema como sus referencias
    // locales para que el siguiente viaje empiece limpio.
    await removeAllTripNotifications(Notifications);
    await AsyncStorage.removeItem(PERSISTENT_NOTIFICATION_KEY);
    await AsyncStorage.removeItem('persistent_trip_notice');
  } catch {
    // La limpieza es opcional y nunca debe bloquear la navegación.
  }
};
