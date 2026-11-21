// app/driver/active-trip.tsx
import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Animated, TouchableOpacity,
  BackHandler, Image, Modal, ScrollView, Alert,
  Vibration,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { apiClient } from '../../apis/Client';
import { connectSocket, ensurePersistentTripNotification, clearPersistentTripNotification } from '../../services/socketClient';
import { getUnreadCount } from '../../apis/chat';
import { verifyTripPayment, markArrived, startTrip, driverArrivedDestination, cancelTripByDriver, cancelTripDeliveryByDriver, markTripDeliveryPickedUp, markTripDeliveryDelivered } from '../../apis/trips';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import ToastNotification from '../../presentation/components/shared/toastNotification';
import { useAuth } from '../../presentation/store/AuthStore';
import { isChatOpen } from '../../services/chatPresence';
import ReviewModal from '../../components/ReviewModal';
import { getMarketplaceOrder, MarketplaceOrder } from '../../apis/marketplace';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCQQVLprlkXfH6sdrNv0VlVSkEN_2_M-eE';

type WebViewHandle = { injectJavaScript: (script: string) => void };
const isWebViewHandle = (value: unknown): value is WebViewHandle =>
  typeof value === 'object' &&
  value !== null &&
  'injectJavaScript' in value &&
  typeof value.injectJavaScript === 'function';

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

// Iconos locales redondos, mismo estilo visual para todos los marcadores.
const driverPinIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path fill="#2563EB" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/><circle cx="12" cy="9" r="1.5" fill="#2563EB"/></svg>')}`;
const originPinIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path fill="#00A884" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/><text x="12" y="10.5" text-anchor="middle" font-size="3" font-family="Arial" font-weight="bold" fill="#00A884">A</text></svg>')}`;
const destinationPinIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path fill="#D99A00" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/><text x="12" y="10.5" text-anchor="middle" font-size="3" font-family="Arial" font-weight="bold" fill="#D99A00">B</text></svg>')}`;
const passengerPinIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path fill="#00C9A7" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/><circle cx="12" cy="9" r="1.5" fill="#00C9A7"/></svg>')}`;
const buildStopPinIcon = (num: number) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path fill="#7C3AED" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/><text x="12" y="10.5" text-anchor="middle" font-size="3" font-family="Arial" font-weight="bold" fill="#7C3AED">${num}</text></svg>`
)}`;

type MapState = 'pickup' | 'stop' | 'destination';

interface TripData {
  id: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  pickup_address: string;
  dropoff_address: string;
  live_passenger_lat?: number | string | null;
  live_passenger_lng?: number | string | null;
  price: number;
  status: string;
  trip_type?: 'ride' | 'delivery';
  marketplace_order_id?: string | null;
  restaurant_order_id?: string | null;
  payment_method?: string;
  package_description?: string | null;
  stops?: { lat: number; lng: number; address: string }[];
  passenger?: {
    id?: string;
    username?: string;
    userlogin: string;
    profile_pic_url?: string;
  };
  payment_status?: string;
  payment_reference?: string;
  payer_bank?: string;
  payer_cedula?: string;
  payer_phone?: string;
}

const distanceInMeters = (
  first: { lat: number; lng: number },
  second: { lat: number; lng: number },
) => {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLat = radians(second.lat - first.lat);
  const deltaLng = radians(second.lng - first.lng);
  const value = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(first.lat)) * Math.cos(radians(second.lat)) *
    Math.sin(deltaLng / 2) ** 2;
  const boundedValue = Math.min(1, Math.max(0, value));
  return 6371000 * 2 * Math.atan2(Math.sqrt(boundedValue), Math.sqrt(1 - boundedValue));
};

