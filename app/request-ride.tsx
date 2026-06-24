import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Animated,
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, ActivityIndicator, Dimensions
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { createTrip, estimatePrice } from '../apis/trips';
import { useAuth } from '../presentation/hooks/useAuth';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  { id: 'moto', label: 'Moto', description: 'Rápido y económico', icon: 'crosshair', available: true },
  { id: 'auto', label: 'Auto', description: 'Próximamente', icon: 'truck', available: false },
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
    window.selecting = false;
    let map, originMarker, destMarker, directionsService, directionsRenderer;

    function log(msg) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: msg }));
    }

    function enableSelection() {
      window.selecting = true;
      if (destMarker) destMarker.setMap(null);
      if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
      log('Modo selección activado');
    }

    function disableSelection() {
      window.selecting = false;
      log('Modo selección desactivado');
    }

    function initMap() {
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
        map,
        icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
      });
      directionsService = new google.maps.DirectionsService();
      directionsRenderer = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#1E90FF', strokeWeight: 5 }
      });
      directionsRenderer.setMap(map);

      map.addListener('click', function(e) {
        if (!window.selecting) return;
        const dest = e.latLng;
        if (destMarker) destMarker.setMap(null);
        destMarker = new google.maps.Marker({
          position: dest,
          map,
          icon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
        });
        directionsService.route({
          origin: origin,
          destination: dest,
          travelMode: 'DRIVING'
        }, function(response, status) {
          if (status === 'OK') directionsRenderer.setDirections(response);
          else window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: 'No se pudo calcular la ruta' }));
        });
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'destinationSelected',
          lat: dest.lat(),
          lng: dest.lng()
        }));
        window.selecting = false;
      });
    }
  </script>
  <script async defer src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap"></script>
