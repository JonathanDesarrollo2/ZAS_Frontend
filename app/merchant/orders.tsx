import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { apiClient } from '../../apis/Client';

interface Order {
  id: string;
  user_id: string;
  restaurant_id: string;
  status: string;
  payment_status: string;
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  total: number;
  delivery_address: string;
  createdAt: string;
}

const OrdersScreen = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    try {
      const res = await apiClient<{ result: boolean; content: Order[] }>('/private/restaurant-orders/restaurant');
      setOrders(res.content);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" color="#00C9A7" style={{ flex: 1, justifyContent: 'center' }} />;
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Pedidos</Text>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pedido #{item.id.slice(0, 8)}</Text>
            <Text style={styles.cardText}>Total: ${item.total.toFixed(2)}</Text>
            <Text style={styles.cardText}>Dirección: {item.delivery_address}</Text>
            <Text style={styles.cardStatus}>Estado: {item.status}</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9', padding: 20, paddingTop: 80 },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardText: { fontSize: 14, color: '#374151', marginBottom: 2 },
  cardStatus: { fontSize: 14, fontWeight: '600', color: '#00C9A7' },
});

export default OrdersScreen;