import io, { Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';

let socket: Socket | null = null;
let locationInterval: ReturnType<typeof setInterval> | null = null;

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
    const trimmed = list.slice(0, 50);
    await AsyncStorage.setItem('notifications', JSON.stringify(trimmed));
  } catch (error) {
    console.log('Error guardando notificación', error);
  }
};

const startDriverLocationUpdates = async (socket: Socket) => {
  const nivel = await AsyncStorage.getItem('userNivel');
  if (Number(nivel) !== 2) return;

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const sendLocation = async () => {
      try {
        // Usar última ubicación conocida para respuesta inmediata
        let location = await Location.getLastKnownPositionAsync();
        if (!location) {
          location = await Location.getCurrentPositionAsync({});
        }
        if (location) {
          socket.emit('driver:location', {
            tripId: 'global',
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          });
        }
      } catch (err) {
        // Silencioso
      }
    };

    // Enviar inmediatamente al conectar
    await sendLocation();

    // Luego cada 5 segundos
    locationInterval = setInterval(sendLocation, 5000);
  } catch (err) {
    // Silencioso
  }
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

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('🔌 Socket conectado:', socket?.id);
    startDriverLocationUpdates(socket!);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket desconectado:', reason);
    stopDriverLocationUpdates();
  });

  socket.on('connect_error', (error) => {
    console.error('Error de conexión socket:', error.message);
  });

  socket.on('adminNotification', (data: { title: string; body: string; link?: string }) => {
    saveNotification({
      title: data.title,
      body: data.body,
      type: 'admin',
      link: data.link,
      createdAt: new Date().toISOString(),
    });
  });

  socket.on('debtReminder', (data: { message: string }) => {
    Alert.alert('Recordatorio de deuda', data.message);
    saveNotification({
      title: 'Recordatorio de deuda',
      body: data.message,
      type: 'debt',
      createdAt: new Date().toISOString(),
    });
  });

  return socket;
};

export const getSocket = (): Socket | null => {
  return socket;
};