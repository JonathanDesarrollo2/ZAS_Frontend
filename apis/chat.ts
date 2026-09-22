// LEIDO
import { apiClient } from './Client';

export interface ChatMessage {
  id: number;
  trip_id: string;
  sender_id: string;
  message: string;
  createdAt: string;
  sender_name?: string;
  read_at?: string | null;
}

export const getMessages = async (tripId: string): Promise<ChatMessage[]> => {
  const res = await apiClient<{ result: boolean; content: ChatMessage[] }>(`/private/chat/${tripId}/messages`);
  return res.content;
};

export const sendMessage = async (tripId: string, message: string) => {
  await apiClient(`/private/chat/${tripId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
};

export const getUnreadCount = async (tripId: string): Promise<number> => {
  const res = await apiClient<{ result: boolean; content: { count: number } }>(
    `/private/chat/${tripId}/unread-count`,
  );
  return res.content?.count || 0;
};

export const markMessagesRead = async (tripId: string) => {
  await apiClient(`/private/chat/${tripId}/read`, { method: 'POST' });
};
