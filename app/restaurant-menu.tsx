import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../apis/Client';
import { useCartStore } from '../presentation/store/cartStore';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
}

const RestaurantMenuScreen = () => {
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  const [menu, setMenu] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const addItem = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);

  useEffect(() => {
    loadMenu();
  }, [restaurantId]);

  const loadMenu = async () => {
    try {
      const res = await apiClient<{ result: boolean; content: any }>(
        `/public/restaurants/${restaurantId}`
      );
      setMenu(res.content);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getQuantityInCart = (productId: string) => {
    const item = cartItems.find(i => i.productId === productId);
    return item ? item.quantity : 0;
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#00C9A7" style={{ flex: 1, justifyContent: 'center' }} />;
  }

  if (!menu) return null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.title}>{menu.name}</Text>
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => router.push('/cart' as any)}
        >
          <Feather name="shopping-cart" size={22} color="#00C9A7" />
          {cartItems.length > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartItems.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={menu.categories}
        keyExtractor={(category) => category.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item: category }) => (
          <View style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category.name}</Text>
            {category.products?.map((product: Product) => (
              <View key={product.id} style={styles.productCard}>
                {product.image && (
                  <Image source={{ uri: product.image }} style={styles.productImage} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{product.name}</Text>
                  {product.description ? (
                    <Text style={styles.productDesc}>{product.description}</Text>
                  ) : null}
                  <Text style={styles.productPrice}>${product.price.toFixed(2)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.addButton}
                  onPress={() =>
                    addItem({
                      productId: product.id,
                      product_name: product.name,
                      price: product.price,
                      quantity: 1,
                      restaurant_id: restaurantId!, // ← añadido
                    })
                  }
                >
                  <Feather name="plus" size={18} color="#fff" />
                </TouchableOpacity>
                {getQuantityInCart(product.id) > 0 && (
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyText}>{getQuantityInCart(product.id)}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#1F2937', flex: 1, textAlign: 'center' },
  cartButton: { position: 'relative', padding: 4 },
  cartBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF5252',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  categorySection: { marginBottom: 20, paddingHorizontal: 20 },
  categoryTitle: { fontSize: 20, fontWeight: '600', color: '#1F2937', marginBottom: 10 },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  productImage: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
  productName: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  productDesc: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  productPrice: { fontSize: 15, color: '#00C9A7', fontWeight: '700' },
  addButton: {
    backgroundColor: '#00C9A7',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBadge: {
    position: 'absolute',
    top: -6,
    right: 40,
    backgroundColor: '#FF9800',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  qtyText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

export default RestaurantMenuScreen;