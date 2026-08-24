import { apiClient } from './Client';

export interface OrderItem {
  product_name: string;
  quantity: number;
  price: number; // unit price
  options?: any[];
}

export interface CreateOrderPayload {
  restaurant_id: string;
  items: OrderItem[];
  delivery_address: string;
  delivery_lat?: number;
  delivery_lng?: number;
  notes?: string;
}

export interface RestaurantOrder {
  id: string;
  user_id: string;
  restaurant_id: string;
  status: string;
  payment_status: string;
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  total: number;
  delivery_type: string;
  delivery_address: string;
  delivery_lat?: number;
  delivery_lng?: number;
  notes?: string;
  createdAt: string;
  items: any[];
}

export const createRestaurantOrder = async (payload: CreateOrderPayload) => {
  return apiClient<{ result: boolean; content: any; error?: string[] }>(
    '/private/restaurant-orders',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
};

export const getMyRestaurantOrders = async () => {
  const res = await apiClient<{ result: boolean; content: RestaurantOrder[] }>('/private/restaurant-orders/my');
  return res.content;
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