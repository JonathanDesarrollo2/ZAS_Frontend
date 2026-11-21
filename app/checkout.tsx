// LEIDO
import React, { useRef, useState } from 'react';
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
  const [cashTendered, setCashTendered] = useState('');
  const [loading, setLoading] = useState(false);
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null);
  const idempotencyKey = useRef(
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
  );

  const orderSubtotal = subtotal();
  const serviceFee = Math.round(orderSubtotal * 0.05 * 100) / 100;
  const total = Math.round((orderSubtotal + serviceFee) * 100) / 100;
  const cashAmount = Number(cashTendered);
  const validCashAmount = Number.isFinite(cashAmount) && cashAmount >= total;
  const change = validCashAmount ? Math.round((cashAmount - total) * 100) / 100 : null;

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
      Alert.alert('Ubicación no disponible', 'No se pudo obtener tu ubicación. Puedes intentarlo de nuevo.');
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

    const restaurantIds = new Set(items.map((item) => item.restaurant_id));
    if (restaurantIds.size !== 1) {
      Alert.alert('Carrito no válido', 'Un pedido solo puede contener productos de un restaurante.');
      return;
    }

    const restaurantId = items[0]?.restaurant_id;
    if (!restaurantId) {
      Alert.alert('Error', 'Falta seleccionar restaurante');
      return;
    }
    if (!validCashAmount) {
      Alert.alert('Monto insuficiente', 'Indica con cuánto pagarás; debe ser igual o mayor al total.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        idempotency_key: idempotencyKey.current,
        restaurant_id: restaurantId,
        items: items.map(i => ({
          product_id: i.productId,
          quantity: i.quantity,
          option_ids: i.options.map((option) => option.id),
        })),
        delivery_address: address.trim(),
        delivery_lat: deliveryCoords?.lat,
        delivery_lng: deliveryCoords?.lng,
        notes: notes.trim() || undefined,
        cash_tendered: cashAmount,
      };

      const response = await createRestaurantOrder(payload);
      if (!response.result || !response.content?.order?.id) {
        throw new Error(response.error?.[0] || 'El servidor no confirmó el pedido');
      }
      const confirmedTotal = Number(response.content.order.total);
      const confirmedCash = Number(response.content.order.cash_tendered);
      if (!Number.isFinite(confirmedTotal) || confirmedTotal <= 0 ||
          !Number.isFinite(confirmedCash) || confirmedCash < confirmedTotal) {
        throw new Error('El servidor devolvió datos de pago no válidos; el carrito se conservó.');
      }
      const confirmedChange = Math.max(0, Math.round((confirmedCash - confirmedTotal) * 100) / 100);
      clearCart();
      Alert.alert(
        'Pedido realizado',
        `Total confirmado: $${confirmedTotal.toFixed(2)}\nPagarás con: $${confirmedCash.toFixed(2)}\nVuelto: $${confirmedChange.toFixed(2)}`,
        [
          { text: 'Cerrar', style: 'cancel', onPress: () => router.replace('/dashboard' as any) },
          {
            text: 'Ver seguimiento',
            onPress: () => router.replace(`/restaurant-orders?orderId=${encodeURIComponent(response.content.order.id)}` as any),
          },
        ]
      );
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
            <View key={item.cartItemId} style={styles.summaryItem}>
              <Text style={styles.itemName}>
                {item.quantity}x {item.product_name}
              </Text>
              <Text style={styles.itemPrice}>
                ${(item.price * item.quantity).toFixed(2)}
              </Text>
              {item.options.length > 0 && (
                <Text style={styles.optionsText}>
                  {item.options.map((option) => `${option.group_name}: ${option.name}`).join(' · ')}
                </Text>
              )}
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

          <Text style={styles.label}>Pago en efectivo contraentrega</Text>
          <Text style={styles.helpText}>Indica el monto con el que pagarás. El total del pedido no cambia.</Text>
          <View style={styles.cashInputRow}>
            <Text style={styles.currencySymbol}>$</Text>
            <TextInput
              style={styles.cashInput}
              value={cashTendered}
              onChangeText={(value) => {
                const normalized = value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
                const [whole, fraction] = normalized.split('.');
                setCashTendered(fraction === undefined ? whole : `${whole}.${fraction.slice(0, 2)}`);
              }}
              placeholder={total.toFixed(2)}
              keyboardType="decimal-pad"
              accessibilityLabel="Monto con el que pagarás"
            />
          </View>
          {cashTendered.length > 0 && !validCashAmount && (
            <Text style={styles.validationText}>El monto debe ser al menos ${total.toFixed(2)}.</Text>
          )}
          {change !== null && (
            <View style={styles.changeRow}>
              <Text style={styles.totalLabel}>Vuelto estimado</Text>
              <Text style={styles.changeValue}>${change.toFixed(2)}</Text>
            </View>
          )}

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
          disabled={loading || items.length === 0}
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
  summaryItem: { marginBottom: 8, paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  itemName: { fontSize: 15, color: '#374151', flex: 1 },
  itemPrice: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  optionsText: { color: '#6B7280', fontSize: 12, marginTop: 2 },
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
  helpText: { color: '#6B7280', fontSize: 13, marginTop: -4, marginBottom: 8 },
  cashInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, marginBottom: 5 },
  currencySymbol: { color: '#374151', fontSize: 17, fontWeight: '700', marginRight: 8 },
  cashInput: { flex: 1, minHeight: 48, color: '#111827', fontSize: 16 },
  validationText: { color: '#B42318', fontSize: 12, marginTop: 4, marginBottom: 8 },
  changeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, marginBottom: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  changeValue: { color: '#008F76', fontSize: 16, fontWeight: '800' },
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