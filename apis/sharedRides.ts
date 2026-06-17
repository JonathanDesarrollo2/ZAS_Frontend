// src/apis/sharedRides.ts
import { apiClient } from './Client';

export interface SharedRide {
  id: string;
  driver_user_id: string;
  origin_address: string;
  origin_lat: number;
  origin_lng: number;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  vehicle_type: string;
  total_seats: number;
  available_seats: number;
  price: number;
  trunk_full: boolean;
  departure_time?: string;
  status: string;
  driver: {
    id: string;
    username?: string;
    userlogin: string;
  };
}

export interface Reservation {
  id: string;
  ride_id: string;
  passenger_user_id: string;
  seat_count: number;
  status: 'pending_payment' | 'paid' | 'cancelled' | 'expired';
  payment_reference?: string;
  reserved_at: string;
  payment_deadline: string;
  ride: SharedRide;
}

export const getAvailableRides = async (params?: { vehicle_type?: string; origin_lat?: number; origin_lng?: number; dest_lat?: number; dest_lng?: number }): Promise<SharedRide[]> => {
  const query = new URLSearchParams();
  if (params?.vehicle_type) query.append('vehicle_type', params.vehicle_type);
  if (params?.origin_lat) query.append('origin_lat', params.origin_lat.toString());
  if (params?.origin_lng) query.append('origin_lng', params.origin_lng.toString());
  if (params?.dest_lat) query.append('dest_lat', params.dest_lat.toString());
  if (params?.dest_lng) query.append('dest_lng', params.dest_lng.toString());
  const response = await apiClient<{ result: boolean; content: SharedRide[] }>(`/private/rides/available?${query.toString()}`);
  return response.content;
};

export const reserveSeat = async (rideId: string, seatCount: number): Promise<{ reservation: Reservation; payment_deadline: string }> => {
  const response = await apiClient<{ result: boolean; content: { reservation: Reservation; payment_deadline: string } }>(`/private/rides/${rideId}/reserve`, {
    method: 'POST',
    body: JSON.stringify({ seat_count: seatCount }),
  });
  return response.content;
};

export const confirmPayment = async (reservationId: string, paymentReference: string): Promise<void> => {
  await apiClient(`/private/rides/${reservationId}/confirm-payment`, {
    method: 'POST',
    body: JSON.stringify({ payment_reference: paymentReference }),
  });
};

export const getMyReservations = async (): Promise<Reservation[]> => {
  const response = await apiClient<{ result: boolean; content: Reservation[] }>('/private/rides');
  return response.content;
};