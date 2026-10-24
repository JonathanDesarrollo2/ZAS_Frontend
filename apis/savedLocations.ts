import { apiClient } from './Client';

export interface SavedLocation {
  id: string;
  name: string;
  address: string;
  lat: number | string;
  lng: number | string;
}

export interface SavedLocationPayload {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export const getSavedLocations = async () =>
  apiClient<{ result: boolean; content: SavedLocation[] }>('/private/saved-locations');

export const createSavedLocation = async (payload: SavedLocationPayload) =>
  apiClient<{ result: boolean; content: SavedLocation }>('/private/saved-locations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateSavedLocation = async (id: string, payload: Partial<SavedLocationPayload>) =>
  apiClient<{ result: boolean; content: SavedLocation }>(`/private/saved-locations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const deleteSavedLocation = async (id: string) =>
  apiClient<{ result: boolean; content: { id: string } }>(`/private/saved-locations/${id}`, {
    method: 'DELETE',
  });
