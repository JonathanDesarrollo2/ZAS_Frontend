// app/trip-active.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet,
  TextInput, ActivityIndicator, ScrollView, Alert, Image,
  Modal, KeyboardAvoidingView, Platform, FlatList,
  BackHandler, AppState,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { connectSocket, getSocket } from './socket/socketClient';
import { apiClient } from '../apis/Client';
import { confirmTripPayment, completeTrip, cancelTrip } from '../apis/trips';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCQQVLprlkXfH6sdrNv0VlVSkEN_2_M-eE';

const BANKS = [
  { code: '0102', name: 'Banco de Venezuela' },
  { code: '0104', name: 'Venezolano de Crédito' },
  { code: '0105', name: 'Mercantil' },
  { code: '0108', name: 'Provincial' },
  { code: '0114', name: 'Bancaribe' },
  { code: '0115', name: 'Banco Exterior' },
  { code: '0116', name: 'Banco Nacional de Crédito (BNC - Antiguo BOD)' },
  { code: '0128', name: 'Banco Caroní' },
  { code: '0134', name: 'Banesco' },
  { code: '0137', name: 'Banco Sofitasa' },
  { code: '0138', name: 'Banco Plaza' },
  { code: '0146', name: 'Banco de la Gente Emprendedora (Bangente)' },
  { code: '0151', name: 'BFC Banco Fondo Común' },
  { code: '0156', name: '100% Banco' },
  { code: '0157', name: 'Banco Del Sur (DelSur)' },
  { code: '0163', name: 'Banco del Tesoro' },
  { code: '0166', name: 'Banco Agrícola de Venezuela' },
  { code: '0168', name: 'Bancrecer' },
  { code: '0169', name: 'Mi Banco' },
  { code: '0171', name: 'Banco Activo' },
  { code: '0172', name: 'Bancamiga' },
  { code: '0174', name: 'Banplus' },
  { code: '0175', name: 'Banco Digital de los Trabajadores (BDT / Antiguo Bicentenario)' },
  { code: '0177', name: 'Banco de la Fuerza Armada Nacional Bolivariana (BANFANB)' },
  { code: '0191', name: 'Banco Nacional de Crédito (BNC)' },
];

