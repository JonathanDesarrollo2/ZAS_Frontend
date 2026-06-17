// app/driver/trip-detail.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Alert
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';             // ← NUEVA IMPORTACIÓN
import { apiClient } from '../../apis/Client';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCQQVLprlkXfH6sdrNv0VlVSkEN_2_M-eE';

interface TripDetail {
  id: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  pickup_address: string;
  dropoff_address: string;
  price: number;
  vehicle_type: string;
  passenger?: {
    username?: string;
    userlogin: string;
  };
}

const TripDetailScreen = () => {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    fetchTrip();
  }, [tripId]);

  const fetchTrip = async () => {
    try {
      const response = await apiClient<{ result: boolean; content: TripDetail }>(`/private/trips/${tripId}`);
      if (response.result) setTrip(response.content);
      else {
        Alert.alert('Error', 'Viaje no disponible');
        router.back();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  // NUEVO handleAccept con ubicación real
  const handleAccept = async () => {
    setAccepting(true);
    try {
      // 1. Pedir permiso de ubicación
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso de ubicación', 'Se necesita la ubicación para aceptar el viaje.');
        setAccepting(false);
        return;
      }

      // 2. Obtener la ubicación actual del conductor
      const location = await Location.getCurrentPositionAsync({});
      const driverLat = location.coords.latitude;
      const driverLng = location.coords.longitude;

      // 3. Enviar al backend junto con la aceptación
      const response = await apiClient<{ result: boolean }>(`/private/trips/${tripId}/accept`, {
        method: 'POST',
        body: JSON.stringify({ driverLat, driverLng }),
      });

      if (response.result) {
        router.replace({ pathname: '/driver/active-trip', params: { tripId } });
      } else {
        Alert.alert('Error', 'No se pudo aceptar el viaje');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setAccepting(false);
    }
  };

  // Mapa con ruta (sin cambios)
  const mapHTML = trip ? `
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
          const origin = { lat: ${trip.pickup_lat}, lng: ${trip.pickup_lng} };
          const destination = { lat: ${trip.dropoff_lat}, lng: ${trip.dropoff_lng} };
          map = new google.maps.Map(document.getElementById('map'), {
            zoom: 14,
            center: origin,
            disableDefaultUI: true,
            zoomControl: false
          });
          directionsService = new google.maps.DirectionsService();
          directionsRenderer = new google.maps.DirectionsRenderer({
            suppressMarkers: true,
            polylineOptions: { strokeColor: '#1E90FF', strokeWeight: 5 }
          });
          directionsRenderer.setMap(map);
          new google.maps.Marker({
            position: origin,
            map: map,
            icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
            title: 'Origen'
          });
          new google.maps.Marker({
            position: destination,
            map: map,
            icon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
            title: 'Destino'
          });
          directionsService.route({
            origin, destination, travelMode: 'DRIVING'
          }, function(response, status) {
            if (status === 'OK') directionsRenderer.setDirections(response);
          });
        }
      </script>
      <script async defer src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap"></script>
    </body>
    </html>
  ` : '';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C9A7" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: '#6B7280' }}>Viaje no disponible</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: '#00C9A7' }}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <WebView style={styles.map} source={{ html: mapHTML }} javaScriptEnabled />
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        <Text style={styles.title}>Detalle del viaje</Text>
        <Text style={styles.value}>👤 {trip.passenger?.username || trip.passenger?.userlogin}</Text>
        <Text style={styles.value}>📍 Origen: {trip.pickup_address}</Text>
        <Text style={styles.value}>🏁 Destino: {trip.dropoff_address}</Text>
        <Text style={styles.price}>💰 ${Number(trip.price).toFixed(2)}</Text>

        <TouchableOpacity
          style={[styles.acceptButton, accepting && { opacity: 0.7 }]}
          onPress={handleAccept}
          disabled={accepting}
          activeOpacity={0.8}
        >
          {accepting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="check-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.acceptButtonText}>Aceptar viaje</Text>
            </>
          )}
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
  value: { fontSize: 16, color: '#374151', marginBottom: 6 },
  price: { fontSize: 22, fontWeight: '700', color: '#00C9A7', marginTop: 8 },
  acceptButton: {
    backgroundColor: '#00C9A7', borderRadius: 16, height: 56, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', marginTop: 16,
    shadowColor: '#00C9A7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  acceptButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
});

export default TripDetailScreen;