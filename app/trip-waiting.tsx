// app/trip-waiting.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet, AppState, BackHandler, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { connectSocket, getSocket } from './socket/socketClient';
import { apiClient } from '../apis/Client';
import { cancelTrip } from '../apis/trips';

const TripWaitingScreen = () => {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [cancelling, setCancelling] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    setupSocketAndPolling();

    // ✅ Cancelar viaje si el pasajero retrocede o cierra la app
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        'Cancelar viaje',
        '¿Deseas cancelar la búsqueda?',
        [
          { text: 'Permanecer', style: 'cancel' },
          { text: 'Cancelar viaje', onPress: async () => {
              setCancelling(true);
              try {
                await cancelTrip(tripId!);
                router.replace('/dashboard');
              } catch (err) {
                Alert.alert('Error', 'No se pudo cancelar el viaje');
                setCancelling(false);
              }
            }
          },
        ]
      );
      return true;
    });

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Opcional: cancelar automáticamente si se va a segundo plano
        // cancelTrip(tripId!).catch(() => {});
      }
      if (nextAppState === 'active') {
        checkActiveTrip();
        const socket = getSocket();
        if (socket && socket.connected) {
          socket.emit('trip:join', tripId);
        }
      }
    });

    return () => {
      backHandler.remove();
      appStateSubscription.remove();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      const socket = getSocket();
      if (socket) socket.off('trip:accepted');
    };
  }, [tripId]);

  const setupSocketAndPolling = async () => {
    try {
      const socket = await connectSocket();
      const joinTrip = () => socket.emit('trip:join', tripId);
      socket.on('connect', joinTrip);
      joinTrip();

      socket.on('trip:accepted', (data: any) => {
        navigateToActiveTrip(data);
      });

      pollIntervalRef.current = setInterval(() => {
        checkActiveTrip();
      }, 1500);
    } catch (error) {
      console.error('Error al conectar socket:', error);
      pollIntervalRef.current = setInterval(() => {
        checkActiveTrip();
      }, 1500);
    }
  };

  const checkActiveTrip = async () => {
    try {
      const res = await apiClient<{ result: boolean; content: any }>(
        '/private/trips/active'
      );
      if (res.result && res.content) {
        const trip = res.content;
        if (trip.status === 'accepted' || trip.status === 'arrived' || trip.status === 'in_progress' || trip.status === 'arrived_destination') {
          navigateToActiveTrip({
            driver: {
              id: trip.driver_id,
              name: trip.driver?.username || trip.driver?.userlogin || 'Conductor',
              vehicle: trip.vehicle_type || 'Moto',
              location: {
                lat: trip.driver?.current_lat || 0,
                lng: trip.driver?.current_lng || 0,
              },
              publicInfoUrl: `/api/private/driver-public/${trip.driver_id}`,
            },
          });
        }
      }
    } catch (err) {
      // Silencioso
    }
  };

  const navigateToActiveTrip = (data: any) => {
    const driverInfo = data.driver || {};
    router.replace({
      pathname: '/trip-active',
      params: {
        tripId,
        driverId: driverInfo.id || data.driverId,
        driverName: driverInfo.name || data.driverName,
        vehicle: driverInfo.vehicle || data.vehicle,
        driverLat: driverInfo.location?.lat ?? data.driverLocation?.lat ?? 0,
        driverLng: driverInfo.location?.lng ?? data.driverLocation?.lng ?? 0,
      },
    });
  };

  const handleCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await cancelTrip(tripId!);
      router.replace('/dashboard');
    } catch (err) {
      Alert.alert('Error', 'No se pudo cancelar el viaje');
      setCancelling(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Feather name="loader" size={48} color="#00C9A7" />
        </Animated.View>
        <Text style={styles.title}>Buscando mototaxi</Text>
        <Text style={styles.subtitle}>Espera a que un conductor acepte tu viaje...</Text>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={cancelling}>
          <Feather name="x-circle" size={20} color="#FF6B6B" style={{ marginRight: 8 }} />
          <Text style={styles.cancelText}>Cancelar viaje</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9', justifyContent: 'center', alignItems: 'center' },
  container: { alignItems: 'center', paddingHorizontal: 30 },
  title: { fontSize: 24, fontWeight: '700', color: '#1F2937', marginTop: 24 },
  subtitle: { fontSize: 16, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  cancelButton: {
    flexDirection: 'row', alignItems: 'center', marginTop: 40, backgroundColor: '#FFE5E5',
    paddingVertical: 12, paddingHorizontal: 24, borderRadius: 16,
  },
  cancelText: { color: '#FF6B6B', fontWeight: '600', fontSize: 16 },
});

export default TripWaitingScreen;