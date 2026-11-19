// app/trip-active.tsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet,
  TextInput, ActivityIndicator, ScrollView, Image,
  Modal, KeyboardAvoidingView, Platform, FlatList,
  AppState,
  Share,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { connectSocket, ensurePersistentTripNotification, clearPersistentTripNotification } from '../services/socketClient';
import { apiClient } from '../apis/Client';
import { confirmTripPayment, completeTrip, cancelTrip, reportPassengerLocation } from '../apis/trips';
import { getUnreadCount } from '../apis/chat';
import ToastNotification from '../presentation/components/shared/toastNotification';
import { useAuth } from '../presentation/store/AuthStore';
import { isChatOpen } from '../services/chatPresence';
import ReviewModal from '../components/ReviewModal';
import { startPassengerLocationTask, stopPassengerLocationTask } from '../services/passengerLocationTask';

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

const resolveBankDisplay = (value?: string | null): string => {
  if (!value) return 'No especificado';
  const found = BANKS.find((b) => b.code === value);
  return found ? `${found.name} (${found.code})` : value;
};

const locationPinIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path fill="%2300C9A7" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`
)}`;

const originPinIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path fill="#00A884" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/><text x="12" y="10.5" text-anchor="middle" font-size="3" font-family="Arial" font-weight="bold" fill="#00A884">A</text></svg>`
)}`;
const destinationPinIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path fill="#D99A00" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/><text x="12" y="10.5" text-anchor="middle" font-size="3" font-family="Arial" font-weight="bold" fill="#D99A00">B</text></svg>`
)}`;

