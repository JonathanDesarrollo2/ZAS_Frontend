import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  confirmRestaurantOrderDelivery,
  getMyRestaurantOrders,
  RestaurantOrder,
} from '../apis/restaurantOrder';
import { connectSocket } from '../services/socketClient';

type Coordinate = { latitude: number; longitude: number };

const coordinate = (lat: unknown, lng: unknown): Coordinate | null => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) return null;
  return { latitude, longitude };
};

const getMapRegion = (
  points: Array<Coordinate | null>,
): Region | null => {
  const validPoints = points.filter((point): point is Coordinate => point !== null);
  if (validPoints.length < 2) return null;
  const latitudes = validPoints.map((point) => point.latitude);
  const longitudes = validPoints.map((point) => point.longitude);
  return {
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
    latitudeDelta: Math.max((Math.max(...latitudes) - Math.min(...latitudes)) * 1.5, 0.012),
    longitudeDelta: Math.max((Math.max(...longitudes) - Math.min(...longitudes)) * 1.5, 0.012),
  };
};

const orderSteps = ['Verificando', 'Preparando', 'Enviando', 'Entregado'];

const getCurrentStage = (order: RestaurantOrder): number => {
  if (order.status === 'cancelled') return -1;
  if (order.status === 'delivered' || ['arrived_destination', 'completed'].includes(order.delivery_trip?.status || '')) return 3;
  if (
    order.status === 'picked_up' &&
    order.delivery_trip?.driver_id &&
    order.delivery_trip.status === 'picked_up'
  ) return 2;
  return order.status === 'pending' ? 0 : 1;
};

const getStageDetail = (order: RestaurantOrder, stage: number): string => {
  if (stage === 0) return 'El pedido fue enviado y espera la respuesta del restaurante.';
  if (stage === 1 && order.status === 'ready' && order.delivery_type === 'external') {
    return 'Tu pedido está listo; estamos buscando un repartidor.';
  }
  if (stage === 1 && order.status === 'ready') return 'El restaurante está coordinando la entrega.';
  if (stage === 1) return 'El restaurante aceptó y está preparando tu pedido.';
  if (stage === 2) return 'El repartidor recogió tu pedido y va hacia tu ubicación.';
  if (order.status === 'delivered') return 'Recepción confirmada. ¡Gracias por tu pedido!';
  return 'El repartidor llegó a tu ubicación. Pulsa “Listo” cuando recibas el pedido.';
};

