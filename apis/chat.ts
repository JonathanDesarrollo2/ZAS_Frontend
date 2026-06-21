import { apiClient } from './Client';

export interface ChatMessage {
  id: number;
  trip_id: string;
  sender_id: string;
  message: string;
  createdAt: string;
  sender_name?: string;
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