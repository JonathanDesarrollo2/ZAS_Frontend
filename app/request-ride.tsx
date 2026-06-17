// app/request-ride.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Animated,
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, ActivityIndicator, Dimensions
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { createTrip } from '../apis/trips';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ---------- Toast ----------
const Toast = ({ message, type = 'error', visible, onHide }: { message: string; type?: 'error' | 'success'; visible: boolean; onHide: () => void }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-80)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, friction: 8, tension: 100, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      const t = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => onHide());
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [visible]);
  if (!visible) return null;
  const bgColor = type === 'error' ? '#FF6B6B' : '#00C9A7';
  return (
    <Animated.View style={[styles.toast, { backgroundColor: bgColor, opacity, transform: [{ translateY }] }]}>
      <View style={styles.toastContent}>
        <Feather name={type === 'error' ? 'alert-circle' : 'check-circle'} size={22} color="#fff" style={{ marginRight: 12 }} />
        <Text style={styles.toastText}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const VEHICLE_OPTIONS = [
  {
    id: 'moto',
    label: 'Moto',
    description: 'Rápido y económico',
    icon: 'crosshair',
    available: true,
    price: 2.50,
  },
  {
    id: 'auto',
    label: 'Auto',
    description: 'Próximamente',
    icon: 'truck',
    available: false,
    price: 0,
  },
] as const;

const GOOGLE_MAPS_API_KEY = 'AIzaSyCQQVLprlkXfH6sdrNv0VlVSkEN_2_M-eE';

const createMapHTML = (originLat: number, originLng: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Variables globales accesibles desde React Native
    window.selecting = false;
    let map, originMarker, destMarker, directionsService, directionsRenderer;

    function log(msg) {
      console.log('[Mapa] ' + msg);
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: msg }));
    }

    function enableSelection() {
      window.selecting = true;
      if (destMarker) destMarker.setMap(null);
      if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
      log('Modo selección activado (vía inyección JS).');
    }

    function disableSelection() {
      window.selecting = false;
      log('Modo selección desactivado (vía inyección JS).');
    }

    function initMap() {
      log('Inicializando mapa...');
      const origin = { lat: ${originLat}, lng: ${originLng} };
      map = new google.maps.Map(document.getElementById('map'), {
        zoom: 14,
        center: origin,
        disableDefaultUI: true,
        zoomControl: false,
        gestureHandling: 'greedy'
      });

      originMarker = new google.maps.Marker({
        position: origin,
        map: map,
        title: 'Origen',
        icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
      });

      directionsService = new google.maps.DirectionsService();
      directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#1E90FF',
          strokeWeight: 5
        }
      });
      directionsRenderer.setMap(map);

      map.addListener('click', function(e) {
        log('Tocaste el mapa. selecting=' + window.selecting);
        if (!window.selecting) {
          log('Modo selección desactivado. Ignorando toque.');
          return;
        }
        const dest = e.latLng;
        log('Nuevo destino seleccionado: ' + dest.lat() + ', ' + dest.lng());
        if (destMarker) destMarker.setMap(null);
        destMarker = new google.maps.Marker({
          position: dest,
          map: map,
          title: 'Destino',
          icon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
        });

        directionsService.route({
          origin: origin,
          destination: dest,
          travelMode: 'DRIVING'
        }, function(response, status) {
          if (status === 'OK') {
            directionsRenderer.setDirections(response);
            log('Ruta calculada correctamente.');
          } else {
            log('Error al calcular la ruta: ' + status);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              message: 'No se pudo calcular la ruta'
            }));
          }
        });

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'destinationSelected',
          lat: dest.lat(),
          lng: dest.lng()
        }));
        window.selecting = false;
        log('Modo selección desactivado automáticamente.');
      });

      log('Mapa inicializado correctamente.');
    }
  </script>
  <script async defer src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap"></script>
