// app/driver/active-trip.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Animated, Alert
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { apiClient } from '../../apis/Client';
import { connectSocket } from '../socket/socketClient';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCQQVLprlkXfH6sdrNv0VlVSkEN_2_M-eE';

interface TripData {
  id: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  dropoff_address: string;
  price: number;
  passenger?: {
    username?: string;
    userlogin: string;
  };
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
  }, [tripId]);

  // Enviar ubicación periódicamente al pasajero
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
      } catch (err) {
        // silenciar error de ubicación
      }
    }, 5000);
  };
  startSendingLocation();
  return () => {
    if (interval) clearInterval(interval);
  };
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
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso de ubicación', 'Se necesita acceso a la ubicación para mostrar el mapa.');
      return;
    }
    let location = await Location.getCurrentPositionAsync({});
    setDriverLoc({
      lat: location.coords.latitude,
      lng: location.coords.longitude,
    });
  };

  const mapHTML = trip && driverLoc ? `
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
          const passengerPos = { lat: ${trip.pickup_lat}, lng: ${trip.pickup_lng} };
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
          new google.maps.Marker({ position: passengerPos, map, icon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png', title: 'Pasajero' });
          directionsService.route({
            origin: driverPos,
            destination: passengerPos,
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
  value: { fontSize: 16, color: '#374151', marginBottom: 6 },
  price: { fontSize: 22, fontWeight: '700', color: '#00C9A7', marginTop: 8 },
});

export default DriverActiveTripScreen;