import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { cancelMarketplaceOrder, getMarketplaceSales, MarketplaceOrder } from '../../apis/marketplace';
import MarketplaceReviewModal from '../../components/MarketplaceReviewModal';

const statusLabel: Record<MarketplaceOrder['status'], string> = {
  pending_payment: 'Pendiente de pago',
  paid: 'Buscando mototaxi',
  delivery_assigned: 'Mototaxi asignado',
  picked_up: 'En camino al comprador',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export default function MarketplaceSalesScreen() {
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewOrderId, setReviewOrderId] = useState<string | null>(null);
  const loadSales = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getMarketplaceSales();
      if (!response.result) throw new Error('No se pudieron cargar tus ventas');
      setOrders(response.content);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar tus ventas');
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { void loadSales(); }, [loadSales]));

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
              await loadSales();
            } catch (cancelError) {
              Alert.alert('No se pudo cancelar', cancelError instanceof Error ? cancelError.message : 'Intenta nuevamente.');
            }
          })();
        },
      },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#00C9A7" /></View>;
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Feather name="arrow-left" size={22} color="#1F2937" /></TouchableOpacity>
        <Text style={styles.title}>Mis Ventas</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onRefresh={() => void loadSales()}
          refreshing={loading}
          ListEmptyComponent={<Text style={styles.empty}>Todavía no tienes ventas.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.product?.image_urls?.[0]
                ? <Image source={{ uri: item.product.image_urls[0] }} style={styles.image} />
                : <View style={[styles.image, styles.placeholder]}><Feather name="package" size={24} color="#00A98E" /></View>}
              <View style={styles.details}>
                <Text style={styles.name} numberOfLines={1}>{item.product?.title || 'Producto'}</Text>
                <Text style={styles.meta}>Cantidad: {item.quantity} · Comprador: {item.buyer?.username || item.buyer?.userlogin || 'Usuario'}</Text>
                <Text style={styles.status}>{statusLabel[item.status]}</Text>
                {item.trip?.status ? <Text style={styles.meta}>Entrega: {item.trip.status.replace('_', ' ')}</Text> : null}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.chatButton}
                  onPress={() => router.push({
                    pathname: '/marketplace/chat/[orderId]',
                    params: { orderId: item.id, chatWith: item.buyer?.username || item.buyer?.userlogin || 'Comprador' },
                  })}
                >
                  <Feather name="message-circle" size={16} color="#FFFFFF" />
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
            </View>
          )}
        />
      )}
      <MarketplaceReviewModal
        orderId={reviewOrderId}
        visible={Boolean(reviewOrderId)}
        onClose={() => setReviewOrderId(null)}
        onSubmitted={() => void loadSales()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: 52 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 18, paddingBottom: 16 },
  title: { color: '#1F2937', fontSize: 22, fontWeight: '800' },
  list: { flexGrow: 1, padding: 14, paddingBottom: 32 },
  card: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 11, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  image: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#ECFDF8' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, paddingHorizontal: 11 },
  name: { color: '#1F2937', fontSize: 14, fontWeight: '700' },
  meta: { color: '#6B7280', fontSize: 11, marginTop: 4 },
  status: { color: '#008F79', fontSize: 12, fontWeight: '700', marginTop: 5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 80 },
  error: { color: '#B91C1C', textAlign: 'center', margin: 24 },
  actions: { width: '100%', marginTop: 10, borderTopWidth: 1, borderColor: '#F3F4F6', paddingTop: 8 },
  chatButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#00C9A7', borderRadius: 10 },
  chatButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  cancelButton: { alignItems: 'center', paddingVertical: 9 },
  cancelText: { color: '#DC2626', fontSize: 13, fontWeight: '700' },
  reviewButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: '#B7F0E2', borderRadius: 10, marginTop: 6 },
  reviewText: { color: '#008F79', fontSize: 13, fontWeight: '800' },
});
