import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../../apis/Client';

interface Restaurant {
  id: string;
  name: string;
  description?: string;
  address: string;
  distance?: number;
}

const RestaurantsScreen = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    try {
      // Usamos coordenadas fijas por ahora; en producción usar GPS
      const lat = 10.071866;
      const lng = -66.869583;
      const res = await apiClient<{ result: boolean; content: Restaurant[] }>(
        `/public/restaurants/nearby?lat=${lat}&lng=${lng}&radius=5`
      );
      setRestaurants(res.content);
    } catch (err) {
      console.error('Error cargando restaurantes', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#00C9A7" style={{ flex: 1, justifyContent: 'center' }} />;
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Restaurantes</Text>
      <FlatList
        data={restaurants}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={<Text style={styles.empty}>No hay locales de comida disponibles (no hay en tu area o no hay ninguno afiliado)</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/restaurant-menu?restaurantId=${item.id}` as any)}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
              <Text style={styles.cardAddress}>{item.address}</Text>
              {item.distance !== undefined && <Text style={styles.cardDistance}>A {item.distance.toFixed(1)} km</Text>}
            </View>
            <Feather name="chevron-right" size={20} color="#ccc" />
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9', padding: 20, paddingTop: 80 },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  cardDesc: { fontSize: 14, color: '#6B7280', marginBottom: 2 },
  cardAddress: { fontSize: 13, color: '#9CA3AF' },
  cardDistance: { fontSize: 13, color: '#00C9A7', fontWeight: '600' },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
});

export default RestaurantsScreen;