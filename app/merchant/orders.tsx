import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import {
  getRestaurantOrders,
  RestaurantOrder,
  updateRestaurantOrderStatus,
} from '../../apis/restaurantOrder';
import { connectSocket } from '../../services/socketClient';

const statusStyles: Record<string, { label: string; background: string; color: string }> = {
  pending: { label: 'Pendiente', background: '#FEF3C7', color: '#B45309' },
  accepted: { label: 'Aceptado', background: '#EDE9FE', color: '#6D28D9' },
  preparing: { label: 'En preparación', background: '#DBEAFE', color: '#1D4ED8' },
  ready: { label: 'Listo', background: '#DCFCE7', color: '#15803D' },
  assigned: { label: 'Repartidor asignado', background: '#E0F2FE', color: '#0369A1' },
  picked_up: { label: 'Retirado', background: '#E0F2FE', color: '#0369A1' },
  delivered: { label: 'Entregado', background: '#F3F4F6', color: '#6B7280' },
  cancelled: { label: 'Cancelado', background: '#FEE2E2', color: '#B91C1C' },
};

const nextAction: Record<string, { status: string; label: string }> = {
  pending: { status: 'accepted', label: 'Aceptar pedido' },
  accepted: { status: 'preparing', label: 'Iniciar preparación' },
  preparing: { status: 'ready', label: 'Marcar como listo' },
};

const OrdersScreen = () => {
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setOrders(await getRestaurantOrders());
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudieron cargar los pedidos');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadOrders();
    }, [loadOrders])
  );

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    connectSocket()
      .then((socket) => {
        if (!active) return;

        const handleNewOrder = (event: { orderId?: string; total?: number }) => {
          const orderReference = event.orderId ? ` Pedido #${event.orderId.slice(0, 8)}.` : '';
          Alert.alert('¡Nuevo pedido recibido!', `Hay un nuevo pedido en tu restaurante.${orderReference}`);
          void loadOrders();
        };

        socket.on('restaurant:new_order', handleNewOrder);
        unsubscribe = () => socket.off('restaurant:new_order', handleNewOrder);
      })
      .catch((error: unknown) => {
        console.error('No se pudo conectar para recibir pedidos en tiempo real', error);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [loadOrders]);

  const updateStatus = async (order: RestaurantOrder, status: string) => {
    setUpdatingOrderId(order.id);
    try {
      await updateRestaurantOrderStatus(order.id, status);
      await loadOrders();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo actualizar el pedido');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>OPERACIÓN</Text>
        <Text style={styles.title}>Pedidos</Text>
        <Text style={styles.subtitle}>Gestiona los pedidos de tu restaurante.</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#00C9A7" style={styles.loader} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, orders.length === 0 && styles.emptyList]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Feather name="clipboard" size={34} color="#00C9A7" /></View>
              <Text style={styles.emptyTitle}>No hay pedidos todavía</Text>
              <Text style={styles.emptyText}>Cuando recibas un pedido, aparecerá aquí.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const status = statusStyles[item.status] || {
              label: item.status.replace(/_/g, ' '),
              background: '#F3F4F6',
              color: '#4B5563',
            };
            const action = nextAction[item.status];
            const orderTime = new Date(item.createdAt);

            return (
              <View style={styles.card}>
                <View style={styles.receiptTop}>
                  <View style={styles.orderIdentity}>
                    <View style={styles.orderIcon}><Feather name="shopping-bag" size={17} color="#00A889" /></View>
                    <View>
                      <Text style={styles.orderId}>Pedido #{item.id.slice(0, 8).toUpperCase()}</Text>
                      <Text style={styles.orderTime}>
                        {Number.isNaN(orderTime.getTime())
                          ? 'Hora no disponible'
                          : orderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: status.background }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total del pedido</Text>
                  <Text style={styles.total}>${Number(item.total).toFixed(2)}</Text>
                </View>

                {!!item.delivery_address && (
                  <View style={styles.detailRow}>
                    <Feather name="map-pin" size={14} color="#9CA3AF" />
                    <Text numberOfLines={2} style={styles.address}>{item.delivery_address}</Text>
                  </View>
                )}

                {action && (
                  <TouchableOpacity
                    style={[styles.actionButton, updatingOrderId === item.id && styles.disabledButton]}
                    onPress={() => updateStatus(item, action.status)}
                    disabled={updatingOrderId === item.id}
                    activeOpacity={0.85}
                  >
                    {updatingOrderId === item.id ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={styles.actionText}>{action.label}</Text>
                        <Feather name="arrow-right" size={16} color="#FFFFFF" />
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  heading: { paddingHorizontal: 20, paddingTop: 25, paddingBottom: 17 },
  eyebrow: { color: '#00A889', fontSize: 11, fontWeight: '800', letterSpacing: 1.1, marginBottom: 7 },
  title: { color: '#1F2937', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#6B7280', fontSize: 14, marginTop: 6 },
  loader: { marginTop: 50 },
  listContent: { paddingHorizontal: 17, paddingBottom: 25 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingHorizontal: 22, paddingBottom: 45 },
  emptyIcon: { width: 78, height: 78, borderRadius: 26, backgroundColor: '#DDF9F2', alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  emptyTitle: { color: '#1F2937', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#6B7280', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 7 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 13, borderWidth: 1, borderColor: '#E5F5F0', elevation: 2, shadowColor: '#163B35', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 7 },
  receiptTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  orderIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  orderIcon: { width: 39, height: 39, borderRadius: 13, backgroundColor: '#E6FFFA', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  orderId: { color: '#1F2937', fontSize: 13, fontWeight: '800' },
  orderTime: { color: '#9CA3AF', fontSize: 11, marginTop: 4 },
  statusPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  statusText: { fontSize: 11, fontWeight: '800' },
  divider: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#D1D5DB', marginVertical: 14 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { color: '#6B7280', fontSize: 13 },
  total: { color: '#1F2937', fontSize: 19, fontWeight: '800' },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginTop: 11 },
  address: { flex: 1, color: '#6B7280', fontSize: 12, marginLeft: 7 },
  actionButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, backgroundColor: '#00B899', marginTop: 15, paddingHorizontal: 14 },
  disabledButton: { opacity: 0.7 },
  actionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});

export default OrdersScreen;
