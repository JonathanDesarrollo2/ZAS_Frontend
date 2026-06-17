// app/trip-active.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet, TextInput, ActivityIndicator, ScrollView
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { connectSocket, getSocket } from './socket/socketClient';
import { apiClient } from '../apis/Client';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCQQVLprlkXfH6sdrNv0VlVSkEN_2_M-eE';

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

const TripActiveScreen = () => {
  const { tripId, driverId, driverName, vehicle, driverLat, driverLng } = useLocalSearchParams<{
    tripId: string;
    driverId: string;
    driverName: string;
    vehicle: string;
    driverLat: string;
    driverLng: string;
  }>();

  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(
    driverLat ? { lat: Number(driverLat), lng: Number(driverLng) } : null
  );
  const [bankData, setBankData] = useState<any>(null);
  const [reference, setReference] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [loadingBank, setLoadingBank] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const webViewRef = useRef<WebView>(null);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg); setToastType(type); setToastVisible(true);
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    const setupSocket = async () => {
      const socket = await connectSocket();
      socket.emit('trip:join', tripId);

      socket.on('trip:tracking', (data: { lat: number; lng: number; driverId: string }) => {
        if (data.driverId === driverId) {
          setDriverLocation({ lat: data.lat, lng: data.lng });
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(`
              updateDriverPosition(${data.lat}, ${data.lng});
            `);
          }
        }
      });

      socket.on('driver:arriving', () => {
        showToast('¡El conductor está cerca!', 'success');
      });
    };

    setupSocket();
    fetchBankData();

    return () => {
      const socket = getSocket();
      if (socket) {
        socket.off('trip:tracking');
        socket.off('driver:arriving');
      }
    };
  }, [tripId, driverId]);

  const fetchBankData = async () => {
    try {
      const res = await apiClient<{ result: boolean; content: any }>(`/private/trips/${tripId}/driver-bank-account`);
      if (res.result) setBankData(res.content);
      else console.log('No se encontraron datos bancarios');
    } catch (err: any) {
      console.log('Error al cargar datos bancarios:', err.message);
    } finally {
      setLoadingBank(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!reference.trim()) {
      showToast('Debes ingresar el número de referencia del pago');
      return;
    }
    setConfirming(true);
    try {
      // Aquí se puede implementar la confirmación con el backend en el futuro
      showToast('Pago confirmado exitosamente', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error al confirmar el pago');
    } finally {
      setConfirming(false);
    }
  };

  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>html, body, #map { height: 100%; margin: 0; padding: 0; }</style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        let map, driverMarker;
        const initialPos = { lat: ${driverLocation?.lat || 10.071866}, lng: ${driverLocation?.lng || -66.869583} };
        function initMap() {
          map = new google.maps.Map(document.getElementById('map'), {
            zoom: 15,
            center: initialPos,
            disableDefaultUI: true,
            zoomControl: false
          });
          driverMarker = new google.maps.Marker({
            position: initialPos,
            map: map,
            icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
          });
        }
        function updateDriverPosition(lat, lng) {
          const pos = { lat, lng };
          if (driverMarker) driverMarker.setPosition(pos);
          else driverMarker = new google.maps.Marker({ position: pos, map: map, icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' });
          map.panTo(pos);
        }
      </script>
      <script async defer src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap"></script>
    </body>
    </html>
  `;

  return (
    <View style={styles.screen}>
      <Toast message={toastMsg} type={toastType} visible={toastVisible} onHide={() => setToastVisible(false)} />
      <WebView
        ref={webViewRef}
        style={styles.map}
        source={{ html: mapHTML }}
        javaScriptEnabled
        domStorageEnabled
      />
      <ScrollView style={styles.bottomSheet} contentContainerStyle={{ paddingBottom: 20 }}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Conductor</Text>
            <View style={styles.row}>
              <Feather name="user" size={20} color="#00C9A7" />
              <Text style={styles.infoText}>{driverName || 'Conductor'}</Text>
            </View>
            <View style={styles.row}>
              <Feather name="truck" size={20} color="#00C9A7" />
              <Text style={styles.infoText}>{vehicle || 'Moto'}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Datos para transferencia</Text>
            {loadingBank ? (
              <ActivityIndicator size="small" color="#00C9A7" />
            ) : bankData ? (
              <>
                <View style={styles.bankRow}>
                  <Feather name="credit-card" size={16} color="#00C9A7" style={{ marginRight: 8 }} />
                  <Text style={styles.bankLabel}>Banco:</Text>
                  <Text style={styles.bankValue}>{bankData.bankName}</Text>
                </View>
                <View style={styles.bankRow}>
                  <Feather name="user" size={16} color="#00C9A7" style={{ marginRight: 8 }} />
                  <Text style={styles.bankLabel}>Titular:</Text>
                  <Text style={styles.bankValue}>{bankData.cedula}</Text>
                </View>
                <View style={styles.bankRow}>
                  <Feather name="phone" size={16} color="#00C9A7" style={{ marginRight: 8 }} />
                  <Text style={styles.bankLabel}>Teléfono:</Text>
                  <Text style={styles.bankValue}>{bankData.phone}</Text>
                </View>

                <Text style={styles.referenceLabel}>Número de referencia del pago</Text>
                <View style={styles.inputRow}>
                  <Feather name="hash" size={20} color="#00C9A7" style={{ marginRight: 12 }} />
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: 12345678"
                    value={reference}
                    onChangeText={setReference}
                    placeholderTextColor="#9ca3af"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.confirmButton, confirming && { opacity: 0.7 }]}
                  onPress={handleConfirmPayment}
                  disabled={confirming}
                  activeOpacity={0.8}
                >
                  {confirming ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Feather name="check-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.confirmButtonText}>Confirmar pago</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.noBankText}>El conductor no ha registrado sus datos bancarios.</Text>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  map: { height: 300 },
  bottomSheet: {
    flex: 1, backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingHorizontal: 20, paddingTop: 20,
    marginTop: -30,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 20, elevation: 10,
  },
  card: {
    backgroundColor: '#F5F7FA', borderRadius: 20, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoText: { fontSize: 16, marginLeft: 12, color: '#374151' },
  bankRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bankLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginRight: 6 },
  bankValue: { fontSize: 14, color: '#1F2937', flex: 1 },
  referenceLabel: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16,
    paddingHorizontal: 16, height: 52, borderWidth: 1, borderColor: '#E5E7EB',
  },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  confirmButton: {
    backgroundColor: '#00C9A7', borderRadius: 16, height: 52, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', marginTop: 16,
  },
  confirmButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  noBankText: { color: '#9CA3AF', fontSize: 16, textAlign: 'center', marginTop: 8 },
  toast: {
    position: 'absolute', top: 60, left: 20, right: 20, borderRadius: 20, padding: 18, zIndex: 1000,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 12,
  },
  toastContent: { flexDirection: 'row', alignItems: 'center' },
  toastText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', flex: 1 },
});

export default TripActiveScreen;