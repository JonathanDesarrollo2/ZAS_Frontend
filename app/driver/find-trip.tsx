// LEIDO
// app/driver/find-trips.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Animated,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { apiClient } from '../../apis/Client';
import { connectSocket } from '../../services/socketClient';
import ToastNotification from '../../presentation/components/shared/toastNotification';

interface Trip {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  price: number;
  vehicle_type: string;
  status: string;
  trip_type?: 'ride' | 'delivery';
  passenger?: {
    username?: string;
    userlogin: string;
  };
}

const sanitizeReadableAddress = (value?: string) => {
  if (!value) return 'Ubicación sin nombre';
  return value
    .replace(/\b[A-Z0-9]{3}\+[A-Z0-9]{3}\s*,?\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*,/g, ', ')
    .trim();
};

const vehicleLabel = (value?: string) => {
  const normalized = value?.toLowerCase();
  if (normalized === 'moto' || normalized === 'motorcycle') return 'Moto';
  if (normalized === 'auto' || normalized === 'carro' || normalized === 'car') return 'Auto';
  return value || 'Vehículo';
};

const FindTripsScreen = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Los avisos de acceso, permisos y carga usan el popup común.
  const showToast = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(message);
    setToastType(type);
    setToastVisible(true);
  }, []);

  const fetchTrips = useCallback(async () => {
    if (!currentCoords) return;
    try {
      const { lat, lng } = currentCoords;
      const radius = 10; // radio en km
      const endpoint = `/private/trips/available?lat=${lat}&lng=${lng}&radius=${radius}`;
      const response = await apiClient<{ result: boolean; content: Trip[] }>(endpoint);
      if (response.result) {
        setTrips(response.content);
      } else {
        showToast('No se pudieron cargar los viajes');
      }
    } catch (err: any) {
      showToast(err.message || 'No se pudieron cargar los viajes');
    } finally {
      setLoading(false);
    }
  }, [currentCoords, showToast]);

  // Escuchar nuevos viajes
  useEffect(() => {
    let cancelled = false;
    let socket: Awaited<ReturnType<typeof connectSocket>> | null = null;
    const handleNewTrip = () => { void fetchTrips(); };
    const handleTripCancelled = (data?: { tripId?: string }) => {
      if (data?.tripId) {
        setTrips((current) => current.filter((trip) => trip.id !== data.tripId));
      }
      void fetchTrips();
    };

    connectSocket().then((connectedSocket) => {
      if (cancelled) return;
      socket = connectedSocket;
      socket.on('newTripAvailable', handleNewTrip);
      socket.on('tripCancelled', handleTripCancelled);
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      socket?.off('newTripAvailable', handleNewTrip);
      socket?.off('tripCancelled', handleTripCancelled);
    };
  }, [fetchTrips]);

  // Obtener ubicación optimizada y enviarla periódicamente al backend
  useEffect(() => {
    let isMounted = true;
    let interval: ReturnType<typeof setInterval> | undefined;

    const getLocationAndStartSending = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          showToast('Se necesita acceso a tu ubicación para buscar viajes.');
          setLoading(false);
          return;
        }

        // 1. Intentar con última ubicación conocida (rápido)
        let location = await Location.getLastKnownPositionAsync();
        if (location && isMounted) {
          setCurrentCoords({
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          });
        }

        // 2. Actualizar con ubicación precisa en segundo plano
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 1000,
          distanceInterval: 1,
        })
          .then((preciseLocation) => {
            if (preciseLocation && isMounted) {
              setCurrentCoords({
                lat: preciseLocation.coords.latitude,
                lng: preciseLocation.coords.longitude,
              });
            }
          })
          .catch(() => {
            // Mantener última ubicación conocida si falla
          });

        // 3. Enviar ubicación al backend cada 5 segundos
        interval = setInterval(async () => {
          try {
            const currentLocation = await Location.getCurrentPositionAsync({});
            const socket = await connectSocket();
            socket.emit('driver:location', {
              tripId: 'find-trips', // string temporal, no afecta el backend
              lat: currentLocation.coords.latitude,
              lng: currentLocation.coords.longitude,
            });
          } catch (err) {
            // Silencioso
          }
        }, 5000);
      } catch (err) {
        if (isMounted) setLoading(false);
      }
    };

    getLocationAndStartSending();

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, []);

  // Cargar viajes cuando ya tengamos coordenadas
  useEffect(() => {
    if (currentCoords) {
      fetchTrips();
    }
  }, [currentCoords, fetchTrips]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const renderTrip = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/driver/trip-detail', params: { tripId: item.id } })}
      activeOpacity={0.8}
    >
      {item.trip_type === 'delivery' && (
        <View style={styles.deliveryBadge}>
          <MaterialCommunityIcons name="package-variant-closed" size={16} color="#FFFFFF" />
          <Text style={styles.deliveryBadgeText}>Viaje de Entrega</Text>
        </View>
      )}
      <View style={styles.routeRow}>
        <Feather name="circle" size={14} color="#00C9A7" />
        <Text style={styles.address}>{sanitizeReadableAddress(item.pickup_address)}</Text>
      </View>
      <View style={styles.dottedLine} />
      <View style={styles.routeRow}>
        <Feather name="map-pin" size={14} color="#FF6B6B" />
        <Text style={styles.address}>{sanitizeReadableAddress(item.dropoff_address)}</Text>
      </View>
      <View style={styles.infoRow}>
        <Feather name="dollar-sign" size={14} color="#374151" style={{ marginRight: 6 }} />
        <Text style={styles.infoText}>${Number(item.price).toFixed(2)}</Text>
        <Feather name="user" size={14} color="#374151" style={{ marginLeft: 16, marginRight: 6 }} />
        <Text style={styles.infoText}>{item.passenger?.username || item.passenger?.userlogin || 'Pasajero'}</Text>
        {vehicleLabel(item.vehicle_type) === 'Moto' ? (
          <MaterialCommunityIcons name="motorbike" size={17} color="#374151" style={{ marginLeft: 16, marginRight: 6 }} />
        ) : (
          <MaterialCommunityIcons name="car" size={17} color="#374151" style={{ marginLeft: 16, marginRight: 6 }} />
        )}
        <Text style={styles.infoText}>{vehicleLabel(item.vehicle_type)}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading && !currentCoords) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C9A7" />
        <Text style={{ marginTop: 10, color: '#6B7280' }}>Obteniendo ubicación...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ToastNotification message={toastMsg} type={toastType} visible={toastVisible} onHide={() => setToastVisible(false)} />
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}> 
        <Text style={styles.title}>Viajes disponibles</Text>
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          renderItem={renderTrip}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="map" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>No hay viajes cercanos</Text>
              <Text style={styles.emptySub}>Vuelve más tarde o cambia tu ubicación</Text>
            </View>
          }
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  container: { flex: 1, paddingTop: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0FDF9' },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937', textAlign: 'center', marginBottom: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5F5F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 3,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  address: { color: '#1F2937', fontSize: 16, fontWeight: '500', marginLeft: 12, flex: 1 },
  dottedLine: { height: 20, borderLeftWidth: 2, borderColor: '#E5E7EB', marginLeft: 6, marginVertical: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 8 },
  deliveryBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#00C9A7', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 10 },
  deliveryBadgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  infoText: { color: '#374151', fontSize: 14 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 18, color: '#6B7280', fontWeight: '600', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
});

export default FindTripsScreen;
