import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { getMyRestaurant, Restaurant } from '../../apis/restaurant';
import { getRestaurantOrders, RestaurantOrder } from '../../apis/restaurantOrder';

const ACCENT = '#00C9A7';
const todayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const MerchantHomeScreen = () => {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      const [myRestaurant, restaurantOrders] = await Promise.all([
        getMyRestaurant(),
        getRestaurantOrders(),
      ]);
      setRestaurant(myRestaurant);
      setOrders(restaurantOrders);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo cargar el resumen');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadDashboard();
    }, [loadDashboard])
  );

  const todaysOrders = orders.filter((order) => {
    const createdAt = new Date(order.createdAt);
    return !Number.isNaN(createdAt.getTime()) && todayKey(createdAt) === todayKey(new Date());
  });
  const todaysSales = todaysOrders
    .filter((order) => order.status !== 'cancelled')
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const pendingOrders = orders.filter((order) => order.status === 'pending').length;

  const actions = [
    { icon: 'grid', title: 'Gestionar menú', description: 'Categorías y productos', route: '/merchant/categories', tint: '#E6FFFA' },
    { icon: 'clipboard', title: 'Ver pedidos', description: 'Revisa y actualiza pedidos', route: '/merchant/orders', tint: '#EFF6FF' },
    { icon: 'settings', title: 'Configurar restaurante', description: 'Información y horarios', route: '/merchant/restaurant-edit', tint: '#FFF7ED' },
  ] as const;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>PANEL DEL COMERCIO</Text>
      <Text style={styles.title}>Hola, {restaurant?.name || 'bienvenido'} 👋</Text>
      <Text style={styles.subtitle}>Aquí tienes el resumen de tu restaurante.</Text>

      {loading ? (
        <ActivityIndicator size="large" color={ACCENT} style={styles.loader} />
      ) : (
        <>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, styles.statWide]}>
              <View style={styles.statIcon}><Feather name="shopping-bag" size={19} color={ACCENT} /></View>
              <Text style={styles.statValue}>{todaysOrders.length}</Text>
              <Text style={styles.statLabel}>Pedidos hoy</Text>
            </View>
            <View style={[styles.statCard, styles.statWide]}>
              <View style={[styles.statIcon, styles.salesIcon]}><Feather name="trending-up" size={19} color="#2563EB" /></View>
              <Text style={styles.statValue}>${todaysSales.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Ventas hoy</Text>
            </View>
            <View style={[styles.statCard, styles.statFull, pendingOrders > 0 && styles.pendingCard]}>
              <View style={[styles.statIcon, pendingOrders > 0 && styles.pendingIcon]}>
                <Feather name="bell" size={19} color={pendingOrders > 0 ? '#EA580C' : '#6B7280'} />
              </View>
              <View style={styles.pendingInfo}>
                <Text style={[styles.statValue, pendingOrders > 0 && styles.pendingValue]}>{pendingOrders}</Text>
                <Text style={styles.statLabel}>Pedidos pendientes</Text>
              </View>
              {pendingOrders > 0 && <Text style={styles.alertLabel}>Requieren atención</Text>}
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Acciones rápidas</Text>
          </View>
          <View style={styles.actions}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.title}
                style={styles.actionCard}
                activeOpacity={0.8}
                onPress={() => router.push(action.route)}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.tint }]}>
                  <Feather name={action.icon} size={21} color={ACCENT} />
                </View>
                <View style={styles.actionText}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionDescription}>{action.description}</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  content: { padding: 20, paddingTop: 28, paddingBottom: 36 },
  eyebrow: { color: ACCENT, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  title: { color: '#1F2937', fontSize: 28, fontWeight: '800', lineHeight: 35 },
  subtitle: { color: '#6B7280', fontSize: 15, marginTop: 7, marginBottom: 24 },
  loader: { marginTop: 60 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E5F5F0',
    elevation: 2,
    shadowColor: '#163B35',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  statWide: { width: '48%' },
  statFull: { width: '100%', flexDirection: 'row', alignItems: 'center' },
  statIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#E6FFFA', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  salesIcon: { backgroundColor: '#EFF6FF' },
  statValue: { color: '#1F2937', fontSize: 24, fontWeight: '800' },
  statLabel: { color: '#6B7280', fontSize: 12, marginTop: 3 },
  pendingCard: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  pendingIcon: { backgroundColor: '#FFEDD5', marginBottom: 0, marginRight: 13 },
  pendingInfo: { flex: 1 },
  pendingValue: { color: '#C2410C' },
  alertLabel: { color: '#C2410C', fontSize: 11, fontWeight: '700' },
  sectionHeading: { marginTop: 29, marginBottom: 13 },
  sectionTitle: { color: '#1F2937', fontSize: 19, fontWeight: '800' },
  actions: { gap: 12 },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E5F5F0',
    elevation: 3,
    shadowColor: '#163B35',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  actionIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  actionText: { flex: 1 },
  actionTitle: { color: '#1F2937', fontSize: 15, fontWeight: '700' },
  actionDescription: { color: '#6B7280', fontSize: 12, marginTop: 4 },
});

export default MerchantHomeScreen;
