import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { apiClient } from '../../apis/Client';
import { Reservation, SharedRide } from '../../apis/sharedRides';
import { markSharedRidePassengerCompleted, markSharedRidePassengerPickedUp } from '../../apis/driver';
import { connectSocket } from '../../services/socketClient';

interface RideReservationsResponse {
  ride: Pick<SharedRide,
    'origin_address' | 'origin_lat' | 'origin_lng' |
    'destination_address' | 'destination_lat' | 'destination_lng' |
    'vehicle_type' | 'departure_time' | 'price'
  > & { total_seats: number; available_seats: number; status: string };
  reservations: Reservation[];
}

const getCoordinate = (lat: number | string | null | undefined, lng: number | string | null | undefined) => {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
};

const SharedRideActiveScreen = () => {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const [data, setData] = useState<RideReservationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!rideId) return;
    setError('');
    try {
      const response = await apiClient<{ result: boolean; content: RideReservationsResponse }>(
        `/private/driver/rides/${rideId}/reservations`,
      );
      if (!response.result) throw new Error('No se pudo cargar el seguimiento del viaje');
      setData(response.content);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error cargando el viaje');
    } finally {
      setLoading(false);
    }
  }, [rideId]);

  useEffect(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => undefined;
    connectSocket().then((socket) => {
      if (cancelled) return;
      socket.emit('driver:join');
      const refresh = (event: { rideId?: string }) => {
        if (!event.rideId || event.rideId === rideId) void load();
      };
      socket.on('reservation:new', refresh);
      socket.on('reservation:paid', refresh);
      socket.on('reservation:verified', refresh);
      socket.on('reservation:picked-up', refresh);
      socket.on('reservation:completed', refresh);
      cleanup = () => {
        socket.off('reservation:new', refresh);
        socket.off('reservation:paid', refresh);
        socket.off('reservation:verified', refresh);
        socket.off('reservation:picked-up', refresh);
        socket.off('reservation:completed', refresh);
      };
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [load, rideId]);

  const ride = data?.ride;
  const reservations = useMemo(() => data?.reservations ?? [], [data?.reservations]);
  const origin = useMemo(
    () => getCoordinate(ride?.origin_lat, ride?.origin_lng),
    [ride?.origin_lat, ride?.origin_lng],
  );
  const destination = useMemo(
    () => getCoordinate(ride?.destination_lat, ride?.destination_lng),
    [ride?.destination_lat, ride?.destination_lng],
  );
  const mapPoints = useMemo(() => {
    const points = [origin, destination, ...reservations
      .filter((item) => ['pending_payment', 'paid', 'verified', 'picked_up', 'completed'].includes(item.status))
      .map((item) => getCoordinate(item.dropoff_lat, item.dropoff_lng))]
      .filter((point): point is { latitude: number; longitude: number } => point !== null);
    return points;
  }, [origin, destination, reservations]);

  const region: Region = useMemo(() => {
    if (!mapPoints.length) return { latitude: 10.071866, longitude: -66.869583, latitudeDelta: 0.08, longitudeDelta: 0.08 };
    const lats = mapPoints.map((point) => point.latitude);
    const lngs = mapPoints.map((point) => point.longitude);
    const latSpan = Math.max(...lats) - Math.min(...lats);
    const lngSpan = Math.max(...lngs) - Math.min(...lngs);
    return {
      latitude: (Math.max(...lats) + Math.min(...lats)) / 2,
      longitude: (Math.max(...lngs) + Math.min(...lngs)) / 2,
      latitudeDelta: Math.max(0.025, latSpan * 1.5),
      longitudeDelta: Math.max(0.025, lngSpan * 1.5),
    };
  }, [mapPoints]);

  const updateReservation = async (reservation: Reservation) => {
    if (!rideId) return;
    setUpdatingId(reservation.id);
    try {
      if (reservation.status === 'verified') {
        await markSharedRidePassengerPickedUp(rideId, reservation.id);
      } else if (reservation.status === 'picked_up') {
        await markSharedRidePassengerCompleted(rideId, reservation.id);
      }
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar la reserva');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#00C9A7" /></View>;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Seguimiento compartido</Text>
          <Text style={styles.subheading}>
            {ride?.status === 'full' ? 'Vehículo lleno · pasajeros y destinos' : 'Punto común de recogida y destinos'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => { setLoading(true); void load(); }} accessibilityLabel="Actualizar">
          <Feather name="refresh-cw" size={21} color="#00C9A7" />
        </TouchableOpacity>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <MapView style={styles.map} initialRegion={region} region={region}>
        {origin && <Marker coordinate={origin} title="Recogida común" pinColor="#00C9A7" />}
        {destination && <Marker coordinate={destination} title="Destino de ruta" pinColor="#1F2937" />}
        {reservations.filter((item) => ['pending_payment', 'paid', 'verified', 'picked_up', 'completed'].includes(item.status)).map((item, index) => {
          const point = getCoordinate(item.dropoff_lat, item.dropoff_lng);
          if (!point) return null;
          return (
            <Marker
              key={item.id}
              coordinate={point}
              title={`Pasajero ${index + 1}: ${item.dropoff_address || 'Destino'}`}
              description={item.status === 'completed' ? 'Entregado' : item.status === 'picked_up' ? 'En viaje' : item.status === 'verified' ? 'Listo para recoger' : 'Pendiente de pago o verificación'}
              pinColor={item.status === 'completed' ? '#9CA3AF' : item.status === 'verified' || item.status === 'picked_up' ? '#FF6B6B' : '#F59E0B'}
            />
          );
        })}
        {origin && destination && (
          <Polyline coordinates={[origin, destination]} strokeColor="#00C9A7" strokeWidth={4} />
        )}
      </MapView>
      <FlatList
        data={reservations.filter((item) => ['pending_payment', 'paid', 'verified', 'picked_up', 'completed'].includes(item.status))}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={styles.listTitle}>Pasajeros y paradas</Text>}
        renderItem={({ item }) => {
          const passengerName = item.passenger?.username || item.passenger?.userlogin || 'Pasajero';
          return (
            <View style={styles.reservationCard}>
              <View style={styles.reservationHead}>
                <View style={styles.iconCircle}><Feather name="user" size={17} color="#00A98E" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.passengerName}>{passengerName} · {item.seat_count} puesto(s)</Text>
                  <Text style={styles.dropoff} numberOfLines={2}>{item.dropoff_address || 'Destino no disponible'}</Text>
                  {!!item.dropoff_notes && <Text style={styles.notes}>Indicaciones: {item.dropoff_notes}</Text>}
                </View>
              </View>
              {item.status === 'verified' ? (
                <TouchableOpacity style={styles.actionButton} onPress={() => void updateReservation(item)} disabled={updatingId === item.id}>
                  {updatingId === item.id ? <ActivityIndicator color="#FFFFFF" /> : <><Feather name="user-check" size={17} color="#FFFFFF" /><Text style={styles.actionText}>Pasajero recogido</Text></>}
                </TouchableOpacity>
              ) : item.status === 'picked_up' ? (
                <TouchableOpacity style={styles.actionButton} onPress={() => void updateReservation(item)} disabled={updatingId === item.id}>
                  {updatingId === item.id ? <ActivityIndicator color="#FFFFFF" /> : <><Feather name="check-circle" size={17} color="#FFFFFF" /><Text style={styles.actionText}>Pasajero entregado</Text></>}
                </TouchableOpacity>
              ) : item.status === 'completed' ? (
                <Text style={styles.completed}>Pasajero entregado</Text>
              ) : (
                <Text style={styles.pending}>Pendiente de pago o verificación</Text>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Aún no hay reservas pagadas y verificadas.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 18, paddingTop: 56, paddingBottom: 14, flexDirection: 'row', alignItems: 'center' },
  heading: { color: '#1F2937', fontSize: 22, fontWeight: '800' },
  subheading: { color: '#6B7280', fontSize: 13, marginTop: 4 },
  error: { color: '#DC2626', paddingHorizontal: 18, paddingBottom: 8 },
  map: { height: 300, marginHorizontal: 14, borderRadius: 18 },
  list: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 30 },
  listTitle: { color: '#1F2937', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  reservationCard: { backgroundColor: '#FFFFFF', borderRadius: 15, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  reservationHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#ECFDF8', alignItems: 'center', justifyContent: 'center' },
  passengerName: { color: '#1F2937', fontSize: 14, fontWeight: '700' },
  dropoff: { color: '#4B5563', fontSize: 13, marginTop: 4 },
  notes: { color: '#6B7280', fontSize: 12, marginTop: 4 },
  actionButton: { minHeight: 44, backgroundColor: '#00C9A7', borderRadius: 11, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 12 },
  actionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  completed: { color: '#059669', fontSize: 13, fontWeight: '700', marginTop: 12 },
  pending: { color: '#B45309', fontSize: 13, fontWeight: '700', marginTop: 12 },
  empty: { color: '#6B7280', textAlign: 'center', paddingVertical: 25 },
});

export default SharedRideActiveScreen;
