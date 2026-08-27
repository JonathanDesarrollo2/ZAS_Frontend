// app/trip-waiting.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  AppState,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { connectSocket, getSocket } from './socket/socketClient';
import { apiClient } from '../apis/Client';

const TripWaitingScreen = () => {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [cancelling, setCancelling] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Refs para controlar intervalos y listeners
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    // Configurar socket y listeners
    setupSocketAndPolling();

    // Listener para AppState: cuando vuelve a primer plano, verificar viaje activo
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkActiveTrip();
        // También re-emitir join al socket por si se perdió
        const socket = getSocket();
        if (socket && socket.connected) {
          socket.emit('trip:join', tripId);
        }
      }
    });

    return () => {
      appStateSubscription.remove();
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      const socket = getSocket();
      if (socket) socket.off('trip:accepted');
    };
  }, [tripId]);

  const setupSocketAndPolling = async () => {
    try {
      const socket = await connectSocket();
      socketRef.current = socket;

      // Al conectar (o reconectar), unirse a la sala
      const joinTrip = () => {
        socket.emit('trip:join', tripId);
      };
      socket.on('connect', joinTrip);
      joinTrip(); // por si ya está conectado

      // Escuchar aceptación
      socket.on('trip:accepted', (data: any) => {
        console.log('🎉 Recibido trip:accepted', data);
        navigateToActiveTrip(data);
      });

      // Iniciar polling cada 5 segundos como respaldo
      pollIntervalRef.current = setInterval(() => {
        checkActiveTrip();
      }, 1000);
    } catch (error) {
      console.error('Error al conectar socket:', error);
      // Aun sin socket, iniciamos polling
      pollIntervalRef.current = setInterval(() => {
        checkActiveTrip();
      }, 1000);
    }
  };

  const checkActiveTrip = async () => {
    try {
      const res = await apiClient<{ result: boolean; content: any }>(
        '/private/trips/active'
      );
      if (res.result && res.content) {
        // Existe un viaje activo: redirigir a trip-active
        const trip = res.content;
        navigateToActiveTrip({
          driverId: trip.driver_id,
          driverName: trip.driver?.username || trip.driver?.userlogin || 'Conductor',
          vehicle: trip.vehicle_type || 'Moto',
        });
      }
    } catch (err) {
      // Silencioso
    }
  };

  const navigateToActiveTrip = (data: any) => {
    router.replace({
      pathname: '/trip-active',
      params: {
        tripId,
        driverId: data.driverId,
        driverName: data.driverName,
        vehicle: data.vehicle,
        driverLat: data.driverLocation?.lat || data.driverLat || 0,
        driverLng: data.driverLocation?.lng || data.driverLng || 0,
      },
    });
  };

  const handleCancel = async () => {
    setCancelling(true);
    router.back();
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