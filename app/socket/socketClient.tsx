import io, { Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

let socket: Socket | null = null;
const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8080';

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

  // Escuchar notificaciones administrativas
  socket.on('adminNotification', (data: { title: string; body: string }) => {
    Alert.alert(data.title, data.body);
  });

  // Escuchar recordatorio de deuda
  socket.on('debtReminder', (data: { message: string }) => {
    Alert.alert('Recordatorio de deuda', data.message);
  });

  return socket;
};

export const getSocket = (): Socket | null => {
  return socket;
};