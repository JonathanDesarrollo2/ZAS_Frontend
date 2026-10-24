// LEIDO
import {
  View, Text, TouchableOpacity, Alert, StyleSheet, ActivityIndicator, TextInput
} from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { getMyReservations, reserveSeat } from '../../apis/sharedRides';
import { apiClient } from '../../apis/Client';
import MapSelector from '../../presentation/components/shared/mapSelector';

interface RideDetail {
  id: string;
  origin_address: string;
  destination_address: string;
  vehicle_type: string;
  total_seats: number;
  available_seats: number;
  trunk_full: boolean;
  departure_time?: string;
  status: string;
  price?: number | string; // precio por puesto (opcional)
  origin_lat: number | string;
  origin_lng: number | string;
  driver: { username?: string; userlogin: string };
}

const RideDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ride, setRide] = useState<RideDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [seatCount, setSeatCount] = useState('1');
  const [reserving, setReserving] = useState(false);
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffNotes, setDropoffNotes] = useState('');
  const [mapVisible, setMapVisible] = useState(false);

  const fetchRideDetail = useCallback(async () => {
    try {
      const response = await apiClient<{ result: boolean; content: RideDetail }>(`/private/rides/${id}`);
      setRide(response.content);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo cargar el viaje');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id || id === 'index') {
      Alert.alert('Error', 'ID de viaje inválido');
      router.back();
      return;
    }
    const timer = setTimeout(() => { void fetchRideDetail(); }, 0);
    return () => clearTimeout(timer);
  }, [fetchRideDetail, id]);

  const handleReserve = async () => {
    const seats = parseInt(seatCount);
    if (!seats || seats < 1) {
      Alert.alert('Cantidad inválida', 'Debes reservar al menos 1 puesto');
      return;
    }
    setReserving(true);
    try {
      if (!dropoffCoords || !dropoffAddress.trim()) {
        Alert.alert('Destino requerido', 'Marca tu destino exacto en el mapa antes de reservar.');
        return;
      }
      const result = await reserveSeat(id!, seats, {
        ...dropoffCoords,
        address: dropoffAddress.trim(),
        notes: dropoffNotes.trim() || undefined,
      });
      // Navegar a la pantalla de pago con los IDs obtenidos
      router.push({
        pathname: '/payment',
        params: {
          rideId: id!,
          reservationId: result.reservation.id,
        },
      });
    } catch (error: any) {
      // Si el error es por reserva existente (409), intentamos obtener la reserva activa y redirigir
      if (error.message.includes('409') || error.message.includes('activa')) {
        try {
            const myReservations = await getMyReservations();
            const active = myReservations.find((r) => r.ride_id === id && (
              r.status === 'pending_payment' || r.status === 'paid' ||
              r.status === 'verified' || r.status === 'picked_up' || r.status === 'completed'
            ));
            if (active) {
              if (active.status === 'verified' || active.status === 'picked_up' || active.status === 'completed') {
                router.push({
                  pathname: '/shared-rides/active/[reservationId]',
                  params: { reservationId: active.id },
                });
                return;
              }
              router.push({
                pathname: '/payment',
                params: { rideId: id!, reservationId: active.id },
              });
              return;
            }
          } catch (lookupError) {
            Alert.alert('Error', lookupError instanceof Error ? lookupError.message : 'No se pudo consultar tu reserva');
            return;
          }
      }
      Alert.alert('Error', error.message || 'No se pudo completar la reserva');
    } finally {
      setReserving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C9A7" />
      </View>
    );
  }

  if (!ride) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.route}>📍 {ride.origin_address}</Text>
        <Text style={styles.arrow}>↓</Text>
        <Text style={styles.route}>🏁 {ride.destination_address}</Text>

        <View style={styles.infoSection}>
          <Text style={styles.infoText}>🚗 {ride.vehicle_type}</Text>
          <Text style={styles.infoText}>
            🪑 {ride.available_seats} de {ride.total_seats} disponibles
          </Text>
          <Text style={styles.infoText}>
            🧳 {ride.trunk_full ? 'Maletero lleno' : 'Maletero disponible'}
          </Text>
          {ride.departure_time && (
            <Text style={styles.infoText}>
              ⏰ Salida: {new Date(ride.departure_time).toLocaleString()}
            </Text>
          )}
          <Text style={styles.infoText}>
            👤 Conductor: {ride.driver?.username || ride.driver?.userlogin}
          </Text>
          {ride.price !== undefined && ride.price !== null && (
            <Text style={styles.priceText}>
              💰 {Number(ride.price).toFixed(2)} USD por puesto
            </Text>
          )}
        </View>

        {ride.available_seats > 0 && ride.status === 'active' ? (
          <View style={styles.reserveSection}>
            <Text style={styles.label}>Puestos a reservar:</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={seatCount}
              onChangeText={setSeatCount}
              maxLength={2}
            />
            <Text style={styles.label}>Tu destino exacto:</Text>
            <TouchableOpacity style={styles.mapButton} onPress={() => setMapVisible(true)}>
              <Feather name="map-pin" size={18} color="#00C9A7" />
              <Text style={styles.mapButtonText}>
                {dropoffAddress || 'Buscar y marcar destino en el mapa'}
              </Text>
            </TouchableOpacity>
            {!!dropoffCoords && (
              <TextInput
                style={styles.input}
                value={dropoffAddress}
                onChangeText={setDropoffAddress}
                placeholder="Nombre del lugar, por ejemplo: El Traki"
                placeholderTextColor="#9CA3AF"
              />
            )}
            <TextInput
              style={styles.notesInput}
              value={dropoffNotes}
              onChangeText={setDropoffNotes}
              placeholder="Indicaciones adicionales (opcional)"
              placeholderTextColor="#9CA3AF"
              multiline
            />
            <TouchableOpacity
              style={styles.reserveButton}
              onPress={handleReserve}
              disabled={reserving}
            >
              {reserving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.reserveButtonText}>Reservar</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.fullBanner}>
            <Text style={styles.fullText}>🚫 Viaje lleno</Text>
          </View>
        )}
      </View>
      <MapSelector
        visible={mapVisible}
        initialCoords={{
          lat: Number(ride.origin_lat),
          lng: Number(ride.origin_lng),
        }}
        onConfirm={(address, lat, lng) => {
          setDropoffAddress(address);
          setDropoffCoords({ lat, lng });
          setMapVisible(false);
        }}
        onCancel={() => setMapVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0FDF9', padding: 20, paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  route: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  arrow: { textAlign: 'center', fontSize: 24, color: '#666', marginVertical: 8 },
  infoSection: { marginVertical: 20 },
  infoText: { fontSize: 15, color: '#374151', marginBottom: 6 },
  priceText: { fontSize: 16, fontWeight: '700', color: '#00C9A7', marginTop: 8 },
  reserveSection: { marginTop: 10 },
  label: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 8 },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  mapButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECFDF8',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  mapButtonText: { flex: 1, color: '#1F2937', fontSize: 14 },
  notesInput: {
    minHeight: 48,
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    marginBottom: 16,
  },
  reserveButton: {
    backgroundColor: '#00C9A7',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#00C9A7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  reserveButtonText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  fullBanner: {
    marginTop: 20,
    backgroundColor: '#FF6B6B',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  fullText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
});

export default RideDetailScreen;