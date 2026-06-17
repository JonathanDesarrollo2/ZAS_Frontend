// app/driver/find-trips.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Animated, Alert
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';   // ← nuevo import
import { apiClient } from '../../apis/Client';

interface Trip {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  price: number;
  vehicle_type: string;
  status: string;
  passenger?: {
    username?: string;
    userlogin: string;
  };
}

const FindTripsScreen = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      // Obtener ubicación real del conductor
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso de ubicación', 'Se necesita acceso a la ubicación para buscar viajes.');
        setLoading(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      const lat = location.coords.latitude;
      const lng = location.coords.longitude;
      const radius = 5; // kilómetros a la redonda
      const endpoint = `/private/trips/available?lat=${lat}&lng=${lng}&radius=${radius}`;
      const response = await apiClient<{ result: boolean; content: Trip[] }>(endpoint);
      if (response.result) setTrips(response.content);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudieron cargar los viajes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    fetchTrips();
  }, []);

  const renderTrip = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/driver/trip-detail', params: { tripId: item.id } })}
      activeOpacity={0.8}
    >
      <View style={styles.routeRow}>
        <Feather name="circle" size={14} color="#00C9A7" />
        <Text style={styles.address}>{item.pickup_address}</Text>
      </View>
      <View style={styles.dottedLine} />
      <View style={styles.routeRow}>
        <Feather name="map-pin" size={14} color="#FF6B6B" />
        <Text style={styles.address}>{item.dropoff_address}</Text>
      </View>
      <View style={styles.infoRow}>
        <Feather name="dollar-sign" size={14} color="#374151" style={{ marginRight: 6 }} />
        <Text style={styles.infoText}>${Number(item.price).toFixed(2)}</Text>
        <Feather name="user" size={14} color="#374151" style={{ marginLeft: 16, marginRight: 6 }} />
        <Text style={styles.infoText}>{item.passenger?.username || item.passenger?.userlogin || 'Pasajero'}</Text>
        <Feather name="truck" size={14} color="#374151" style={{ marginLeft: 16, marginRight: 6 }} />
        <Text style={styles.infoText}>{item.vehicle_type}</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C9A7" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
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
  infoText: { color: '#374151', fontSize: 14 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 18, color: '#6B7280', fontWeight: '600', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
});

export default FindTripsScreen;