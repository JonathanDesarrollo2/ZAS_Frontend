import { apiClient } from './Client';

export const requestTopup = async (amount: number, reference: string) => {
  return apiClient('/private/balance/topup', {
    method: 'POST',
    body: JSON.stringify({ amount, reference }),
  });
};