const TripActiveScreen = () => {
  const { user } = useAuth();
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
  const [tripPrice, setTripPrice] = useState<number>(0);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [reference, setReference] = useState('');
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [cedula, setCedula] = useState('');
  const [phone, setPhone] = useState('');
  const [sendingPayment, setSendingPayment] = useState(false);
  const [loadingBank, setLoadingBank] = useState(true);
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);

  const [tripStatus, setTripStatus] = useState<string>('accepted');
  const [tripType, setTripType] = useState<'ride' | 'delivery'>('ride');
  const [tripLoaded, setTripLoaded] = useState(false);
  const [tripOrigen, setTripOrigen] = useState<{ lat: number; lng: number } | null>(null);
  const [tripDestino, setTripDestino] = useState<{ lat: number; lng: number } | null>(null);
  const [tripStops, setTripStops] = useState<{ lat: number; lng: number; address: string }[]>([]);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [revieweeDriverId, setRevieweeDriverId] = useState(driverId || '');
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  const [payingPartyId, setPayingPartyId] = useState<string | null>(null);
  const [marketplaceFreeShipping, setMarketplaceFreeShipping] = useState<boolean | null>(null);

  const lastFetchedDriverIdRef = useRef(driverId || '');

  const [realDriverName, setRealDriverName] = useState<string | null>(null);
  const [passengerLoc, setPassengerLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [packageDescription, setPackageDescription] = useState<string | null>(null);

  const [driverPublicInfo, setDriverPublicInfo] = useState<{
    profilePicUrl?: string | null;
    username?: string | null;
    userlogin?: string | null;
    usermail?: string | null;
    vehiclePhotos?: { photo1?: string | null; photo2?: string | null; photo3?: string | null } | null;
    vehicleDetails?: { marca_modelo?: string; color?: string; placa?: string; cilindrada?: number } | null;
  } | null>(null);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const [cancellingAndSearching, setCancellingAndSearching] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const lastMessageNoticeAt = useRef(0);
  const lastLocationErrorAt = useRef(0);
  const backgroundPermissionRequested = useRef(false);
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const webViewRef = useRef<WebView>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const activeStop = tripStatus === 'in_progress' && currentStopIndex < tripStops.length
    ? tripStops[currentStopIndex]
    : null;

  // ✅ FIX BUG #2: Back button con fallback al dashboard.
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/dashboard');
    }
  };

  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        const res = await apiClient<{ result: boolean; content: { rate: number } }>('/public/exchange-rate');
        if (res.result && res.content?.rate) {
          setExchangeRate(res.content.rate);
        }
      } catch (err) { /* Silencioso */ }
    };
    fetchExchangeRate();
  }, []);

  useEffect(() => {
    if (tripStatus === 'completed') setReviewModalVisible(true);
  }, [tripStatus]);

  useEffect(() => {
    let cancelled = false;
    let activeSocket: Awaited<ReturnType<typeof connectSocket>> | null = null;

    // ✅ FIX BUG #1: resetear el estado local cuando el conductor cancela,
    //    para que la UI vuelva a "Buscando conductor..." sin salir de la pantalla.
    const handleDriverCancelled = (data: { tripId?: string; message?: string }) => {
      if (String(data.tripId) !== String(tripId)) return;
      showToast(data.message || 'El conductor canceló. Buscando otro mototaxista.', 'error');
      lastFetchedDriverIdRef.current = '';
      setRevieweeDriverId('');
      setDriverPublicInfo(null);
      setRealDriverName(null);
      setBankData(null);
      setTripStatus('pending');
      fetchTripData();
    };

    const handleTracking = (data: any) => {
      if (data.driverId === driverId || data.tripId === tripId) {
        if (data.lat && data.lng) {
          setDriverLocation({ lat: data.lat, lng: data.lng });
          webViewRef.current?.injectJavaScript(`updateDriverPosition(${data.lat}, ${data.lng});`);
        }
      }
    };
    const handleDriverArrived = () => {
      showToast('¡El conductor ha llegado!', 'success');
      setTripStatus('arrived');
      fetchBankData();
    };
    const handleTripStarted = () => {
      showToast('El viaje ha comenzado', 'success');
      setTripStatus('in_progress');
      fetchTripData();
    };
    const handleDestinationReached = () => {
      showToast('El conductor ha llegado al destino. Confirma tu llegada.', 'success');
      setTripStatus('arrived_destination');
    };
    const handleTripCompleted = () => {
      showToast('Has llegado a tu destino', 'success');
      setTripStatus('completed');
    };
    const handlePaymentStatus = (data: any) => {
      fetchTripData();
      if (data.status === 'verified') showToast('El conductor ha verificado tu pago', 'success');
      if (data.status === 'rejected') showToast('El conductor ha rechazado tu pago', 'error');
    };
    const handleTripCancelled = (data?: { tripId?: string; by?: string; searchingAgain?: boolean }) => {
      if (data?.searchingAgain) {
        handleDriverCancelled({ tripId: data.tripId, message: 'El conductor canceló. Buscando otro mototaxista.' });
        return;
      }
      showToast('Viaje cancelado', 'error');
      setTripStatus('cancelled');
      setTimeout(() => router.replace('/dashboard'), 800);
    };
    const handleStopCompleted = (data: { tripId?: string; stopIndex?: number }) => {
      if (String(data.tripId) === String(tripId) && typeof data.stopIndex === 'number') {
        setCurrentStopIndex(data.stopIndex);
      }
    };
    let handleChatMessage: (message: { sender_id?: string; sender_name?: string }) => void = () => undefined;
    let handleChatRead: (data: { reader_id?: string }) => void = () => undefined;

    connectSocket().then((socket) => {
      if (cancelled) return;
      activeSocket = socket;
      socket.emit('trip:join', tripId);
      socket.on('trip:driver-cancelled', handleDriverCancelled);
      socket.on('trip:tracking', handleTracking);
      socket.on('driverArrived', handleDriverArrived);
      socket.on('tripStarted', handleTripStarted);
      socket.on('tripDestinationReached', handleDestinationReached);
      socket.on('tripCompleted', handleTripCompleted);
      socket.on('tripPaymentStatusChanged', handlePaymentStatus);
      socket.on('tripCancelled', handleTripCancelled);
      socket.on('trip:stop-completed', handleStopCompleted);
      handleChatMessage = (message: { sender_id?: string; sender_name?: string }) => {
        if (message.sender_id && String(message.sender_id) !== String(user?.id)) {
          setUnreadMessages((count) => count + 1);
          const now = Date.now();
          if (!isChatOpen() && now - lastMessageNoticeAt.current >= 10000) {
            lastMessageNoticeAt.current = now;
            showToast(`Tienes un mensaje nuevo de ${message.sender_name || 'tu conductor'}`, 'success');
          }
        }
      };
      handleChatRead = (data: { reader_id?: string }) => {
        if (String(data.reader_id) === String(user?.id)) setUnreadMessages(0);
      };
      socket.on('chat:message', handleChatMessage);
      socket.on('chat:read', handleChatRead);
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      if (activeSocket) {
        activeSocket.off('trip:driver-cancelled', handleDriverCancelled);
        activeSocket.off('trip:tracking', handleTracking);
        activeSocket.off('driverArrived', handleDriverArrived);
        activeSocket.off('tripStarted', handleTripStarted);
        activeSocket.off('tripDestinationReached', handleDestinationReached);
        activeSocket.off('tripCompleted', handleTripCompleted);
        activeSocket.off('tripPaymentStatusChanged', handlePaymentStatus);
        activeSocket.off('tripCancelled', handleTripCancelled);
        activeSocket.off('trip:stop-completed', handleStopCompleted);
        activeSocket.off('chat:message', handleChatMessage);
        activeSocket.off('chat:read', handleChatRead);
      }
    };
  }, [tripId, driverId]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchTripData();
    }, 5000);
    return () => clearInterval(interval);
  }, [tripId]);

  const sharingPassengerLocation = ['accepted', 'arrived', 'in_progress', 'arrived_destination', 'picked_up'].includes(tripStatus);

  useEffect(() => {
    if (!tripLoaded || !tripId) return;
    if (!sharingPassengerLocation) {
      void stopPassengerLocationTask(tripId).catch((error: unknown) => {
        console.error('No se pudo detener el rastreo del viaje:', error);
      });
      return;
    }

    let cancelled = false;
    let sending = false;
    let lastSentAt = 0;
    let subscription: Location.LocationSubscription | null = null;

    const sendLocation = async (lat: number, lng: number) => {
      const now = Date.now();
      if (cancelled || sending || now - lastSentAt < 9500) return;
      sending = true;
      lastSentAt = now;
      try {
        await reportPassengerLocation(tripId, lat, lng);
      } catch (error) {
        if (!cancelled && now - lastLocationErrorAt.current >= 30000) {
          lastLocationErrorAt.current = now;
          console.error('No se pudo actualizar la ubicación del pasajero:', error);
          showToast('No se pudo actualizar tu ubicación. Revisa tu conexión.');
        }
      } finally {
        sending = false;
      }
    };

    const startWatching = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          showToast('Permite el acceso a la ubicación para compartirla durante el viaje.');
          return;
        }

        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (cancelled) return;
        await sendLocation(current.coords.latitude, current.coords.longitude);

        const locationSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 0 },
          (location) => {
            void sendLocation(location.coords.latitude, location.coords.longitude);
          }
        );
        if (cancelled) {
          locationSubscription.remove();
        } else {
          subscription = locationSubscription;
        }

        if (cancelled || Platform.OS === 'web') return;
        try {
          let permission = await Location.getBackgroundPermissionsAsync();
          if (permission.status !== 'granted' && permission.canAskAgain && !backgroundPermissionRequested.current) {
            backgroundPermissionRequested.current = true;
            permission = await Location.requestBackgroundPermissionsAsync();
          }
          if (cancelled) return;
          if (permission.status === 'granted') {
            await startPassengerLocationTask(tripId);
          } else {
            showToast('Activa la ubicación en segundo plano para mantener actualizado al conductor al minimizar la app.');
          }
        } catch (error) {
          console.error('No se pudo activar la ubicación en segundo plano:', error);
          if (!cancelled) showToast('No se pudo activar el GPS en segundo plano; la ubicación se comparte mientras esta pantalla está abierta.');
        }
      } catch (error) {
        console.error('No se pudo iniciar el seguimiento de ubicación:', error);
        if (!cancelled) showToast('No se pudo iniciar el seguimiento de ubicación.');
      }
    };

    void startWatching();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [tripId, tripLoaded, sharingPassengerLocation, showToast]);

  useEffect(() => {
    let target: { lat: number; lng: number } | null = null;
    if (activeStop) {
      target = { lat: Number(activeStop.lat), lng: Number(activeStop.lng) };
    } else if (
      tripStatus === 'in_progress' ||
      tripStatus === 'arrived_destination' ||
      (tripType === 'delivery' && tripStatus === 'picked_up')
    ) {
      target = tripDestino;
    } else {
      target = tripOrigen;
    }
    if (target) {
      webViewRef.current?.injectJavaScript(
        `window.updateRouteTarget && window.updateRouteTarget(${target.lat}, ${target.lng}); true;`,
      );
    }
  }, [
    tripStatus, tripType,
    tripOrigen?.lat, tripOrigen?.lng,
    tripDestino?.lat, tripDestino?.lng,
    activeStop?.lat, activeStop?.lng,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') fetchTripData();
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    fetchBankData();
    fetchTripData();
    getUnreadCount(tripId!).then(setUnreadMessages).catch(() => undefined);
  }, [tripId]);

  useEffect(() => {
    if (revieweeDriverId && revieweeDriverId !== lastFetchedDriverIdRef.current) {
      lastFetchedDriverIdRef.current = revieweeDriverId;
      fetchBankData();
    }
  }, [revieweeDriverId]);

  const fetchBankData = async () => {
    try {
      const res = await apiClient<{ result: boolean; content: any }>(
        `/private/trips/${tripId}/driver-bank-account`
      );
      if (res.result) setBankData(res.content);
      else setBankData(null);
    } catch {
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

        const dbDriverName = trip.driver?.username || trip.driver?.userlogin;
        if (dbDriverName) {
          setRealDriverName(dbDriverName);
        }

        // ✅ FIX BUG #1: si no hay driver asignado (viaje re-buscando),
        //    limpiar los datos del conductor anterior.
        if (trip.driver_id) {
          setRevieweeDriverId(String(trip.driver_id));
        } else {
          lastFetchedDriverIdRef.current = '';
          setRevieweeDriverId('');
          setDriverPublicInfo(null);
          setRealDriverName(null);
          setBankData(null);
        }

        setTripLoaded(true);
        setPackageDescription(trip.package_description);
        setTripPrice(Number(trip.price) || 0);

        setPayingPartyId(trip.paying_party_id || null);
        setMarketplaceFreeShipping(
          trip.marketplace_order && typeof trip.marketplace_order.free_shipping === 'boolean'
            ? trip.marketplace_order.free_shipping
            : null
        );

        if (!['completed', 'cancelled'].includes(trip.status)) {
          const driverAssigned = ['accepted', 'arrived'].includes(trip.status);
          ensurePersistentTripNotification(
            tripId!,
            driverAssigned ? 'Conductor asignado' : 'Viaje en curso',
            driverAssigned
              ? `${dbDriverName || driverName || 'Un conductor'} aceptó tu viaje.`
              : `Conductor: ${dbDriverName || driverName || 'Conductor'}`
          ).catch(() => undefined);
        } else {
          clearPersistentTripNotification().catch(() => undefined);
        }

        setTripPayment({
          payment_status: trip.payment_status,
          payment_reference: trip.payment_reference,
          payer_bank: trip.payer_bank,
          payer_cedula: trip.payer_cedula,
          payer_phone: trip.payer_phone,
        });

        if (trip.payment_method) setPaymentMethod(trip.payment_method);
        if (trip.payment_status === 'paid' || trip.payment_status === 'verified') setShowPaymentForm(false);

        setTripStatus(trip.status || 'accepted');
        setTripType(trip.trip_type === 'delivery' ? 'delivery' : 'ride');

        if (trip.pickup_lat && trip.pickup_lng) {
          setTripOrigen({ lat: Number(trip.pickup_lat), lng: Number(trip.pickup_lng) });
        }
        if (trip.dropoff_lat && trip.dropoff_lng) {
          setTripDestino({ lat: Number(trip.dropoff_lat), lng: Number(trip.dropoff_lng) });
        }

        if (Array.isArray(trip.stops) && trip.stops.length > 0) {
          const newStops = trip.stops.map((s: any) => ({
            lat: Number(s.lat), lng: Number(s.lng), address: s.address || '',
          }));
          setTripStops((prev) => {
            if (prev.length === newStops.length &&
              prev.every((s, i) => s.lat === newStops[i].lat && s.lng === newStops[i].lng)) {
              return prev;
            }
            return newStops;
          });
        }

        const liveLat = Number(trip.live_passenger_lat);
        const liveLng = Number(trip.live_passenger_lng);
        if (trip.live_passenger_lat != null && trip.live_passenger_lng != null &&
          Number.isFinite(liveLat) && Number.isFinite(liveLng)) {
          setPassengerLoc((current) =>
            current?.lat === liveLat && current.lng === liveLng
              ? current
              : { lat: liveLat, lng: liveLng }
          );
        }

        let publicInfoObtained = false;
        if (trip.driverPublicInfoUrl) {
          try {
            const publicRes = await apiClient<{ result: boolean; content: any }>(trip.driverPublicInfoUrl);
            if (publicRes.result && publicRes.content) {
              const info = publicRes.content;
              setDriverPublicInfo({
                profilePicUrl: info.profilePicUrl || null,
                username: info.username || dbDriverName || null,
                userlogin: info.userlogin || null,
                usermail: info.usermail || null,
                vehiclePhotos: info.vehiclePhotos || null,
                vehicleDetails: info.vehicleDetails || null,
              });
              publicInfoObtained = true;
            }
          } catch (err) { /* Silencioso */ }
        }

        const tripDriverId = trip.driver_id ? String(trip.driver_id) : null;
        if (!publicInfoObtained && tripDriverId) {
          try {
            const publicRes = await apiClient<{ result: boolean; content: any }>(
              `/private/driver-public/${tripDriverId}`,
            );
            if (publicRes.result && publicRes.content) {
              const info = publicRes.content;
              setDriverPublicInfo({
                profilePicUrl: info.profilePicUrl || null,
                username: info.username || dbDriverName || null,
                userlogin: info.userlogin || null,
                usermail: info.usermail || null,
                vehiclePhotos: info.vehiclePhotos || null,
                vehicleDetails: info.vehicleDetails || null,
              });
            }
          } catch (err) { /* Silencioso */ }
        }
      }
    } catch (err) {
      // Silencioso
    }
  };

  const handleSendPayment = async () => {
    if (!reference.trim() || !selectedBankCode || !cedula.trim() || !phone.trim()) {
      showToast('Completa todos los datos del pago');
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
      showToast('El conductor revisará tu comprobante', 'success');
      fetchTripData();
    } catch (err: any) {
      showToast(err.message);
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
      showToast(err.message);
    }
  };

  const handleCancelTrip = async () => {
    try {
      await cancelTrip(tripId!);
      router.replace('/dashboard');
    } catch (err: any) {
      showToast(err.message);
    }
  };

