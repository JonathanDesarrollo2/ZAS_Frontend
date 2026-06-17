// app/payment/index.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  ActivityIndicator, TextInput, ScrollView
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../../apis/Client';

const Toast = ({ message, type = 'error', visible, onHide }: { message: string; type?: 'error' | 'success'; visible: boolean; onHide: () => void }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-80)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, friction: 8, tension: 100, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      const t = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => onHide());
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [visible]);
  if (!visible) return null;
  const bgColor = type === 'error' ? '#FF6B6B' : '#00C9A7';
  return (
    <Animated.View style={[styles.toast, { backgroundColor: bgColor, opacity, transform: [{ translateY }] }]}>
      <View style={styles.toastContent}>
        <Feather name={type === 'error' ? 'alert-circle' : 'check-circle'} size={22} color="#fff" style={{ marginRight: 12 }} />
        <Text style={styles.toastText}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const PaymentScreen = () => {
  const { rideId, reservationId } = useLocalSearchParams<{ rideId: string; reservationId: string }>();
  const [ride, setRide] = useState<any>(null);
  const [reservation, setReservation] = useState<any>(null);
  const [bankData, setBankData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reference, setReference] = useState('');
  const [confirming, setConfirming] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg); setToastType(type); setToastVisible(true);
  }, []);

  useEffect(() => {
    if (!rideId || !reservationId) {
      showToast('Error: faltan datos para completar el pago.');
      return;
    }
    fetchData();
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [rideId, reservationId]);

  const fetchData = async () => {
    try {
      const [rideRes, reservationRes, bankRes] = await Promise.all([
        apiClient<{ result: boolean; content: any }>(`/private/rides/${rideId}`),
        apiClient<{ result: boolean; content: any }>(`/private/rides/${reservationId}/confirm-payment`).catch(() => null), // maybe we need a separate reservation endpoint
        apiClient<{ result: boolean; content: any }>(`/private/rides/${rideId}/driver-bank-account`),
      ]);
      if (rideRes.result) setRide(rideRes.content);
      // We don't have a get reservation by id endpoint; we'll use a mock or fetch from ride detail? Better: fetch ride detail to show price.
      // We'll simply show price from ride object. We'll need seat count from reservation? Not yet. We'll show placeholder.
      if (bankRes.result) setBankData(bankRes.content);
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!reference.trim()) {
      showToast('Debes ingresar el número de referencia del pago');
      return;
    }
    if (!reservationId) {
      showToast('Error: no se encontró la reserva');
      return;
    }
    setConfirming(true);
    try {
      await apiClient(`/private/rides/${reservationId}/confirm-payment`, {
        method: 'POST',
        body: JSON.stringify({ payment_reference: reference.trim() }),
      });
      showToast('Pago confirmado exitosamente', 'success');
      setTimeout(() => router.replace(`/shared-rides/${rideId}`), 1500);
    } catch (err: any) {
      showToast(err.message || 'Error al confirmar el pago');
    } finally {
      setConfirming(false);
    }
  };

  if (!rideId || !reservationId) {
    return (
      <View style={styles.screen}>
        <View style={styles.centered}>
          <Feather name="alert-circle" size={48} color="#FF6B6B" />
          <Text style={styles.errorText}>Faltan datos para completar el pago.</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Toast message={toastMsg} type={toastType} visible={toastVisible} onHide={() => setToastVisible(false)} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {loading ? (
            <ActivityIndicator size="large" color="#00C9A7" />
          ) : (
            <>
              {/* Detalle del viaje */}
              {ride && (
                <View style={styles.rideCard}>
                  <Text style={styles.sectionTitle}>Tu viaje</Text>
                  <View style={styles.rideRow}>
                    <Feather name="circle" size={14} color="#00C9A7" />
                    <Text style={styles.rideText}>{ride.origin_address}</Text>
                  </View>
                  <View style={styles.dottedLine} />
                  <View style={styles.rideRow}>
                    <Feather name="map-pin" size={14} color="#FF6B6B" />
                    <Text style={styles.rideText}>{ride.destination_address}</Text>
                  </View>
                  {ride.price !== undefined && ride.price !== null && (
                    <View style={styles.priceRow}>
                      <Feather name="dollar-sign" size={16} color="#00C9A7" style={{ marginRight: 6 }} />
                      <Text style={styles.priceText}>${Number(ride.price).toFixed(2)} por puesto</Text>
                    </View>
                  )}
                  {/* Puestos reservados – asumimos seatCount de la reserva; si no tienes, puedes mostrarlo del ride */}
                  <Text style={styles.seatsText}>🪑 Puestos reservados: {ride.available_seats ? '1' : '?'}</Text>
                </View>
              )}

              {/* Datos bancarios del conductor */}
              <Text style={styles.sectionTitle}>Datos bancarios del conductor</Text>
              {bankData ? (
                <View style={styles.bankCard}>
                  <View style={styles.row}>
                    <Feather name="credit-card" size={20} color="#00C9A7" />
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={styles.label}>Banco</Text>
                      <Text style={styles.value}>{bankData.bankName}</Text>
                    </View>
                  </View>
                  <View style={styles.row}>
                    <Feather name="user" size={20} color="#00C9A7" />
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={styles.label}>Titular (cédula)</Text>
                      <Text style={styles.value}>{bankData.cedula}</Text>
                    </View>
                  </View>
                  <View style={styles.row}>
                    <Feather name="phone" size={20} color="#00C9A7" />
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={styles.label}>Teléfono</Text>
                      <Text style={styles.value}>{bankData.phone}</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.bankCard}>
                  <Feather name="info" size={20} color="#9CA3AF" style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyText}>El conductor aún no ha registrado su cuenta bancaria.</Text>
                </View>
              )}

              {/* Referencia */}
              <Text style={styles.referenceLabel}>Número de referencia del pago</Text>
              <View style={styles.inputRow}>
                <Feather name="hash" size={20} color="#00C9A7" style={{ marginRight: 12 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Ej: 12345678"
                  value={reference}
                  onChangeText={setReference}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <TouchableOpacity
                style={[styles.button, (!bankData || confirming) && { opacity: 0.5 }]}
                onPress={handleConfirmPayment}
                disabled={!bankData || confirming}
                activeOpacity={0.8}
              >
                {confirming ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="check-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.buttonText}>Confirmar pago</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 12, marginTop: 20 },
  rideCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 8,
    borderWidth: 1, borderColor: '#E5F5F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  rideRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rideText: { color: '#1F2937', fontSize: 16, fontWeight: '500', marginLeft: 12, flex: 1 },
  dottedLine: { height: 20, borderLeftWidth: 2, borderColor: '#E5E7EB', marginLeft: 6, marginVertical: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  priceText: { fontSize: 16, fontWeight: '700', color: '#00C9A7' },
  seatsText: { fontSize: 14, color: '#374151', marginTop: 6 },
  bankCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5F5F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  label: { fontSize: 13, color: '#6B7280', marginBottom: 2 },
  value: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginLeft: 14, flex: 1 },
  emptyText: { color: '#9CA3AF', fontSize: 16, textAlign: 'center' },
  referenceLabel: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16,
    paddingHorizontal: 16, height: 52, marginBottom: 24, borderWidth: 1, borderColor: '#E5E7EB',
  },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  button: {
    backgroundColor: '#00C9A7', borderRadius: 16, height: 52, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', shadowColor: '#00C9A7',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  errorText: { fontSize: 18, color: '#FF6B6B', textAlign: 'center', marginVertical: 20 },
  backButton: { backgroundColor: '#E5E7EB', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 12, marginTop: 20 },
  backButtonText: { fontWeight: '600', color: '#1F2937' },
  toast: {
    position: 'absolute', top: 60, left: 20, right: 20, borderRadius: 20, padding: 18, zIndex: 1000,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 12,
  },
  toastContent: { flexDirection: 'row', alignItems: 'center' },
  toastText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', flex: 1 },
});

export default PaymentScreen;