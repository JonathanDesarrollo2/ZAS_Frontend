// app/trip-active.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet,
  TextInput, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { connectSocket, getSocket } from './socket/socketClient';
import { apiClient } from '../apis/Client';
import { confirmTripPayment } from '../apis/trips';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCQQVLprlkXfH6sdrNv0VlVSkEN_2_M-eE';

// ---------- Toast (mismo de siempre) ----------
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
    tripId: string; driverId: string; driverName: string; vehicle: string; driverLat: string; driverLng: string;
  }>();

  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(
    driverLat ? { lat: Number(driverLat), lng: Number(driverLng) } : null
  );
  const [bankData, setBankData] = useState<any>(null);
  const [tripPayment, setTripPayment] = useState<any>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [reference, setReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [cedula, setCedula] = useState('');
  const [phone, setPhone] = useState('');
  const [sendingPayment, setSendingPayment] = useState(false);
  const [loadingBank, setLoadingBank] = useState(true);

  const [tripStatus, setTripStatus] = useState<string>('accepted');
  const [tripDestino, setTripDestino] = useState<{ lat: number; lng: number } | null>(null);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg); setToastType(type); setToastVisible(true);
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    fetchBankData();
    fetchTripData();
    setupSocket();
  }, [tripId]);

  const fetchBankData = async () => {
    try {
      const res = await apiClient<{ result: boolean; content: any }>(`/private/trips/${tripId}/driver-bank-account`);
      if (res.result) setBankData(res.content);
    } catch (e) {} finally { setLoadingBank(false); }
  };

  const fetchTripData = async () => {
    try {
      const res = await apiClient<{ result: boolean; content: any }>(`/private/trips/${tripId}`);
      if (res.result) {
        const trip = res.content;
        setTripPayment({
          payment_status: trip.payment_status,
          payment_reference: trip.payment_reference,
          payer_bank: trip.payer_bank,
          payer_cedula: trip.payer_cedula,
          payer_phone: trip.payer_phone,
        });
        if (trip.payment_status === 'paid' || trip.payment_status === 'verified') setShowPaymentForm(false);
        setTripStatus(trip.status || 'accepted');
        if (trip.dropoff_lat && trip.dropoff_lng) setTripDestino({ lat: trip.dropoff_lat, lng: trip.dropoff_lng });
      }
    } catch (e) {}
  };

  const setupSocket = async () => {
    try {
      const socket = await connectSocket();
      socket.emit('trip:join', tripId);
      socket.on('trip:tracking', (data: any) => {
        if (data.driverId === driverId) {
          setDriverLocation({ lat: data.lat, lng: data.lng });
          webViewRef.current?.injectJavaScript(`updateDriverPosition(${data.lat}, ${data.lng});`);
        }
      });
      socket.on('driverArrived', () => {
        showToast('¡El conductor ha llegado!', 'success');
        setTripStatus('arrived');
        fetchTripData(); // por si necesitamos actualizar destino
      });
      socket.on('tripStarted', () => {
        showToast('El viaje ha comenzado', 'success');
        setTripStatus('in_progress');
      });
      socket.on('tripCompleted', () => {
        showToast('Has llegado a tu destino', 'success');
        setTripStatus('completed');
      });
      socket.on('tripPaymentStatusChanged', (data: any) => {
        fetchTripData();
        showToast(data.status === 'verified' ? 'Pago verificado' : 'Pago rechazado', data.status === 'verified' ? 'success' : 'error');
      });
    } catch (e) { console.error('Socket error', e); }

    return () => {
      const socket = getSocket();
      if (socket) {
        socket.off('trip:tracking'); socket.off('driverArrived');
        socket.off('tripStarted'); socket.off('tripCompleted'); socket.off('tripPaymentStatusChanged');
      }
    };
  };

  const handleSendPayment = async () => {
    if (!reference.trim() || !bankName.trim() || !cedula.trim() || !phone.trim()) {
      Alert.alert('Campos requeridos', 'Completa todos los datos del pago');
      return;
    }
    setSendingPayment(true);
    try {
      await confirmTripPayment(tripId!, {
        payment_reference: reference.trim(), payer_bank: bankName.trim(),
        payer_cedula: cedula.trim(), payer_phone: phone.trim(),
      });
      Alert.alert('Pago enviado', 'El conductor revisará tu comprobante');
      fetchTripData();
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setSendingPayment(false); }
  };

  // Mapa: si está arrived o in_progress, muestra ruta al destino; si no, solo sigue al conductor
  const shouldShowDestination = (tripStatus === 'arrived' || tripStatus === 'in_progress') && tripDestino;
  const mapHTML = driverLocation ? `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>html, body, #map { height: 100%; margin: 0; padding: 0; }</style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        let map, driverMarker, directionsService, directionsRenderer;
        const destinationCoords = ${shouldShowDestination ? `{ lat: ${tripDestino!.lat}, lng: ${tripDestino!.lng} }` : 'null'};

        function initMap() {
          const driverPos = { lat: ${driverLocation.lat}, lng: ${driverLocation.lng} };
          map = new google.maps.Map(document.getElementById('map'), {
            zoom: 14,
            center: driverPos,
            disableDefaultUI: true,
            zoomControl: false
          });
          driverMarker = new google.maps.Marker({
            position: driverPos,
            map: map,
            icon: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
          });
          directionsService = new google.maps.DirectionsService();
          directionsRenderer = new google.maps.DirectionsRenderer({
            suppressMarkers: false,
            polylineOptions: { strokeColor: '#1E90FF', strokeWeight: 5 }
          });
          directionsRenderer.setMap(map);

          if (destinationCoords) {
            new google.maps.Marker({
              position: destinationCoords,
              map: map,
              icon: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
            });
            directionsService.route({
              origin: driverPos,
              destination: destinationCoords,
              travelMode: 'DRIVING'
            }, function(response, status) {
              if (status === 'OK') directionsRenderer.setDirections(response);
            });
          }
        }
        function updateDriverPosition(lat, lng) {
          const pos = { lat, lng };
          driverMarker.setPosition(pos);
          map.panTo(pos);
          if (destinationCoords) {
            directionsService.route({
              origin: pos,
              destination: destinationCoords,
              travelMode: 'DRIVING'
            }, function(response, status) {
              if (status === 'OK') directionsRenderer.setDirections(response);
            });
          }
        }
      </script>
      <script async defer src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap"></script>
    </body>
    </html>
  ` : '';

  return (
    <View style={styles.screen}>
      <Toast message={toastMsg} type={toastType} visible={toastVisible} onHide={() => setToastVisible(false)} />
      <WebView ref={webViewRef} style={styles.map} source={{ html: mapHTML }} javaScriptEnabled domStorageEnabled />
      <ScrollView style={styles.bottomSheet} contentContainerStyle={{ paddingBottom: 20 }}>
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Conductor */}
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

          {/* Botón Chat (arriba y accesible) */}
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => router.push({ pathname: '/chat', params: { tripId, chatWith: driverName || 'Conductor' } })}
          >
            <Feather name="message-circle" size={20} color="#fff" />
            <Text style={styles.chatButtonText}> Chat con {driverName || 'Conductor'}</Text>
          </TouchableOpacity>

          {/* Estado del viaje */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Estado</Text>
            {tripStatus === 'accepted' && <View style={styles.statusRow}><Feather name="clock" size={20} color="#FFA500" /><Text style={styles.statusText}>Esperando al conductor...</Text></View>}
            {tripStatus === 'arrived' && <View style={styles.statusRow}><Feather name="map-pin" size={20} color="#2196F3" /><Text style={styles.statusText}>¡Conductor ha llegado!</Text></View>}
            {tripStatus === 'in_progress' && <View style={styles.statusRow}><Feather name="navigation" size={20} color="#00C9A7" /><Text style={styles.statusText}>En camino a tu destino</Text></View>}
            {tripStatus === 'completed' && <View style={styles.statusRow}><Feather name="check-circle" size={20} color="#4CAF50" /><Text style={styles.statusText}>Viaje finalizado</Text></View>}
          </View>

          {/* Datos bancarios */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Datos para transferencia</Text>
            {loadingBank ? <ActivityIndicator size="small" color="#00C9A7" /> :
              bankData ? (
                <>
                  <View style={styles.bankRow}><Feather name="credit-card" size={16} color="#00C9A7" style={{ marginRight: 8 }} /><Text style={styles.bankLabel}>Banco:</Text><Text style={styles.bankValue}>{bankData.bankName}</Text></View>
                  <View style={styles.bankRow}><Feather name="user" size={16} color="#00C9A7" style={{ marginRight: 8 }} /><Text style={styles.bankLabel}>Cédula:</Text><Text style={styles.bankValue}>{bankData.cedula}</Text></View>
                  <View style={styles.bankRow}><Feather name="phone" size={16} color="#00C9A7" style={{ marginRight: 8 }} /><Text style={styles.bankLabel}>Teléfono:</Text><Text style={styles.bankValue}>{bankData.phone}</Text></View>
                </>
              ) : <Text style={styles.noBankText}>El conductor no ha registrado sus datos bancarios.</Text>
            }
          </View>

          {/* Pago */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Pago</Text>
            {!tripPayment || tripPayment.payment_status === 'pending' ? (
              !showPaymentForm ? (
                <TouchableOpacity style={styles.payButton} onPress={() => setShowPaymentForm(true)}>
                  <Feather name="credit-card" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.payButtonText}>Enviar comprobante</Text>
                </TouchableOpacity>
              ) : (
                <View>
                  <TextInput style={styles.input} placeholder="Referencia" value={reference} onChangeText={setReference} />
                  <TextInput style={styles.input} placeholder="Banco (ej: 0102)" value={bankName} onChangeText={setBankName} />
                  <TextInput style={styles.input} placeholder="Cédula" value={cedula} onChangeText={setCedula} />
                  <TextInput style={styles.input} placeholder="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                  <TouchableOpacity style={styles.payButton} onPress={handleSendPayment} disabled={sendingPayment}>
                    {sendingPayment ? <ActivityIndicator color="#fff" /> : <Text style={styles.payButtonText}>Enviar</Text>}
                  </TouchableOpacity>
                </View>
              )
            ) : (
              <View style={styles.paymentStatus}>
                <Feather name={tripPayment.payment_status === 'verified' ? 'check-circle' : 'clock'} size={24} color={tripPayment.payment_status === 'verified' ? '#4CAF50' : '#FFA500'} />
                <Text style={styles.statusText}>{tripPayment.payment_status === 'paid' ? 'Pendiente de verificación' : 'Verificado'}</Text>
                {tripPayment.payment_reference && <Text style={styles.refText}>Ref: {tripPayment.payment_reference}</Text>}
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  map: { height: 300 },
  bottomSheet: {
    flex: 1, backgroundColor: '#FFFFFF', borderTopLeftRadius: 30, borderTopRightRadius: 30,
    paddingHorizontal: 20, paddingTop: 20, marginTop: -30,
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
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  statusText: { fontSize: 16, marginLeft: 12, color: '#374151', fontWeight: '500' },
  chatButton: {
    backgroundColor: '#00C9A7', borderRadius: 12, paddingVertical: 12, marginBottom: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  chatButtonText: { color: '#fff', fontWeight: '600', fontSize: 16, marginLeft: 8 },
  bankRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bankLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginRight: 6 },
  bankValue: { fontSize: 14, color: '#1F2937', flex: 1 },
  noBankText: { color: '#9CA3AF', fontSize: 16, textAlign: 'center', marginTop: 8 },
  input: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB', fontSize: 16, color: '#111827' },
  payButton: {
    backgroundColor: '#00C9A7', borderRadius: 14, padding: 14, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  payButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  paymentStatus: { alignItems: 'center', paddingVertical: 10 },
  refText: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  toast: {
    position: 'absolute', top: 60, left: 20, right: 20, borderRadius: 20, padding: 18, zIndex: 1000,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 12,
  },
  toastContent: { flexDirection: 'row', alignItems: 'center' },
  toastText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', flex: 1 },
});

export default TripActiveScreen;