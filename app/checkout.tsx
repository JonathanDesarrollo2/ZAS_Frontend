import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useCartStore } from '../presentation/store/cartStore';
import { createRestaurantOrder } from '../apis/restaurantOrder';

const CheckoutScreen = () => {
  const { items, subtotal, clearCart } = useCartStore();
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null);

  const serviceFee = Math.round(subtotal() * 0.05 * 100) / 100;
  const total = Math.round((subtotal() + serviceFee) * 100) / 100;

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'No se pudo obtener tu ubicación');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setDeliveryCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirm = async () => {
    if (!address.trim()) {
      Alert.alert('Dirección requerida', 'Ingresa la dirección de entrega');
      return;
    }

    if (items.length === 0) {
      Alert.alert('Carrito vacío', 'No hay productos en tu carrito');
      return;
    }

    const restaurantId = items[0]?.restaurant_id;
    if (!restaurantId) {
      Alert.alert('Error', 'Falta seleccionar restaurante');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        restaurant_id: restaurantId,
        items: items.map(i => ({
          product_name: i.product_name,
          quantity: i.quantity,
          price: i.price,
          options: i.options || [],
        })),
        delivery_address: address.trim(),
        delivery_lat: deliveryCoords?.lat,
        delivery_lng: deliveryCoords?.lng,
        notes: notes.trim() || undefined,
      };

      const response = await createRestaurantOrder(payload as any);
      if (response.result) {
        clearCart();
        Alert.alert(
          'Pedido realizado',
          'Tu pedido ha sido enviado al restaurante.',
          [{ text: 'Ok', onPress: () => router.replace('/dashboard' as any) }]
        );
      } else {
        Alert.alert('Error', response.error?.[0] || 'No se pudo realizar el pedido');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.title}>Confirmar pedido</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen</Text>
          {items.map((item) => (
            <View key={item.productId} style={styles.summaryRow}>
              <Text style={styles.itemName}>
                {item.quantity}x {item.product_name}
              </Text>
              <Text style={styles.itemPrice}>
                ${(item.price * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>${subtotal().toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Comisión (5%)</Text>
            <Text style={styles.totalValue}>${serviceFee.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalFinal}>${total.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.label}>Dirección de entrega</Text>
        <View style={styles.inputRow}>
          <Feather name="map-pin" size={20} color="#00C9A7" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.input}
            placeholder="Ej: Av. Principal, Edificio..."
            value={address}
            onChangeText={setAddress}
          />
          <TouchableOpacity onPress={getCurrentLocation}>
            <Feather name="crosshair" size={20} color="#00C9A7" /> {/* ← icono corregido */}
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Notas (opcional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Ej: Casa de portón azul"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <TouchableOpacity
          style={[styles.confirmButton, loading && { opacity: 0.7 }]}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="check-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.confirmButtonText}>Confirmar pedido</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  container: { padding: 20, paddingTop: 80, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1F2937', marginLeft: 16 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemName: { fontSize: 15, color: '#374151', flex: 1 },
  itemPrice: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalLabel: { fontSize: 15, color: '#374151' },
  totalValue: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  totalFinal: { fontSize: 18, fontWeight: '700', color: '#00C9A7' },
  label: { fontWeight: '600', color: '#374151', marginBottom: 8, fontSize: 15 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  input: { flex: 1, fontSize: 16, color: '#111827', paddingVertical: 12 },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  confirmButton: {
    backgroundColor: '#00C9A7',
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00C9A7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmButtonText: { color: '#fff', fontWeight: '700', fontSize: 18 },
});

export default CheckoutScreen;