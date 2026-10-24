// LEIDO
import { apiClient, getToken, setToken, removeToken } from './Client';
import * as FileSystem from 'expo-file-system/legacy';

export interface RegisterPayload {
  usermail: string;
  userlogin: string;
  username?: string;
  userpass: string;
  userrepass: string;
  nivel?: number;
  termsAccepted: boolean;
  privacyAccepted: boolean;
}

export interface AuthResponse {
  result: boolean;
  content: any;
  error: string[];
}

export const registerUser = async (payload: RegisterPayload): Promise<AuthResponse> => {
  const data = await apiClient<AuthResponse>('/public/login/adduser', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (data.result && data.content?.token) {
    await setToken(data.content.token);
  }
  return data;
};

export interface LoginPayload {
  usermail: string;
  userpass: string;
}

export const loginUser = async (payload: LoginPayload): Promise<AuthResponse> => {
  const data = await apiClient<AuthResponse>('/public/login/privateauth', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (data.result && typeof data.content === 'string') {
    await setToken(data.content);
  }
  return data;
};

export const logoutUser = async (): Promise<void> => {
  await removeToken();
};

export const uploadProfilePicture = async (
  imageUri: string,
  mimeType = 'image/jpeg',
  fileName = 'profile.jpg',
) => {
  let uri = typeof imageUri === 'string' ? imageUri.trim() : '';
  if (!uri || uri.startsWith('data:')) {
    throw new Error('La foto debe ser un archivo local valido.');
  }
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(uri)) {
    uri = uri.startsWith('/') ? `file://${uri}` : `file:///${uri}`;
  }

  const authToken = await getToken();
  if (!authToken) throw new Error('No hay token de autenticacion.');

  const baseUrl = process.env.EXPO_PUBLIC_API_URL ||
    'https://zas-backend-112404045385.us-central1.run.app/api';
  const uploadUrl = `${baseUrl.replace(/\/+$/, '')}/private/user/profile-pic`;
  const response = await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'profile_pic',
    mimeType,
    headers: {
      Authorization: `Bearer ${authToken}`,
      Accept: 'application/json',
    },
    parameters: {},
  });

  let data: {
    result: boolean;
    content?: { url?: string };
    error?: string[];
  };
  try {
    data = JSON.parse(response.body);
  } catch {
    throw new Error('El servidor devolvio una respuesta invalida al guardar la foto.');
  }

  if (response.status < 200 || response.status >= 300 || !data.result) {
    throw new Error(data.error?.[0] || 'No se pudo guardar la foto.');
  }
  return data;
};

export const getActiveUser = async (): Promise<{
  sesionUser: string;
  sesionEmail: string;
  userStatus: boolean;
  nivel: number;
  balance?: number;
  isEmailVerified?: boolean;
  isKYCVerified?: boolean;
  profile_pic_url?: string | null;
  profile_pic_updated_at?: Date | string | null;   // ← nuevo
  terms_version?: string | null;
  privacy_policy_version?: string | null;
  legal_accepted_at?: Date | string | null;
  marketplace_terms_version?: string | null;
  marketplace_terms_accepted_at?: Date | string | null;
}> => {
  const data = await apiClient<{ result: boolean; content: any }>('/private/user/onsession');
  return data.content;
};

export interface LegalConsent {
  terms_version: string | null;
  privacy_policy_version: string | null;
  legal_accepted_at: string | null;
  marketplace_terms_version: string | null;
  marketplace_terms_accepted_at: string | null;
}

export const getLegalConsent = async () => {
  const response = await apiClient<{ result: boolean; content: LegalConsent }>('/private/user/legal-consent');
  return response.content;
};

export const acceptLegalConsent = async () =>
  apiClient<{ result: boolean; content: { terms_version: string; privacy_policy_version: string }; error: string[] }>('/private/user/legal-consent', {
    method: 'PUT',
    body: JSON.stringify({ termsAccepted: true, privacyAccepted: true }),
  });

export const acceptMarketplaceTerms = async () =>
  apiClient<{ result: boolean; content: { marketplace_terms_version: string }; error: string[] }>('/private/user/marketplace-terms', {
    method: 'PUT',
    body: JSON.stringify({ accepted: true }),
  });

export const sendEmailVerificationCode = async (): Promise<AuthResponse> => {
  return apiClient<AuthResponse>('/private/email-verification/send-code', { method: 'POST' });
};

export const confirmEmailVerificationCode = async (code: string): Promise<AuthResponse> => {
  return apiClient<AuthResponse>('/private/email-verification/confirm-code', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
};

// ---------- NUEVAS FUNCIONES PARA RECUPERACIÓN DE CONTRASEÑA ----------

export const requestPasswordResetCode = async (usermail: string): Promise<AuthResponse> => {
  return apiClient<AuthResponse>('/public/password-reset/send-code', {
    method: 'POST',
    body: JSON.stringify({ usermail }),
  });
};

export const resetPasswordWithCode = async (
  usermail: string,
  code: string,
  newPassword: string
): Promise<AuthResponse> => {
  return apiClient<AuthResponse>('/public/password-reset/reset-password', {
    method: 'POST',
    body: JSON.stringify({ usermail, code, newPassword }),
  });
};