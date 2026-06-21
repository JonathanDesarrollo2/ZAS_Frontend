import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';   // ← importación corregida
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
  id: string;            // ← nuevo campo
  sesionUser: string;
  sesionEmail: string;
  nivel: number;
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
        },
        isLoading: false,
      });
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
    await logoutUser();
    set({ isAuthenticated: false, user: null });
  },

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const userData = await getActiveUser();
      const token = await AsyncStorage.getItem('authToken');
      const decoded: any = token ? jwtDecode(token) : {};
      const userId = decoded.id || '';

      set({
        isAuthenticated: true,
        user: {
          id: userId,
          sesionUser: userData.sesionUser,
          sesionEmail: userData.sesionEmail,
          nivel: userData.nivel,
        },
        isLoading: false,
      });
    } catch (error: any) {
      await logoutUser();
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