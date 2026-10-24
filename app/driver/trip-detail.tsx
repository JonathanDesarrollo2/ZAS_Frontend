// LEIDO
// app/driver/trip-detail.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { apiClient } from '../../apis/Client';
import { useAuth } from '../../presentation/store/AuthStore';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCQQVLprlkXfH6sdrNv0VlVSkEN_2_M-eE';

// Marcadores embebidos para que A/B carguen también en producción sin recursos externos.
const originPinIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path fill="#00A884" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/><text x="12" y="10.5" text-anchor="middle" font-size="3" font-family="Arial" font-weight="bold" fill="#00A884">A</text></svg>')}`;
const destinationPinIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path fill="#D99A00" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/><text x="12" y="10.5" text-anchor="middle" font-size="3" font-family="Arial" font-weight="bold" fill="#D99A00">B</text></svg>')}`;

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
  const { user } = useAuth();
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

  const handleAccept = async () => {
    setAccepting(true);
    try {
      let location = await Location.getLastKnownPositionAsync();
      if (!location) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permiso de ubicación', 'Se necesita la ubicación para aceptar el viaje.');
          setAccepting(false);
          return;
        }
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      const driverLat = location.coords.latitude;
      const driverLng = location.coords.longitude;

      const response = await apiClient<{ result: boolean }>(`/private/trips/${tripId}/accept`, {
        method: 'POST',
        body: JSON.stringify({ driverLat, driverLng }),
      });

      if (response.result) {
        router.replace({ pathname: '/driver/active-trip', params: { tripId } });
      } else {
        Alert.alert('Viaje no disponible', 'Otro conductor ya aceptó este viaje. La lista se actualizará al volver.');
        router.back();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setAccepting(false);
    }
  };

  const handleAcceptPress = () => {
    const hasProfilePhoto = [user?.profile_pic_url, user?.profile_pic]
      .some((photo) => typeof photo === 'string' && photo.trim().length > 0);
    if (!hasProfilePhoto) {
      Alert.alert(
        'Foto de perfil requerida',
        'Acción requerida: Necesitas subir una foto de perfil real para poder pedir o aceptar viajes.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Aceptar', onPress: () => router.push('/profile') },
        ],
      );
      return;
    }
    void handleAccept();
  };

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
             icon: '${originPinIcon}',
            title: 'Origen'
          });
          new google.maps.Marker({
            position: destination,
            map: map,
             icon: '${destinationPinIcon}',
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

  if (!trip) return null;

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
          onPress={handleAcceptPress}
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
