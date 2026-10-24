// LEIDO
// app/chat.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMessages, sendMessage, markMessagesRead, getMarketplaceMessages, sendMarketplaceMessage, uploadMarketplaceChatImage, ChatMessage } from '../apis/chat';
import { connectSocket } from '../services/socketClient';
import { useAuth } from '../presentation/store/AuthStore'; // ✅ importación corregida
import { setChatOpen } from '../services/chatPresence';
import { cancelMarketplaceOrder, getMarketplaceOrder, markMarketplaceOrderPaid, reportMarketplaceOrderPayment, MarketplaceOrder } from '../apis/marketplace';
import MarketplaceReviewModal from '../components/MarketplaceReviewModal';

const ARRIVED_KEY_PREFIX = 'arrived_';

const BASE_BOTTOM_PADDING = Platform.OS === 'ios' ? 34 : 28;
const KEYBOARD_OPEN_PADDING = 8;

const ChatScreen = () => {
  const { tripId, orderId, chatWith } = useLocalSearchParams<{
    tripId?: string;
    orderId?: string;
    chatWith: string;
  }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const { user } = useAuth(); // ahora user.id existe
  const [bottomPadding, setBottomPadding] = useState(BASE_BOTTOM_PADDING);
  const marketplaceChat = Boolean(orderId && !tripId);
  const [marketplaceOrder, setMarketplaceOrder] = useState<MarketplaceOrder | null>(null);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [reportingPayment, setReportingPayment] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState({
    payer_bank: '',
    payer_cedula: '',
    payer_phone: '',
    payment_reference: '',
  });

  useEffect(() => {
    if (!marketplaceChat || !orderId) return;
    let mounted = true;
    getMarketplaceOrder(orderId)
      .then(({ result, content }) => {
        if (!result) throw new Error('No se pudo cargar la orden');
        if (mounted) setMarketplaceOrder(content);
      })
      .catch((error: unknown) => {
        if (mounted) Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo cargar la orden');
      });
    return () => { mounted = false; };
  }, [marketplaceChat, orderId]);

  const confirmMarketplacePayment = async () => {
    if (!orderId || confirmingDelivery) return;
    setConfirmingDelivery(true);
    try {
      const response = await markMarketplaceOrderPaid(orderId);
      if (!response.result) throw new Error(response.error?.[0] || 'No se pudo confirmar el pago');
      setMarketplaceOrder((current) => current
        ? { ...current, status: 'paid', trip: response.content.trip }
        : current);
      Alert.alert('Entrega creada', 'El pedido quedó confirmado y ya está disponible para asignar un mototaxi.');
    } catch (error) {
      Alert.alert('No se pudo confirmar', error instanceof Error ? error.message : 'Intenta nuevamente.');
    } finally {
      setConfirmingDelivery(false);
    }
  };

  const reportPayment = async () => {
    if (!orderId || reportingPayment) return;
    if (Object.values(paymentDetails).some((value) => !value.trim())) {
      Alert.alert('Datos incompletos', 'Completa el banco, cédula, teléfono y referencia del pago.');
      return;
    }
    setReportingPayment(true);
    try {
      const response = await reportMarketplaceOrderPayment(orderId, {
        payer_bank: paymentDetails.payer_bank.trim(),
        payer_cedula: paymentDetails.payer_cedula.trim(),
        payer_phone: paymentDetails.payer_phone.trim(),
        payment_reference: paymentDetails.payment_reference.trim(),
      });
      if (!response.result) throw new Error(response.error?.[0] || 'No se pudo reportar el pago');
      setMarketplaceOrder(response.content);
      setPaymentModalVisible(false);
      await loadMessages();
      Alert.alert('Pago reportado', 'El vendedor recibirá los datos para verificar el pago.');
    } catch (error) {
      Alert.alert('No se pudo reportar', error instanceof Error ? error.message : 'Intenta nuevamente.');
    } finally {
      setReportingPayment(false);
    }
  };

  const refreshMarketplaceOrder = async () => {
    if (!orderId) return;
    const response = await getMarketplaceOrder(orderId);
    if (!response.result) throw new Error('No se pudo actualizar el pedido.');
    setMarketplaceOrder(response.content);
  };

  const confirmCancelOrder = () => {
    if (!marketplaceOrder || marketplaceOrder.status !== 'pending_payment') return;
    Alert.alert('Cancelar pedido', '¿Seguro que deseas cancelar este pedido?', [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Cancelar pedido',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              const response = await cancelMarketplaceOrder(marketplaceOrder.id);
              if (!response.result) throw new Error(response.error?.[0] || 'No se pudo cancelar el pedido.');
              await refreshMarketplaceOrder();
            } catch (cancelError) {
              Alert.alert('No se pudo cancelar', cancelError instanceof Error ? cancelError.message : 'Intenta nuevamente.');
            }
          })();
        },
      },
    ]);
  };

  const handlePickChatImage = async () => {
    if (!marketplaceChat || !orderId) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitas permitir el acceso a tus fotos para enviar una imagen.');
        return;
      }
      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      });
      if (selection.canceled || !selection.assets[0]) return;
      const asset = selection.assets[0];
      const imageUrl = await uploadMarketplaceChatImage({
        uri: asset.uri,
        name: asset.fileName || `chat-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
      await sendMarketplaceMessage(orderId, { image_url: imageUrl });
    } catch (error) {
      Alert.alert('No se pudo enviar la imagen', error instanceof Error ? error.message : 'Intenta nuevamente.');
    }
  };

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
    void loadMessages();
    if (tripId) markMessagesRead(tripId).catch(() => undefined);
    const setupSocket = async () => {
      const socket = await connectSocket();
      if (cancelled) return;
      if (tripId) socket.emit('trip:join', tripId);

      const handleMessage = (msg: ChatMessage) => {
        if (marketplaceChat) {
          if (msg.marketplace_order_id !== orderId) return;
          setMessages(prev => {
            if (prev.some((item) => item.id === msg.id ||
              (item.sender_id === 'system' && msg.sender_id === 'system' && item.message === msg.message))) return prev;
            return [...prev, msg];
          });
          return;
        }
        setMessages(prev => [...prev, msg]);
        if (tripId) markMessagesRead(tripId).catch(() => undefined);
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
        if (!tripId) return;
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
      const handleMarketplaceOrderUpdate = (data: { orderId?: string }) => {
        if (!marketplaceChat || !orderId || data.orderId !== orderId) return;
        getMarketplaceOrder(orderId)
          .then(({ result, content }) => { if (result) setMarketplaceOrder(content); })
          .catch(() => undefined);
      };

      const messageEvent = marketplaceChat ? 'marketplace:message' : 'chat:message';
      socket.on(messageEvent, handleMessage);
      if (marketplaceChat) socket.on('marketplace:order-updated', handleMarketplaceOrderUpdate);
      if (tripId) {
        socket.on('chat:read', handleRead);
        socket.on('driverArrived', handleDriverArrived);
      }
      cleanupSocket = () => {
        socket.off(messageEvent, handleMessage);
        socket.off('marketplace:order-updated', handleMarketplaceOrderUpdate);
        socket.off('chat:read', handleRead);
        socket.off('driverArrived', handleDriverArrived);
      };
    };

    setupSocket().catch(() => undefined);
    return () => {
      cancelled = true;
      cleanupSocket();
    };
  }, [tripId, orderId, marketplaceChat, user?.id]);

  const loadMessages = async () => {
    try {
      if (marketplaceChat && orderId) {
        setMessages(await getMarketplaceMessages(orderId));
        return;
      }
      if (!tripId) return;
      const data = await getMessages(tripId);
      const arrived = await AsyncStorage.getItem(ARRIVED_KEY_PREFIX + tripId);
      if (arrived === 'true') {
        const systemMsg: ChatMessage = {
          id: Date.now() + 1,
          trip_id: tripId,
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
    } catch {}
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    try {
      if (marketplaceChat && orderId) await sendMarketplaceMessage(orderId, text.trim());
      else if (tripId) await sendMessage(tripId, text.trim());
      else return;
      setText('');
    } catch {}
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    if (item.sender_id === 'system' || item.message_type === 'system') {
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
            {item.sender_name || item.sender?.username || item.sender?.userlogin || 'Usuario'}
          </Text>
        )}
        {item.message_type === 'image' && item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.chatImage} resizeMode="cover" />
        ) : (
          <Text style={[styles.msgText, isMine && { color: '#fff' }]}>{item.message}</Text>
        )}
        <Text style={[styles.messageTime, isMine && styles.myMessageTime]}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {isMine && <Text> {item.read_at ? '✓✓' : '✓'}</Text>}
        </Text>
      </View>
    );
  };
  const marketplaceTripId = marketplaceOrder?.trip?.id;

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

      {marketplaceChat && marketplaceOrder && marketplaceOrder.seller_id === user?.id &&
        (marketplaceOrder.status === 'pending_payment' || (marketplaceOrder.status === 'paid' && !marketplaceOrder.trip)) && (
        <TouchableOpacity
          style={[styles.confirmOrderButton, confirmingDelivery && { opacity: 0.65 }]}
          onPress={() => void confirmMarketplacePayment()}
          disabled={confirmingDelivery}
        >
          {confirmingDelivery
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.confirmOrderText}>Confirmar Pago y Enviar</Text>}
        </TouchableOpacity>
      )}
      {marketplaceChat && marketplaceOrder?.status === 'pending_payment' && (
        <TouchableOpacity style={styles.cancelOrderButton} onPress={confirmCancelOrder}>
          <Text style={styles.cancelOrderText}>Cancelar Pedido</Text>
        </TouchableOpacity>
      )}
      {marketplaceChat && marketplaceOrder && marketplaceOrder.buyer_id === user?.id && marketplaceOrder.status === 'pending_payment' && (
        <TouchableOpacity
          style={[styles.reportPaymentButton, reportingPayment && { opacity: 0.65 }]}
          onPress={() => setPaymentModalVisible(true)}
          disabled={reportingPayment}
        >
          <Text style={styles.confirmOrderText}>Marcar como Pagado</Text>
        </TouchableOpacity>
      )}
      {marketplaceChat && marketplaceOrder && marketplaceOrder.status !== 'pending_payment' && (
        <View style={styles.orderStatus}>
          <Text style={styles.orderStatusText}>
            Pedido: {marketplaceOrder.status === 'paid' && !marketplaceOrder.trip
              ? 'pago reportado, esperando verificación'
              : marketplaceOrder.status === 'delivered' ? 'entregado' : marketplaceOrder.status.replace('_', ' ')}
          </Text>
          {marketplaceTripId ? (
            <TouchableOpacity onPress={() => router.push({ pathname: '/trip-active', params: { tripId: marketplaceTripId } })}>
              <Text style={styles.deliveryLink}>Ver entrega</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
      {marketplaceChat && marketplaceOrder?.payment_reported_at &&
        marketplaceOrder.seller_id === user?.id && (
          <View style={styles.paymentDetailsCard}>
            <Text style={styles.paymentDetailsTitle}>Datos reportados por el comprador</Text>
            <Text style={styles.paymentDetailsText}>Banco: {marketplaceOrder.payer_bank}</Text>
            <Text style={styles.paymentDetailsText}>Cédula: {marketplaceOrder.payer_cedula}</Text>
            <Text style={styles.paymentDetailsText}>Teléfono: {marketplaceOrder.payer_phone}</Text>
            <Text style={styles.paymentDetailsText}>Referencia: {marketplaceOrder.payment_reference}</Text>
          </View>
        )}
      {marketplaceChat && marketplaceOrder?.status === 'delivered' && !marketplaceOrder.has_reviewed_by_me && (
        <TouchableOpacity style={styles.chatReviewButton} onPress={() => setReviewModalVisible(true)}>
          <Feather name="star" size={17} color="#008F79" />
          <Text style={styles.chatReviewText}>Calificar Venta</Text>
        </TouchableOpacity>
      )}

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
          {marketplaceChat && (
            <TouchableOpacity style={styles.imageButton} onPress={() => void handlePickChatImage()} accessibilityLabel="Enviar imagen">
              <Feather name="image" size={21} color="#00A98E" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Feather name="send" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.paymentModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reportar pago</Text>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)} accessibilityLabel="Cerrar">
                <Feather name="x" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <Text style={styles.paymentNotice}>El vendedor verificará estos datos antes de crear la entrega.</Text>
            {([
              ['payer_bank', 'Banco emisor'],
              ['payer_cedula', 'Cédula'],
              ['payer_phone', 'Teléfono'],
              ['payment_reference', 'Número de referencia'],
            ] as const).map(([field, label]) => (
              <TextInput
                key={field}
                style={styles.paymentInput}
                value={paymentDetails[field]}
                onChangeText={(value) => setPaymentDetails((current) => ({ ...current, [field]: value }))}
                placeholder={label}
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
              />
            ))}
            <TouchableOpacity
              style={[styles.reportPaymentButton, reportingPayment && { opacity: 0.65 }]}
              onPress={() => void reportPayment()}
              disabled={reportingPayment}
            >
              {reportingPayment ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmOrderText}>Enviar reporte</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <MarketplaceReviewModal
        orderId={marketplaceOrder?.id || null}
        visible={reviewModalVisible}
        onClose={() => setReviewModalVisible(false)}
        onSubmitted={() => {
          void refreshMarketplaceOrder().catch((refreshError: unknown) => {
            Alert.alert('Calificación guardada', refreshError instanceof Error
              ? `No se pudo actualizar el pedido: ${refreshError.message}`
              : 'No se pudo actualizar el pedido.');
          });
        }}
      />
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
  confirmOrderButton: { minHeight: 48, marginHorizontal: 16, marginTop: 10, marginBottom: 4, borderRadius: 12, backgroundColor: '#00A98E', alignItems: 'center', justifyContent: 'center' },
  reportPaymentButton: { minHeight: 48, marginHorizontal: 16, marginTop: 10, marginBottom: 8, borderRadius: 12, backgroundColor: '#00C9A7', alignItems: 'center', justifyContent: 'center' },
  cancelOrderButton: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  cancelOrderText: { color: '#DC2626', fontSize: 13, fontWeight: '700' },
  chatReviewButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginHorizontal: 16, marginVertical: 8, borderWidth: 1, borderColor: '#B7F0E2', borderRadius: 11 },
  chatReviewText: { color: '#008F79', fontSize: 13, fontWeight: '800' },
  confirmOrderText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  orderStatus: { minHeight: 38, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ECFDF8' },
  orderStatusText: { color: '#374151', fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  paymentDetailsCard: { marginHorizontal: 14, marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: '#ECFDF8', borderWidth: 1, borderColor: '#B7F0E2' },
  paymentDetailsTitle: { color: '#1F2937', fontSize: 13, fontWeight: '800', marginBottom: 4 },
  paymentDetailsText: { color: '#4B5563', fontSize: 12, marginTop: 2 },
  deliveryLink: { color: '#008F79', fontSize: 13, fontWeight: '700' },
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
  imageButton: { width: 40, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: 5 },
  chatImage: { width: 220, height: 190, borderRadius: 12, backgroundColor: '#E5E7EB' },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(17,24,39,0.5)' },
  paymentModal: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { color: '#1F2937', fontSize: 20, fontWeight: '800' },
  paymentNotice: { color: '#6B7280', fontSize: 13, lineHeight: 19, marginBottom: 12 },
  paymentInput: { height: 48, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 11, paddingHorizontal: 13, color: '#1F2937', marginTop: 9 },
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
