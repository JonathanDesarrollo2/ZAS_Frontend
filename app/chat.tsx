// app/chat.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Image,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  Alert,
  BackHandler,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../apis/Client';
import { getMessages, sendMessage, markMessagesRead, getMarketplaceMessages, sendMarketplaceMessage, uploadMarketplaceChatImage, ChatMessage } from '../apis/chat';
import { connectSocket } from '../services/socketClient';
import { useAuth } from '../presentation/store/AuthStore';
import { setChatOpen } from '../services/chatPresence';
import { cancelMarketplaceOrder, getMarketplaceOrder, markMarketplaceOrderPaid, reportMarketplaceOrderPayment, MarketplaceOrder } from '../apis/marketplace';
import MarketplaceReviewModal from '../components/MarketplaceReviewModal';

const ARRIVED_KEY_PREFIX = 'arrived_';

const BASE_BOTTOM_PADDING = Platform.OS === 'ios' ? 34 : 28;
const KEYBOARD_OPEN_PADDING = 8;

const ChatScreen = () => {
  const { tripId, orderId, chatWith, chatRecipientId, chatParticipantId, returnTo, returnTripId } = useLocalSearchParams<{
    tripId?: string;
    orderId?: string;
    chatRecipientId?: string;
    chatParticipantId?: string;
    chatWith: string;
    returnTo?: string;
    returnTripId?: string;
  }>();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const { user } = useAuth();
  const [bottomPadding, setBottomPadding] = useState(BASE_BOTTOM_PADDING);
  const marketplaceChat = Boolean(orderId && !tripId);

  // Este ID es el que separa los chats
  const currentChatParticipantId = chatParticipantId || chatRecipientId;

  const [marketplaceOrder, setMarketplaceOrder] = useState<MarketplaceOrder | null>(null);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [reportingPayment, setReportingPayment] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');

  // Carga inicial de los datos de la orden de MarketPlace
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

  // Lógica de salida robusta
  const handleBack = React.useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    // Fallback en caso de que no haya historial
    if (returnTo === '/driver/active-trip' && (returnTripId || tripId)) {
      router.replace({ pathname: '/driver/active-trip', params: { tripId: returnTripId || tripId } });
    } else if (returnTo === '/trip-active' && tripId) {
      router.replace({ pathname: '/trip-active', params: { tripId } });
    } else if (returnTo === '/marketplace/sales') {
      router.replace('/marketplace/sales');
    } else if (returnTo === '/marketplace/my-orders') {
      router.replace('/marketplace/my-orders');
    } else if (tripId && user?.nivel === 2) {
      router.replace({ pathname: '/driver/active-trip', params: { tripId } });
    } else if (tripId) {
      router.replace({ pathname: '/trip-active', params: { tripId } });
    } else if (marketplaceOrder?.seller_id === user?.id) {
      router.replace('/marketplace/sales');
    } else if (marketplaceOrder?.buyer_id === user?.id) {
      router.replace('/marketplace/my-orders');
    } else {
      router.replace('/dashboard');
    }
  }, [returnTo, returnTripId, tripId, user?.id, user?.nivel, marketplaceOrder?.buyer_id, marketplaceOrder?.seller_id]);

  const confirmMarketplacePayment = async () => {
    if (!orderId || confirmingDelivery) return;
    setConfirmingDelivery(true);
    try {
      const response = await markMarketplaceOrderPaid(orderId);
      if (!response.result) throw new Error(response.error?.[0] || 'No se pudo confirmar el pago');
      setMarketplaceOrder((current) => current ? { ...current, status: 'paid', trip: response.content.trip } : current);
      Alert.alert('Entrega creada', 'El pedido quedó confirmado y ya está disponible para asignar un mototaxi.');
    } catch (error) {
      Alert.alert('No se pudo confirmar', error instanceof Error ? error.message : 'Intenta nuevamente.');
    } finally {
      setConfirmingDelivery(false);
    }
  };

  const reportPayment = async () => {
    if (!orderId || reportingPayment) return;
    if (!paymentReference.trim()) {
      Alert.alert('Referencia requerida', 'Ingresa el número de referencia para continuar.');
      return;
    }
    setReportingPayment(true);
    try {
      const response = await reportMarketplaceOrderPayment(orderId, {
        payer_bank: '',
        payer_cedula: '',
        payer_phone: '',
        payment_reference: paymentReference.trim(),
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
    Alert.alert('Cancelar Pedido', '¿Estás seguro de que deseas cancelar este pedido? Esta acción no se puede deshacer.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar',
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
      await sendMarketplaceMessage(orderId, { image_url: imageUrl }, currentChatParticipantId);
    } catch (error) {
      Alert.alert('No se pudo enviar la imagen', error instanceof Error ? error.message : 'Intenta nuevamente.');
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      setChatOpen(true);
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });
      return () => {
        backHandler.remove();
        setChatOpen(false);
      };
    }, [handleBack]),
  );

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
        } else if (tripId) {
          if (msg.trip_id !== tripId) return;
        }

        // ============================================================
        // FILTRO ESTRICTO BIDIRECCIONAL PARA AISLAR LOS CHATS
        // ============================================================
        // Un mensaje pertenece a esta conversación SOLO si:
        //   (yo → participante)  OR  (participante → yo)
        // Cualquier otro caso se descarta para evitar fugas cruzadas.
        const myId = String(user?.id || '');
        const participantId = String(currentChatParticipantId || '');
        const msgSender = String(msg.sender_id || '');
        const msgRecipient = msg.chat_participant_id ? String(msg.chat_participant_id) : '';

        if (msgRecipient) {
          // Mensaje con destinatario específico.
          const iSentIt = msgSender === myId && msgRecipient === participantId;
          const theySentIt = msgSender === participantId && msgRecipient === myId;
          if (!iSentIt && !theySentIt) return;
        } else {
          // Mensaje sin destinatario (chat general del viaje).
          // Solo se muestra si NO estamos en un chat con participante asignado.
          if (participantId) return;
        }
        // ============================================================

        setMessages(prev => {
          if (prev.some((item) => item.id === msg.id || (item.sender_id === 'system' && msg.sender_id === 'system' && item.message === msg.message))) return prev;
          return [...prev, msg];
        });
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
          id: Date.now(), trip_id: tripId!, sender_id: 'system',
          message: 'El conductor ha llegado a tu ubicación',
          createdAt: new Date().toISOString(), sender_name: 'Sistema',
        };
        setMessages(prev => prev.some(m => m.sender_id === 'system' && m.message === systemMsg.message) ? prev : [...prev, systemMsg]);
      };

      const handleMarketplaceOrderUpdate = (data: { orderId?: string }) => {
        if (!marketplaceChat || !orderId || data.orderId !== orderId) return;
        getMarketplaceOrder(orderId).then(({ result, content }) => { if (result) setMarketplaceOrder(content); }).catch(() => undefined);
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
  }, [tripId, orderId, currentChatParticipantId, marketplaceChat, user?.id]);

  const loadMessages = async () => {
    try {
      if (marketplaceChat && orderId) {
        setMessages(await getMarketplaceMessages(orderId, currentChatParticipantId));
        return;
      }
      if (!tripId) return;

      // Pasamos el chatParticipantId a la API para que el backend filtre los mensajes
      const query = currentChatParticipantId ? `?chatParticipantId=${currentChatParticipantId}` : '';
      const res = await apiClient<{ result: boolean; content: ChatMessage[] }>(`/private/chat/${tripId}/messages${query}`);
      const data = res.content;

      const arrived = await AsyncStorage.getItem(ARRIVED_KEY_PREFIX + tripId);
      if (arrived === 'true') {
        const systemMsg: ChatMessage = {
          id: Date.now() + 1, trip_id: tripId, sender_id: 'system',
          message: 'El conductor ha llegado a tu ubicación',
          createdAt: new Date().toISOString(), sender_name: 'Sistema',
        };
        if (!data.some(m => m.sender_id === 'system' && m.message === systemMsg.message)) {
          data.unshift(systemMsg);
        }
      }
      setMessages(data);
    } catch (error) {
      console.error('No se pudieron cargar los mensajes del chat:', error);
    }
  };

  const handleSend = async () => {
    const messageText = text.trim();
    if (!messageText || sendingMessage) return;
    setSendingMessage(true);
    try {
      if (marketplaceChat && orderId) {
        const response = await sendMarketplaceMessage(orderId, messageText, currentChatParticipantId);
        if (!response.result) throw new Error(response.error?.[0] || 'No se pudo enviar el mensaje.');
        const sentMessage: ChatMessage = {
          ...response.content,
          marketplace_order_id: response.content.marketplace_order_id || orderId,
          sender_id: response.content.sender_id || user?.id || '',
        };
        setMessages((current) => current.some((item) => String(item.id) === String(sentMessage.id)) ? current : [...current, sentMessage]);
      } else if (tripId) {
        // Enviamos el chatParticipantId para que el backend guarde el mensaje en la sala correcta
        await apiClient(`/private/chat/${tripId}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            message: messageText,
            chatParticipantId: currentChatParticipantId || null
          }),
        });
      } else {
        throw new Error('No se encontró la conversación para enviar el mensaje.');
      }
      setText('');
    } catch (error) {
      console.error('Error enviando mensaje del chat:', error);
      Alert.alert('No se pudo enviar', error instanceof Error ? error.message : 'Verifica tu conexión.');
    } finally {
      setSendingMessage(false);
    }
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    if (item.sender_id === 'system' || item.message_type === 'system') {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemMessageText}>{item.message}</Text>
        </View>
      );
    }

    const isMine = user?.id === item.sender_id;

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
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>{chatWith || 'Chat'}</Text>
          {marketplaceChat && marketplaceOrder && (
            <Text style={[
              styles.orderBadge,
              marketplaceOrder.status === 'cancelled' ? styles.cancelledBadge
                : marketplaceOrder.status === 'pending_payment' ? styles.pendingBadge
                  : styles.paidBadge,
            ]}>
              {marketplaceOrder.status === 'pending_payment' ? 'Pendiente'
                : marketplaceOrder.status === 'cancelled' ? 'Cancelado'
                  : marketplaceOrder.status === 'delivered' ? 'Entregado'
                    : marketplaceOrder.status === 'picked_up' ? 'En camino'
                      : marketplaceOrder.status === 'delivery_assigned' ? 'Repartidor asignado'
                        : 'Pagado'}
            </Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {marketplaceChat && marketplaceOrder &&
        marketplaceOrder.seller_id === user?.id &&
        marketplaceOrder.status === 'paid' &&
        Boolean(marketplaceOrder.payment_reported_at) &&
        !marketplaceOrder.trip && (
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
          style={styles.reportPaymentButton}
          onPress={() => setPaymentModalVisible(true)}
        >
          <Text style={styles.confirmOrderText}>Ver datos de pago</Text>
        </TouchableOpacity>
      )}
      {marketplaceChat && marketplaceOrder && marketplaceOrder.status !== 'pending_payment' && marketplaceOrder.status !== 'cancelled' && (
        <View style={styles.orderStatus}>
          <Text style={styles.orderStatusText}>
            {marketplaceOrder.status === 'paid' && !marketplaceOrder.trip
              ? 'Pago reportado, esperando verificación'
              : marketplaceOrder.status === 'delivered' ? 'Pedido entregado' : ''}
          </Text>
          {/* AQUÍ ESTÁ EL CAMBIO PARA QUE EL TAXISTA NO VEA ESTE BOTÓN */}
          {marketplaceTripId && user?.nivel !== 2 ? (
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
            {!!marketplaceOrder.payer_bank && <Text style={styles.paymentDetailsText}>Banco: {marketplaceOrder.payer_bank}</Text>}
            {!!marketplaceOrder.payer_cedula && <Text style={styles.paymentDetailsText}>Cédula: {marketplaceOrder.payer_cedula}</Text>}
            {!!marketplaceOrder.payer_phone && <Text style={styles.paymentDetailsText}>Teléfono: {marketplaceOrder.payer_phone}</Text>}
            <Text style={styles.paymentDetailsText}>Referencia: {marketplaceOrder.payment_reference}</Text>
          </View>
        )}
      {marketplaceChat && marketplaceOrder?.status === 'delivered' && marketplaceOrder.driver_payment_account && (
        <View style={styles.paymentDetailsCard}>
          <Text style={styles.paymentDetailsTitle}>Datos para pagar al mototaxista</Text>
          <Text style={styles.paymentDetailsText}>Banco: {marketplaceOrder.driver_payment_account.bankName}</Text>
          <Text style={styles.paymentDetailsText}>Cédula: {marketplaceOrder.driver_payment_account.cedula}</Text>
          <Text style={styles.paymentDetailsText}>Teléfono: {marketplaceOrder.driver_payment_account.phone}</Text>
        </View>
      )}
      {marketplaceChat && marketplaceOrder?.status === 'delivered' && !marketplaceOrder.has_reviewed_by_me && (
        <TouchableOpacity style={styles.chatReviewButton} onPress={() => setReviewModalVisible(true)}>
          <Feather name="star" size={17} color="#008F79" />
          <Text style={styles.chatReviewText}>Calificar Venta</Text>
        </TouchableOpacity>
      )}
      {marketplaceChat && marketplaceOrder?.status === 'cancelled' && (
        <View style={styles.cancelledBanner}>
          <Feather name="slash" size={18} color="#B42318" />
          <Text style={styles.cancelledBannerText}>Este pedido fue cancelado</Text>
        </View>
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

      {!(marketplaceChat && marketplaceOrder?.status === 'cancelled') && <View style={[styles.inputWrapper, { paddingBottom: bottomPadding }]}>
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
            {sendingMessage
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Feather name="send" size={22} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>}
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.paymentModal}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Pago Móvil del vendedor</Text>
                <TouchableOpacity onPress={() => setPaymentModalVisible(false)} accessibilityLabel="Cerrar">
                  <Feather name="x" size={22} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <View style={styles.sellerPaymentCard}>
                {marketplaceOrder?.seller_payment_account ? (
                  <>
                    <Text style={styles.paymentDetailsTitle}>Transfiere a estos datos</Text>
                    <Text style={styles.paymentDetailsText}>Banco: {marketplaceOrder.seller_payment_account.bankName}</Text>
                    <Text style={styles.paymentDetailsText}>Cédula: {marketplaceOrder.seller_payment_account.cedula}</Text>
                    <Text style={styles.paymentDetailsText}>Teléfono: {marketplaceOrder.seller_payment_account.phone}</Text>
                  </>
                ) : (
                  <Text style={styles.paymentNotice}>El vendedor aún no ha registrado sus datos de Pago Móvil. Contáctalo por el chat antes de pagar.</Text>
                )}
              </View>
              <Text style={styles.paymentNotice}>Después de pagar, ingresa el número de referencia.</Text>
              <TextInput
                style={styles.paymentInput}
                value={paymentReference}
                onChangeText={setPaymentReference}
                placeholder="Número de referencia *"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.reportPaymentButton, reportingPayment && { opacity: 0.65 }]}
                onPress={() => void reportPayment()}
                disabled={reportingPayment}
              >
                {reportingPayment ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmOrderText}>Ya realicé el pago</Text>}
              </TouchableOpacity>
            </ScrollView>
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
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  orderBadge: { alignSelf: 'flex-start', overflow: 'hidden', borderRadius: 10, marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, fontSize: 11, fontWeight: '700' },
  pendingBadge: { color: '#92400E', backgroundColor: '#FEF3C7' },
  paidBadge: { color: '#166534', backgroundColor: '#DCFCE7' },
  cancelledBadge: { color: '#B42318', backgroundColor: '#FEE4E2' },
  cancelledBanner: { marginHorizontal: 16, marginVertical: 10, minHeight: 44, borderRadius: 12, backgroundColor: '#FEF2F2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cancelledBannerText: { color: '#B42318', fontWeight: '700', fontSize: 14 },
  confirmOrderButton: { minHeight: 48, marginHorizontal: 16, marginTop: 10, marginBottom: 4, borderRadius: 12, backgroundColor: '#00C9A7', alignItems: 'center', justifyContent: 'center' },
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
  sellerPaymentCard: { padding: 12, backgroundColor: '#ECFDF8', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#B7F0E2' },
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