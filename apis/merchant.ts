import { apiClient } from './Client';

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

export const submitMerchantApplication = async (formData: FormData) => {
  return apiClient('/public/merchant-applications', {
    method: 'POST',
    headers: {
      // Importante: No establecer Content-Type manualmente; fetch lo hace por FormData
    },
    body: formData,
  } as RequestInit);
};