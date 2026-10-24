import { apiClient } from './Client';

export type ReviewRole = 'passenger' | 'driver';

export interface UserReview {
  id: string;
  rating: number;
  tags: string[];
  comment: string | null;
  reviewer_role: ReviewRole;
  createdAt: string;
  reviewer?: { id: string; username: string; profile_pic_url: string | null };
}

export const submitReview = (payload: {
  trip_id: string;
  reviewee_id: string;
  reviewer_role: ReviewRole;
  rating: number;
  tags: string[];
  comment: string;
}) => apiClient('/reviews', {
  method: 'POST',
  body: JSON.stringify(payload),
});

export interface PublicProfile {
  id: string;
  username: string;
  profile_pic_url: string | null;
  city: string | null;
  completed_trip_count: number;
  products: Array<{
    id: string;
    title: string;
    price: number;
    image_urls: string[];
    image_url?: string | null;
    status: string;
  }>;
  rating_average?: number;
  rating_count?: number;
  vehicle?: { vehicle_type?: string; plate?: string } | null;
  reviews?: UserReview[];
}

export const getPublicProfile = (userId: string) =>
  apiClient<{ result: boolean; content: PublicProfile }>(
    `/users/${encodeURIComponent(userId)}/public-profile`,
  );

export const getUserReviews = (userId: string) =>
  apiClient<{ result: boolean; content: { average_rating: number | null; review_count: number; reviews: UserReview[] } }>(
    `/users/${encodeURIComponent(userId)}/reviews`,
  );

export type EarningsPeriod = 'today' | 'week' | 'month';

export interface EarningsSummary {
  total_earnings: number;
  completed_trip_count: number;
  by_date: Array<{ date: string; earnings: number; completed_trip_count: number }>;
}

export const getDriverEarnings = (period: EarningsPeriod) =>
  apiClient<{ result: boolean; content: EarningsSummary }>(
    `/drivers/earnings?period=${period}`,
  );

export const createReport = (payload: {
  reported_user_id?: string;
  trip_id?: string;
  product_id?: string;
  category: string;
  description: string;
}) => apiClient<{ result: boolean; content: { id: string; status: string }; error: string[] }>('/reports', {
  method: 'POST',
  body: JSON.stringify(payload),
});
