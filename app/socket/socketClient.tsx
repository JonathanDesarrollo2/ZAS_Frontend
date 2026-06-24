import io, { Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

let socket: Socket | null = null;
const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8080';

const saveNotification = async (notification: {
  title: string;
  body: string;
  type: string;
  createdAt: string;
}) => {
  try {
    const raw = await AsyncStorage.getItem('notifications');
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(notification);
    // mantener solo las últimas 50
    const trimmed = list.slice(0, 50);
    await AsyncStorage.setItem('notifications', JSON.stringify(trimmed));
  } catch (error) {
    console.log('Error guardando notificación', error);
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
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket desconectado:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Error de conexión socket:', error.message);
  });

  // Admin push notification
  socket.on('adminNotification', (data: { title: string; body: string }) => {
    Alert.alert(data.title, data.body);
    saveNotification({
      title: data.title,
      body: data.body,
      type: 'admin',
      createdAt: new Date().toISOString(),
    });
  });

  // Debt reminder
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