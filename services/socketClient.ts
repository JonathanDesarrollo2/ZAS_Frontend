//LEIDO
import io, { Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import { clearPersistentTripNotification as clearStoredTripNotification, showPersistentTripNotification } from './notifications';
  
let socket: Socket | null = null;
let locationInterval: ReturnType<typeof setInterval> | null = null;
let persistentNotificationOperation: Promise<void> = Promise.resolve();
const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8080';

const saveNotification = async (notification: {
  title: string;
  body: string;
  type: string;
  createdAt: string;
  link?: string;
}) => {
  try {
    const raw = await AsyncStorage.getItem('notifications');
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(notification);
    await AsyncStorage.setItem('notifications', JSON.stringify(list.slice(0, 50)));
  } catch {
    // No bloquear la experiencia del usuario si falla el almacenamiento local.
  }
};

const upsertPersistentTripNotice = async (tripId: string, title: string, body: string) => {
  try {
    await AsyncStorage.setItem(
      'persistent_trip_notice',
      JSON.stringify({ tripId, title, body, createdAt: new Date().toISOString() }),
    );
  } catch {
    // Persistencia local no crítica para el viaje activo.
  }
};

export const ensurePersistentTripNotification = async (tripId: string, title: string, body: string) => {
  persistentNotificationOperation = persistentNotificationOperation.then(async () => {
    // Evita que el polling y el evento de aceptación creen avisos simultáneos.
    const raw = await AsyncStorage.getItem('persistent_trip_notice');
    if (raw) {
      try {
        const current = JSON.parse(raw);
        if (current.tripId === tripId && current.title === title && current.body === body) return;
      } catch {
        // Si el valor quedó corrupto, se reemplaza con el aviso actual.
      }
    }
    await upsertPersistentTripNotice(tripId, title, body);
    await showPersistentTripNotification(tripId, title, body);
  }).catch(() => undefined);
  await persistentNotificationOperation;
};

export const clearPersistentTripNotification = async () => {
  persistentNotificationOperation = persistentNotificationOperation
    .then(() => clearStoredTripNotification())
    .catch(() => undefined);
  await persistentNotificationOperation;
};

const startDriverLocationUpdates = async (currentSocket: Socket) => {
  const nivel = await AsyncStorage.getItem('userNivel');
  if (Number(nivel) !== 2) return;

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;

  const sendLocation = async () => {
    try {
      let location = await Location.getLastKnownPositionAsync();
      if (!location) location = await Location.getCurrentPositionAsync({});
      currentSocket.emit('driver:location', {
        tripId: 'global',
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    } catch {
      // La ubicación del conductor no debe bloquear la sesión del usuario.
    }
  };

  await sendLocation();
  stopDriverLocationUpdates();
  locationInterval = setInterval(sendLocation, 5000);
};

const stopDriverLocationUpdates = () => {
  if (locationInterval) {
    clearInterval(locationInterval);
    locationInterval = null;
  }
};

export const connectSocket = async (): Promise<Socket> => {
  if (socket?.connected) return socket;

  const token = await AsyncStorage.getItem('authToken');
  if (!token) throw new Error('No hay token disponible para socket');

  socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
  socket.on('connect', () => { startDriverLocationUpdates(socket!).catch(() => undefined); });
  socket.on('disconnect', stopDriverLocationUpdates);
  socket.on('trip:accepted', (data: { tripId?: string; driver?: { name?: string } }) => {
    if (data?.tripId) {
      ensurePersistentTripNotification(
        data.tripId,
        'Conductor asignado',
        data.driver?.name ? `${data.driver.name} aceptó tu viaje.` : 'Un conductor aceptó tu viaje.',
      ).catch(() => undefined);
    }
  });
  socket.on('tripCompleted', () => { clearPersistentTripNotification().catch(() => undefined); });
  socket.on('tripCancelled', () => { clearPersistentTripNotification().catch(() => undefined); });
  socket.on('adminNotification', (data: { title: string; body: string; link?: string }) => {
    saveNotification({ ...data, type: 'admin', createdAt: new Date().toISOString() }).catch(() => undefined);
    if (data.link) Linking.openURL(data.link).catch(() => undefined);
  });
  socket.on('debtReminder', (data: { message: string }) => {
    Alert.alert('Recordatorio de deuda', data.message);
    saveNotification({
      title: 'Recordatorio de deuda',
      body: data.message,
      type: 'debt',
      createdAt: new Date().toISOString(),
    }).catch(() => undefined);
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;
