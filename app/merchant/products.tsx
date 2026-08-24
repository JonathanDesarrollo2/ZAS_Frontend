import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { apiClient } from '../../apis/Client';
import { Product } from '../../apis/restaurant';

const ProductsScreen = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = async () => {
    try {
      // Obtenemos el restaurante y su menú a través del endpoint público, asumiendo que el dueño está logueado y conocemos su restaurantId.
      // Pero no tenemos endpoint de productos del dueño. Asumimos que existe o lo sustituimos.
      // En backend actual, RestaurantController no lista productos; solo público getMenu necesita restaurantId.
      // Necesitamos un endpoint GET /private/merchant/products, no creado. Añadiremos un placeholder.
      Alert.alert('Info', 'Listado de productos próximamente');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Productos</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#00C9A7" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/merchant/product-edit?productId=${item.id}` as any)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardPrice}>${item.price.toFixed(2)}</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#ccc" />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9', padding: 20, paddingTop: 80 },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  cardPrice: { fontSize: 15, color: '#00C9A7', fontWeight: '700' },
});

export default ProductsScreen;