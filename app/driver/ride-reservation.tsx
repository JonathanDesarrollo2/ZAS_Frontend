// app/driver/ride-reservations.tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../../apis/Client';
import { acceptReservationPayment, rejectReservationPayment } from '../../apis/driver';

interface Reservation {
  id: string;
  passenger_user_id: string;
  seat_count: number;
  status: string;
  payment_reference?: string;
  passenger: { username?: string; userlogin: string };
}

interface RideData {
  ride: { total_seats: number; available_seats: number; status: string };
  reservations: Reservation[];
}

const Toast = ({ message, type = 'error', visible, onHide }: { message: string; type?: 'error' | 'success'; visible: boolean; onHide: () => void }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-80)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, friction: 8, tension: 100, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => onHide());
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [visible]);
  if (!visible) return null;
  return (
    <Animated.View style={[styles.toast, { backgroundColor: type === 'error' ? '#FF6B6B' : '#00C9A7', opacity, transform: [{ translateY }] }]}>
      <View style={styles.toastContent}>
        <Feather name={type === 'error' ? 'alert-circle' : 'check-circle'} size={22} color="#fff" style={{ marginRight: 12 }} />
        <Text style={styles.toastText}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const RideReservationsScreen = () => {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const [data, setData] = useState<RideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastV, setToastV] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg);
    setToastType(type);
    setToastV(true);
  };

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const load = async () => {
    try {
      const res = await apiClient<{ result: boolean; content: RideData }>(`/private/driver/rides/${rideId}/reservations`);
      setData(res.content);
    } catch (e: any) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const accept = (reservationId: string) => {
    acceptReservationPayment(rideId, reservationId)
      .then(() => { showToast('Reserva aceptada', 'success'); load(); })
      .catch(e => showToast(e.message));
  };
  const reject = (reservationId: string) => {
    rejectReservationPayment(rideId, reservationId)
      .then(() => { showToast('Reserva rechazada', 'success'); load(); })
      .catch(e => showToast(e.message));
  };

  if (loading) return <View style={styles.center}><Text style={{ color: '#00C9A7' }}>Cargando...</Text></View>;
  if (!data) return null;
  const { ride, reservations } = data;
  const appPaid = reservations.filter(r => r.status === 'paid' || r.status === 'verified').reduce((s, r) => s + r.seat_count, 0);
  const occupied = ride.total_seats - ride.available_seats;
  const manual = Math.max(0, occupied - appPaid);

  return (
    <View style={styles.screen}>
      <Toast message={toastMsg} type={toastType} visible={toastV} onHide={() => setToastV(false)} />
      <Animated.View style={{ opacity: fadeAnim, flex: 1, paddingTop: 60 }}>
        <Text style={styles.heading}>Reservas del viaje</Text>

        <View style={styles.summary}>
          <Text style={styles.sumTitle}>Resumen</Text>
          <View style={styles.sumRow}><Text style={styles.sumLabel}>Puestos totales</Text><Text style={styles.sumValue}>{ride.total_seats}</Text></View>
          <View style={styles.sumRow}><Text style={styles.sumLabel}>Ocupados (app + manual)</Text><Text style={styles.sumValue}>{occupied}</Text></View>
          <View style={styles.sumRow}><Text style={styles.sumLabel}>Pagaron por la app</Text><Text style={styles.sumValue}>{appPaid}</Text></View>
          <View style={styles.sumRow}><Text style={styles.sumLabel}>Agregados manualmente</Text><Text style={styles.sumValue}>{manual}</Text></View>
          <View style={styles.sumRow}><Text style={styles.sumLabel}>Disponibles</Text><Text style={[styles.sumValue, ride.available_seats === 0 && { color: '#FF5252' }]}>{ride.available_seats}</Text></View>
          {ride.status === 'full' && <Text style={styles.fullBadge}>🚫 VIAJE LLENO</Text>}
        </View>

        <FlatList
          data={reservations}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingHorizontal: 20 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.passenger}>👤 {item.passenger?.username || item.passenger?.userlogin}</Text>
              <Text style={styles.detail}>Puestos: {item.seat_count} · {item.status}</Text>
              {item.payment_reference && <Text style={styles.ref}>Ref: {item.payment_reference}</Text>}
              {item.status === 'paid' && (
                <View style={styles.actions}>
                  <TouchableOpacity style={[styles.btn, { backgroundColor: '#00C9A7' }]} onPress={() => accept(item.id)}>
                    <Feather name="check" size={16} color="#fff" /><Text style={styles.btnText}> Aceptar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { backgroundColor: '#FF5252' }]} onPress={() => reject(item.id)}>
                    <Feather name="x" size={16} color="#fff" /><Text style={styles.btnText}> Rechazar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#6b7280', marginTop: 40 }}>No hay reservas</Text>}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0fdf9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0fdf9' },
  heading: { fontSize: 28, fontWeight: '700', color: '#1f2937', textAlign: 'center', marginBottom: 20 },
  summary: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginHorizontal: 20, marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  sumTitle: { fontWeight: '700', fontSize: 18, marginBottom: 12, color: '#1f2937' },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sumLabel: { color: '#6b7280', fontSize: 15 },
  sumValue: { fontWeight: '600', fontSize: 15, color: '#1f2937' },
  fullBadge: { marginTop: 10, backgroundColor: '#FF5252', color: '#fff', textAlign: 'center', fontWeight: '700', borderRadius: 8, paddingVertical: 4, overflow: 'hidden' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  passenger: { fontWeight: '600', fontSize: 16, marginBottom: 4 },
  detail: { color: '#6b7280', marginBottom: 4 },
  ref: { color: '#555', fontStyle: 'italic' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 10, flex: 1, marginHorizontal: 4, justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '600' },
  toast: { position: 'absolute', top: 60, left: 20, right: 20, borderRadius: 20, padding: 18, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 12 },
  toastContent: { flexDirection: 'row', alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
});

export default RideReservationsScreen;
