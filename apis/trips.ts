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