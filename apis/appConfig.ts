// apis/appConfig.ts
import { apiClient } from './Client';

export interface AppConfig {
  min_version: string;
  update_url: string;
}

export const getAppConfig = async (): Promise<AppConfig> => {
  const res = await apiClient<{ result: boolean; content: AppConfig }>('/public/app-config');
  return res.content;
};