export default function RestaurantOrdersScreen() {
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const requestedOrderId = typeof orderId === 'string' ? orderId : '';
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState(requestedOrderId);
  const [liveLocations, setLiveLocations] = useState<Record<string, Coordinate>>({});
  const [socketConnected, setSocketConnected] = useState(false);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setError('');
    setRefreshing(true);
    try {
      const response = await getMyRestaurantOrders();
      if (!response.result || !Array.isArray(response.content)) {
        throw new Error(response.error?.[0] || 'No se pudieron cargar tus pedidos.');
      }
      setOrders(response.content);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar tus pedidos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadOrders();
  }, [loadOrders]));

  useEffect(() => {
    if (requestedOrderId) setSelectedOrderId(requestedOrderId);
  }, [requestedOrderId]);

  useEffect(() => {
    if (!selectedOrderId && orders.length > 0) setSelectedOrderId(orders[0].id);
  }, [orders, selectedOrderId]);

  const activeTripIds = useMemo(
    () => orders
      .filter((order) =>
        order.status === 'picked_up' &&
        order.delivery_trip?.status === 'picked_up' &&
        Boolean(order.delivery_trip.driver_id),
      )
      .map((order) => order.delivery_trip!.id),
    [orders],
  );
  const activeTripIdsKey = activeTripIds.join(',');

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    connectSocket().then((socket) => {
      if (cancelled) return;
      const tripIds = activeTripIdsKey ? activeTripIdsKey.split(',') : [];
      const joinTrips = () => tripIds.forEach((tripId) => socket.emit('trip:join', tripId));
      const handleConnect = () => {
        setSocketConnected(true);
        joinTrips();
        void loadOrders();
      };
      const handleDisconnect = () => setSocketConnected(false);
      const handleOrderStatus = () => { void loadOrders(); };
      const handleTracking = (event: { tripId?: string; lat?: number; lng?: number }) => {
        if (!event.tripId || !tripIds.includes(event.tripId)) return;
        const point = coordinate(event.lat, event.lng);
        if (point) setLiveLocations((current) => ({ ...current, [event.tripId!]: point }));
      };

      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      socket.on('restaurant:order_status', handleOrderStatus);
      socket.on('trip:tracking', handleTracking);
      setSocketConnected(socket.connected);
      if (socket.connected) handleConnect();
      cleanup = () => {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('restaurant:order_status', handleOrderStatus);
        socket.off('trip:tracking', handleTracking);
      };
    }).catch(() => {
      if (!cancelled) setSocketConnected(false);
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [activeTripIdsKey, loadOrders]);

  const confirmDelivery = (order: RestaurantOrder) => {
    if (
      order.status !== 'picked_up' ||
      order.delivery_trip?.status !== 'arrived_destination' ||
      confirmingOrderId
    ) return;
    Alert.alert('Confirmar recepción', '¿Recibiste tu pedido?', [
      { text: 'Todavía no', style: 'cancel' },
      {
        text: 'Listo',
        onPress: () => {
          void (async () => {
            setConfirmingOrderId(order.id);
            try {
              const response = await confirmRestaurantOrderDelivery(order.id);
              if (!response.result || response.content?.status !== 'delivered') {
                throw new Error(response.error?.[0] || 'No se pudo cerrar el pedido.');
              }
              setOrders((current) => current.map((item) =>
                item.id === order.id ? { ...item, status: 'delivered' } : item,
              ));
              router.replace('/dashboard' as any);
            } catch (confirmError) {
              Alert.alert(
                'No se pudo confirmar',
                confirmError instanceof Error ? confirmError.message : 'Intenta nuevamente.',
              );
            } finally {
              setConfirmingOrderId(null);
            }
          })();
        },
      },
    ]);
  };

  const renderOrder = ({ item }: { item: RestaurantOrder }) => {
    const expanded = item.id === selectedOrderId;
    const currentStage = getCurrentStage(item);
    const isCancelled = currentStage < 0;
    const statusColor = isCancelled ? '#B91C1C' : currentStage === 3 ? '#15803D' : currentStage === 2 ? '#0369A1' : '#00A889';
    const trip = item.delivery_trip;
    const pickup = trip ? coordinate(trip.pickup_lat, trip.pickup_lng) : null;
    const dropoff = trip ? coordinate(trip.dropoff_lat, trip.dropoff_lng) : null;
    const trackingActive = currentStage === 2 && Boolean(trip?.driver_id) && trip?.status === 'picked_up';
    const driverLocation = trackingActive && trip
      ? liveLocations[trip.id] || coordinate(trip.driver_location?.lat, trip.driver_location?.lng)
      : null;
    const region = trackingActive ? getMapRegion([pickup, dropoff, driverLocation]) : null;
    const orderDate = new Date(item.createdAt);
    const cashTendered = item.cash_tendered === null || item.cash_tendered === undefined
      ? null
      : Number(item.cash_tendered);

    return (
      <View style={styles.orderCard}>
        <TouchableOpacity
          style={styles.orderHeader}
          onPress={() => setSelectedOrderId(expanded ? '' : item.id)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          <View style={styles.orderIcon}>
            <Feather name="shopping-bag" size={18} color="#00A889" />
          </View>
          <View style={styles.orderHeading}>
            <Text style={styles.restaurantName} numberOfLines={1}>
              {item.restaurant?.name || 'Restaurante'}
            </Text>
            <Text style={styles.orderNumber}>
              Pedido #{item.id.slice(0, 8).toUpperCase()}
              {Number.isNaN(orderDate.getTime()) ? '' : ` · ${orderDate.toLocaleDateString()}`}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${statusColor}18` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {isCancelled ? 'Cancelado' : orderSteps[currentStage]}
            </Text>
          </View>
        </TouchableOpacity>

        {expanded && (
          <View style={styles.orderDetails}>
            {isCancelled ? (
              <View style={[styles.statusPanel, { borderLeftColor: statusColor }]}>
                <Feather name="x-circle" size={21} color={statusColor} />
                <View style={styles.statusCopy}>
                  <Text style={[styles.statusTitle, { color: statusColor }]}>Pedido cancelado</Text>
                  <Text style={styles.statusDescription}>Este pedido no continuará su preparación ni entrega.</Text>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.stageRow}>
                  {orderSteps.map((label, index) => {
                    const complete = index < currentStage;
                    const current = index === currentStage;
                    return (
                      <View key={label} style={styles.stageItem}>
                        <View style={[
                          styles.stageCircle,
                          (complete || current) && styles.stageCircleActive,
                        ]}>
                          {complete ? (
                            <Feather name="check" size={13} color="#FFFFFF" />
                          ) : (
                            <Text style={[styles.stageNumber, current && styles.stageNumberActive]}>{index + 1}</Text>
                          )}
                        </View>
                        <Text style={[styles.stageLabel, current && styles.stageLabelActive]}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={[styles.statusPanel, { borderLeftColor: statusColor }]}>
                  <Feather name={currentStage === 3 ? 'check-circle' : currentStage === 2 ? 'truck' : 'clock'} size={21} color={statusColor} />
                  <View style={styles.statusCopy}>
                    <Text style={[styles.statusTitle, { color: statusColor }]}>{orderSteps[currentStage]}</Text>
                    <Text style={styles.statusDescription}>{getStageDetail(item, currentStage)}</Text>
                  </View>
                </View>
                {item.status === 'picked_up' && trip?.status === 'arrived_destination' && (
                  <TouchableOpacity
                    style={[styles.confirmButton, confirmingOrderId === item.id && styles.disabledButton]}
                    onPress={() => confirmDelivery(item)}
                    disabled={confirmingOrderId === item.id}
                    accessibilityRole="button"
                  >
                    {confirmingOrderId === item.id ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Feather name="check-circle" size={18} color="#FFFFFF" />
                        <Text style={styles.confirmButtonText}>Listo, recibí mi pedido</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </>
            )}

            {trip?.driver && trackingActive && (
              <View style={styles.driverRow}>
                <View style={styles.driverIcon}><Feather name="user" size={17} color="#0369A1" /></View>
                <View>
                  <Text style={styles.driverLabel}>Repartidor</Text>
                  <Text style={styles.driverName}>{trip.driver.name}</Text>
                </View>
              </View>
            )}

            {region && pickup && dropoff && trackingActive && (
              <View style={styles.mapContainer}>
                <MapView style={styles.map} region={region} showsCompass>
                  <Marker coordinate={pickup} title="Restaurante" pinColor="#00A889" />
                  <Marker coordinate={dropoff} title="Entrega" pinColor="#F59E0B" />
                  {driverLocation && <Marker coordinate={driverLocation} title="Repartidor" pinColor="#2563EB" />}
                </MapView>
                <View style={styles.mapLegend}>
                  {driverLocation && (
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
                      <Text style={styles.legendText}>Repartidor</Text>
                    </View>
                  )}
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#00A889' }]} />
                    <Text style={styles.legendText}>Restaurante</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.legendText}>Entrega</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.addressBlock}>
              {item.restaurant?.address ? (
                <Text style={styles.addressText}>Origen: {item.restaurant.address}</Text>
              ) : null}
              <Text style={styles.addressText}>Entrega: {item.delivery_address}</Text>
              {item.notes ? <Text style={styles.notesText}>Nota: {item.notes}</Text> : null}
            </View>

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Productos</Text>
            {item.items.map((orderItem) => (
              <View key={orderItem.id} style={styles.itemRow}>
                <View style={styles.itemCopy}>
                  <Text style={styles.itemName}>{orderItem.quantity} × {orderItem.product_name}</Text>
                  {orderItem.options?.length ? (
                    <Text style={styles.optionText}>
                      {orderItem.options.map((option) => `${option.group_name}: ${option.name}`).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.itemPrice}>${Number(orderItem.total_price).toFixed(2)}</Text>
              </View>
            ))}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>${Number(item.total).toFixed(2)}</Text>
            </View>
            {cashTendered !== null && Number.isFinite(cashTendered) && (
              <View style={styles.cashSummary}>
                <Text style={styles.cashText}>Pagas con ${cashTendered.toFixed(2)}</Text>
                <Text style={styles.cashText}>
                  Vuelto estimado ${Math.max(0, cashTendered - Number(item.total)).toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.canGoBack() ? router.back() : router.replace('/restaurants')}
          style={styles.backButton}
          accessibilityLabel="Volver"
        >
          <Feather name="arrow-left" size={22} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Mis pedidos</Text>
          <View style={styles.connectionRow}>
            <View style={[styles.connectionDot, socketConnected && styles.connectedDot]} />
            <Text style={styles.connectionText}>
              {socketConnected ? 'Seguimiento en vivo' : 'Actualiza para ver cambios'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => void loadOrders()} style={styles.refreshButton} accessibilityLabel="Actualizar pedidos">
          <Feather name="refresh-cw" size={19} color="#00A889" />
        </TouchableOpacity>
      </View>

      {loading && orders.length === 0 ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#00C9A7" /></View>
      ) : (
        <>
          {!!error && (
            <TouchableOpacity style={styles.errorBanner} onPress={() => void loadOrders()}>
              <Feather name="alert-circle" size={17} color="#B42318" />
              <Text style={styles.errorText}>{error} Toca para reintentar.</Text>
            </TouchableOpacity>
          )}
          <FlatList
            data={orders}
            keyExtractor={(item) => item.id}
            renderItem={renderOrder}
            contentContainerStyle={[styles.listContent, orders.length === 0 && styles.emptyList]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadOrders()} tintColor="#00A889" />}
            ListEmptyComponent={(
              <View style={styles.emptyState}>
                <Feather name="clipboard" size={40} color="#00A889" />
                <Text style={styles.emptyTitle}>Todavía no tienes pedidos</Text>
                <Text style={styles.emptyText}>Cuando hagas un pedido, podrás seguir su estado aquí.</Text>
                <TouchableOpacity style={styles.exploreButton} onPress={() => router.replace('/restaurants')}>
                  <Text style={styles.exploreText}>Explorar restaurantes</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  header: { minHeight: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17, paddingTop: 8, paddingBottom: 10 },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5F5F0' },
  headerTitle: { flex: 1, alignItems: 'center' },
  title: { color: '#1F2937', fontSize: 20, fontWeight: '800' },
  connectionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  connectionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#F59E0B', marginRight: 5 },
  connectedDot: { backgroundColor: '#16A34A' },
  connectionText: { color: '#6B7280', fontSize: 11 },
  refreshButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5F5F0' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingHorizontal: 28 },
  emptyTitle: { color: '#1F2937', fontSize: 18, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  emptyText: { color: '#6B7280', fontSize: 14, lineHeight: 21, marginTop: 7, textAlign: 'center' },
  exploreButton: { backgroundColor: '#00B899', borderRadius: 13, paddingHorizontal: 18, paddingVertical: 12, marginTop: 18 },
  exploreText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', marginHorizontal: 16, marginTop: 8, padding: 11, borderRadius: 12, gap: 8 },
  errorText: { flex: 1, color: '#B42318', fontSize: 12 },
  orderCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5F5F0', borderRadius: 17, marginBottom: 13, overflow: 'hidden', elevation: 2, shadowColor: '#164E43', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 7 },
  orderHeader: { minHeight: 75, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 12 },
  orderIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#E6FFFA', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  orderHeading: { flex: 1, marginRight: 7 },
  restaurantName: { color: '#1F2937', fontSize: 15, fontWeight: '800' },
  orderNumber: { color: '#9CA3AF', fontSize: 10, marginTop: 4 },
  statusPill: { borderRadius: 18, paddingHorizontal: 9, paddingVertical: 7, maxWidth: 118 },
  statusText: { fontSize: 10, fontWeight: '800', textAlign: 'center' },
  orderDetails: { borderTopWidth: 1, borderTopColor: '#F3F4F6', padding: 14 },
  statusPanel: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, paddingVertical: 8, paddingLeft: 10, marginBottom: 14 },
  statusCopy: { flex: 1, marginLeft: 9 },
  statusTitle: { fontSize: 14, fontWeight: '800' },
  statusDescription: { color: '#6B7280', fontSize: 12, marginTop: 3 },
  stageRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  stageItem: { flex: 1, alignItems: 'center' },
  stageCircle: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  stageCircleActive: { backgroundColor: '#00A889', borderColor: '#00A889' },
  stageNumber: { color: '#9CA3AF', fontSize: 11, fontWeight: '700' },
  stageNumberActive: { color: '#FFFFFF' },
  stageLabel: { color: '#9CA3AF', fontSize: 9, textAlign: 'center', marginTop: 5 },
  stageLabelActive: { color: '#008F76', fontWeight: '800' },
  driverRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 },
  driverIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E0F2FE', marginRight: 9 },
  driverLabel: { color: '#9CA3AF', fontSize: 10 },
  driverName: { color: '#1F2937', fontSize: 13, fontWeight: '700', marginTop: 2 },
  mapContainer: { overflow: 'hidden', borderRadius: 14, marginBottom: 12 },
  map: { height: 220, width: '100%' },
  mapLegend: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#FFFFFF', paddingVertical: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: '#4B5563', fontSize: 10 },
  addressBlock: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 11, gap: 6 },
  addressText: { color: '#4B5563', fontSize: 12, lineHeight: 18 },
  notesText: { color: '#6B7280', fontSize: 11, fontStyle: 'italic' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 13 },
  sectionTitle: { color: '#374151', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingVertical: 6 },
  itemCopy: { flex: 1, marginRight: 10 },
  itemName: { color: '#374151', fontSize: 12, fontWeight: '600' },
  optionText: { color: '#9CA3AF', fontSize: 10, marginTop: 3, lineHeight: 14 },
  itemPrice: { color: '#374151', fontSize: 12, fontWeight: '700' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 8, paddingTop: 11 },
  totalLabel: { color: '#1F2937', fontSize: 14, fontWeight: '800' },
  totalValue: { color: '#008F76', fontSize: 16, fontWeight: '900' },
  cashSummary: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 6 },
  cashText: { color: '#6B7280', fontSize: 10 },
  confirmButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 13, backgroundColor: '#00A889', marginTop: 12 },
  disabledButton: { opacity: 0.65 },
  confirmButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