const Toast = ({ message, type = 'error', visible, onHide }: {
  message: string;
  type?: 'error' | 'success';
  visible: boolean;
  onHide: () => void;
}) => {
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

const locationPinIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="%2300C9A7" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`
)}`;

const TripActiveScreen = () => {
  const { tripId, driverId, driverName, vehicle, driverLat, driverLng } =
    useLocalSearchParams<{
      tripId: string;
      driverId: string;
      driverName: string;
      vehicle: string;
      driverLat: string;
      driverLng: string;
    }>();

  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(() => {
    if (driverLat && driverLng) {
      const lat = Number(driverLat);
      const lng = Number(driverLng);
      if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) return { lat, lng };
    }
    return null;
  });

  const [bankData, setBankData] = useState<any>(null);
  const [tripPayment, setTripPayment] = useState<any>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [reference, setReference] = useState('');
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [cedula, setCedula] = useState('');
  const [phone, setPhone] = useState('');
  const [sendingPayment, setSendingPayment] = useState(false);
  const [loadingBank, setLoadingBank] = useState(true);
  const [bankModalVisible, setBankModalVisible] = useState(false);

  const [tripStatus, setTripStatus] = useState<string>('accepted');
  const [tripDestino, setTripDestino] = useState<{ lat: number; lng: number } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');

  const [driverPublicInfo, setDriverPublicInfo] = useState<{
    profilePicUrl?: string | null;
    vehiclePhotos?: { photo1?: string | null; photo2?: string | null; photo3?: string | null } | null;
    vehicleDetails?: { marca_modelo?: string; color?: string; placa?: string; cilindrada?: number } | null;
  } | null>(null);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const webViewRef = useRef<WebView>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Polling para actualizar estado cada 5 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTripData();
    }, 5000);
    return () => clearInterval(interval);
  }, [tripId]);

  // Al volver a la app, refrescar estado
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchTripData();
      }
    });
    return () => subscription.remove();
  }, []);

  // Bloquear retroceso hasta finalizar
  useEffect(() => {
    const backAction = () => {
      if (tripStatus !== 'completed' && tripStatus !== 'cancelled') {
        Alert.alert('Viaje en curso', 'No puedes salir hasta que el viaje finalice.');
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [tripStatus]);

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
      const res = await apiClient<{ result: boolean; content: any }>(
        `/private/trips/${tripId}/driver-bank-account`
      );
      if (res.result) {
        setBankData(res.content);
      } else {
        setBankData(null);
      }
    } catch (err: any) {
      console.log('Error al cargar datos bancarios:', err.message);
      setBankData(null);
    } finally {
      setLoadingBank(false);
    }
  };

  const fetchTripData = async () => {
    try {
      const res = await apiClient<{ result: boolean; content: any }>(
        `/private/trips/${tripId}`
      );
      if (res.result) {
        const trip = res.content;
        setTripPayment({
          payment_status: trip.payment_status,
          payment_reference: trip.payment_reference,
          payer_bank: trip.payer_bank,
          payer_cedula: trip.payer_cedula,
          payer_phone: trip.payer_phone,
        });
        if (trip.payment_method) {
          setPaymentMethod(trip.payment_method);
        }
        if (trip.payment_status === 'paid' || trip.payment_status === 'verified') {
          setShowPaymentForm(false);
        }
        setTripStatus(trip.status || 'accepted');
        if (trip.dropoff_lat && trip.dropoff_lng) {
          setTripDestino({ lat: trip.dropoff_lat, lng: trip.dropoff_lng });
        }

        let publicInfoObtained = false;

        if (trip.driverPublicInfoUrl) {
          try {
            const publicRes = await apiClient<{ result: boolean; content: any }>(
              trip.driverPublicInfoUrl
            );
            if (publicRes.result && publicRes.content) {
              const info = publicRes.content;
              setDriverPublicInfo({
                profilePicUrl: info.profilePicUrl || null,
                vehiclePhotos: info.vehiclePhotos || null,
                vehicleDetails: info.vehicleDetails || null,
              });
              publicInfoObtained = true;
            }
          } catch (err) {
            // Silencioso
          }
        }

        if (!publicInfoObtained && driverId) {
          try {
            const publicRes = await apiClient<{ result: boolean; content: any }>(
              `/private/driver-public/${driverId}`
            );
            if (publicRes.result && publicRes.content) {
              const info = publicRes.content;
              setDriverPublicInfo({
                profilePicUrl: info.profilePicUrl || null,
                vehiclePhotos: info.vehiclePhotos || null,
                vehicleDetails: info.vehicleDetails || null,
              });
            }
          } catch (err) {
            // Silencioso
          }
        }
      }
    } catch (err) {
      // Silencioso
    }
  };

  const setupSocket = async () => {
    try {
      const socket = await connectSocket();
      socket.emit('trip:join', tripId);

      socket.on('trip:tracking', (data: any) => {
        if (data.driverId === driverId || data.tripId === tripId) {
          if (data.lat && data.lng) {
            setDriverLocation({ lat: data.lat, lng: data.lng });
            webViewRef.current?.injectJavaScript(`
              updateDriverPosition(${data.lat}, ${data.lng});
            `);
          }
        }
      });

      socket.on('driverArrived', () => {
        showToast('¡El conductor ha llegado!', 'success');
        setTripStatus('arrived');
        fetchBankData();
      });

      socket.on('tripStarted', () => {
        showToast('El viaje ha comenzado', 'success');
        setTripStatus('in_progress');
        fetchTripData();
      });

      socket.on('tripDestinationReached', (data: any) => {
        showToast('El conductor ha llegado al destino. Confirma tu llegada.', 'success');
        setTripStatus('arrived_destination');
      });

      socket.on('tripCompleted', () => {
        showToast('Has llegado a tu destino', 'success');
        setTripStatus('completed');
      });

      socket.on('tripPaymentStatusChanged', (data: any) => {
        fetchTripData();
        if (data.status === 'verified') {
          showToast('El conductor ha verificado tu pago', 'success');
        } else if (data.status === 'rejected') {
          showToast('El conductor ha rechazado tu pago', 'error');
        }
      });

      socket.on('tripCancelled', (data: any) => {
        showToast('Viaje cancelado', 'error');
        setTripStatus('cancelled');
        setTimeout(() => router.replace('/dashboard'), 800);
      });

    } catch (error) {
      console.error('Error al conectar socket:', error);
    }

    return () => {
      const socket = getSocket();
      if (socket) {
        socket.off('trip:tracking');
        socket.off('driverArrived');
        socket.off('tripStarted');
        socket.off('tripDestinationReached');
        socket.off('tripCompleted');
        socket.off('tripPaymentStatusChanged');
        socket.off('tripCancelled');
      }
    };
  };

  const handleSendPayment = async () => {
    if (!reference.trim() || !selectedBankCode || !cedula.trim() || !phone.trim()) {
      Alert.alert('Campos requeridos', 'Completa todos los datos del pago');
      return;
    }
    setSendingPayment(true);
    try {
      await confirmTripPayment(tripId!, {
        payment_reference: reference.trim(),
        payer_bank: selectedBankCode,
        payer_cedula: cedula.trim(),
        payer_phone: phone.trim(),
      });
      Alert.alert('Pago enviado', 'El conductor revisará tu comprobante');
      fetchTripData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSendingPayment(false);
    }
  };

  const handleConfirmDestination = async () => {
    try {
      await completeTrip(tripId!);
      setTripStatus('completed');
      showToast('Viaje completado', 'success');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleCancelTrip = async () => {
    try {
      await cancelTrip(tripId!);
      router.replace('/dashboard');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const mapHTML = driverLocation
    ? `
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
        const destinationCoords = ${tripStatus === 'in_progress' && tripDestino ? `{ lat: ${tripDestino.lat}, lng: ${tripDestino.lng} }` : 'null'};

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
            icon: '${locationPinIcon}'
          });

          directionsService = new google.maps.DirectionsService();
          directionsRenderer = new google.maps.DirectionsRenderer({
            suppressMarkers: false,
            polylineOptions: { strokeColor: '#00C9A7', strokeWeight: 5 }
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
  `
    : '';

  const photos = driverPublicInfo?.vehiclePhotos;
  const selectedBankName = BANKS.find(b => b.code === selectedBankCode)?.name || 'Selecciona tu banco';

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 300 : 0}
    >
      <Toast message={toastMsg} type={toastType} visible={toastVisible} onHide={() => setToastVisible(false)} />
      {driverLocation ? (
        <WebView
          ref={webViewRef}
          style={styles.map}
          source={{ html: mapHTML }}
          javaScriptEnabled
          domStorageEnabled
        />
      ) : (
        <View style={[styles.map, styles.mapLoading]}>
          <ActivityIndicator size="large" color="#00C9A7" />
          <Text>Esperando ubicación del conductor...</Text>
        </View>
      )}
      <ScrollView
        style={styles.bottomSheet}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Datos del conductor */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Conductor</Text>
            <View style={styles.row}>
              {driverPublicInfo?.profilePicUrl ? (
                <TouchableOpacity onPress={() => setSelectedImage(driverPublicInfo.profilePicUrl!)}>
                  <Image source={{ uri: driverPublicInfo.profilePicUrl }} style={styles.profilePic} />
                </TouchableOpacity>
              ) : (
                <Feather name="user" size={20} color="#00C9A7" />
              )}
              <Text style={styles.infoText}>{driverName || 'Conductor'}</Text>
            </View>

            {driverPublicInfo?.vehicleDetails && (
              <>
                <View style={styles.row}>
                  <Feather name="credit-card" size={20} color="#00C9A7" />
                  <Text style={styles.infoText}>Placa: {driverPublicInfo.vehicleDetails.placa}</Text>
                </View>
                <View style={styles.row}>
                  <Feather name="tool" size={20} color="#00C9A7" />
                  <Text style={styles.infoText}>Marca: {driverPublicInfo.vehicleDetails.marca_modelo}</Text>
                </View>
                <View style={styles.row}>
                  <Feather name="droplet" size={20} color="#00C9A7" />
                  <Text style={styles.infoText}>Color: {driverPublicInfo.vehicleDetails.color}</Text>
                </View>
                {driverPublicInfo.vehicleDetails.cilindrada && (
                  <View style={styles.row}>
                    <Feather name="settings" size={20} color="#00C9A7" />
                    <Text style={styles.infoText}>Cilindrada: {driverPublicInfo.vehicleDetails.cilindrada} cc</Text>
                  </View>
                )}
              </>
            )}

            {photos && (
              <View style={styles.vehiclePhotosContainer}>
                {photos.photo1 && (
                  <TouchableOpacity onPress={() => setSelectedImage(photos.photo1!)}>
                    <Image source={{ uri: photos.photo1 }} style={styles.vehiclePhoto} />
                  </TouchableOpacity>
                )}
                {photos.photo2 && (
                  <TouchableOpacity onPress={() => setSelectedImage(photos.photo2!)}>
                    <Image source={{ uri: photos.photo2 }} style={styles.vehiclePhoto} />
                  </TouchableOpacity>
                )}
                {photos.photo3 && (
                  <TouchableOpacity onPress={() => setSelectedImage(photos.photo3!)}>
                    <Image source={{ uri: photos.photo3 }} style={styles.vehiclePhoto} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => router.push({ pathname: '/chat', params: { tripId, chatWith: driverName || 'Conductor' } })}
          >
            <Feather name="message-circle" size={20} color="#fff" />
            <Text style={styles.chatButtonText}> Chat</Text>
          </TouchableOpacity>

          {/* Estado del viaje */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Estado del viaje</Text>
            {tripStatus === 'accepted' && (
              <View style={styles.statusRow}>
                <Feather name="clock" size={20} color="#FFA500" />
                <Text style={styles.statusText}>Esperando al conductor...</Text>
              </View>
            )}
            {tripStatus === 'arrived' && (
              <View style={styles.statusRow}>
                <Feather name="map-pin" size={20} color="#2196F3" />
                <Text style={styles.statusText}>El conductor ha llegado a tu ubicación</Text>
              </View>
            )}
            {tripStatus === 'in_progress' && (
              <View style={styles.statusRow}>
                <Feather name="navigation" size={20} color="#00C9A7" />
                <Text style={styles.statusText}>En camino a tu destino</Text>
              </View>
            )}
            {tripStatus === 'arrived_destination' && (
              <>
                <View style={styles.statusRow}>
                  <Feather name="flag" size={20} color="#4CAF50" />
                  <Text style={styles.statusText}>El conductor ha llegado al destino</Text>
                </View>
                <TouchableOpacity
                  style={[styles.payButton, { backgroundColor: '#4CAF50' }]}
                  onPress={handleConfirmDestination}
                >
                  <Feather name="check-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.payButtonText}>Confirmar destino</Text>
                </TouchableOpacity>
              </>
            )}
            {tripStatus === 'completed' && (
              <>
                <View style={styles.statusRow}>
                  <Feather name="check-circle" size={20} color="#4CAF50" />
                  <Text style={styles.statusText}>Viaje finalizado</Text>
                </View>
                <TouchableOpacity
                  style={[styles.payButton, { backgroundColor: '#6B7280' }]}
                  onPress={() => router.replace('/dashboard')}
                >
                  <Feather name="home" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.payButtonText}>Volver al inicio</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Datos bancarios solo si no es app */}
          {paymentMethod !== 'app' && (
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
                    <Text style={styles.bankLabel}>Cédula:</Text>
                    <Text style={styles.bankValue}>{bankData.cedula}</Text>
                  </View>
                  <View style={styles.bankRow}>
                    <Feather name="phone" size={16} color="#00C9A7" style={{ marginRight: 8 }} />
                    <Text style={styles.bankLabel}>Teléfono:</Text>
                    <Text style={styles.bankValue}>{bankData.phone}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.noBankText}>El conductor no ha registrado sus datos bancarios.</Text>
              )}
            </View>
          )}

          {/* Sección de pago */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Pago</Text>
            {paymentMethod === 'app' ? (
              <View style={styles.paymentStatus}>
                <Feather name="smartphone" size={24} color="#00C9A7" />
                <Text style={styles.statusText}>
                  El pago se realizará automáticamente al finalizar el viaje
                </Text>
              </View>
            ) : (
              <>
                {!tripPayment || tripPayment.payment_status === 'pending' ? (
                  !showPaymentForm ? (
                    <TouchableOpacity style={styles.payButton} onPress={() => setShowPaymentForm(true)}>
                      <Feather name="credit-card" size={20} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.payButtonText}>Enviar comprobante de pago</Text>
                    </TouchableOpacity>
                  ) : (
                    <View>
                      <TextInput
                        style={styles.input}
                        placeholder="Referencia del pago"
                        value={reference}
                        onChangeText={setReference}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        style={styles.bankSelector}
                        onPress={() => setBankModalVisible(true)}
                      >
                        <Text style={[styles.bankSelectorText, !selectedBankCode && { color: '#9CA3AF' }]}>
                          {selectedBankName}
                        </Text>
                        <Feather name="chevron-down" size={20} color="#9CA3AF" />
                      </TouchableOpacity>
                      <TextInput
                        style={styles.input}
                        placeholder="Cédula"
                        value={cedula}
                        onChangeText={setCedula}
                        keyboardType="number-pad"
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Teléfono"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                      />
                      <TouchableOpacity
                        style={styles.payButton}
                        onPress={handleSendPayment}
                        disabled={sendingPayment}
                      >
                        {sendingPayment ? <ActivityIndicator color="#fff" /> : <Text style={styles.payButtonText}>Enviar</Text>}
                      </TouchableOpacity>
                    </View>
                  )
                ) : (
                  <View style={styles.paymentStatus}>
                    <Feather name={tripPayment.payment_status === 'verified' ? 'check-circle' : 'clock'} size={24} color={tripPayment.payment_status === 'verified' ? '#4CAF50' : '#FFA500'} />
                    <Text style={styles.statusText}>
                      {tripPayment.payment_status === 'paid' ? 'Pendiente de verificación' : 'Verificado'}
                    </Text>
                    {tripPayment.payment_reference && (
                      <Text style={styles.refText}>Ref: {tripPayment.payment_reference}</Text>
                    )}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Botón cancelar viaje (con margen inferior amplio) */}
          {['accepted'].includes(tripStatus) && (
            <TouchableOpacity
              style={[styles.payButton, { backgroundColor: '#FF5252', marginTop: 10, marginBottom: 20 }]}
              onPress={handleCancelTrip}
            >
              <Feather name="x-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.payButtonText}>Cancelar viaje</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </ScrollView>

      <Modal
        visible={bankModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBankModalVisible(false)}
      >
        <View style={styles.modalOverlayBank}>
          <View style={styles.modalBankContainer}>
            <View style={styles.modalBankHeader}>
              <Text style={styles.modalBankTitle}>Selecciona tu banco</Text>
              <TouchableOpacity onPress={() => setBankModalVisible(false)}>
                <Feather name="x" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={BANKS}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.bankItem}
                  onPress={() => {
                    setSelectedBankCode(item.code);
                    setBankModalVisible(false);
                  }}
                >
                  <Text style={styles.bankItemText}>{item.name} ({item.code})</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={selectedImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity
            style={styles.imageModalClose}
            onPress={() => setSelectedImage(null)}
          >
            <Feather name="x" size={28} color="#fff" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.imageModalFull}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  map: { height: 300 },
  mapLoading: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#E5E7EB' },
  profilePic: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  vehiclePhotosContainer: { flexDirection: 'row', marginTop: 10, gap: 8 },
  vehiclePhoto: { width: 80, height: 80, borderRadius: 8 },
  bottomSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 20,
    marginTop: -30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  card: {
    backgroundColor: '#F5F7FA',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  infoText: { fontSize: 16, marginLeft: 12, color: '#374151' },
  statusRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  statusText: { fontSize: 16, marginLeft: 12, color: '#374151', fontWeight: '500' },
  bankRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bankLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginRight: 6 },
  bankValue: { fontSize: 14, color: '#1F2937', flex: 1 },
  noBankText: { color: '#9CA3AF', fontSize: 16, textAlign: 'center', marginTop: 8 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 16,
    color: '#111827',
  },
  bankSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bankSelectorText: { flex: 1, fontSize: 16, color: '#111827' },
  payButton: {
    backgroundColor: '#00C9A7',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  payButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  paymentStatus: { alignItems: 'center', paddingVertical: 10 },
  refText: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  chatButton: {
    backgroundColor: '#00C9A7',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  chatButtonText: { color: '#fff', fontWeight: '600', fontSize: 16, marginLeft: 8 },
  toast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    borderRadius: 20,
    padding: 18,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  toastContent: { flexDirection: 'row', alignItems: 'center' },
  toastText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', flex: 1 },
  modalOverlayBank: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBankContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalBankHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalBankTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  bankItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  bankItemText: { fontSize: 16, color: '#1F2937' },
  imageModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  imageModalFull: {
    width: '100%',
    height: '100%',
  },
});

export default TripActiveScreen;