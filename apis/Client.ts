// LEIDO
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sanitizeAddressFields } from '../utils/address';

export class ApiClientError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// La URL viene EXCLUSIVAMENTE de la variable de entorno definida en eas.json
const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export const getToken = async (): Promise<string | null> => {
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
  const isMultipartBody = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(!isMultipartBody && { 'Content-Type': 'application/json' }),
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });

  // ✅ Renovar token si el backend envía 'newtoken' en el header
  const newToken = response.headers.get('newtoken');
  if (newToken) {
    await setToken(newToken);
  }

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data.error?.[0] || 'Error desconocido';
    throw new ApiClientError(errorMessage, response.status);
  }

  return sanitizeAddressFields(data);
}