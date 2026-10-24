import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { cancelMarketplaceOrder, getMyMarketplaceOrders, MarketplaceOrder } from '../../apis/marketplace';
import MarketplaceReviewModal from '../../components/MarketplaceReviewModal';

const getStatusLabel = (order: MarketplaceOrder): string => {
  if (order.status === 'pending_payment') return 'Pendiente de pago';
  if (order.status === 'paid') return order.trip ? 'Pagado · preparando entrega' : 'Pagado';
  if (order.status === 'delivery_assigned') return 'Mototaxi asignado';
  if (order.status === 'picked_up' || order.trip?.status === 'in_progress') return 'En camino';
  if (order.status === 'delivered') return 'Entregado';
  return 'Cancelado';
};

export default function MarketplaceMyOrdersScreen() {
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getMyMarketplaceOrders();
      if (!response.result) throw new Error('No se pudieron cargar tus pedidos.');
      setOrders(response.content);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar tus pedidos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadOrders();
  }, [loadOrders]));

  const cancelOrder = (order: MarketplaceOrder) => {
    Alert.alert('Cancelar pedido', '¿Seguro que deseas cancelar este pedido?', [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Cancelar pedido',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              const response = await cancelMarketplaceOrder(order.id);
              if (!response.result) throw new Error(response.error?.[0] || 'No se pudo cancelar el pedido.');
              await loadOrders();
            } catch (cancelError) {
              Alert.alert('No se pudo cancelar', cancelError instanceof Error ? cancelError.message : 'Intenta nuevamente.');
            }
          })();
        },
      },
    ]);
  };

  const renderOrder = ({ item }: { item: MarketplaceOrder }) => {
    const imageUrl = item.product?.image_urls?.[0] || item.product?.image_url;
    return (
      <View style={styles.card}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
        ) : (
          <View style={[styles.productImage, styles.imagePlaceholder]}>
            <Feather name="package" size={27} color="#00A98E" />
          </View>
        )}
        <View style={styles.orderDetails}>
          <Text style={styles.productName} numberOfLines={2}>{item.product?.title || 'Producto'}</Text>
          <Text style={styles.price}>${(Number(item.product?.price || 0) * item.quantity).toFixed(2)}</Text>
          <View style={[
            styles.statusPill,
            item.status === 'cancelled' && styles.cancelledPill,
            item.status === 'delivered' && styles.deliveredPill,
          ]}>
            <Text style={[
              styles.statusText,
              item.status === 'cancelled' && styles.cancelledText,
              item.status === 'delivered' && styles.deliveredText,
            ]}>{getStatusLabel(item)}</Text>
          </View>
          <Text style={styles.seller} numberOfLines={1}>
            Vendedor: {item.seller?.username || item.seller?.userlogin || 'Vendedor'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => router.push({
            pathname: '/marketplace/chat/[orderId]',
            params: {
              orderId: item.id,
              chatWith: item.seller?.username || item.seller?.userlogin || 'Vendedor',
            },
          })}
          accessibilityRole="button"
        >
          <Feather name="message-circle" size={17} color="#FFFFFF" />
          <Text style={styles.chatButtonText}>Abrir Chat</Text>
        </TouchableOpacity>
        {item.status === 'pending_payment' && (
          <TouchableOpacity style={styles.cancelButton} onPress={() => cancelOrder(item)}>
            <Text style={styles.cancelText}>Cancelar Pedido</Text>
          </TouchableOpacity>
        )}
        {item.status === 'delivered' && !item.has_reviewed_by_me && (
          <TouchableOpacity style={styles.reviewButton} onPress={() => setReviewOrderId(item.id)}>
            <Feather name="star" size={16} color="#00A98E" />
            <Text style={styles.reviewText}>Calificar Venta</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityLabel="Volver">
          <Feather name="arrow-left" size={22} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Mis Pedidos</Text>
        <View style={styles.headerSpacer} />
      </View>
      {loading && orders.length === 0 ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#00C9A7" /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={38} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadOrders()}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderOrder}
          contentContainerStyle={[styles.list, orders.length === 0 && styles.emptyList]}
          onRefresh={() => void loadOrders()}
          refreshing={loading}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="shopping-bag" size={42} color="#00A98E" />
              </View>
              <Text style={styles.emptyTitle}>Aún no has realizado ningún pedido</Text>
              <Text style={styles.emptySubtitle}>Cuando compres en el Marketplace, podrás seguir tus pedidos aquí.</Text>
              <TouchableOpacity style={styles.exploreButton} onPress={() => router.back()}>
                <Text style={styles.exploreButtonText}>Explorar productos</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
      <MarketplaceReviewModal
        orderId={reviewOrderId}
        visible={Boolean(reviewOrderId)}
        onClose={() => setReviewOrderId(null)}
        onSubmitted={() => void loadOrders()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9', paddingTop: 52 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 15 },
  backButton: { width: 36, height: 36, alignItems: 'flex-start', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: '#1F2937', fontSize: 22, fontWeight: '800' },
  headerSpacer: { width: 36 },
  list: { paddingHorizontal: 14, paddingBottom: 30, paddingTop: 4 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E5F5F0', elevation: 2 },
  productImage: { width: '100%', height: 175, borderRadius: 12, backgroundColor: '#ECFDF8' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  orderDetails: { paddingTop: 10 },
  productName: { color: '#1F2937', fontSize: 16, fontWeight: '800' },
  price: { color: '#00A98E', fontSize: 18, fontWeight: '800', marginTop: 5 },
  statusPill: { alignSelf: 'flex-start', backgroundColor: '#FFF7ED', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8 },
  statusText: { color: '#C2410C', fontSize: 12, fontWeight: '700' },
  deliveredPill: { backgroundColor: '#DCFCE7' },
  deliveredText: { color: '#15803D' },
  cancelledPill: { backgroundColor: '#F3F4F6' },
  cancelledText: { color: '#6B7280' },
  seller: { color: '#6B7280', fontSize: 12, marginTop: 7 },
  chatButton: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#00C9A7', borderRadius: 12, marginTop: 12 },
  chatButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  cancelButton: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 10, marginTop: 3 },
  cancelText: { color: '#DC2626', fontSize: 13, fontWeight: '700' },
  reviewButton: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: '#B7F0E2', borderRadius: 12, marginTop: 8 },
  reviewText: { color: '#008F79', fontSize: 13, fontWeight: '800' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  errorText: { color: '#B91C1C', textAlign: 'center', fontSize: 14 },
  retryButton: { backgroundColor: '#00C9A7', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  emptyList: { flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 25, paddingVertical: 50 },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#DDF9F1', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  emptyTitle: { color: '#1F2937', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptySubtitle: { color: '#6B7280', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  exploreButton: { backgroundColor: '#00C9A7', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 11, marginTop: 18 },
  exploreButtonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
});
