// app/trip-waiting.tsx
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { connectSocket, getSocket } from './socket/socketClient';

const TripWaitingScreen = () => {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [cancelling, setCancelling] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    const setupSocket = async () => {
      try {
        const socket = await connectSocket();
        console.log('Socket conectado, uniendo a trip:', tripId);
        socket.emit('trip:join', tripId);

        socket.on('trip:accepted', (data: any) => {
          console.log('🎉 Recibido trip:accepted', data);
          router.replace({
            pathname: '/trip-active',
            params: {
              tripId,
              driverId: data.driverId,
              driverName: data.driverName,
              vehicle: data.vehicle,
              driverLat: data.driverLocation?.lat || 0,
              driverLng: data.driverLocation?.lng || 0,
            },
          });
        });
      } catch (error) {
        console.error('Error al conectar socket:', error);
      }
    };

    setupSocket();

    return () => {
      const socket = getSocket();
      if (socket) {
        socket.off('trip:accepted');
      }
    };
  }, [tripId]);

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