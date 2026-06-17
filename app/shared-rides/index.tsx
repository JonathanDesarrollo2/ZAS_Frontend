// app/shared-rides/index.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { getAvailableRides, SharedRide } from '../../apis/sharedRides';
import { useAuth } from '../../presentation/hooks/useAuth'; // 👈 importamos el hook de autenticación

const SharedRidesListScreen = () => {
  const [rides, setRides] = useState<SharedRide[]>([]);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const { user } = useAuth(); // 👈 obtenemos el usuario para saber su nivel
  const isDriver = user?.nivel === 2; // solo los conductores pueden publicar

  useEffect(() => {
    loadRides();
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const loadRides = async () => {
    try {
      const data = await getAvailableRides();
      setRides(data);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderRide = ({ item }: { item: SharedRide }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push({ pathname: '/shared-rides/[id]', params: { id: item.id } })
      }
      activeOpacity={0.8}
    >
      <View style={styles.routeRow}>
        <Feather name="circle" size={14} color="#00C9A7" />
        <Text style={styles.address}>{item.origin_address}</Text>
      </View>
      <View style={styles.dottedLine} />
      <View style={styles.routeRow}>
        <Feather name="map-pin" size={14} color="#FF6B6B" />
        <Text style={styles.address}>{item.destination_address}</Text>
      </View>

      <View style={styles.tagsRow}>
        <View style={styles.tag}>
          <Feather name="truck" size={12} color="#00C9A7" style={{ marginRight: 4 }} />
          <Text style={styles.tagText}>{item.vehicle_type}</Text>
        </View>
        <View style={styles.tag}>
          <Feather name="users" size={12} color="#00C9A7" style={{ marginRight: 4 }} />
          <Text style={styles.tagText}>{item.available_seats}/{item.total_seats}</Text>
        </View>
        {item.trunk_full && (
          <View style={styles.tag}>
            <Feather name="package" size={12} color="#FF9800" style={{ marginRight: 4 }} />
            <Text style={styles.tagText}>Lleno</Text>
          </View>
          
        )}
          {item.price != null && (
    <View style={styles.tag}>
      <Feather name="dollar-sign" size={12} color="#00C9A7" style={{ marginRight: 4 }} />
      <Text style={styles.tagText}>${Number(item.price).toFixed(2)}</Text>
    </View>
  )}
      </View>

      {item.departure_time && (
        <Text style={styles.timeText}>
          <Feather name="clock" size={12} color="#9CA3AF" style={{ marginRight: 4 }} />
          {new Date(item.departure_time).toLocaleString()}
        </Text>
      )}
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
        <View style={styles.header}>
          <Text style={styles.title}>Taxis disponibles</Text>
          <TouchableOpacity onPress={() => router.push('/my-reservations')}>
            <Text style={styles.myReservationsBtn}>Mis Reservas</Text>
          </TouchableOpacity>
        </View>

        {rides.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Feather name="navigation" size={48} color="#00C9A7" />
            </View>
            <Text style={styles.emptyTitle}>No hay viajes aún</Text>
            <Text style={styles.emptySub}>
              {isDriver
                ? 'Sé el primero en publicar uno o vuelve más tarde.'
                : 'Vuelve más tarde, pronto habrá viajes disponibles.'}
            </Text>
            {/* 👇 Solo mostramos el botón si es conductor */}
            {isDriver && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/driver/create-ride')}
              >
                <Feather name="plus-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.emptyButtonText}>Publicar viaje</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={rides}
            keyExtractor={(item) => item.id}
            renderItem={renderRide}
            contentContainerStyle={styles.list}
          />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  container: { flex: 1, paddingTop: 60 },
  centered: { flex: 1, backgroundColor: '#F0FDF9', justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937' },
  myReservationsBtn: { color: '#00C9A7', fontWeight: '600', fontSize: 16 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5F5F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  address: { color: '#1F2937', fontSize: 16, fontWeight: '500', marginLeft: 12, flex: 1 },
  dottedLine: { height: 20, borderLeftWidth: 2, borderColor: '#E5E7EB', marginLeft: 6, marginVertical: 4 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6FFFA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: { color: '#00C9A7', fontSize: 13, fontWeight: '600' },
  timeText: { color: '#6B7280', fontSize: 13, marginTop: 10 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: '#E6FFFA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: { color: '#1F2937', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: '#6B7280', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00C9A7',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    shadowColor: '#00C9A7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});

export default SharedRidesListScreen;