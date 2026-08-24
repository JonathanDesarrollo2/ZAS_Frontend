import { apiClient, getToken } from './Client';

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface ProductOption {
  id: string;
  name: string;
  extra_price: number;
  active: boolean;
}

export interface OptionGroup {
  id: string;
  name: string;
  required: boolean;
  min_select: number;
  max_select: number;
  sort_order: number;
  options: ProductOption[];
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  sort_order: number;
  active: boolean;
  optionGroups?: OptionGroup[];
}

export interface Restaurant {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  banner?: string;
  address: string;
  lat?: number;
  lng?: number;
  delivery_radius_km?: number;
  has_own_delivery: boolean;
  commission_percent: number;
  active: boolean;
  opening_hours: any[];
}

export const getMyRestaurant = async () => {
  const res = await apiClient<{ result: boolean; content: Restaurant }>('/private/merchant/restaurant');
  return res.content;
};

export const updateRestaurant = async (data: Partial<Restaurant>) => {
  return apiClient('/private/merchant/restaurant', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const createCategory = async (name: string, sortOrder = 0) => {
  return apiClient('/private/merchant/categories', {
    method: 'POST',
    body: JSON.stringify({ name, sort_order: sortOrder }),
  });
};

export const updateCategory = async (categoryId: string, data: Partial<Category>) => {
  return apiClient(`/private/merchant/categories/${categoryId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
};

export const deleteCategory = async (categoryId: string) => {
  return apiClient(`/private/merchant/categories/${categoryId}`, {
    method: 'DELETE',
  });
};

export const createProduct = async (categoryId: string, data: {
  name: string;
  description?: string;
  price: number;
  sort_order?: number;
  imageFile?: { uri: string; type: string; name: string };
}) => {
  const formData = new FormData();
  formData.append('name', data.name);
  formData.append('price', data.price.toString());
  if (data.description) formData.append('description', data.description);
  if (data.sort_order) formData.append('sort_order', data.sort_order.toString());
  if (data.imageFile) {
    formData.append('image', data.imageFile as any);
  }

  // Usamos fetch directo para FormData
  const token = await getToken();
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  const res = await fetch(`${baseUrl}/private/merchant/categories/${categoryId}/products`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.[0] || 'Error al crear producto');
  return json;
};

export const updateProduct = async (productId: string, data: {
  name?: string;
  description?: string;
  price?: number;
  sort_order?: number;
  active?: boolean;
  imageFile?: { uri: string; type: string; name: string };
}) => {
  const formData = new FormData();
  if (data.name) formData.append('name', data.name);
  if (data.price !== undefined) formData.append('price', data.price.toString());
  if (data.description !== undefined) formData.append('description', data.description);
  if (data.sort_order !== undefined) formData.append('sort_order', data.sort_order.toString());
  if (data.active !== undefined) formData.append('active', data.active ? 'true' : 'false');
  if (data.imageFile) formData.append('image', data.imageFile as any);

  const token = await getToken();
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  const res = await fetch(`${baseUrl}/private/merchant/products/${productId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.[0] || 'Error al actualizar producto');
  return json;
};

export const deleteProduct = async (productId: string) => {
  return apiClient(`/private/merchant/products/${productId}`, {
    method: 'DELETE',
  });
};

export const createOptionGroup = async (productId: string, data: {
  name: string;
  required?: boolean;
  min_select?: number;
  max_select?: number;
  sort_order?: number;
}) => {
  return apiClient(`/private/merchant/products/${productId}/option-groups`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const createOption = async (groupId: string, data: {
  name: string;
  extra_price?: number;
}) => {
  return apiClient(`/private/merchant/option-groups/${groupId}/options`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};