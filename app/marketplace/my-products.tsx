import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { deleteMarketplaceProduct, getMyMarketplaceProducts, MarketplaceProduct } from '../../apis/marketplace';

export default function MyMarketplaceProductsScreen() {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getMyMarketplaceProducts();
      if (!response.result) throw new Error('No se pudieron cargar tus productos');
      setProducts(response.content);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudieron cargar tus productos');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadProducts(); }, [loadProducts]));

  const removeProduct = (product: MarketplaceProduct) => {
    Alert.alert('Eliminar producto', `¿Quieres eliminar «${product.title}»?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          setRemovingId(product.id);
          try {
            const response = await deleteMarketplaceProduct(product.id);
            if (!response.result) throw new Error(response.error?.[0] || 'No se pudo eliminar el producto');
            setProducts((current) => current.filter((item) => item.id !== product.id));
          } catch (error) {
            Alert.alert('No se pudo eliminar', error instanceof Error ? error.message : 'Intenta nuevamente.');
          } finally {
            setRemovingId(null);
          }
        },
      },
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#00C9A7" /></View>;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Feather name="arrow-left" size={22} color="#1F2937" /></TouchableOpacity>
        <Text style={styles.title}>Mis Productos</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/marketplace/create')}>
          <Feather name="plus" size={19} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={products}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={() => void loadProducts()}
        refreshing={loading}
        ListEmptyComponent={<Text style={styles.empty}>Aún no tienes productos publicados.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {item.image_urls?.[0]
              ? <Image source={{ uri: item.image_urls[0] }} style={styles.image} />
              : <View style={[styles.image, styles.placeholder]}><Feather name="image" size={25} color="#00A98E" /></View>}
            <View style={styles.details}>
              <Text style={styles.name} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.price}>${Number(item.price).toFixed(2)}</Text>
              <Text style={styles.stock}>Disponibles: {item.stock}</Text>
              <Text style={styles.status}>{item.status === 'available' ? 'Publicado' : 'Sin stock / vendido'}</Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.action} onPress={() => router.push({ pathname: '/marketplace/create', params: { productId: item.id } })} accessibilityLabel="Editar producto">
                <Feather name="edit-2" size={17} color="#008F79" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.action} onPress={() => removeProduct(item)} disabled={removingId === item.id} accessibilityLabel="Eliminar producto">
                {removingId === item.id ? <ActivityIndicator size="small" color="#EF4444" /> : <Feather name="trash-2" size={17} color="#EF4444" />}
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: 52 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 16, paddingBottom: 16 },
  title: { flex: 1, fontSize: 22, fontWeight: '800', color: '#1F2937' },
  addButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#00A98E' },
  list: { padding: 14, paddingBottom: 32, flexGrow: 1 },
  card: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 10, marginBottom: 11, borderWidth: 1, borderColor: '#E5E7EB' },
  image: { width: 82, height: 88, borderRadius: 10, backgroundColor: '#ECFDF8' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, paddingHorizontal: 12, justifyContent: 'center' },
  name: { color: '#1F2937', fontSize: 14, fontWeight: '700' },
  price: { color: '#008F79', fontSize: 15, fontWeight: '800', marginTop: 5 },
  stock: { color: '#4B5563', fontSize: 12, marginTop: 2 },
  status: { color: '#6B7280', fontSize: 11, marginTop: 3 },
  actions: { justifyContent: 'space-around' },
  action: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 80, fontSize: 15 },
});
