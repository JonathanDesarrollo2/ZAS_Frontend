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
import { getProducts, Product } from '../../apis/restaurant';

const ProductsScreen = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = useCallback(async () => {
    try {
      setProducts(await getProducts());
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudieron cargar los productos');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadProducts();
    }, [loadProducts])
  );

  const openProduct = (productId: string) => {
    router.push({ pathname: '/merchant/product-edit', params: { productId } });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>MENÚ</Text>
        <Text style={styles.title}>Productos</Text>
        <Text style={styles.subtitle}>Administra tus platos y precios.</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#00C9A7" style={styles.loader} />
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, products.length === 0 && styles.emptyGrid]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Feather name="package" size={34} color="#00C9A7" /></View>
              <Text style={styles.emptyTitle}>Aún no tienes productos</Text>
              <Text style={styles.emptyText}>Agrega el primer producto a tu menú.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.productImage} resizeMode="cover" />
              ) : (
                <View style={styles.imagePlaceholder}><Feather name="image" size={30} color="#9CA3AF" /></View>
              )}
              <View style={styles.productInfo}>
                <Text numberOfLines={2} style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.price}>${Number(item.price).toFixed(2)}</Text>
                <TouchableOpacity style={styles.editButton} onPress={() => openProduct(item.id)}>
                  <Feather name="edit-2" size={14} color="#008F76" />
                  <Text style={styles.editText}>Editar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Crear producto"
        style={styles.fab}
        onPress={() => router.push('/merchant/product-edit')}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={25} color="#FFFFFF" />
      </TouchableOpacity>
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
  grid: { paddingHorizontal: 13, paddingBottom: 105 },
  emptyGrid: { flexGrow: 1, justifyContent: 'center' },
  row: { justifyContent: 'space-between' },
  card: {
    flex: 1,
    marginHorizontal: 5,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E5F5F0',
    elevation: 2,
    shadowColor: '#163B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 7,
  },
  productImage: { width: '100%', height: 132, backgroundColor: '#E5E7EB' },
  imagePlaceholder: { height: 132, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F7F3' },
  productInfo: { padding: 12 },
  cardTitle: { color: '#1F2937', fontSize: 14, fontWeight: '700', minHeight: 38 },
  price: { color: '#00A889', fontSize: 16, fontWeight: '800', marginTop: 4 },
  editButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E6FFFA', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, marginTop: 11 },
  editText: { color: '#008F76', fontSize: 12, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingHorizontal: 22, paddingBottom: 45 },
  emptyIcon: { width: 78, height: 78, borderRadius: 26, backgroundColor: '#DDF9F2', alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  emptyTitle: { color: '#1F2937', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#6B7280', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 7 },
  fab: { position: 'absolute', right: 22, bottom: 24, width: 58, height: 58, borderRadius: 20, backgroundColor: '#00C9A7', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#008F76', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 7 },
});

export default ProductsScreen;
