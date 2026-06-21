// app/driver/active-trip.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Animated, Alert, TouchableOpacity
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, router } from 'expo-router';
import * as Location from 'expo-location';
import { apiClient } from '../../apis/Client';
import { connectSocket } from '../socket/socketClient';
import { verifyTripPayment, markArrived, startTrip, completeTrip } from '../../apis/trips';
import { Feather } from '@expo/vector-icons';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCQQVLprlkXfH6sdrNv0VlVSkEN_2_M-eE';

interface TripData {
  id: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string;
  price: number;
  status: string;
  passenger?: { username?: string; userlogin: string };
  payment_status?: string;
  payment_reference?: string;
  payer_bank?: string;
  payer_cedula?: string;
  payer_phone?: string;
}

const DriverActiveTripScreen = () => {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [trip, setTrip] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    fetchTripDetails();
    getDriverLocation();
    listenPaymentUpdates();
  }, [tripId]);

  // Enviar ubicación periódicamente
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    const startSendingLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      interval = setInterval(async () => {
        try {
          const location = await Location.getCurrentPositionAsync({});
          const socket = await connectSocket();
          socket.emit('driver:location', {
            tripId,
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          });
        } catch (err) {}
      }, 5000);
    };
    startSendingLocation();
    return () => clearInterval(interval);
  }, [tripId]);

  const fetchTripDetails = async () => {
    try {
      const response = await apiClient<{ result: boolean; content: TripData }>(`/private/trips/${tripId}`);
      if (response.result) setTrip(response.content);
      else Alert.alert('Error', 'No se pudo cargar el viaje');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const getDriverLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const location = await Location.getCurrentPositionAsync({});
    setDriverLoc({ lat: location.coords.latitude, lng: location.coords.longitude });
  };

  const listenPaymentUpdates = async () => {
    try {
      const socket = await connectSocket();
      socket.on('tripPaymentUpdated', () => fetchTripDetails());
    } catch (err) {}
  };

  const handleVerifyPayment = async (action: 'verify' | 'reject') => {
    try {
      await verifyTripPayment(tripId!, action);
      fetchTripDetails();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleArrive = async () => {
    try {
      await markArrived(tripId!);
      Alert.alert('Aviso', 'Se ha notificado al pasajero que has llegado');
      fetchTripDetails();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleStartTrip = async () => {
    try {
      await startTrip(tripId!);
      fetchTripDetails();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleCompleteTrip = async () => {
    Alert.alert('Finalizar viaje', '¿Has llegado al destino?', [
      { text: 'No' },
      { text: 'Sí', onPress: async () => {
        try {
          await completeTrip(tripId!);
          Alert.alert('Viaje completado', 'Has llegado al destino');
          fetchTripDetails();
        } catch (err: any) {
          Alert.alert('Error', err.message);
        }
      }},
    ]);
  };

  // Determinar el destino según el estado
  const destinationCoords = trip && driverLoc
    ? (trip.status === 'accepted'
        ? { lat: trip.pickup_lat, lng: trip.pickup_lng, title: 'Pasajero' }
        : { lat: trip.dropoff_lat, lng: trip.dropoff_lng, title: 'Destino' })
    : null;

  const mapHTML = trip && driverLoc && destinationCoords ? `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>html, body, #map { height: 100%; margin: 0; padding: 0; }</style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        let map, directionsService, directionsRenderer;
        function initMap() {
          const driverPos = { lat: ${driverLoc.lat}, lng: ${driverLoc.lng} };
          const destPos = { lat: ${destinationCoords.lat}, lng: ${destinationCoords.lng} };
          map = new google.maps.Map(document.getElementById('map'), {
            zoom: 14,
            center: driverPos,
            disableDefaultUI: true,
            zoomControl: false
          });
          directionsService = new google.maps.DirectionsService();
          directionsRenderer = new google.maps.DirectionsRenderer({
            suppressMarkers: true,
            polylineOptions: { strokeColor: '#1E90FF', strokeWeight: 5 }
          });
          directionsRenderer.setMap(map);
          new google.maps.Marker({ position: driverPos, map, icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png', title: 'Tú' });
          new google.maps.Marker({ position: destPos, map, icon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png', title: '${destinationCoords.title}' });
          directionsService.route({
            origin: driverPos,
            destination: destPos,
            travelMode: 'DRIVING'
          }, function(response, status) {
            if (status === 'OK') directionsRenderer.setDirections(response);
          });
        }
      </script>
      <script async defer src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap"></script>
    </body>
    </html>
  ` : '';

  if (loading || !driverLoc) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C9A7" />
      </View>
    );
  }

  if (!trip) return null;

  return (
    <View style={styles.screen}>
      <WebView style={styles.map} source={{ html: mapHTML }} javaScriptEnabled />
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        <Text style={styles.title}>Datos del pasajero</Text>
        <Text style={styles.value}>👤 {trip.passenger?.username || trip.passenger?.userlogin}</Text>
        <Text style={styles.value}>📍 Origen: {trip.pickup_address}</Text>
        <Text style={styles.value}>🏁 Destino: {trip.dropoff_address}</Text>
        <Text style={styles.price}>💰 ${Number(trip.price).toFixed(2)}</Text>

        {/* Pago */}
        {trip.payment_status === 'paid' && (
          <View style={styles.paymentSection}>
            <Text style={styles.subtitle}>Comprobante de pago</Text>
            <Text style={styles.value}>🏦 Banco: {trip.payer_bank}</Text>
            <Text style={styles.value}>🆔 Cédula: {trip.payer_cedula}</Text>
            <Text style={styles.value}>📞 Teléfono: {trip.payer_phone}</Text>
            <Text style={styles.value}>🔢 Ref: {trip.payment_reference}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 }}>
              <TouchableOpacity style={styles.verifyBtn} onPress={() => handleVerifyPayment('verify')}>
                <Feather name="check" size={18} color="#fff" />
                <Text style={styles.btnText}> Verificar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectBtn} onPress={() => handleVerifyPayment('reject')}>
                <Feather name="x" size={18} color="#fff" />
                <Text style={styles.btnText}> Rechazar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {trip.payment_status === 'verified' && (
          <View style={styles.verifiedBadge}>
            <Feather name="check-circle" size={20} color="#4CAF50" />
            <Text style={{ marginLeft: 8, color: '#4CAF50', fontWeight: '600' }}>Pago verificado</Text>
          </View>
        )}
        {trip.payment_status === 'pending' && (
          <Text style={styles.waiting}>⏳ Esperando comprobante de pago...</Text>
        )}

        {/* Botones según estado */}
        {trip.status === 'accepted' && (
          <TouchableOpacity style={styles.arriveBtn} onPress={handleArrive}>
            <Feather name="map-pin" size={18} color="#fff" />
            <Text style={styles.btnText}> He llegado</Text>
          </TouchableOpacity>
        )}
        {trip.status === 'arrived' && (
          <TouchableOpacity style={styles.startBtn} onPress={handleStartTrip}>
            <Feather name="user-check" size={18} color="#fff" />
            <Text style={styles.btnText}> Pasajero a bordo</Text>
          </TouchableOpacity>
        )}
        {trip.status === 'in_progress' && (
          <TouchableOpacity style={styles.completeBtn} onPress={handleCompleteTrip}>
            <Feather name="flag" size={18} color="#fff" />
            <Text style={styles.btnText}> Viaje completado</Text>
          </TouchableOpacity>
        )}
        {trip.status === 'completed' && (
          <Text style={styles.completedText}>✅ Viaje finalizado</Text>
        )}

        {/* Chat SIEMPRE visible */}
        <TouchableOpacity style={styles.chatButton} onPress={() => router.push({ pathname: '/chat', params: { tripId } })}>
          <Feather name="message-circle" size={20} color="#fff" />
          <Text style={styles.chatButtonText}> Chat</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  card: {
    backgroundColor: '#FFFFFF', margin: 20, padding: 20, borderRadius: 20,
    borderWidth: 1, borderColor: '#E5F5F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  subtitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginTop: 12, marginBottom: 8 },
  value: { fontSize: 16, color: '#374151', marginBottom: 6 },
  price: { fontSize: 22, fontWeight: '700', color: '#00C9A7', marginTop: 8 },
  paymentSection: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginTop: 15 },
  verifyBtn: {
    backgroundColor: '#4CAF50', borderRadius: 8, padding: 10, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: '#FF5252', borderRadius: 8, padding: 10, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { color: '#FFFFFF', fontWeight: '600', marginLeft: 4 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  waiting: { marginTop: 10, color: '#888' },
  arriveBtn: {
    backgroundColor: '#FF9800', borderRadius: 10, padding: 12, marginTop: 15,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  startBtn: {
    backgroundColor: '#2196F3', borderRadius: 10, padding: 12, marginTop: 15,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  completeBtn: {
    backgroundColor: '#4CAF50', borderRadius: 10, padding: 12, marginTop: 15,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  completedText: { marginTop: 10, color: '#4CAF50', fontWeight: '600' },
  chatButton: {
    backgroundColor: '#00C9A7', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  chatButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});

export default DriverActiveTripScreen;