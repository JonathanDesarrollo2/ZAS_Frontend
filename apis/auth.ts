import { apiClient, setToken, removeToken } from './Client';

export interface RegisterPayload {
  usermail: string;
  userlogin: string;
  username?: string;
  userpass: string;
  userrepass: string;
  nivel?: number;
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

export const getActiveUser = async (): Promise<{
  sesionUser: string;
  sesionEmail: string;
  userStatus: boolean;
  nivel: number;
  balance?: number;
}> => {
  const data = await apiClient<{ result: boolean; content: any }>('/private/user/onsession');
  return data.content;
};

export const sendEmailVerificationCode = async (): Promise<AuthResponse> => {
  return apiClient<AuthResponse>('/private/email-verification/send-code', { method: 'POST' });
};

export const confirmEmailVerificationCode = async (code: string): Promise<AuthResponse> => {
  return apiClient<AuthResponse>('/private/email-verification/confirm-code', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
};