const DriverActiveTripScreen = () => {
  const { user } = useAuth();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const [trip, setTrip] = useState<TripData | null>(null);
  const [marketplaceOrder, setMarketplaceOrder] = useState<MarketplaceOrder | null>(null);
  const [cancellingDelivery, setCancellingDelivery] = useState(false);
  const [loading, setLoading] = useState(true);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [passengerLoc, setPassengerLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [passengerPic, setPassengerPic] = useState<string | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const lastMessageNoticeAt = useRef(0);
  const proximityAlertsShown = useRef(new Set<string>());
  const deliveryArrivalAlerted = useRef(new Set<string>());
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<WebViewHandle | null>(null);

  useEffect(() => {
    if (trip?.status === 'completed' && trip.trip_type !== 'delivery') setReviewModalVisible(true);
  }, [trip?.status, trip?.trip_type]);

  const showToast = useCallback((message: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(message);
    setToastType(type);
    setToastVisible(true);
  }, []);

  const handleDeliveryPickedUp = async () => {
    try {
      await markTripDeliveryPickedUp(tripId!);
      showToast('Producto recibido. Ruta actualizada hacia el comprador.', 'success');
      await fetchTripDetails();
    } catch (err: any) {
      if (err.message?.toLowerCase().includes('términos')) {
        showToast('Error de validación, reintenta o contacta a soporte.', 'error');
      } else {
        showToast(err.message || 'No se pudo actualizar la entrega');
      }
    }
  };

  const confirmCancelDelivery = () => {
    if (
      trip?.trip_type !== 'delivery' ||
      !['accepted', 'arrived'].includes(trip.status) ||
      cancellingDelivery
    ) return;
    Alert.alert(
      'Cancelar entrega',
      '¿Seguro que deseas cancelar esta entrega? Se buscará otro mototaxi.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setCancellingDelivery(true);
              try {
                const response = await cancelTripDeliveryByDriver(trip.id);
                if (!response.result) throw new Error(response.error?.[0] || 'No se pudo cancelar la entrega.');
                await clearPersistentTripNotification();
                showToast('Entrega cancelada. Buscando otro mototaxi.', 'success');
                setTimeout(() => router.replace('/dashboard'), 800);
              } catch (error) {
                showToast(error instanceof Error ? error.message : 'No se pudo cancelar la entrega.');
              } finally {
                setCancellingDelivery(false);
              }
            })();
          },
        },
      ],
    );
  };

  const handleDeliveryDelivered = async () => {
    if (!isNearDeliveryDestination) return;
    try {
      await markTripDeliveryDelivered(tripId!);
      showToast(
        trip?.restaurant_order_id
          ? 'Llegaste al destino. Esperando la confirmación del cliente.'
          : 'Entrega completada',
        'success',
      );
      await fetchTripDetails();
      if (!trip?.restaurant_order_id) {
        await clearPersistentTripNotification();
        setTimeout(() => router.replace('/dashboard'), 800);
      }
    } catch (err: any) {
      showToast(err.message || 'No se pudo completar la entrega');
    }
  };

  useEffect(() => {
    if (!trip?.marketplace_order_id) {
      setMarketplaceOrder(null);
      return;
    }
    let mounted = true;
    getMarketplaceOrder(trip.marketplace_order_id)
      .then(({ result, content }) => {
        if (mounted && result) setMarketplaceOrder(content);
        else if (mounted) showToast('No se pudieron cargar los datos de esta entrega.');
      })
      .catch((error: unknown) => {
        console.error('No se pudo cargar la orden del viaje de entrega:', error);
        if (mounted) showToast(error instanceof Error ? error.message : 'No se pudieron cargar los datos de esta entrega.');
      });
    return () => { mounted = false; };
  }, [trip?.marketplace_order_id]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchTripDetails();
    }, 5000);
    return () => clearInterval(interval);
  }, [tripId]);

  useEffect(() => {
    let cancelled = false;
    let cleanupSocket: () => void = () => undefined;
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    fetchTripDetails();
    getUnreadCount(tripId!).then(setUnreadMessages).catch(() => undefined);
    getDriverLocation();
    listenSocketEvents().then((cleanup) => {
      if (cancelled) cleanup();
      else cleanupSocket = cleanup;
    });
    return () => {
      cancelled = true;
      cleanupSocket();
    };
  }, [tripId]);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    const startSendingLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: trip?.trip_type === 'delivery' ? 3000 : 6000,
          distanceInterval: trip?.trip_type === 'delivery' ? 3 : 15,
        },
        (location) => {
          const lat = location.coords.latitude;
          const lng = location.coords.longitude;
          setDriverLoc({ lat, lng });
          connectSocket()
            .then((socket) => socket.emit('driver:location', { tripId, lat, lng }))
            .catch(() => undefined);
        }
      );
    };
    startSendingLocation();
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [tripId, trip?.trip_type]);

  useEffect(() => {
    if (!driverLoc) return;
    mapRef.current?.injectJavaScript(
      `window.updateDriverPosition && window.updateDriverPosition(${driverLoc.lat}, ${driverLoc.lng}); true;`
    );
  }, [driverLoc]);

  useEffect(() => {
    if (!passengerLoc) return;
    mapRef.current?.injectJavaScript(
      `window.updatePassengerPosition && window.updatePassengerPosition(${passengerLoc.lat}, ${passengerLoc.lng}); true;`
    );
  }, [passengerLoc]);

  useFocusEffect(useCallback(() => {
    const backAction = () => {
      if (trip && trip.status !== 'completed' && trip.status !== 'cancelled') {
        showToast('No puedes salir hasta que el viaje finalice.');
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [trip?.status, showToast]));

  const fetchTripDetails = async () => {
    try {
      const response = await apiClient<{ result: boolean; content: TripData }>(
        `/private/trips/${tripId}`
      );
      if (response.result) {
        setTrip(response.content);
        if (!['completed', 'cancelled'].includes(response.content.status)) {
          ensurePersistentTripNotification(
            tripId!,
            'Viaje en curso',
            `Pasajero: ${response.content.passenger?.username || response.content.passenger?.userlogin || 'Pasajero'}`
          ).catch(() => undefined);
        } else {
          clearPersistentTripNotification().catch(() => undefined);
        }
        if (response.content.passenger?.profile_pic_url) {
          setPassengerPic(response.content.passenger.profile_pic_url);
        } else {
          setPassengerPic(null);
        }
        const liveLat = Number(response.content.live_passenger_lat);
        const liveLng = Number(response.content.live_passenger_lng);
        if (response.content.live_passenger_lat != null && response.content.live_passenger_lng != null &&
          Number.isFinite(liveLat) && Number.isFinite(liveLng)) {
          setPassengerLoc((current) =>
            current?.lat === liveLat && current.lng === liveLng
              ? current
              : { lat: liveLat, lng: liveLng }
          );
        }
      }
    } catch (err: any) {
      // Silencioso en polling
    } finally {
      setLoading(false);
    }
  };

  const getDriverLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDriverLoc(null);
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setDriverLoc({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    } catch {
      setDriverLoc(null);
    }
  };

  const listenSocketEvents = async (): Promise<() => void> => {
    try {
      const socket = await connectSocket();
      socket.emit('driver:join');
      socket.emit('trip:join', tripId);
      const handlePaymentUpdated = () => {
        showToast('El pasajero ya registró su pago. Revisa el comprobante.', 'success');
        fetchTripDetails();
      };
      const handleCompleted = () => {
        fetchTripDetails();
      };
      const handlePassengerLocationUpdated = (data: {
        tripId?: string;
        lat?: number;
        lng?: number;
      }) => {
        if (String(data.tripId) !== String(tripId) ||
          !Number.isFinite(data.lat) || !Number.isFinite(data.lng)) return;
        setPassengerLoc({ lat: Number(data.lat), lng: Number(data.lng) });
      };
      const handleCancelled = (_data: any) => {
        showToast('El viaje ha sido cancelado.');
        fetchTripDetails();
        setTimeout(() => router.replace('/dashboard'), 1000);
      };
      const handleMessage = (message: { sender_id?: string; sender_name?: string }) => {
        if (message.sender_id && String(message.sender_id) !== String(user?.id)) {
          setUnreadMessages((count) => count + 1);
          const now = Date.now();
          if (!isChatOpen() && now - lastMessageNoticeAt.current >= 10000) {
            lastMessageNoticeAt.current = now;
            showToast(`Tienes un mensaje nuevo de ${message.sender_name || 'el pasajero'}`, 'success');
          }
        }
      };
      const handleRead = (data: { reader_id?: string }) => {
        if (String(data.reader_id) === String(user?.id)) setUnreadMessages(0);
      };
      socket.on('tripPaymentUpdated', handlePaymentUpdated);
      socket.on('tripCompleted', handleCompleted);
      socket.on('tripCancelled', handleCancelled);
      socket.on('passengerLocationUpdated', handlePassengerLocationUpdated);
      socket.on('chat:message', handleMessage);
      socket.on('chat:read', handleRead);
      return () => {
        socket.off('tripPaymentUpdated', handlePaymentUpdated);
        socket.off('tripCompleted', handleCompleted);
        socket.off('tripCancelled', handleCancelled);
        socket.off('passengerLocationUpdated', handlePassengerLocationUpdated);
        socket.off('chat:message', handleMessage);
        socket.off('chat:read', handleRead);
      };
    } catch {
      return () => undefined;
    }
  };

  const handleVerifyPayment = async (action: 'verify' | 'reject') => {
    try {
      await verifyTripPayment(tripId!, action);
      showToast(action === 'verify' ? 'Pago verificado correctamente' : 'Pago rechazado', action === 'verify' ? 'success' : 'error');
      fetchTripDetails();
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleArrive = async () => {
    try {
      await markArrived(tripId!);
      showToast('Se ha notificado al pasajero que has llegado', 'success');
      fetchTripDetails();
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleStartTrip = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await startTrip(tripId!, {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
      fetchTripDetails();
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleArriveDestination = async () => {
    try {
      await driverArrivedDestination(tripId!);
      showToast('Has llegado al destino. Esperando confirmación del pasajero...', 'success');
      fetchTripDetails();
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleCancelTrip = async () => {
    try {
      await cancelTripByDriver(tripId!);
      router.replace('/dashboard');
    } catch (err: any) {
      showToast(err.message);
    }
  };

  // ============ LÓGICA DE MULTIPARADA Y VISIBILIDAD PROGRESIVA ============
  const hasStops = Boolean(trip?.stops && trip.stops.length > 0);
  const activeStop = (trip?.status === 'in_progress') && hasStops && currentStopIndex < (trip?.stops?.length ?? 0)
    ? trip!.stops![currentStopIndex]
    : null;

  const isDestinationLeg = !activeStop && (
    ['in_progress', 'arrived_destination'].includes(String(trip?.status || '').toLowerCase()) ||
    (trip?.trip_type === 'delivery' && trip.status === 'picked_up')
  );

  // Estado del mapa que controla la visibilidad progresiva de los marcadores.
  // - pickup:  yendo a buscar al pasajero (solo se muestra el marcador del pasajero).
  // - stop:    yendo a una parada intermedia (se muestra el pasajero + la parada actual).
  // - destination: yendo al destino final (se muestra el pasajero + el destino).
  const mapState: MapState = activeStop
    ? 'stop'
    : isDestinationLeg
      ? 'destination'
      : 'pickup';

  const handleConfirmStop = useCallback(() => {
    if (!activeStop) return;
    const stopNumber = currentStopIndex + 1;
    Alert.alert(
      `Confirmar parada ${stopNumber}`,
      `¿Ya completaste la parada en ${activeStop.address || 'esta ubicación'}?`,
      [
        { text: 'Aún no', style: 'cancel' },
        {
          text: 'Sí, continuar',
          onPress: () => {
            const nextIndex = currentStopIndex + 1;
            setCurrentStopIndex(nextIndex);
            connectSocket()
              .then((socket) => socket.emit('trip:stop-completed', { tripId, stopIndex: nextIndex }))
              .catch(() => undefined);
            showToast(
              nextIndex < (trip?.stops?.length ?? 0)
                ? `Parada ${stopNumber} completada. Siguiente parada...`
                : 'Parada completada. Continúa al destino final.',
              'success',
            );
          }
        }
      ]
    );
  }, [activeStop, currentStopIndex, trip?.stops?.length, tripId, showToast]);

  useEffect(() => {
    if (!trip || !driverLoc) return;

    let promptKey: string | null = null;
    let target: { lat: number; lng: number } | null = null;

    if (trip.status === 'accepted') {
      promptKey = `${trip.id}:pickup`;
      const liveLat = passengerLoc?.lat ?? (trip.live_passenger_lat == null ? Number.NaN : Number(trip.live_passenger_lat));
      const liveLng = passengerLoc?.lng ?? (trip.live_passenger_lng == null ? Number.NaN : Number(trip.live_passenger_lng));
      target = trip.trip_type !== 'delivery' && Number.isFinite(liveLat) && Number.isFinite(liveLng)
        ? { lat: liveLat, lng: liveLng }
        : { lat: Number(trip.pickup_lat), lng: Number(trip.pickup_lng) };
    } else if (trip.status === 'in_progress') {
      if (activeStop) {
        promptKey = `${trip.id}:stop-${currentStopIndex}`;
        target = { lat: Number(activeStop.lat), lng: Number(activeStop.lng) };
      } else {
        promptKey = `${trip.id}:destination`;
        target = { lat: Number(trip.dropoff_lat), lng: Number(trip.dropoff_lng) };
      }
    }

    if (!promptKey || !target ||
      !Number.isFinite(target.lat) || !Number.isFinite(target.lng) ||
      proximityAlertsShown.current.has(promptKey) ||
      distanceInMeters(driverLoc, target) > 50) return;

    proximityAlertsShown.current.add(promptKey);

    if (trip.status === 'accepted') {
      Alert.alert(
        'Punto de recogida',
        '¿Ya llegaste con el pasajero? ¿Deseas marcar que ya estás en el punto de recogida?',
        [
          { text: 'Sí, marcar llegada', onPress: () => { void handleArrive(); } },
          { text: 'Aún no', style: 'cancel' },
        ],
      );
      return;
    }

    if (activeStop) {
      Alert.alert(
        'Parada Alcanzada',
        `¿Has completado la parada en ${activeStop.address}?`,
        [
          { text: 'Aún no', style: 'cancel' },
          { text: 'Sí, continuar', onPress: () => { handleConfirmStop(); } }
        ]
      );
      return;
    }

    Alert.alert(
      'Destino',
      '¿Ya llegaste al destino? Puedes notificar la llegada para que el pasajero confirme el viaje.',
      [
        { text: 'Sí, notificar llegada', onPress: () => { void handleArriveDestination(); } },
        { text: 'Aún no', style: 'cancel' },
      ],
    );
  }, [driverLoc, passengerLoc, trip, activeStop, currentStopIndex, handleConfirmStop]);

  const isNearDeliveryDestination = Boolean(
    trip?.trip_type === 'delivery' &&
    trip.status === 'picked_up' &&
    driverLoc &&
    distanceInMeters(driverLoc, {
      lat: passengerLoc?.lat ?? Number(trip.live_passenger_lat ?? trip.dropoff_lat),
      lng: passengerLoc?.lng ?? Number(trip.live_passenger_lng ?? trip.dropoff_lng),
    }) <= 10
  );

  useEffect(() => {
    if (!isNearDeliveryDestination || !trip) return;
    const key = `${trip.id}:delivery-arrival`;
    if (deliveryArrivalAlerted.current.has(key)) return;
    deliveryArrivalAlerted.current.add(key);
    Vibration.vibrate([0, 500, 200, 500]);
  }, [isNearDeliveryDestination, trip?.id]);

  const mapDriverLocation = driverLoc ?? (trip ? { lat: Number(trip.pickup_lat), lng: Number(trip.pickup_lng) } : null);

  const routeTarget = activeStop
    ? { lat: Number(activeStop.lat), lng: Number(activeStop.lng) }
    : trip && isDestinationLeg
      ? {
          lat: trip.trip_type === 'delivery'
            ? passengerLoc?.lat ?? Number(trip.live_passenger_lat ?? trip.dropoff_lat)
            : Number(trip.dropoff_lat),
          lng: trip.trip_type === 'delivery'
            ? passengerLoc?.lng ?? Number(trip.live_passenger_lng ?? trip.dropoff_lng)
            : Number(trip.dropoff_lng),
        }
      : { lat: Number(trip?.pickup_lat ?? mapDriverLocation?.lat ?? 0), lng: Number(trip?.pickup_lng ?? mapDriverLocation?.lng ?? 0) };

  const routeOrigin = mapDriverLocation;

  const stopsWithIcons = (trip?.stops || []).map((stop, index) => ({
    lat: Number(stop.lat),
    lng: Number(stop.lng),
    address: stop.address || '',
    iconUrl: buildStopPinIcon(index + 1),
  }));

  const stopsSignature = useMemo(
    () => JSON.stringify(stopsWithIcons.map(s => ({ lat: s.lat, lng: s.lng }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stopsWithIcons.length, stopsWithIcons.map(s => `${s.lat},${s.lng}`).join('|')]
  );

  const mapHTML = useMemo(() => trip && mapDriverLocation
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
         let map, directionsService, driverMarker, pickupMarker, destinationMarker;
         let stopMarkers = [];        // NUEVO: se guardan para poder mostrarlos/ocultarlos
         let currentState = 'pickup'; // NUEVO: 'pickup' | 'stop' | 'destination'
         let activeStopIdx = -1;      // NUEVO: índice de la parada actualmente visible
         const trackPassengerDestination = ${trip.trip_type === 'delivery'};
         let activeRouteTarget, fallbackRouteOrigin;
         let routeViewportFitted = false;
         let routePath = [];
         let routePolyline = null;
         let trimIndex = 0;
         let lastRerouteAt = 0;
         let driverAnim = null;
         const stopsData = ${JSON.stringify(stopsWithIcons)};

        function createMarker(position, icon, title, markerMap) {
           return new google.maps.Marker({
             position,
             map: markerMap === undefined ? map : markerMap,
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

          function applyRoute(response) {
            const route = response.routes && response.routes[0];
            if (!route) return;
            const raw = route.overview_path || [];
            const pts = raw.getArray ? raw.getArray() : raw;
            routePath = pts.map(function(p) { return { lat: p.lat(), lng: p.lng() }; });
            trimIndex = 0;
            if (!routePolyline) {
              routePolyline = new google.maps.Polyline({
                strokeColor: '#00C9A7', strokeOpacity: 1, strokeWeight: 6, zIndex: 10,
              });
              routePolyline.setMap(map);
            }
            routePolyline.setPath(routePath);
            if (!routeViewportFitted && route.bounds) {
              map.fitBounds(route.bounds);
              routeViewportFitted = true;
            }
          }

          function requestRoute(origin, destination, fallbackOrigin) {
            if (!directionsService || !origin || !destination) return;
            directionsService.route({
              origin,
              destination,
              travelMode: 'DRIVING',
              provideRouteAlternatives: false,
            }, function(response, status) {
              if (status === 'OK') {
                applyRoute(response);
              } else if (fallbackOrigin && (fallbackOrigin.lat !== origin.lat || fallbackOrigin.lng !== origin.lng)) {
                directionsService.route({
                  origin: fallbackOrigin,
                  destination,
                  travelMode: 'DRIVING',
                  provideRouteAlternatives: false,
                }, function(fallbackResponse, fallbackStatus) {
                  if (fallbackStatus === 'OK') applyRoute(fallbackResponse);
                });
              }
            });
          }

          function trimRouteTo(pos) {
            if (!routePath.length) {
              if (activeRouteTarget && Date.now() - lastRerouteAt > 15000) {
                lastRerouteAt = Date.now();
                requestRoute(pos, activeRouteTarget, fallbackRouteOrigin);
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
              requestRoute(pos, activeRouteTarget, fallbackRouteOrigin);
            }
          }

          function updateRouteTarget(lat, lng) {
             if (!driverMarker) return;
             activeRouteTarget = { lat, lng };
             requestRoute(driverMarker.getPosition(), activeRouteTarget, fallbackRouteOrigin);
          }

          function updatePassengerPosition(lat, lng) {
             if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
              const passengerPosition = { lat, lng };
              if (trackPassengerDestination) {
                // Delivery: solo actualizar el destino durante el tramo final
                if (currentState === 'pickup') return;
                if (destinationMarker) destinationMarker.setPosition(passengerPosition);
                if (activeRouteTarget &&
                    distMeters(activeRouteTarget, passengerPosition) > 40 &&
                    Date.now() - lastRerouteAt > 40000) {
                  lastRerouteAt = Date.now();
                  activeRouteTarget = passengerPosition;
                  requestRoute(driverMarker.getPosition(), activeRouteTarget, fallbackRouteOrigin);
                }
                return;
              }
              // Ride: siempre actualiza la posición visual del pasajero, pero solo
              // recalcula la ruta si estamos en el tramo de recogida.
              if (!pickupMarker) return;
              pickupMarker.setPosition(passengerPosition);
              if (currentState === 'pickup' && activeRouteTarget &&
                  distMeters(activeRouteTarget, passengerPosition) > 40 &&
                  Date.now() - lastRerouteAt > 40000) {
                lastRerouteAt = Date.now();
                activeRouteTarget = passengerPosition;
                requestRoute(driverMarker.getPosition(), activeRouteTarget, fallbackRouteOrigin);
              }
          }

          // NUEVO: aplica la visibilidad progresiva de los marcadores según el
          // estado actual del viaje. Reglas:
          //   pickup      -> conductor + pasajero. (sin paradas, sin destino)
          //   stop        -> conductor + pasajero + parada actual. (sin destino)
          //   destination -> conductor + pasajero + destino. (sin paradas)
          window.setMapState = function(state, stopIdx) {
            const stateChanged = (currentState !== state) || (activeStopIdx !== stopIdx);
            currentState = state;
            activeStopIdx = stopIdx;

            if (stateChanged) {
              // Al cambiar de tramo, limpiamos la caché de la ruta para que el
              // próximo requestRoute vuelva a encuadrar la cámara en la nueva ruta.
              routeViewportFitted = false;
              routePath = [];
              trimIndex = 0;
              if (routePolyline) routePolyline.setPath([]);
            }

            // Driver: siempre visible.
            if (driverMarker) driverMarker.setMap(map);
            // Passenger: visible durante todo el viaje activo (pedido del usuario).
            if (pickupMarker) pickupMarker.setMap(map);
            // Destination: solo en el tramo final.
            if (destinationMarker) destinationMarker.setMap(state === 'destination' ? map : null);
            // Stops: solo se muestra la parada actual; el resto ocultas.
            stopMarkers.forEach(function(marker, index) {
              marker.setMap(state === 'stop' && index === stopIdx ? map : null);
            });
          };

        function initMap() {
          const driverPos = { lat: ${mapDriverLocation.lat}, lng: ${mapDriverLocation.lng} };
           const pickupPos = ${trip ? `{ lat: ${Number(trip.pickup_lat)}, lng: ${Number(trip.pickup_lng)} }` : 'null'};
           const destinationPos = ${trip ? `{ lat: ${Number(trip.dropoff_lat)}, lng: ${Number(trip.dropoff_lng)} }` : 'null'};
            const activeTarget = ${JSON.stringify(routeTarget)};
            fallbackRouteOrigin = pickupPos;
            activeRouteTarget = activeTarget;

          map = new google.maps.Map(document.getElementById('map'), {
            zoom: 14,
            center: driverPos,
            disableDefaultUI: true,
            zoomControl: false,
          });

           driverMarker = createMarker(driverPos, '${driverPinIcon}', 'Tú');
          if (pickupPos) {
             pickupMarker = createMarker(
               pickupPos,
               '${trip?.trip_type === 'delivery' ? originPinIcon : passengerPinIcon}',
               '${trip?.trip_type === 'delivery' ? 'Origen' : 'Pasajero'}',
               null
             );
          }
          if (destinationPos) {
            destinationMarker = createMarker(
              destinationPos,
              '${destinationPinIcon}',
              'Destino',
              null
            );
          }

          // Crear los marcadores de las paradas en null; setMapState decide cuál mostrar.
          if (stopsData && stopsData.length > 0) {
            stopsData.forEach(function(stop) {
              const marker = new google.maps.Marker({
                map: null,
                position: { lat: stop.lat, lng: stop.lng },
                icon: { url: stop.iconUrl, anchor: new google.maps.Point(18, 36) },
                title: 'Parada: ' + (stop.address || '')
              });
              stopMarkers.push(marker);
            });
          }

          directionsService = new google.maps.DirectionsService();

          // Aplicar la visibilidad inicial y luego pedir la ruta al target activo.
          window.setMapState('${mapState}', ${currentStopIndex});
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
      </script>
      <script async defer src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap"></script>
    </body>
    </html>
  `
    : '', [trip?.id, trip?.pickup_lat, trip?.pickup_lng, trip?.dropoff_lat, trip?.dropoff_lng, trip?.trip_type, stopsSignature]);
  const mapSource = useMemo(() => ({ html: mapHTML }), [mapHTML]);

  // Efecto 1: aplica la visibilidad de los marcadores cuando cambia el estado del viaje.
  useEffect(() => {
    if (!trip) return;
    mapRef.current?.injectJavaScript(
      `window.setMapState && window.setMapState('${mapState}', ${currentStopIndex}); true;`
    );
  }, [mapState, currentStopIndex, trip?.id]);

  // Efecto 2: actualiza la ruta (se dispara por separado para no re-renderizar el mapa).
  useEffect(() => {
    if (!trip) return;
    mapRef.current?.injectJavaScript(
      `window.updateRouteTarget && window.updateRouteTarget(${routeTarget.lat}, ${routeTarget.lng}); true;`
    );
  }, [routeTarget.lat, routeTarget.lng, trip?.id]);

  if (loading || !mapDriverLocation) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C9A7" />
      </View>
    );
  }

  if (!trip) return null;

  const isAppPayment = trip.payment_method === 'app';
  const normalizeAddress = (value?: string) => {
    if (!value) return 'Ubicación sin nombre';
    return value
      .replace(/\b[A-Z0-9]{3}\+[A-Z0-9]{3}\s*,?\s*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/,\s*,/g, ', ')
      .trim();
  };

  return (
    <View style={styles.screen}>
      <ToastNotification message={toastMsg} type={toastType} visible={toastVisible} onHide={() => setToastVisible(false)} />
      <ReviewModal
        visible={reviewModalVisible && trip.status === 'completed'}
        tripId={trip.id}
        revieweeId={trip.passenger?.id || ''}
        reviewerRole="driver"
        onClose={() => setReviewModalVisible(false)}
        onSubmitted={() => showToast('Gracias por compartir tu experiencia', 'success')}
      />
      <WebView
        ref={(instance) => { mapRef.current = isWebViewHandle(instance) ? instance : null; }}
        style={styles.map}
        source={mapSource}
        javaScriptEnabled
        onLoadEnd={() => {
          if (driverLoc) {
            mapRef.current?.injectJavaScript(
              `window.updateDriverPosition && window.updateDriverPosition(${driverLoc.lat}, ${driverLoc.lng}); true;`
            );
          }
          if (passengerLoc) {
            mapRef.current?.injectJavaScript(
              `window.updatePassengerPosition && window.updatePassengerPosition(${passengerLoc.lat}, ${passengerLoc.lng}); true;`
            );
          }
          mapRef.current?.injectJavaScript(
            `window.setMapState && window.setMapState('${mapState}', ${currentStopIndex}); true;`
          );
          mapRef.current?.injectJavaScript(
            `window.updateRouteTarget && window.updateRouteTarget(${routeTarget.lat}, ${routeTarget.lng}); true;`
          );
        }}
      />
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        <ScrollView
          style={styles.cardScroll}
          contentContainerStyle={styles.cardContent}
          showsVerticalScrollIndicator
        >
          <Text style={styles.title}>{trip.trip_type === 'delivery' ? 'Datos de la entrega' : 'Datos del pasajero'}</Text>
          {trip.trip_type === 'delivery' && (
            <View style={styles.deliveryBadge}>
              <MaterialCommunityIcons name="package-variant-closed" size={18} color="#FFFFFF" />
              <Text style={styles.deliveryBadgeText}>Viaje de Entrega</Text>
            </View>
          )}
          <View style={styles.passengerRow}>
            {passengerPic ? (
              <TouchableOpacity onPress={() => setSelectedImage(passengerPic)}>
                <Image source={{ uri: passengerPic }} style={styles.passengerPic} />
              </TouchableOpacity>
            ) : (
              <Feather name="user" size={40} color="#9CA3AF" />
            )}
            <Text style={styles.value}>{trip.passenger?.username || trip.passenger?.userlogin}</Text>
          </View>
          <Text style={styles.value}>📍 Origen: {normalizeAddress(trip.pickup_address)}</Text>
          {hasStops && (
            <View style={styles.stopsBlock}>
              <Text style={styles.stopsHeader}>
                🚩 {trip.stops!.length} parada{trip.stops!.length > 1 ? 's' : ''} intermedia{trip.stops!.length > 1 ? 's' : ''}:
              </Text>
              {trip.stops!.map((stop, index) => (
                <Text
                  key={index}
                  style={[
                    styles.stopItem,
                    index < currentStopIndex && styles.stopItemDone,
                    index === currentStopIndex && trip.status === 'in_progress' && styles.stopItemActive,
                  ]}
                >
                  {index + 1}. {stop.address}
                  {index < currentStopIndex ? ' ✓' : index === currentStopIndex && trip.status === 'in_progress' ? ' (actual)' : ''}
                </Text>
              ))}
            </View>
          )}
          <Text style={styles.value}>🏁 Destino: {normalizeAddress(trip.dropoff_address)}</Text>
          <Text style={styles.price}>💰 ${Number(trip.price).toFixed(2)}</Text>

          {/* ═══════════════════════════════════════════════════════════════
    PRIORIDAD 1: Comprobante pendiente de verificación.
    Aplica a CUALQUIER viaje (delivery o ride), sin importar trip_type.
    El mototaxista debe ver los datos del pagador + botones de acción.
    ═══════════════════════════════════════════════════════════════ */}
{trip.payment_status === 'paid' && (
  <View style={styles.paymentSection}>
    <Text style={styles.subtitle}>💳 Comprobante de pago recibido</Text>
    <Text style={styles.value}>
      {trip.trip_type === 'delivery'
        ? (trip.package_description?.includes('vendedor')
            ? 'El vendedor registró el pago del envío.'
            : 'El comprador registró el pago del envío.')
        : 'El pasajero registró el pago del viaje.'}
      {' '}Verifica que el dinero llegó a tu cuenta antes de confirmar.
    </Text>
    <Text style={styles.value}>💵 Monto: ${Number(trip.price).toFixed(2)}</Text>
    {!!trip.payer_bank && (
      <Text style={styles.value}>
        🏦 Banco: {BANKS.find(b => b.code === trip.payer_bank)?.name || trip.payer_bank}
      </Text>
    )}
    {!!trip.payer_cedula && <Text style={styles.value}>🆔 Cédula: {trip.payer_cedula}</Text>}
    {!!trip.payer_phone && <Text style={styles.value}>📞 Teléfono: {trip.payer_phone}</Text>}
    {!!trip.payment_reference && <Text style={styles.value}>🔢 Referencia: {trip.payment_reference}</Text>}
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 8 }}>
      <TouchableOpacity
        style={[styles.verifyBtn, { flex: 1 }]}
        onPress={() => handleVerifyPayment('verify')}
      >
        <Feather name="check" size={18} color="#fff" />
        <Text style={styles.btnText}>Confirmar Pago</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.rejectBtn, { flex: 1 }]}
        onPress={() => handleVerifyPayment('reject')}
      >
        <Feather name="x" size={18} color="#fff" />
        <Text style={styles.btnText}>Rechazar</Text>
      </TouchableOpacity>
    </View>
  </View>
)}

{/* PRIORIDAD 2: Pago verificado */}
{trip.payment_status === 'verified' && (
  <View style={styles.verifiedBadge}>
    <Feather name="check-circle" size={20} color="#4CAF50" />
    <Text style={{ marginLeft: 8, color: '#4CAF50', fontWeight: '600' }}>Pago verificado</Text>
  </View>
)}

{/* PRIORIDAD 3: Pago rechazado (el pagador debe reenviar el comprobante) */}
{trip.payment_status === 'rejected' && (
  <View style={styles.paymentSection}>
    <Text style={styles.subtitle}>❌ Pago rechazado</Text>
    <Text style={styles.value}>Notificaste al pagador que reenvíe el comprobante.</Text>
  </View>
)}

{/* PRIORIDAD 4: Sin pago aún — mostramos según el tipo de viaje */}
{trip.payment_status === 'pending' && (
  trip.trip_type === 'delivery' ? (
    <View style={styles.paymentSection}>
      <Text style={styles.subtitle}>Pago de la entrega</Text>
      <Text style={styles.value}>
        {trip.package_description?.includes('vendedor')
          ? 'El vendedor asume el costo del envío.'
          : 'El comprador pagará el envío al recibir el paquete.'}
      </Text>
      <Text style={styles.waiting}>⏳ Esperando comprobante de pago...</Text>
    </View>
  ) : isAppPayment ? (
    <View style={styles.paymentSection}>
      <Text style={styles.subtitle}>Pago automático</Text>
      <Text style={styles.value}>El pasajero pagará con saldo de la app al finalizar.</Text>
    </View>
  ) : (
    <View style={styles.paymentSection}>
      <Text style={styles.waiting}>⏳ Esperando comprobante de pago...</Text>
    </View>
  )
)}

          {trip.status === 'accepted' && (
            <TouchableOpacity style={styles.arriveBtn} onPress={handleArrive}>
              <Feather name="map-pin" size={18} color="#fff" />
              <Text style={styles.btnText}> He llegado al origen</Text>
            </TouchableOpacity>
          )}
          {trip.status === 'arrived' && (
            <TouchableOpacity style={styles.startBtn} onPress={trip.trip_type === 'delivery' ? handleDeliveryPickedUp : handleStartTrip}>
              <Feather name={trip.trip_type === 'delivery' ? 'package' : 'user-check'} size={18} color="#fff" />
              <Text style={styles.btnText}>{trip.trip_type === 'delivery' ? ' Tengo el paquete' : ' Pasajero a bordo'}</Text>
            </TouchableOpacity>
          )}
          {trip.trip_type === 'delivery' && ['accepted', 'arrived'].includes(trip.status) && (
            <TouchableOpacity
              style={[styles.completeBtn, styles.cancelDeliveryButton, cancellingDelivery && { opacity: 0.65 }]}
              onPress={confirmCancelDelivery}
              disabled={cancellingDelivery}
            >
              {cancellingDelivery
                ? <ActivityIndicator color="#FFFFFF" />
                : <>
                    <Feather name="x-circle" size={18} color="#FFFFFF" />
                    <Text style={styles.btnText}> Cancelar Entrega</Text>
                  </>}
            </TouchableOpacity>
          )}
          {trip.trip_type === 'delivery' && trip.status === 'picked_up' && (
            <TouchableOpacity
              style={[styles.completeBtn, !isNearDeliveryDestination && { opacity: 0.65 }]}
              onPress={handleDeliveryDelivered}
              disabled={!isNearDeliveryDestination}
            >
              <Feather name={isNearDeliveryDestination ? 'check-circle' : 'navigation'} size={18} color="#fff" />
              <Text style={styles.btnText}>{isNearDeliveryDestination ? ' Llegué al destino' : ' En camino al destino'}</Text>
            </TouchableOpacity>
          )}
          {trip.status === 'in_progress' && activeStop && (
            <TouchableOpacity style={styles.stopConfirmBtn} onPress={handleConfirmStop}>
              <Feather name="map-pin" size={18} color="#fff" />
              <Text style={styles.btnText}> Confirmar parada {currentStopIndex + 1}</Text>
            </TouchableOpacity>
          )}
          {trip.status === 'in_progress' && !activeStop && (
            <TouchableOpacity style={styles.completeBtn} onPress={handleArriveDestination}>
              <Feather name="flag" size={18} color="#fff" />
              <Text style={styles.btnText}> He llegado al destino</Text>
            </TouchableOpacity>
          )}
          {trip.status === 'arrived_destination' && (
            <Text style={styles.completedText}>
              {trip.trip_type === 'delivery'
                ? 'Esperando que el cliente confirme la recepción...'
                : '⏳ Esperando confirmación del pasajero...'}
            </Text>
          )}
          {trip.status === 'completed' && (
            <Text style={styles.completedText}>✅ Viaje finalizado</Text>
          )}

          {trip.trip_type !== 'delivery' && ['accepted', 'arrived', 'in_progress', 'arrived_destination'].includes(trip.status) && (
            <TouchableOpacity
              style={[styles.completeBtn, { backgroundColor: '#FF5252', marginTop: 8 }]}
              onPress={handleCancelTrip}
            >
              <Feather name="x-circle" size={18} color="#fff" />
              <Text style={styles.btnText}> Cancelar viaje</Text>
            </TouchableOpacity>
          )}

          {trip.trip_type === 'delivery' ? (
            trip.marketplace_order_id && marketplaceOrder ? (
              <>
                {['accepted', 'arrived'].includes(trip.status) && (
                  <TouchableOpacity
                    style={styles.chatButton}
                    onPress={() => router.push({
                      pathname: '/chat',
                      params: {
                        tripId: trip.id,
                        chatParticipantId: marketplaceOrder.seller_id,
                        chatWith: marketplaceOrder.seller?.username || marketplaceOrder.seller?.userlogin || 'Vendedor',
                        returnTo: '/driver/active-trip',
                        returnTripId: tripId,
                      },
                    })}
                  >
                    <Feather name="message-circle" size={20} color="#fff" />
                    <Text style={styles.chatButtonText}> Chatear con Vendedor</Text>
                  </TouchableOpacity>
                )}
                {['accepted', 'arrived', 'picked_up'].includes(trip.status) && (
                  <TouchableOpacity
                    style={styles.chatButton}
                    onPress={() => router.push({
                      pathname: '/chat',
                      params: {
                        tripId: trip.id,
                        chatParticipantId: marketplaceOrder.buyer_id,
                        chatWith: marketplaceOrder.buyer?.username || marketplaceOrder.buyer?.userlogin || 'Comprador',
                        returnTo: '/driver/active-trip',
                        returnTripId: tripId,
                      },
                    })}
                  >
                    <Feather name="message-circle" size={20} color="#fff" />
                    <Text style={styles.chatButtonText}> Chatear con Comprador</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : trip.marketplace_order_id ? (
              <ActivityIndicator style={{ marginTop: 12 }} color="#00C9A7" />
            ) : null
          ) : (
            <TouchableOpacity
              style={styles.chatButton}
              onPress={() => {
                setUnreadMessages(0);
                router.push({
                  pathname: '/chat',
                  params: {
                    tripId,
                    chatParticipantId: trip.passenger?.id,
                    chatWith: trip.passenger?.username || trip.passenger?.userlogin || 'Pasajero',
                    returnTo: '/driver/active-trip',
                  }
                });
              }}
            >
              <Feather name="message-circle" size={20} color="#fff" />
              <Text style={styles.chatButtonText}> Chat</Text>
              {unreadMessages > 0 && <View style={styles.chatBadge}><Text style={styles.chatBadgeText}>{unreadMessages}</Text></View>}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => router.replace('/dashboard')}
          >
            <Feather name="home" size={20} color="#374151" />
            <Text style={styles.homeButtonText}> Volver al inicio</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      <Modal
        visible={selectedImage !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setSelectedImage(null)}
          >
            <Feather name="x" size={28} color="#fff" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={{ uri: selectedImage }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  card: {
    backgroundColor: '#FFFFFF', height: '42%', margin: 12, padding: 0, borderRadius: 20,
    borderWidth: 1, borderColor: '#E5F5F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, overflow: 'hidden',
  },
  cardScroll: { flex: 1 },
  cardContent: { padding: 16, paddingBottom: 24 },
  title: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  subtitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginTop: 12, marginBottom: 8 },
  passengerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  passengerPic: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  value: { fontSize: 16, color: '#374151', marginBottom: 6 },
  price: { fontSize: 22, fontWeight: '700', color: '#00C9A7', marginTop: 8 },
  paymentSection: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginTop: 15 },
  verifyBtn: { backgroundColor: '#4CAF50', borderRadius: 8, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { backgroundColor: '#FF5252', borderRadius: 8, padding: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '600', marginLeft: 4 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  waiting: { marginTop: 10, color: '#888' },
  arriveBtn: { backgroundColor: '#FF9800', borderRadius: 10, padding: 12, marginTop: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  startBtn: { backgroundColor: '#2196F3', borderRadius: 10, padding: 12, marginTop: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  completeBtn: { backgroundColor: '#4CAF50', borderRadius: 10, padding: 12, marginTop: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  stopConfirmBtn: { backgroundColor: '#7C3AED', borderRadius: 10, padding: 12, marginTop: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  cancelDeliveryButton: { backgroundColor: '#DC2626' },
  completedText: { marginTop: 10, color: '#4CAF50', fontWeight: '600' },
  deliveryBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#00C9A7', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 10 },
  deliveryBadgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  stopsBlock: { backgroundColor: '#F5F3FF', borderRadius: 12, padding: 12, marginVertical: 6 },
  stopsHeader: { fontSize: 14, fontWeight: '700', color: '#6D28D9', marginBottom: 6 },
  stopItem: { fontSize: 14, color: '#4C1D95', marginBottom: 3, marginLeft: 4 },
  stopItemDone: { color: '#6D28D9', textDecorationLine: 'line-through', opacity: 0.6 },
  stopItemActive: { fontWeight: '800', color: '#5B21B6' },
  chatButton: { backgroundColor: '#00C9A7', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  chatButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  chatBadge: { position: 'absolute', right: 10, top: -8, minWidth: 24, height: 24, borderRadius: 12, backgroundColor: '#FF5252', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  chatBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  homeButton: { backgroundColor: '#E5E7EB', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  homeButtonText: { color: '#374151', fontWeight: '600', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalCloseButton: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
  modalImage: { width: '100%', height: '100%' },
});

export default DriverActiveTripScreen;