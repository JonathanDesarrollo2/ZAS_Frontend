import { apiClient, setToken, removeToken } from './Client';

// ===== Registro =====
export interface RegisterPayload {
  usermail: string;
  userlogin: string;
  username?: string;
  userpass: string;
  userrepass: string;
  nivel?: number; // 3 = pasajero, 2 = conductor, etc.
}

export interface AuthResponse {
  result: boolean;
  content: any; // El token o mensaje
  error: string[];
}

export const registerUser = async (payload: RegisterPayload): Promise<AuthResponse> => {
  const data = await apiClient<AuthResponse>('/public/login/adduser', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  
  // Después del registro, el backend puede devolver el token directamente
  // Si lo devuelve, lo guardamos automáticamente.
  if (data.result && data.content?.token) {
    await setToken(data.content.token);
  }
  return data;
};

// ===== Inicio de sesión =====
export interface LoginPayload {
  usermail: string;
  userpass: string;
}

export const loginUser = async (payload: LoginPayload): Promise<AuthResponse> => {
  const data = await apiClient<AuthResponse>('/public/login/privateauth', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  // El backend devuelve el token en `content`
  if (data.result && typeof data.content === 'string') {
    await setToken(data.content);
  }
  return data;
};

// ===== Cerrar sesión =====
export const logoutUser = async (): Promise<void> => {
  await removeToken();
};

// ===== Obtener datos del usuario activo =====
export const getActiveUser = async (): Promise<{
  sesionUser: string;
  sesionEmail: string;
  userStatus: boolean;
  nivel: number;
}> => {
  const data = await apiClient<{ result: boolean; content: any }>('/private/user/onsession');
  return data.content;
};

// ===== Verificación de email =====
export const sendEmailVerificationCode = async (): Promise<AuthResponse> => {
  return apiClient<AuthResponse>('/private/email-verification/send-code', {
    method: 'POST',
  });
};

export const confirmEmailVerificationCode = async (code: string): Promise<AuthResponse> => {
  return apiClient<AuthResponse>('/private/email-verification/confirm-code', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
};