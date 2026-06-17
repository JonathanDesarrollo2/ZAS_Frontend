import { apiClient } from './Client';

export interface CreateSharedRidePayload {
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  total_seats: number;
  vehicle_type?: string;
  trunk_full?: boolean;
  departure_time?: string;
  price_per_seat_usd?: number;   // 👈 Agrega esta línea (opcional o requerido)
}

export const createSharedRide = async (payload: CreateSharedRidePayload) => {
  return apiClient('/private/driver/rides', { method: 'POST', body: JSON.stringify(payload) });
};

export const getDriverRides = async () => {
  const response = await apiClient<{ result: boolean; content: any[] }>('/private/driver/rides');
  return response.content;
};

export const cancelRide = async (rideId: string) => {
  return apiClient(`/private/driver/rides/${rideId}/cancel`, { method: 'PUT' });
};

export const markRideAsFull = async (rideId: string) => {
  return apiClient(`/private/driver/rides/${rideId}/mark-full`, { method: 'PUT' });
};

export const addManualPassenger = async (rideId: string, seats: number, name?: string, phone?: string) => {
  return apiClient(`/private/driver/rides/${rideId}/manual-passenger`, {
    method: 'POST',
    body: JSON.stringify({ seats, name, phone }),
  });
};

export const getAvailability = async () => {
  const response = await apiClient<{ result: boolean; content: { is_available: boolean } }>('/private/driver/availability');
  return response.content.is_available;
};

export const toggleAvailability = async () => {
  const response = await apiClient<{ result: boolean; content: string }>('/private/driver/toggle-availability', { method: 'PUT' });
  return response.content;
};

export const getVehicles = async () => {
  const response = await apiClient<{ result: boolean; content: any[] }>('/private/vehicles/list');
  return response.content;
};

export const addVehicle = async (vehicle_type: string, plate: string) => {
  return apiClient('/private/vehicles/add', { method: 'POST', body: JSON.stringify({ vehicle_type, plate }) });
};

export const setActiveVehicle = async (vehicle_id: string) => {
  return apiClient('/private/vehicles/set-active', { method: 'POST', body: JSON.stringify({ vehicle_id }) });
};

export const acceptReservationPayment = async (rideId: string, reservationId: string) => {
  return apiClient(`/private/driver/rides/${rideId}/reservations/${reservationId}/accept`, { method: 'PUT' });
};

export const rejectReservationPayment = async (rideId: string, reservationId: string) => {
  return apiClient(`/private/driver/rides/${rideId}/reservations/${reservationId}/reject`, { method: 'PUT' });
};