</body>
</html>
`;

const RequestRideScreen = () => {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('moto');
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [isSelectingDestination, setIsSelectingDestination] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg); setToastType(type); setToastVisible(true);
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast('Permiso de ubicación denegado');
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      setPickup('Ubicación actual');
      setLocationLoaded(true);
    })();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleSelectDestination = () => {
    setIsSelectingDestination(true);
    // Inyectamos JavaScript directamente para cambiar la variable global
    webViewRef.current?.injectJavaScript('enableSelection();');
    console.log('📱 Activando modo selección en el mapa (inyección JS)');
    showToast('Toca el mapa para seleccionar tu destino', 'success');
  };

  const handleCancelSelection = () => {
    setIsSelectingDestination(false);
    webViewRef.current?.injectJavaScript('disableSelection();');
    console.log('📱 Modo selección cancelado (inyección JS)');
  };

  const handleWebViewMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'destinationSelected') {
        console.log('📱 Destino seleccionado:', data);
        const { lat, lng } = data;
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
        );
        const json = await response.json();
        if (json.status === 'OK' && json.results[0]) {
          setDropoff(json.results[0].formatted_address);
          console.log('📱 Dirección obtenida:', json.results[0].formatted_address);
        } else {
          const fallback = `Coordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setDropoff(fallback);
          console.log('📱 Fallback de dirección:', fallback);
        }
        setIsSelectingDestination(false);
      } else if (data.type === 'error') {
        showToast(data.message, 'error');
      } else if (data.type === 'log') {
        console.log('[WebView] ' + data.message);
      }
    } catch (error) {
      console.warn('📱 Error al procesar mensaje del WebView', error);
    }
  };

  const estimatePrice = () => {
    if (!dropoff.trim()) return 0;
    return selectedVehicle === 'moto' ? 2.50 : 0;
  };

  const handleRequestRide = async () => {
    if (!pickup.trim() || !dropoff.trim()) {
      showToast('Completa la dirección de recogida y destino');
      return;
    }
    if (!currentLocation) {
      showToast('No se pudo obtener tu ubicación');
      return;
    }
    if (selectedVehicle !== 'moto') {
      showToast('Solo moto está disponible actualmente');
      return;
    }
    setLoading(true);
    try {
      const payload = {
          pickup_lat: 10.071866,   // ← valor fijo para la prueba
          pickup_lng: -66.869583,  // ← valor fijo para la prueba
          pickup_address: pickup.trim(),
          dropoff_lat: 0,
          dropoff_lng: 0,
          dropoff_address: dropoff.trim(),
          vehicle_type: selectedVehicle,
          trip_type: 'ride' as const,
          price: estimatePrice(),
        };
      const response = await createTrip(payload as any);
        if (response.result) {
          showToast('Viaje solicitado', 'success');
          const tripId = response.content?.id;
          setTimeout(() => router.push({
            pathname: '/trip-waiting',
            params: { tripId }
          }), 500);
        } else {
          showToast(response.error?.[0] || 'No se pudo solicitar el viaje');
        }
    } catch (err: any) {
      showToast(err.message || 'Error al solicitar viaje');
    } finally {
      setLoading(false);
    }
  };

  if (!locationLoaded) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00C9A7" />
        <Text style={{ marginTop: 16, color: '#6B7280' }}>Obteniendo ubicación...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Toast message={toastMsg} type={toastType} visible={toastVisible} onHide={() => setToastVisible(false)} />
      
      <WebView
        ref={webViewRef}
        style={styles.map}
        originWhitelist={['*']}
        source={{ html: createMapHTML(currentLocation!.latitude, currentLocation!.longitude) }}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleWebViewMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={[styles.map, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color="#00C9A7" />
          </View>
        )}
      />

      <Animated.View style={[styles.bottomSheet, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 20 }}>
          <Text style={styles.label}>Destino</Text>
          <TouchableOpacity
            style={[
              styles.inputRow,
              isSelectingDestination && { borderColor: '#00C9A7', borderWidth: 2 }
            ]}
            onPress={handleSelectDestination}
            activeOpacity={0.8}
          >
            <Feather name="map-pin" size={20} color={isSelectingDestination ? '#00C9A7' : '#9CA3AF'} style={{ marginRight: 12 }} />
            <Text style={[styles.input, !dropoff && { color: '#9CA3AF' }]}>
              {dropoff || 'Seleccionar destino'}
            </Text>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          {isSelectingDestination && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelSelection}>
              <Text style={styles.cancelButtonText}>Cancelar selección</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Elige tu vehículo</Text>
          <View style={styles.vehicleRow}>
            {VEHICLE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.vehicleCard,
                  selectedVehicle === opt.id && opt.available && styles.vehicleCardSelected,
                  !opt.available && styles.vehicleCardDisabled,
                ]}
                onPress={() => opt.available && setSelectedVehicle(opt.id)}
                disabled={!opt.available}
              >
                <Feather name={opt.icon} size={24} color={opt.available ? (selectedVehicle === opt.id ? '#FFFFFF' : '#00C9A7') : '#B0BEC5'} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={[styles.vehicleLabel, !opt.available && { color: '#B0BEC5' }]}>{opt.label}</Text>
                  <Text style={[styles.vehicleDesc, !opt.available && { color: '#B0BEC5' }]}>{opt.description}</Text>
                </View>
                {opt.available && <Text style={[styles.vehiclePrice, selectedVehicle === opt.id && { color: '#FFFFFF' }]}>${opt.price.toFixed(2)}</Text>}
                {!opt.available && <Text style={styles.vehicleComing}>Próximamente</Text>}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.priceEstimate}>
            <Feather name="dollar-sign" size={20} color="#374151" style={{ marginRight: 8 }} />
            <Text style={styles.priceText}>Precio estimado: ${estimatePrice().toFixed(2)}</Text>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={handleRequestRide}
            disabled={loading || selectedVehicle !== 'moto'}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Solicitar viaje</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  map: { flex: 1 },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 24,
    marginTop: -30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  label: { fontWeight: '600', color: '#374151', marginBottom: 10, marginTop: 16, fontSize: 15 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F7FA', borderRadius: 16,
    paddingHorizontal: 16, height: 52, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8,
  },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  cancelButton: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#FF5252',
  },
  cancelButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  vehicleRow: { marginBottom: 24 },
  vehicleCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  vehicleCardSelected: { backgroundColor: '#00C9A7', borderColor: '#00C9A7' },
  vehicleCardDisabled: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' },
  vehicleLabel: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  vehicleDesc: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  vehiclePrice: { fontSize: 16, fontWeight: '700', color: '#00C9A7' },
  vehicleComing: { fontSize: 12, fontWeight: '600', color: '#9E9E9E', backgroundColor: '#EEEEEE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  priceEstimate: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  priceText: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  button: {
    backgroundColor: '#00C9A7', borderRadius: 16, height: 56, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', shadowColor: '#00C9A7',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8, marginBottom: 20,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
  toast: {
    position: 'absolute', top: 60, left: 20, right: 20, borderRadius: 20, padding: 18, zIndex: 1000,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 12,
  },
  toastContent: { flexDirection: 'row', alignItems: 'center' },
  toastText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', flex: 1 },
});

export default RequestRideScreen;