</body>
</html>
`;

const RequestRideScreen = () => {
  const { user } = useAuth();
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('moto');
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [isSelectingDestination, setIsSelectingDestination] = useState(false);
  const [destCoords, setDestCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'app'>('cash');

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg); setToastType(type); setToastVisible(true);
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const webViewRef = useRef<WebView>(null);

  const balance = user?.balance || 0;
  const canPayWithApp = balance >= (estimatedPrice || 0);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast('Permiso de ubicación denegado');
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
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
    webViewRef.current?.injectJavaScript('enableSelection();');
    showToast('Toca el mapa para seleccionar tu destino', 'success');
  };

  const handleCancelSelection = () => {
    setIsSelectingDestination(false);
    webViewRef.current?.injectJavaScript('disableSelection();');
  };

  const handleWebViewMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'destinationSelected') {
        const { lat, lng } = data;
        setDestCoords({ latitude: lat, longitude: lng });
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`
        );
        const json = await response.json();
        if (json.status === 'OK' && json.results[0]) {
          setDropoff(json.results[0].formatted_address);
        } else {
          setDropoff(`Coordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }
        if (currentLocation) {
          try {
            const price = await estimatePrice(currentLocation.latitude, currentLocation.longitude, lat, lng);
            setEstimatedPrice(price);
            setPriceError(null);
          } catch (err: any) {
            setPriceError(err.message || 'Error al estimar precio');
            setEstimatedPrice(null);
          }
        }
        setIsSelectingDestination(false);
      } else if (data.type === 'error') {
        showToast(data.message, 'error');
      }
    } catch (error) { console.warn(error); }
  };

  const handleRequestRide = async () => {
    if (!pickup.trim() || !dropoff.trim()) { showToast('Completa origen y destino'); return; }
    if (!currentLocation) { showToast('No se pudo obtener tu ubicación'); return; }
    if (!destCoords) { showToast('Selecciona destino en el mapa'); return; }
    if (selectedVehicle !== 'moto') { showToast('Solo moto disponible'); return; }
    if (paymentMethod === 'app' && !canPayWithApp) { showToast('Saldo insuficiente para pagar con la app'); return; }
    setLoading(true);
    try {
      const payload = {
        pickup_lat: currentLocation.latitude,
        pickup_lng: currentLocation.longitude,
        pickup_address: pickup.trim(),
        dropoff_lat: destCoords.latitude,
        dropoff_lng: destCoords.longitude,
        dropoff_address: dropoff.trim(),
        vehicle_type: selectedVehicle,
        trip_type: 'ride' as const,
        price: estimatedPrice ?? undefined,
        payment_method: paymentMethod,
      };
      const response = await createTrip(payload as any);
      if (response.result) {
        showToast('Viaje solicitado', 'success');
        const tripId = response.content?.id;
        setTimeout(() => router.push({ pathname: '/trip-waiting', params: { tripId } }), 500);
      } else {
        showToast(response.error?.[0] || 'No se pudo solicitar el viaje');
      }
    } catch (err: any) {
      showToast(err.message || 'Error al solicitar viaje');
    } finally { setLoading(false); }
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
        javaScriptEnabled domStorageEnabled
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
            style={[styles.inputRow, isSelectingDestination && { borderColor: '#00C9A7', borderWidth: 2 }]}
            onPress={handleSelectDestination}
            activeOpacity={0.8}
          >
            <Feather name="map-pin" size={20} color={isSelectingDestination ? '#00C9A7' : '#9CA3AF'} style={{ marginRight: 12 }} />
            <Text style={[styles.input, !dropoff && { color: '#9CA3AF' }]}>{dropoff || 'Seleccionar destino'}</Text>
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
                {!opt.available && <Text style={styles.vehicleComing}>Próximamente</Text>}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.priceEstimate}>
            <Feather name="dollar-sign" size={20} color="#374151" style={{ marginRight: 8 }} />
            {priceError ? (
              <Text style={styles.priceError}>{priceError}</Text>
            ) : (
              <Text style={styles.priceText}>
                Precio estimado: {estimatedPrice ? `$${estimatedPrice.toFixed(2)}` : 'Calculando...'}
              </Text>
            )}
          </View>

          <View style={styles.balanceRow}>
            <Feather name="dollar-sign" size={18} color="#00C9A7" style={{ marginRight: 8 }} />
            <Text style={styles.balanceText}>Saldo: ${balance.toFixed(2)}</Text>
          </View>

          <Text style={styles.label}>Método de pago</Text>
          <View style={styles.paymentRow}>
            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'cash' && styles.paymentOptionSelected]}
              onPress={() => setPaymentMethod('cash')}
            >
              <Feather name="dollar-sign" size={20} color={paymentMethod === 'cash' ? '#fff' : '#00C9A7'} />
              <Text style={[styles.paymentText, paymentMethod === 'cash' && { color: '#fff' }]}>Efectivo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.paymentOption, paymentMethod === 'app' && styles.paymentOptionSelected, !canPayWithApp && styles.paymentOptionDisabled]}
              onPress={() => setPaymentMethod('app')}
              disabled={!canPayWithApp}
            >
              <Feather name="smartphone" size={20} color={paymentMethod === 'app' ? '#fff' : canPayWithApp ? '#00C9A7' : '#ccc'} />
              <Text style={[styles.paymentText, paymentMethod === 'app' && { color: '#fff' }, !canPayWithApp && { color: '#ccc' }]}>App</Text>
            </TouchableOpacity>
          </View>
          {!canPayWithApp && paymentMethod === 'app' && (
            <Text style={styles.errorText}>Saldo insuficiente para pagar con la app</Text>
          )}

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={handleRequestRide}
            disabled={loading || selectedVehicle !== 'moto'}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
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
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingHorizontal: 24, paddingTop: 24,
    marginTop: -30,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 10,
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  label: { fontWeight: '600', color: '#374151', marginBottom: 10, marginTop: 16, fontSize: 15 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F7FA', borderRadius: 16,
    paddingHorizontal: 16, height: 52, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8,
  },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  cancelButton: {
    alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 12,
    marginBottom: 12, borderRadius: 8, backgroundColor: '#FF5252',
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
  vehicleComing: { fontSize: 12, fontWeight: '600', color: '#9E9E9E', backgroundColor: '#EEEEEE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  priceEstimate: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  priceText: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  priceError: { fontSize: 16, color: '#FF5252', fontWeight: '600' },
  balanceRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12,
    marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB',
  },
  balanceText: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  paymentRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  paymentOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#E5E7EB', gap: 8,
  },
  paymentOptionSelected: { backgroundColor: '#00C9A7', borderColor: '#00C9A7' },
  paymentOptionDisabled: { opacity: 0.5 },
  paymentText: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  errorText: { color: '#EF4444', fontSize: 14, marginTop: -12, marginBottom: 12, marginLeft: 4 },
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