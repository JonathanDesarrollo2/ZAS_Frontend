// LEIDO
import { getToken } from './Client';

export interface MerchantApplicationPayload {
  owner_name: string;
  owner_email: string;
  phone: string;
  rif: string;
  business_name: string;
  business_address: string;
  business_lat?: number;
  business_lng?: number;
  delivery_radius_km?: number;
  has_own_delivery: boolean;
  documents?: FormData; // si se usa upload directo, aquí no se envía JSON
}

export const submitMerchantApplication = async (formData: FormData): Promise<any> => {
  const token = await getToken();
  const baseUrl = process.env.EXPO_PUBLIC_API_URL ||
    'https://zas-backend-112404045385.us-central1.run.app/api';

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/public/merchant-applications`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  let data: { result?: boolean; error?: string[] };
  try {
    data = await response.json();
  } catch {
    throw new Error('Error al procesar la respuesta del servidor');
  }
  if (!response.ok || !data.result) {
    throw new Error(data.error?.[0] || 'Error al enviar la solicitud');
  }
  return data;
};