const handleCancelAndReSearch = () => {
  Alert.alert(
    'Cancelar y buscar de nuevo',
    'Se cancelará este viaje y podrás solicitar uno nuevo. ¿Continuar?',
    [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, continuar',
        style: 'destructive',
        onPress: async () => {
          setCancellingAndSearching(true);
          try {
            // ✅ Fix: casteamos el response porque `cancelTrip` infiere `{}`.
            const response = (await cancelTrip(tripId!)) as
              | { result?: boolean; error?: string[] }
              | undefined;
            if (response && response.result === false) {
              throw new Error(response.error?.[0] || 'No se pudo cancelar el viaje');
            }
            showToast('Viaje cancelado. Redirigiendo para buscar de nuevo...', 'success');
            setTimeout(() => router.replace('/request-ride'), 600);
          } catch (err: any) {
            const msg: string = err?.message || '';
            if (/no se puede cancelar|estado actual|no permitida/i.test(msg)) {
              Alert.alert(
                'No se puede cancelar ahora',
                'El viaje está en un estado que no permite cancelación desde la app. Intenta de nuevo en unos segundos o contacta a soporte.',
              );
            } else {
              showToast(msg || 'No se pudo cancelar');
            }
          } finally {
            setCancellingAndSearching(false);
          }
        },
      },
    ],
  );
};

  const handleShareTrip = async () => {
    const start = driverLocation ?? tripOrigen;
    const destination = tripDestino ?? tripOrigen;
    const mapsUrl = start && destination
      ? `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`
      : 'https://maps.google.com';
    const plate = driverPublicInfo?.vehicleDetails?.placa;
    const vehicleDescription = [
      driverPublicInfo?.vehicleDetails?.marca_modelo || vehicle || 'Moto',
      plate ? `placa ${plate}` : null,
    ].filter(Boolean).join(', ');

    try {
      await Share.share({
        message: `¡Hola! Estoy en un viaje con ZAS. Mi conductor es ${realDriverName || driverName || 'Conductor'} en ${vehicleDescription}. Puedes consultar el trayecto en Google Maps: ${mapsUrl}`,
      });
    } catch {
      showToast('No se pudo abrir el menú para compartir.');
    }
  };

  const routeOrigin = driverLocation ?? tripOrigen ?? { lat: 0, lng: 0 };
  const routeDestination = activeStop
    ? { lat: activeStop.lat, lng: activeStop.lng }
    : tripStatus === 'in_progress' || tripStatus === 'arrived_destination' ||
      (tripType === 'delivery' && tripStatus === 'picked_up')
      ? (tripDestino ?? tripOrigen ?? routeOrigin)
      : (tripOrigen ?? tripDestino ?? routeOrigin);

  const mapHTML = useMemo(() => driverLocation || tripOrigen || tripDestino
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
        let map, driverMarker, pickupMarker, destinationMarker, directionsService;
        let activeRouteTarget = null;
        let routePath = [];
        let routePolyline = null;
        let trimIndex = 0;
        let lastRerouteAt = 0;
        let driverAnim = null;
        let routeViewportFitted = false;
        const driverStart = ${driverLocation ? `{ lat: ${driverLocation.lat}, lng: ${driverLocation.lng} }` : (tripOrigen ? `{ lat: ${tripOrigen.lat}, lng: ${tripOrigen.lng} }` : '{ lat: 0, lng: 0 }')};
        const pickupCoords = ${tripOrigen ? `{ lat: ${tripOrigen.lat}, lng: ${tripOrigen.lng} }` : 'null'};
        const destinationCoords = ${tripDestino ? `{ lat: ${tripDestino.lat}, lng: ${tripDestino.lng} }` : 'null'};
        const stopsData = ${JSON.stringify((tripStops || []).map((stop) => ({
          lat: Number(stop.lat),
          lng: Number(stop.lng),
          address: stop.address || '',
        })))};
        const activeStopIndex = ${currentStopIndex};

         function createMarker(position, icon, title) {
           return new google.maps.Marker({
             position, map,
             icon: { url: icon, anchor: new google.maps.Point(18, 36) },
             title,
           });
        }

        function distMeters(a, b) {
          const R = 6371000;
          const dLat = (b.lat - a.lat) * Math.PI / 180;
          const dLng = (b.lng - a.lng) * Math.PI / 180;
          const s = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180)
            * Math.sin(dLng / 2) * Math.sin(dLng / 2);
          return 2 * R * Math.asin(Math.sqrt(s));
        }

         function applyRoute(response, fitViewport) {
           const route = response.routes && response.routes[0];
           if (!route) return;
           const raw = route.overview_path || [];
           const pts = raw.getArray ? raw.getArray() : raw;
           routePath = pts.map(function(p) { return { lat: p.lat(), lng: p.lng() }; });
           trimIndex = 0;
           if (!routePolyline) {
             routePolyline = new google.maps.Polyline({
               strokeColor: '#00C9A7', strokeOpacity: 1, strokeWeight: 5, zIndex: 10,
             });
             routePolyline.setMap(map);
           }
           routePolyline.setPath(routePath);
           if (fitViewport && !routeViewportFitted && route.bounds) {
             map.fitBounds(route.bounds);
             routeViewportFitted = true;
           }
         }

         function requestRoute(origin, destination, fitViewport) {
          if (!directionsService || !origin || !destination) return;
          directionsService.route({
            origin, destination, travelMode: 'DRIVING'
          }, function(response, status) {
             if (status === 'OK') applyRoute(response, fitViewport);
          });
        }

        function trimRouteTo(pos) {
          if (!routePath.length) {
            if (activeRouteTarget && Date.now() - lastRerouteAt > 15000) {
              lastRerouteAt = Date.now();
              requestRoute(pos, activeRouteTarget, false);
            }
            return;
          }
          let best = trimIndex, bestDist = Infinity;
          for (let i = Math.max(0, trimIndex - 5); i < routePath.length; i++) {
            const d = distMeters(pos, routePath[i]);
            if (d < bestDist) { bestDist = d; best = i; }
          }
          if (best > trimIndex) trimIndex = best;
          routePolyline.setPath([pos].concat(routePath.slice(trimIndex + 1)));
          if (bestDist > 90 && Date.now() - lastRerouteAt > 40000) {
            lastRerouteAt = Date.now();
            requestRoute(pos, activeRouteTarget, false);
          }
        }

        function initMap() {
          const driverPos = driverStart;
          map = new google.maps.Map(document.getElementById('map'), {
            zoom: 14, center: driverPos, disableDefaultUI: true, zoomControl: false,
          });

          driverMarker = createMarker(driverPos, '${locationPinIcon}', 'Conductor');
          if (pickupCoords) {
             pickupMarker = createMarker(pickupCoords, '${originPinIcon}', 'Origen');
          }
          if (destinationCoords) {
             destinationMarker = createMarker(destinationCoords, '${destinationPinIcon}', 'Destino');
          }

          if (stopsData && stopsData.length > 0) {
            stopsData.forEach((stop, index) => {
              const stopNum = index + 1;
              const stopIconUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path fill="#7C3AED" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/><text x="12" y="10.5" text-anchor="middle" font-size="3" font-family="Arial" font-weight="bold" fill="#7C3AED">' + stopNum + '</text></svg>'
              );
              new google.maps.Marker({
                map: map,
                position: { lat: Number(stop.lat), lng: Number(stop.lng) },
                icon: { url: stopIconUrl, anchor: new google.maps.Point(18, 36) },
                title: 'Parada ' + stopNum + (stop.address ? ': ' + stop.address : '')
              });
            });
          }

          directionsService = new google.maps.DirectionsService();

          const activeStopCoords = (stopsData && stopsData.length > activeStopIndex)
            ? { lat: Number(stopsData[activeStopIndex].lat), lng: Number(stopsData[activeStopIndex].lng) }
            : null;
          const isInProgress = ${tripStatus === 'in_progress'};
          const isDestinationPhase = ${tripStatus === 'in_progress' || tripStatus === 'arrived_destination' || (tripType === 'delivery' && tripStatus === 'picked_up')};

          let routeTarget;
          if (isInProgress && activeStopCoords) routeTarget = activeStopCoords;
          else if (isDestinationPhase) routeTarget = destinationCoords || pickupCoords;
          else routeTarget = pickupCoords || destinationCoords;

          if (routeTarget) {
             requestRoute(driverPos, routeTarget, true);
             activeRouteTarget = routeTarget;
          }
        }

         let lastAcceptedPos = null, lastAcceptedAt = 0, discardedCount = 0;

         function updateDriverPosition(lat, lng) {
          if (!driverMarker) return;
           const to = { lat, lng };
           const nowMs = Date.now();
           if (lastAcceptedPos && discardedCount < 3
               && distMeters(lastAcceptedPos, to) > 50 * ((nowMs - lastAcceptedAt) / 1000)) {
             discardedCount++;
             return;
           }
           discardedCount = 0;
           lastAcceptedPos = to;
           lastAcceptedAt = nowMs;
           const from = driverMarker.getPosition();
           if (driverAnim) clearInterval(driverAnim);
           const start = Date.now();
           driverAnim = setInterval(function() {
             const t = Math.min(1, (Date.now() - start) / 2500);
             const pos = {
               lat: from.lat() + (to.lat - from.lat()) * t,
               lng: from.lng() + (to.lng - from.lng()) * t,
             };
             driverMarker.setPosition(pos);
             trimRouteTo(pos);
             if (t >= 1) { clearInterval(driverAnim); driverAnim = null; }
           }, 50);
         }

         function updateRouteTarget(lat, lng) {
           if (!driverMarker) return;
           activeRouteTarget = { lat, lng };
           requestRoute(driverMarker.getPosition(), activeRouteTarget, false);
         }
      </script>
      <script async defer src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap"></script>
    </body>
    </html>
  ` : '', [
    Boolean(driverLocation),
    tripOrigen?.lat, tripOrigen?.lng,
    tripDestino?.lat, tripDestino?.lng,
    tripStops,
  ]);

  // ✅ FIX BUG #3: memoizar el `source` del WebView para evitar que cada
  //    re-render (polling cada 5s, eventos de socket) cree un objeto nuevo
  //    y provoque la recarga del HTML → zoom/fitBounds agresivo.
  const mapSource = useMemo(() => ({ html: mapHTML }), [mapHTML]);

  const photos = driverPublicInfo?.vehiclePhotos;
  const selectedBankName = BANKS.find(b => b.code === selectedBankCode)?.name || 'Selecciona tu banco';

  const isDelivery = tripType === 'delivery';
  const freeShipping = marketplaceFreeShipping !== null
    ? marketplaceFreeShipping
    : Boolean(packageDescription?.toLowerCase().includes('vendedor'));

  let shouldShowBankData = false;
  if (paymentMethod !== 'app') {
    if (payingPartyId) {
      shouldShowBankData = String(payingPartyId) === String(user?.id);
    } else {
      if (!isDelivery) {
        shouldShowBankData = user?.nivel === 3;
      } else {
        shouldShowBankData = freeShipping ? user?.nivel === 4 : user?.nivel === 3;
      }
    }
  }

  const tripPriceUsd = tripPrice;
  const tripPriceVes = exchangeRate !== null && Number.isFinite(tripPriceUsd)
    ? tripPriceUsd * exchangeRate
    : null;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 300 : 0}
    >
      <ToastNotification message={toastMsg} type={toastType} visible={toastVisible} onHide={() => setToastVisible(false)} />
      <ReviewModal
        visible={reviewModalVisible && tripStatus === 'completed'}
        tripId={String(tripId || '')}
        revieweeId={revieweeDriverId}
        reviewerRole="passenger"
        onClose={() => setReviewModalVisible(false)}
        onSubmitted={() => showToast('Gracias por compartir tu experiencia', 'success')}
      />

      {/* ✅ FIX BUG #2: header con back button funcional. */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} accessibilityLabel="Volver">
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalles del viaje</Text>
        <View style={styles.headerSpacer} />
      </View>

      {driverLocation || tripOrigen || tripDestino ? (
        <WebView
          ref={webViewRef}
          style={styles.map}
          source={mapSource}
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
              <TouchableOpacity
                onPress={() => revieweeDriverId && router.push({
                  pathname: '/profile/[userId]',
                  params: { userId: revieweeDriverId },
                })}
                disabled={!revieweeDriverId}
              >
                <Text style={styles.infoText}>
                  {realDriverName || driverPublicInfo?.username || driverName || 'Buscando conductor...'}
                </Text>
              </TouchableOpacity>
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
            style={styles.shareTripButton}
            onPress={() => void handleShareTrip()}
            accessibilityRole="button"
          >
            <Feather name="share-2" size={20} color="#00967D" />
            <Text style={styles.shareTripButtonText}>Compartir viaje</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.chatButton}
            onPress={() => {
              setUnreadMessages(0);
              router.push({
                pathname: '/chat',
                params: {
                  tripId,
                  chatParticipantId: revieweeDriverId,
                  chatWith: realDriverName || driverName || 'Conductor',
                  returnTo: '/trip-active',
                },
              });
            }}
          >
            <Feather name="message-circle" size={20} color="#fff" />
            <Text style={styles.chatButtonText}> Chat con el Conductor</Text>
            {unreadMessages > 0 && <View style={styles.chatBadge}><Text style={styles.chatBadgeText}>{unreadMessages}</Text></View>}
          </TouchableOpacity>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Estado del viaje</Text>
            {tripType === 'delivery' && (
              <View style={styles.statusRow}>
                <Feather name="package" size={20} color="#00C9A7" />
                <Text style={styles.statusText}>Entrega de marketplace</Text>
              </View>
            )}
            {/* ✅ FIX BUG #1: nuevo estado para "re-buscando conductor". */}
            {(tripStatus === 'pending' || tripStatus === 'searching') && (
              <View style={styles.statusRow}>
                <Feather name="search" size={20} color="#FFA500" />
                <Text style={styles.statusText}>Buscando conductor...</Text>
              </View>
            )}
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
              <>
                <View style={styles.statusRow}>
                  <Feather name="navigation" size={20} color="#00C9A7" />
                  <Text style={styles.statusText}>
                    {activeStop
                      ? `En camino a parada ${currentStopIndex + 1} de ${tripStops.length}`
                      : 'En camino a tu destino'}
                  </Text>
                </View>
                {activeStop && (
                  <View style={styles.statusRow}>
                    <Feather name="map-pin" size={20} color="#2196F3" />
                    <Text style={styles.statusText}>
                      📍 {activeStop.address || `Parada ${currentStopIndex + 1}`}
                    </Text>
                  </View>
                )}
              </>
            )}
            {tripType === 'delivery' && tripStatus === 'picked_up' && (
              <View style={styles.statusRow}>
                <Feather name="navigation" size={20} color="#00C9A7" />
                <Text style={styles.statusText}>El producto fue recogido y va en camino a tu ubicación</Text>
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

          {shouldShowBankData && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Datos para transferencia al conductor</Text>
              {loadingBank ? (
                <ActivityIndicator size="small" color="#00C9A7" />
              ) : bankData ? (
                <>
                  <View style={styles.bankRow}>
                    <Feather name="credit-card" size={16} color="#00C9A7" style={{ marginRight: 8 }} />
                    <Text style={styles.bankLabel}>Banco:</Text>
                    <Text style={styles.bankValue}>{resolveBankDisplay(bankData.bankName)}</Text>
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

                  <View style={[styles.bankRow, styles.amountRow]}>
                    <Feather name="dollar-sign" size={16} color="#008F79" style={{ marginRight: 8 }} />
                    <Text style={[styles.bankLabel, { color: '#008F79' }]}>Monto a pagar:</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.amountUsd}>${tripPriceUsd.toFixed(2)}</Text>
                      {tripPriceVes !== null && (
                        <Text style={styles.amountVes}>≈ Bs. {tripPriceVes.toFixed(2)}</Text>
                      )}
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.noBankText}>El conductor no ha registrado sus datos bancarios.</Text>
              )}
            </View>
          )}

          {paymentMethod === 'app' ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Pago</Text>
              <View style={styles.paymentStatus}>
                <Feather name="smartphone" size={24} color="#00C9A7" />
                <Text style={styles.statusText}>
                  El pago se realizará automáticamente al finalizar el viaje
                </Text>
              </View>
            </View>
          ) : shouldShowBankData ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Pago</Text>
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
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Pago del envío</Text>
              <View style={styles.paymentStatus}>
                <Feather name="info" size={24} color="#6B7280" />
                <Text style={styles.statusText}>
                  {freeShipping
                    ? 'El vendedor realiza el pago al conductor.'
                    : 'El comprador realiza el pago al conductor.'}
                </Text>
              </View>
            </View>
          )}

          {/* ✅ Nuevo botón unificado: aparece en todas las fases pre-viaje
            (pending, searching, accepted, arrived) y permite cancelar + re-buscar. */}
        {['pending', 'searching', 'accepted', 'arrived'].includes(tripStatus) && (
          <TouchableOpacity
            style={[styles.payButton, { backgroundColor: '#FF5252', marginTop: 10, marginBottom: 20 }]}
            onPress={handleCancelAndReSearch}
            disabled={cancellingAndSearching}
            accessibilityRole="button"
          >
            {cancellingAndSearching ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="refresh-cw" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.payButtonText}>Cancelar y buscar de nuevo</Text>
              </>
            )}
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
  // ✅ FIX BUG #2: estilos del header.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#1F2937' },
  headerSpacer: { width: 40 },
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
  amountRow: {
    marginTop: 4,
    backgroundColor: '#ECFDF8',
    borderWidth: 1,
    borderColor: '#B7F0E2',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  amountUsd: { fontSize: 18, fontWeight: '800', color: '#008F79' },
  amountVes: { fontSize: 12, color: '#6B7280', marginTop: 2 },
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
  shareTripButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#B7EDE1',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  shareTripButtonText: { color: '#008F79', fontWeight: '700', fontSize: 15, marginLeft: 8 },
  chatBadge: { position: 'absolute', right: 10, top: -8, minWidth: 24, height: 24, borderRadius: 12, backgroundColor: '#FF5252', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  chatBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
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