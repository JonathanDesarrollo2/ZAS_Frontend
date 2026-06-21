// src/apis/trips.ts
import { apiClient } from './Client';

export interface CreateTripPayload {
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string;
  price?: number;
  vehicle_type?: string;
  trip_type?: 'ride' | 'delivery';
  package_description?: string;
  package_recipient_phone?: string;
}

export const createTrip = async (payload: CreateTripPayload): Promise<any> => {
  return apiClient('/private/trips', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const getAvailableTrips = async (lat: number, lng: number, radius: number = 5): Promise<any> => {
  return apiClient(`/private/trips/available?lat=${lat}&lng=${lng}&radius=${radius}`);
};
export const cancelTrip = async (tripId: string) => {
  return apiClient(`/private/trips/${tripId}/cancel`, { method: 'PUT' });
};
export const confirmTripPayment = async (tripId: string, data: {
  payment_reference: string;
  payer_bank: string;
  payer_cedula: string;
  payer_phone: string;
}) => {
  return apiClient(`/private/trips/${tripId}/pay`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const verifyTripPayment = async (tripId: string, action: 'verify' | 'reject') => {
  return apiClient(`/private/trips/${tripId}/verify-payment`, {
    method: 'PUT',
    body: JSON.stringify({ action }),
  });
};

export const markArrived = async (tripId: string) => {
  return apiClient(`/private/trips/${tripId}/arrive`, { method: 'PUT' });
};

export const startTrip = async (tripId: string) => {
  return apiClient(`/private/trips/${tripId}/start`, { method: 'PUT' });
};

export const completeTrip = async (tripId: string) => {
  return apiClient(`/private/trips/${tripId}/complete`, { method: 'PUT' });
};