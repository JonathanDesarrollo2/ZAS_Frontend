// LEIDO
import { apiClient } from './Client';

export interface OrderItem {
  product_id: string;
  quantity: number;
  option_ids: string[];
}

export interface CreateOrderPayload {
  idempotency_key: string;
  restaurant_id: string;
  items: OrderItem[];
  delivery_address: string;
  delivery_lat?: number;
  delivery_lng?: number;
  notes?: string;
  cash_tendered: number;
}

export interface CreatedRestaurantOrder {
  id: string;
  user_id: string;
  restaurant_id: string;
  status: string;
  subtotal: number | string;
  service_fee: number | string;
  delivery_fee: number | string;
  total: number | string;
  cash_tendered: number | string;
}

export interface CreateRestaurantOrderResponse {
  result: boolean;
  content: {
    order: CreatedRestaurantOrder;
    items: Array<{ id: string; product_name: string; quantity: number; unit_price: number | string; total_price: number | string }>;
  };
  error?: string[];
}

export interface RestaurantOrder {
  id: string;
  user_id: string;
  restaurant_id: string;
  status: string;
  payment_status: string;
  subtotal: number | string;
  delivery_fee: number | string;
  service_fee: number | string;
  total: number | string;
  cash_tendered?: number | string | null;
  delivery_type: 'own' | 'external';
  delivery_address: string;
  delivery_lat?: number | string;
  delivery_lng?: number | string;
  notes?: string;
  createdAt: string;
  restaurant?: { id: string; name: string; address: string };
  delivery_trip?: {
    id: string;
    status: string;
    driver_id?: string | null;
    pickup_lat: number | string;
    pickup_lng: number | string;
    dropoff_lat: number | string;
    dropoff_lng: number | string;
    driver?: { id: string; name: string } | null;
    driver_location?: { lat: number | string; lng: number | string } | null;
  } | null;
  items: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number | string;
    total_price: number | string;
    options?: Array<{ group_name: string; name: string; extra_price: number | string }>;
  }>;
}

export const createRestaurantOrder = async (payload: CreateOrderPayload) => {
  return apiClient<CreateRestaurantOrderResponse>(
    '/private/restaurant-orders',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
};

export const getMyRestaurantOrders = async () => {
  return apiClient<{ result: boolean; content: RestaurantOrder[]; error?: string[] }>(
    '/private/restaurant-orders/my',
  );
};

export const confirmRestaurantOrderDelivery = async (orderId: string) => {
  return apiClient<{ result: boolean; content: { orderId: string; status: string }; error?: string[] }>(
    `/private/restaurant-orders/${encodeURIComponent(orderId)}/confirm-delivery`,
    { method: 'PUT' },
  );
};

export const getRestaurantOrders = async () => {
  const res = await apiClient<{ result: boolean; content: RestaurantOrder[] }>('/private/restaurant-orders/restaurant');
  return res.content;
};

export const updateRestaurantOrderStatus = async (orderId: string, status: string) => {
  return apiClient(`/private/restaurant-orders/${orderId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
};