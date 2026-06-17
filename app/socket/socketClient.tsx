// app/socket/socketClient.ts
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';
// Extraer la base (sin "/api")
const SOCKET_URL = API_URL.replace(/\/api$/, '');

let socket: Socket | null = null;

const getAuthToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('authToken');
  } catch {
    return null;
  }
};

export const connectSocket = async (): Promise<Socket> => {
  if (socket?.connected) return socket;

  const token = await getAuthToken();
  if (!token) throw new Error('No hay token de autenticación');

  socket = io(SOCKET_URL, {
    auth: { token },            // se envía en el handshake
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('✅ Socket conectado:', socket?.id);
    // Unirse a la sala de conductor si es nivel 2
    // Eso lo hará el frontend con el evento 'driver:join' cuando sea necesario
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket desconectado:', reason);
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;