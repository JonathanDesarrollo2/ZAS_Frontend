import { apiClient } from './Client';

export interface MarketplaceProduct {
  id: string;
  title: string;
  description: string;
  price: number | string;
  stock: number;
  image_urls?: string[] | null;
  image_url?: string | null;
  status: 'available' | 'sold' | 'archived';
  free_shipping?: boolean;
  sales_count?: number;
  pickup_address: string;
  pickup_lat: number | string;
  pickup_lng: number | string;
  seller_id: string;
  seller?: { id: string; username?: string; userlogin?: string };
}

export interface MarketplaceOrder {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  status: 'pending_payment' | 'paid' | 'delivery_assigned' | 'picked_up' | 'delivered' | 'cancelled';
  quantity: number;
  payer_bank?: string | null;
  payer_cedula?: string | null;
  payer_phone?: string | null;
  payment_reference?: string | null;
  payment_reported_at?: string | null;
  has_reviewed_by_me?: boolean;
  product?: MarketplaceProduct | null;
  seller?: { id: string; username?: string; userlogin?: string };
  buyer?: { id: string; username?: string; userlogin?: string };
  trip?: { id: string; status: string; driver_id?: string | null } | null;
}

export const listMarketplaceProducts = () =>
  apiClient<{ result: boolean; content: MarketplaceProduct[] }>('/private/marketplace/products');

export const getMarketplaceProduct = (productId: string) =>
  apiClient<{ result: boolean; content: MarketplaceProduct }>('/private/marketplace/products/' + encodeURIComponent(productId));

export const getMyMarketplaceProducts = () =>
  apiClient<{ result: boolean; content: MarketplaceProduct[] }>('/private/marketplace/products/mine');

export const updateMarketplaceProduct = (productId: string, payload: {
  title: string;
  description: string;
  price: number;
  stock: number;
  free_shipping?: boolean;
}) =>
  apiClient<{ result: boolean; content: MarketplaceProduct }>(`/private/marketplace/products/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const deleteMarketplaceProduct = (productId: string) =>
  apiClient<{ result: boolean; content: { id: string }; error: string[] }>(`/private/marketplace/products/${encodeURIComponent(productId)}`, { method: 'DELETE' });

export const getMarketplaceSales = () =>
  apiClient<{ result: boolean; content: MarketplaceOrder[] }>('/private/marketplace/sales');

export const getMyMarketplaceOrders = () =>
  apiClient<{ result: boolean; content: MarketplaceOrder[] }>('/private/marketplace/orders/my');

export const getMarketplaceOrder = (orderId: string) =>
  apiClient<{ result: boolean; content: MarketplaceOrder }>(`/private/marketplace/orders/${encodeURIComponent(orderId)}`);

export const createMarketplaceProduct = (payload: {
  title: string;
  description: string;
  price: number;
  image_urls: string[];
  image_url?: string;
  seller_declaration_accepted: boolean;
  stock: number;
  free_shipping?: boolean;
  pickup: { address: string; lat: number; lng: number };
}) =>
  apiClient<{ result: boolean; content: MarketplaceProduct; error?: string[] }>(
    '/private/marketplace/products',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
export const createMarketplaceOrder = (payload: {
  product_id: string;
  quantity: number;
  dropoff: { address: string; lat: number; lng: number };
}) =>
  apiClient<{ result: boolean; content: MarketplaceOrder }>('/private/marketplace/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const markMarketplaceOrderPaid = (orderId: string) =>
  apiClient<{ result: boolean; content: { order: MarketplaceOrder; trip: { id: string; status: string } }; error: string[] }>(`/private/marketplace/orders/${orderId}/paid`, { method: 'PUT' });

export const reportMarketplaceOrderPayment = (orderId: string, payment: {
  payer_bank: string;
  payer_cedula: string;
  payer_phone: string;
  payment_reference: string;
}) =>
  apiClient<{ result: boolean; content: MarketplaceOrder; error: string[] }>(
    `/private/marketplace/orders/${encodeURIComponent(orderId)}/report-payment`,
    { method: 'POST', body: JSON.stringify(payment) },
  );

export const cancelMarketplaceOrder = (orderId: string) =>
  apiClient<{ result: boolean; content: MarketplaceOrder; error?: string[] }>(
    `/private/marketplace/orders/${encodeURIComponent(orderId)}/cancel`,
    { method: 'PUT' },
  );

export const submitMarketplaceReview = (orderId: string, review: { rating: number; comment: string }) =>
  apiClient<{ result: boolean; content: { id: string }; error?: string[] }>(
    `/private/marketplace/orders/${encodeURIComponent(orderId)}/review`,
    { method: 'POST', body: JSON.stringify(review) },
  );

export const markDeliveryPickedUp = (tripId: string) =>
  apiClient(`/private/marketplace/trips/${tripId}/picked-up`, { method: 'PUT' });

export const markDeliveryDelivered = (tripId: string) =>
  apiClient(`/private/marketplace/trips/${tripId}/delivered`, { method: 'PUT' });
