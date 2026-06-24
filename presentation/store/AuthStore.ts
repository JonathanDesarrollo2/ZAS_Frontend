import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import {
  loginUser,
  registerUser,
  logoutUser,
  getActiveUser,
  sendEmailVerificationCode,
  confirmEmailVerificationCode,
  LoginPayload,
  RegisterPayload,
} from '../../apis/auth';
import {
  startVerification,
  getVerificationStatus,
} from '../../apis/Verification';

interface User {
  id: string;
  sesionUser: string;
  sesionEmail: string;
  nivel: number;
  balance?: number;
  isEmailVerified: boolean;
  isKYCVerified: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;

  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  clearError: () => void;

  sendEmailCode: () => Promise<void>;
  confirmEmailCode: (code: string) => Promise<void>;

  startKYC: () => Promise<string>;
  checkKYCStatus: () => Promise<string>;
}

const SESSION_EXPIRATION_DAYS = 7;

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  isLoading: false,
  error: null,

  login: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await loginUser(payload);
      if (!response.result) throw new Error(response.error[0] || 'Error al iniciar sesión');

      const token = response.content;
      await AsyncStorage.setItem('authToken', token);

      const decoded: any = jwtDecode(token);
      const userId = decoded.id;

      const userData = await getActiveUser();
      set({
        isAuthenticated: true,
        user: {
          id: userId,
          sesionUser: userData.sesionUser,
          sesionEmail: userData.sesionEmail,
          nivel: userData.nivel,
          balance: userData.balance || 0,
          isEmailVerified: userData.isEmailVerified || false,
          isKYCVerified: userData.isKYCVerified || false,
        },
        isLoading: false,
      });

      if (Platform.OS !== 'web') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          console.log('Permiso de notificación no concedido');
        }
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  register: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await registerUser(payload);
      if (!response.result) throw new Error(response.error[0] || 'Error al registrarse');

      if (typeof response.content === 'string') {
        const token = response.content;
        await AsyncStorage.setItem('authToken', token);

        const decoded: any = jwtDecode(token);
        const userId = decoded.id;

        const userData = await getActiveUser();
        set({
          isAuthenticated: true,
          user: {
            id: userId,
            sesionUser: userData.sesionUser,
            sesionEmail: userData.sesionEmail,
            nivel: userData.nivel,
            balance: userData.balance || 0,
            isEmailVerified: userData.isEmailVerified || false,
            isKYCVerified: userData.isKYCVerified || false,
          },
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem('authToken');
    set({ isAuthenticated: false, user: null });
  },

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        set({ isAuthenticated: false, user: null, isLoading: false });
        return;
      }

      const decoded: any = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);
      const tokenExp = decoded.exp || 0;

      if (tokenExp > 0 && now - tokenExp > SESSION_EXPIRATION_DAYS * 24 * 3600) {
        await AsyncStorage.removeItem('authToken');
        set({ isAuthenticated: false, user: null, isLoading: false });
        return;
      }

      const userData = await getActiveUser();
      set({
        isAuthenticated: true,
        user: {
          id: decoded.id || '',
          sesionUser: userData.sesionUser,
          sesionEmail: userData.sesionEmail,
          nivel: userData.nivel,
          balance: userData.balance || 0,
          isEmailVerified: userData.isEmailVerified || false,
          isKYCVerified: userData.isKYCVerified || false,
        },
        isLoading: false,
      });
    } catch (error: any) {
      await AsyncStorage.removeItem('authToken');
      set({ isAuthenticated: false, user: null, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),

  sendEmailCode: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await sendEmailVerificationCode();
      if (!response.result) throw new Error(response.error[0] || 'Error al enviar código');
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  confirmEmailCode: async (code) => {
    set({ isLoading: true, error: null });
    try {
      const response = await confirmEmailVerificationCode(code);
      if (!response.result) throw new Error(response.error[0] || 'Código incorrecto');
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  startKYC: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await startVerification();
      if (!response.result) throw new Error(response.error[0] || 'Error al iniciar verificación');
      set({ isLoading: false });
      return response.content.verificationUrl;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  checkKYCStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await getVerificationStatus();
      if (!response.result) throw new Error(response.error[0] || 'Error al consultar estado');
      set({ isLoading: false });
      return response.content.status;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
}));