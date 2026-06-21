// app/chat.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { getMessages, sendMessage, ChatMessage } from '../apis/chat';
import { connectSocket } from './socket/socketClient';
import { useAuth } from '../presentation/hooks/useAuth'; // para obtener el usuario actual

const ChatScreen = () => {
  const { tripId, chatWith } = useLocalSearchParams<{
    tripId: string;
    chatWith: string;
  }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const { user } = useAuth(); // usuario autenticado

  useEffect(() => {
    loadMessages();
    const setupSocket = async () => {
      const socket = await connectSocket();
      socket.emit('trip:join', tripId);

      socket.on('chat:message', (msg: ChatMessage) => {
        setMessages(prev => [...prev, msg]);
      });

      // Escuchar llegada del conductor
      socket.on('driverArrived', () => {
        const systemMsg: ChatMessage = {
          id: Date.now(), // temporal, solo visual
          trip_id: tripId!,
          sender_id: 'system',
          message: 'El conductor ha llegado a tu ubicación',
          createdAt: new Date().toISOString(),
          sender_name: 'Sistema',
        };
        setMessages(prev => [...prev, systemMsg]);
      });

      return () => {
        socket.off('chat:message');
        socket.off('driverArrived');
      };
    };

    setupSocket();
  }, [tripId]);

  const loadMessages = async () => {
    try {
      const data = await getMessages(tripId!);
      setMessages(data);
    } catch (err) {}
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    try {
      await sendMessage(tripId!, text.trim());
      setText('');
    } catch (err) {}
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    // Mensaje del sistema (centrado, sin burbuja)
    if (item.sender_id === 'system') {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemMessageText}>{item.message}</Text>
        </View>
      );
    }

    const isMine = item.sender_id === user?.id;

    return (
      <View style={[styles.bubble, isMine ? styles.myBubble : styles.otherBubble]}>
        {!isMine && (
          <Text style={styles.sender}>
            {item.sender_name || 'Usuario'}
          </Text>
        )}
        <Text style={[styles.msgText, isMine && { color: '#fff' }]}>
          {item.message}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Cabecera */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{chatWith || 'Chat'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.empty}>No hay mensajes aún</Text>
        }
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje..."
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Feather name="send" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  backBtn: { marginRight: 12 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '600', color: '#1F2937' },
  list: { padding: 16 },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#00C9A7', // verde menta para mensajes propios
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sender: {
    fontWeight: '600',
    fontSize: 13,
    color: '#555',
    marginBottom: 2,
  },
  msgText: { fontSize: 16, color: '#111827' },
  systemMessage: {
    alignItems: 'center',
    marginVertical: 12,
  },
  systemMessageText: {
    backgroundColor: '#E5E7EB',
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendBtn: {
    backgroundColor: '#00C9A7',
    borderRadius: 25,
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
});

export default ChatScreen;