import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCartStore } from '../presentation/store/cartStore';

const CartScreen = () => {
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const subtotal = useCartStore((state) => state.subtotal());
  const clearCart = useCartStore((state) => state.clearCart);

  const serviceFee = Math.round(subtotal * 0.05 * 100) / 100;
  const total = Math.round((subtotal + serviceFee) * 100) / 100;

  const handleCheckout = () => {
    if (items.length === 0) {
      Alert.alert('Carrito vacío', 'Agrega productos antes de continuar');
      return;
    }
    router.push('/checkout' as any);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Carrito</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={clearCart}>
            <Feather name="trash-2" size={22} color="#FF5252" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.productId}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <Text style={styles.empty}>Tu carrito está vacío</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.product_name}</Text>
              <Text style={styles.itemPrice}>
                ${(item.price * item.quantity).toFixed(2)}
              </Text>
            </View>
            <View style={styles.qtyControl}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => updateQuantity(item.productId, item.quantity - 1)}
              >
                <Feather name="minus" size={18} color="#00C9A7" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => updateQuantity(item.productId, item.quantity + 1)}
              >
                <Feather name="plus" size={18} color="#00C9A7" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => removeItem(item.productId)}>
              <Feather name="x" size={20} color="#FF5252" />
            </TouchableOpacity>
          </View>
        )}
      />

      {items.length > 0 && (
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Comisión (5%)</Text>
            <Text style={styles.summaryValue}>${serviceFee.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryTotal}>${total.toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
            <Text style={styles.checkoutButtonText}>Realizar pedido</Text>
          </TouchableOpacity>
        </View>
      )}
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemName: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  itemPrice: { fontSize: 15, color: '#00C9A7', fontWeight: '700' },
  qtyControl: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  qtyBtn: {
    backgroundColor: '#E6FFFA',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: { marginHorizontal: 12, fontSize: 16, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#6B7280', marginTop: 40, fontSize: 16 },
  summary: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: { fontSize: 15, color: '#374151' },
  summaryValue: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  summaryTotal: { fontSize: 18, fontWeight: '700', color: '#00C9A7' },
  checkoutButton: {
    backgroundColor: '#00C9A7',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  checkoutButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default CartScreen;