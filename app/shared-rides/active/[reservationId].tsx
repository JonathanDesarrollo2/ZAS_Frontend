import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { getMyReservations, markReservationArrived, Reservation } from '../../../apis/sharedRides';
import { connectSocket } from '../../../services/socketClient';

const coordinate = (lat: number | string | null | undefined, lng: number | string | null | undefined) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
    ? { latitude, longitude }
    : null;
};

const PassengerSharedRideActiveScreen = () => {
  const { reservationId } = useLocalSearchParams<{ reservationId: string }>();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!reservationId) return;
    try {
      const reservations = await getMyReservations();
      const found = reservations.find((item) => item.id === reservationId);
      if (!found) throw new Error('No se encontró tu reserva');
      setReservation(found);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo cargar la reserva');
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => undefined;
    connectSocket().then((socket) => {
      if (cancelled) return;
      const handleStatus = (event: { reservationId?: string; status?: Reservation['status'] }) => {
        if (event.reservationId === reservationId && event.status) {
          setReservation((current) => current ? { ...current, status: event.status! } : current);
        }
      };
      socket.on('reservation:picked-up', handleStatus);
      socket.on('reservation:completed', handleStatus);
      cleanup = () => {
        socket.off('reservation:picked-up', handleStatus);
        socket.off('reservation:completed', handleStatus);
      };
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [reservationId]);

  const origin = useMemo(
    () => coordinate(reservation?.ride.origin_lat, reservation?.ride.origin_lng),
    [reservation?.ride.origin_lat, reservation?.ride.origin_lng],
  );
  const dropoff = useMemo(
    () => coordinate(reservation?.dropoff_lat, reservation?.dropoff_lng),
    [reservation?.dropoff_lat, reservation?.dropoff_lng],
  );
  const region: Region = useMemo(() => {
    const points = [origin, dropoff].filter((point): point is NonNullable<typeof point> => point !== null);
    if (!points.length) return { latitude: 10.071866, longitude: -66.869583, latitudeDelta: 0.05, longitudeDelta: 0.05 };
    return {
      latitude: points.reduce((sum, point) => sum + point.latitude, 0) / points.length,
      longitude: points.reduce((sum, point) => sum + point.longitude, 0) / points.length,
      latitudeDelta: Math.max(0.025, Math.abs((origin?.latitude ?? points[0].latitude) - (dropoff?.latitude ?? points[0].latitude)) * 1.5),
      longitudeDelta: Math.max(0.025, Math.abs((origin?.longitude ?? points[0].longitude) - (dropoff?.longitude ?? points[0].longitude)) * 1.5),
    };
  }, [origin, dropoff]);

  const markArrived = async () => {
    if (!reservation) return;
    setSubmitting(true);
    try {
      await markReservationArrived(reservation.id);
      setReservation({ ...reservation, status: 'completed' });
      Alert.alert('Destino confirmado', 'Gracias por confirmar que llegaste.');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo confirmar tu llegada');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#00C9A7" /></View>;
  if (!reservation) return <View style={styles.centered}><Text style={styles.body}>No se encontró tu reserva.</Text></View>;

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Tu viaje compartido</Text>
      <MapView style={styles.map} region={region}>
        {origin && <Marker coordinate={origin} title={`Origen: ${reservation.ride.origin_address}`} pinColor="#00C9A7" />}
        {dropoff && <Marker coordinate={dropoff} title={reservation.dropoff_address || 'Tu destino'} pinColor="#FF6B6B" />}
        {origin && dropoff && <Polyline coordinates={[origin, dropoff]} strokeColor="#00C9A7" strokeWidth={4} />}
      </MapView>
      <View style={styles.card}>
        <Text style={styles.label}>Tu destino</Text>
        <Text style={styles.address}>{reservation.dropoff_address || 'Destino no disponible'}</Text>
        {!!reservation.dropoff_notes && <Text style={styles.notes}>Indicaciones: {reservation.dropoff_notes}</Text>}
        <Text style={styles.status}>
          {reservation.status === 'picked_up' ? 'Viaje en curso' : reservation.status === 'completed' ? 'Viaje completado' : 'Esperando la recogida'}
        </Text>
        {reservation.status === 'picked_up' ? (
          <TouchableOpacity style={styles.button} onPress={() => void markArrived()} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#FFFFFF" /> : <><Feather name="check-circle" size={18} color="#FFFFFF" /><Text style={styles.buttonText}>He llegado a mi destino</Text></>}
          </TouchableOpacity>
        ) : reservation.status === 'completed' ? (
          <TouchableOpacity style={[styles.button, styles.doneButton]} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Listo</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.button, styles.disabled]} onPress={() => void load()}>
            <Text style={styles.buttonText}>Actualizar estado</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB', paddingTop: 56 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  heading: { color: '#1F2937', fontSize: 23, fontWeight: '800', paddingHorizontal: 18, marginBottom: 14 },
  map: { flex: 1, marginHorizontal: 14, borderRadius: 18 },
  card: { backgroundColor: '#FFFFFF', margin: 14, borderRadius: 17, padding: 18, borderWidth: 1, borderColor: '#E5E7EB' },
  label: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  address: { color: '#1F2937', fontSize: 17, fontWeight: '700', marginTop: 4 },
  notes: { color: '#6B7280', fontSize: 13, marginTop: 6 },
  status: { color: '#00A98E', fontWeight: '700', marginTop: 12 },
  button: { minHeight: 48, marginTop: 15, borderRadius: 12, backgroundColor: '#00C9A7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  doneButton: { backgroundColor: '#1F2937' },
  disabled: { opacity: 0.65 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  body: { color: '#6B7280' },
});

export default PassengerSharedRideActiveScreen;
