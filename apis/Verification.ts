import { apiClient } from './Client';

export interface VerificationResponse {
  result: boolean;
  content: any;
  error: string[];
}

export const startVerification = async (): Promise<VerificationResponse> => {
  return apiClient<VerificationResponse>('/private/verification/start', {
    method: 'POST',
  });
};

export const getVerificationStatus = async (): Promise<VerificationResponse> => {
  return apiClient<VerificationResponse>('/private/verification/status');
};