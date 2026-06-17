// src/apis/client.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

// La URL base se toma de la variable de entorno; si no existe, usa localhost:8080/api
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api';

const getToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('authToken');
  } catch {
    return null;
  }
};

export const setToken = async (token: string) => {
  await AsyncStorage.setItem('authToken', token);
};

export const removeToken = async () => {
  await AsyncStorage.removeItem('authToken');
};

export async function apiClient<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data.error?.[0] || 'Error desconocido';
    throw new Error(errorMessage);
  }

  const newToken = data.content?.newToken;
  if (newToken) {
    await setToken(newToken);
  }

  return data;
}