// LEIDO
// app/chat.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMessages, sendMessage, markMessagesRead, ChatMessage } from '../apis/chat';
import { connectSocket } from '../services/socketClient';
import { useAuth } from '../presentation/store/AuthStore'; // ✅ importación corregida
import { setChatOpen } from '../services/chatPresence';

const ARRIVED_KEY_PREFIX = 'arrived_';

const BASE_BOTTOM_PADDING = Platform.OS === 'ios' ? 34 : 28;
const KEYBOARD_OPEN_PADDING = 8;

const ChatScreen = () => {
  const { tripId, chatWith } = useLocalSearchParams<{
    tripId: string;
    chatWith: string;
  }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const { user } = useAuth(); // ahora user.id existe
  const [bottomPadding, setBottomPadding] = useState(BASE_BOTTOM_PADDING);

  useFocusEffect(
    React.useCallback(() => {
      setChatOpen(true);
      return () => setChatOpen(false);
    }, []),
  );

  // Control del teclado
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setBottomPadding(KEYBOARD_OPEN_PADDING);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setBottomPadding(BASE_BOTTOM_PADDING);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Carga inicial y socket
  useEffect(() => {
    let cancelled = false;
    let cleanupSocket: () => void = () => undefined;
    loadMessages();
    markMessagesRead(tripId!).catch(() => undefined);
    const setupSocket = async () => {
      const socket = await connectSocket();
      if (cancelled) return;
      socket.emit('trip:join', tripId);

      const handleMessage = (msg: ChatMessage) => {
        setMessages(prev => [...prev, msg]);
        markMessagesRead(tripId!).catch(() => undefined);
      };

      const handleRead = (data: { reader_id?: string }) => {
        if (String(data.reader_id) !== String(user?.id)) {
          setMessages(prev => prev.map(message => (
            String(message.sender_id) === String(user?.id)
              ? { ...message, read_at: new Date().toISOString() }
              : message
          )));
        }
      };

      const handleDriverArrived = async () => {
        await AsyncStorage.setItem(ARRIVED_KEY_PREFIX + tripId, 'true');
        const systemMsg: ChatMessage = {
          id: Date.now(),
          trip_id: tripId!,
          sender_id: 'system',
          message: 'El conductor ha llegado a tu ubicación',
          createdAt: new Date().toISOString(),
          sender_name: 'Sistema',
        };
        setMessages(prev => {
          const alreadyExists = prev.some(
            m => m.sender_id === 'system' && m.message === systemMsg.message
          );
          return alreadyExists ? prev : [...prev, systemMsg];
        });
      };

      socket.on('chat:message', handleMessage);
      socket.on('chat:read', handleRead);
      socket.on('driverArrived', handleDriverArrived);
      cleanupSocket = () => {
        socket.off('chat:message', handleMessage);
        socket.off('chat:read', handleRead);
        socket.off('driverArrived', handleDriverArrived);
      };
    };

    setupSocket().catch(() => undefined);
    return () => {
      cancelled = true;
      cleanupSocket();
    };
  }, [tripId]);

  const loadMessages = async () => {
    try {
      const data = await getMessages(tripId!);
      const arrived = await AsyncStorage.getItem(ARRIVED_KEY_PREFIX + tripId);
      if (arrived === 'true') {
        const systemMsg: ChatMessage = {
          id: Date.now() + 1,
          trip_id: tripId!,
          sender_id: 'system',
          message: 'El conductor ha llegado a tu ubicación',
          createdAt: new Date().toISOString(),
          sender_name: 'Sistema',
        };
        const exists = data.some(
          m => m.sender_id === 'system' && m.message === systemMsg.message
        );
        if (!exists) {
          data.unshift(systemMsg);
        }
      }
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
    if (item.sender_id === 'system') {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemMessageText}>{item.message}</Text>
        </View>
      );
    }

    const isMine = user?.id === item.sender_id; // ✅ ya no da error

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
        <Text style={[styles.messageTime, isMine && styles.myMessageTime]}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {isMine && <Text> {item.read_at ? '✓✓' : '✓'}</Text>}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} 
    >
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
        style={styles.chatList}
        contentContainerStyle={styles.listContent}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.empty}>No hay mensajes aún</Text>
        }
      />

      <View style={[styles.inputWrapper, { paddingBottom: bottomPadding }]}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#999"
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Feather name="send" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// Los estilos permanecen exactamente igual
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  chatList: { 
    flex: 1,
    backgroundColor: '#F0FDF9' 
  },
  listContent: { 
    padding: 16,
    paddingBottom: 20 
  },
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
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#00C9A7',
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
  messageTime: {
    alignSelf: 'flex-end',
    marginTop: 4,
    color: '#9CA3AF',
    fontSize: 10,
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.8)',
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
  inputWrapper: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 2,
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
    minHeight: 40,
    fontSize: 16,
    color: '#111827',
    marginRight: 8,
  },
  sendBtn: {
    backgroundColor: '#00C9A7',
    borderRadius: 25,
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
});

export default ChatScreen;
