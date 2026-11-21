import { apiClient } from './Client';

export interface RestaurantDriverLinkRequest {
  id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  restaurant?: { id: string; name: string; address?: string };
  driver?: { user?: { id: string; username?: string; userlogin?: string } };
}

export interface LinkedRestaurant {
  id: string;
  name: string;
  address?: string;
}

export interface RestaurantDriverLink {
  driver_id: string;
  driver?: { user?: { id: string; username?: string; userlogin?: string } };
}

export interface DriverLinkData {
  driver_code: string;
  requests: RestaurantDriverLinkRequest[];
  requestHistory: RestaurantDriverLinkRequest[];
  restaurants: LinkedRestaurant[];
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

export const getRestaurantDriverLinks = () =>
  apiClient<{
    result: boolean;
    content: { drivers: RestaurantDriverLink[]; requests: RestaurantDriverLinkRequest[] };
    error?: string[];
  }>('/private/driver-link/restaurant');

export const cancelRestaurantDriverLinkRequest = (requestId: string) =>
  apiClient<{ result: boolean; content: RestaurantDriverLinkRequest; error?: string[] }>(
    `/private/driver-link/restaurant/requests/${encodeURIComponent(requestId)}`,
    { method: 'DELETE' },
  );

export const unlinkRestaurantDriver = (driverId: string) =>
  apiClient<{ result: boolean; content: { restaurantId: string; driverId: string }; error?: string[] }>(
    `/private/driver-link/restaurant/${encodeURIComponent(driverId)}`,
    { method: 'DELETE' },
  );

export const unlinkDriverRestaurant = (restaurantId: string) =>
  apiClient<{ result: boolean; content: { restaurantId: string; driverId: string }; error?: string[] }>(
    `/private/driver-link/me/restaurants/${encodeURIComponent(restaurantId)}`,
    { method: 'DELETE' },
  );
