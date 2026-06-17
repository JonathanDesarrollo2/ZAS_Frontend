import { create } from 'zustand';
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

  // Email verification
  sendEmailCode: () => Promise<void>;
  confirmEmailCode: (code: string) => Promise<void>;

  // Didit verification
  startKYC: () => Promise<string>; // Devuelve la URL de verificación
  checkKYCStatus: () => Promise<string>; // Devuelve el estado actual
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
      
      // Obtener datos del usuario después del login exitoso
      const userData = await getActiveUser();
      set({
        isAuthenticated: true,
        user: {
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
      
      // Algunos backends pueden devolver directamente el token y datos del usuario,
      // pero aquí asumimos que después del registro hay que iniciar sesión manualmente
      // o que el registro ya devuelve el token. Adaptamos según tu flujo.
      if (typeof response.content === 'string') {
        // Si el registro devuelve el token, lo usamos para obtener la sesión.
        const userData = await getActiveUser();
        set({
          isAuthenticated: true,
          user: {
            sesionUser: userData.sesionUser,
            sesionEmail: userData.sesionEmail,
            nivel: userData.nivel,
          },
          isLoading: false,
        });
      } else {
        // Solo registro exitoso sin token (deberá iniciar sesión después)
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
      set({
        isAuthenticated: true,
        user: {
          sesionUser: userData.sesionUser,
          sesionEmail: userData.sesionEmail,
          nivel: userData.nivel,
        },
        isLoading: false,
      });
    } catch (error: any) {
      // Si falla, probablemente el token expiró o es inválido
      await logoutUser();
      set({ isAuthenticated: false, user: null, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),

  // Email verification
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
      // Actualizar el estado del usuario si es necesario (marcar email verificado)
      // Podrías volver a obtener la sesión o actualizar el campo user.emailVerified
      set({ isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  // KYC Didit
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
      return response.content.status; // 'verified', 'rejected', 'processing', etc.
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },
}));