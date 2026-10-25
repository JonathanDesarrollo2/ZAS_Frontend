import { apiClient } from './Client';

export interface RestaurantDriverLinkRequest {
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  restaurant?: { id: string; name: string; address?: string };
}

export interface DriverLinkData {
  driver_code: string;
  requests: RestaurantDriverLinkRequest[];
}

export const getDriverLinkData = () =>
  apiClient<{ result: boolean; content: DriverLinkData; error?: string[] }>('/private/driver-link/me');

export const respondToDriverLinkRequest = (requestId: string, decision: 'accept' | 'reject') =>
  apiClient<{ result: boolean; content: RestaurantDriverLinkRequest; error?: string[] }>(
    `/private/driver-link/requests/${encodeURIComponent(requestId)}`,
    { method: 'PUT', body: JSON.stringify({ decision }) },
  );

export const requestRestaurantDriverLink = (driver_code: string) =>
  apiClient<{ result: boolean; content: RestaurantDriverLinkRequest; error?: string[] }>(
    '/private/merchant/restaurant/link-driver',
    { method: 'POST', body: JSON.stringify({ driver_code }) },
  );
