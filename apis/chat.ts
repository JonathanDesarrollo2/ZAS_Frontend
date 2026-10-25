// LEIDO
import { apiClient, getToken } from './Client';
import * as FileSystem from 'expo-file-system/legacy';

export interface ChatMessage {
  id: number;
  trip_id?: string;
  marketplace_order_id?: string;
  chat_participant_id?: string | null;
  sender_id: string;
  message: string;
  message_type?: 'text' | 'image' | 'system';
  image_url?: string | null;
  createdAt: string;
  sender_name?: string;
  sender?: { username?: string; userlogin?: string };
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

export const getMarketplaceMessages = async (orderId: string, chatParticipantId?: string): Promise<ChatMessage[]> => {
  const query = chatParticipantId ? `?chatParticipantId=${encodeURIComponent(chatParticipantId)}` : '';
  const res = await apiClient<{ result: boolean; content: ChatMessage[] }>(
    `/private/marketplace/orders/${orderId}/messages${query}`,
  );
  return res.content;
};

export const sendMarketplaceMessage = async (
  orderId: string,
  message: string | { image_url: string },
  chatParticipantId?: string,
) => {
  await apiClient(`/private/marketplace/orders/${orderId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      ...(typeof message === 'string' ? { message } : {
        message_type: 'image',
        image_url: message.image_url,
      }),
      ...(chatParticipantId ? { chat_participant_id: chatParticipantId } : {}),
    }),
  });
};

export const uploadMarketplaceChatImage = async (file: {
  uri: string;
  name: string;
  type: string;
}): Promise<string> => {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!baseUrl) throw new Error('API URL no configurada.');
  const token = await getToken();
  if (!token) throw new Error('No hay una sesión activa.');
  const response = await FileSystem.uploadAsync(
    `${baseUrl.replace(/\/+$/, '')}/private/marketplace/upload-chat-image`,
    file.uri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'image',
      mimeType: file.type,
      parameters: { name: file.name },
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  let body: { result?: boolean; content?: { url?: string }; error?: string[] };
  try {
    body = JSON.parse(response.body) as typeof body;
  } catch {
    throw new Error('El servidor devolvió una respuesta inválida al subir la imagen.');
  }
  if (response.status < 200 || response.status >= 300 || !body.result || !body.content?.url) {
    throw new Error(body.error?.[0] || 'No se pudo subir la imagen del chat.');
  }
  return body.content.url;
};
