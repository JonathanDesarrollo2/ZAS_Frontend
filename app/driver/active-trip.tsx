// LEIDO
// app/driver/active-trip.tsx
import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Animated, TouchableOpacity,
  BackHandler, Image, Modal, ScrollView, Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, router } from 'expo-router';
import * as Location from 'expo-location';
import { apiClient } from '../../apis/Client';
import { connectSocket, ensurePersistentTripNotification, clearPersistentTripNotification } from '../../services/socketClient';
import { getUnreadCount } from '../../apis/chat';
import { verifyTripPayment, markArrived, startTrip, driverArrivedDestination, cancelTripByDriver, markTripDeliveryPickedUp, markTripDeliveryDelivered } from '../../apis/trips';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import ToastNotification from '../../presentation/components/shared/toastNotification';
import { useAuth } from '../../presentation/store/AuthStore';
import { isChatOpen } from '../../services/chatPresence';
import ReviewModal from '../../components/ReviewModal';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCQQVLprlkXfH6sdrNv0VlVSkEN_2_M-eE';

// Iconos locales para A, B y la posición del conductor, sin URLs externas.
const driverPinIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path fill="#2563EB" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/><circle cx="12" cy="9" r="1.5" fill="#2563EB"/></svg>')}`;
const originPinIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path fill="#00A884" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/><text x="12" y="10.5" text-anchor="middle" font-size="3" font-family="Arial" font-weight="bold" fill="#00A884">A</text></svg>')}`;
const destinationPinIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path fill="#D99A00" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/><text x="12" y="10.5" text-anchor="middle" font-size="3" font-family="Arial" font-weight="bold" fill="#D99A00">B</text></svg>')}`;
const passengerPinIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"><path fill="#00C9A7" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="3" fill="white"/><circle cx="12" cy="9" r="1.5" fill="#00C9A7"/></svg>')}`;

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
  payment_method?: string;
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
  const [loading, setLoading] = useState(true);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [passengerLoc, setPassengerLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [passengerPic, setPassengerPic] = useState<string | null>(null);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  // Badge local de mensajes recibidos durante este viaje.
  const [unreadMessages, setUnreadMessages] = useState(0);
  const lastMessageNoticeAt = useRef(0);
  const proximityAlertsShown = useRef(new Set<string>());
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<WebView>(null);

  useEffect(() => {
    if (trip?.status === 'completed') setReviewModalVisible(true);
  }, [trip?.status]);

  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(message);
    setToastType(type);
    setToastVisible(true);
  };

  const handleDeliveryPickedUp = async () => {
    try {
      await markTripDeliveryPickedUp(tripId!);
      showToast('Producto recibido. Ruta actualizada hacia el comprador.', 'success');
      await fetchTripDetails();
    } catch (err: any) {
      showToast(err.message || 'No se pudo actualizar la entrega');
    }
  };

  const handleDeliveryDelivered = async () => {
    try {
      await markTripDeliveryDelivered(tripId!);
      await clearPersistentTripNotification();
      showToast('Entrega completada', 'success');
      await fetchTripDetails();
      setTimeout(() => router.replace('/dashboard'), 800);
    } catch (err: any) {
      showToast(err.message || 'No se pudo completar la entrega');
    }
  };

  // Polling cada 5 segundos
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

  // Durante el viaje activo la ubicación se comparte cada ~6s y solo si el
  // conductor se movió >15m; la interpolación en cliente cubre la fluidez
  // visual, así que el GPS es solo la fuente de verdad, no la animación.
  // Al salir de la pantalla el watcher se detiene.
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    const startSendingLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 6000,
          distanceInterval: 15,
        },
        (location) => {
          const lat = location.coords.latitude;
          const lng = location.coords.longitude;
          // La ruta al destino debe partir de la posición actual del conductor,
          // no de la ubicación inicial conservada al abrir esta pantalla.
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
  }, [tripId]);

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

  useEffect(() => {
    const backAction = () => {
      if (trip && trip.status !== 'completed' && trip.status !== 'cancelled') {
         showToast('No puedes salir hasta que el viaje finalice.');
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [trip?.status]);

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
          // Limpieza de respaldo si el viaje terminó mientras la app estaba cerrada.
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
         // El conductor recibe confirmación visible además de la actualización de datos.
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
      // El socket es opcional para la pantalla activa; no bloquea el flujo del viaje.
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
      await startTrip(tripId!);
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

  useEffect(() => {
    if (!trip || !driverLoc) return;
    let promptKey: string | null = null;
    let target: { lat: number; lng: number } | null = null;

    if (trip.status === 'accepted') {
      promptKey = `${trip.id}:pickup`;
      const liveLat = passengerLoc?.lat ??
        (trip.live_passenger_lat == null ? Number.NaN : Number(trip.live_passenger_lat));
      const liveLng = passengerLoc?.lng ??
        (trip.live_passenger_lng == null ? Number.NaN : Number(trip.live_passenger_lng));
      target = Number.isFinite(liveLat) && Number.isFinite(liveLng)
        ? { lat: liveLat, lng: liveLng }
        : { lat: Number(trip.pickup_lat), lng: Number(trip.pickup_lng) };
    } else if (trip.status === 'in_progress') {
      promptKey = `${trip.id}:destination`;
      target = { lat: Number(trip.dropoff_lat), lng: Number(trip.dropoff_lng) };
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

    Alert.alert(
      'Destino',
      '¿Ya llegaste al destino? Puedes notificar la llegada para que el pasajero confirme el viaje.',
      [
        { text: 'Sí, notificar llegada', onPress: () => { void handleArriveDestination(); } },
        { text: 'Aún no', style: 'cancel' },
      ],
    );
  }, [driverLoc, passengerLoc, trip]);

  // La ruta cambia al destino desde que el backend marca el viaje en curso.
  const isDestinationLeg = ['in_progress', 'arrived_destination'].includes(String(trip?.status || '').toLowerCase()) ||
    (trip?.trip_type === 'delivery' && trip.status === 'picked_up');
  // CORRECCIÓN CLAVE: el backend guarda las coordenadas como DECIMAL y la API
  // las entrega como TEXTO ("10.1234567"). Al inyectarlas con JSON.stringify
  // quedaban con comillas ({"lat":"10.12"}) y Google DirectionsService las
  // rechazaba: por eso el marcador se veía pero la ruta NUNCA se trazaba.
  // El mapa del pasajero sí funcionaba porque allí se convierte con Number().
  // Aquí se hace exactamente la misma conversión antes de usar cualquier
  // coordenada del viaje.
  const mapDriverLocation = driverLoc ?? (trip ? { lat: Number(trip.pickup_lat), lng: Number(trip.pickup_lng) } : null);
  const routeTarget = trip && isDestinationLeg
    ? { lat: Number(trip.dropoff_lat), lng: Number(trip.dropoff_lng) }
    : { lat: Number(trip?.pickup_lat ?? mapDriverLocation?.lat ?? 0), lng: Number(trip?.pickup_lng ?? mapDriverLocation?.lng ?? 0) };
  // Se usa como origen principal para Directions y como fallback cuando el GPS
  // cae unos metros fuera de una calle enrutable.
  const routeOrigin = mapDriverLocation;

  // El HTML solo cambia por estado/coordenadas del viaje; el GPS mueve el marcador por JS.
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
         let pickupLeg = true;
         let activeRouteTarget, fallbackRouteOrigin;
         // La cámara solo se encuadra una vez por tramo; después se respeta el
         // zoom/centro que el conductor haya elegido manualmente.
         let routeViewportFitted = false;
         // Directions se pide UNA vez por tramo; la polyline se recorta localmente
         // en cada actualización. Solo se vuelve a llamar a Google si el conductor
         // se desvía >90m de la ruta (máx. 1 re-cálculo cada 40s).
         let routePath = [];
         let routePolyline = null;
         let trimIndex = 0;
         let lastRerouteAt = 0;
         let driverAnim = null;

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

          // Recorte local de la polyline: sin llamadas a Directions.
          function trimRouteTo(pos) {
            if (!routePath.length) {
              // Reintento espaciado si el cálculo inicial falló (p.ej. GPS sin vía válida).
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
            // ÚNICA causa de re-cálculo: desvío real >90m de la ruta.
            // 90m descarta ruido de GPS urbano; 40s evita ráfagas de reroutes.
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
             if (!pickupMarker || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
              const passengerPosition = { lat, lng };
              pickupMarker.setPosition(passengerPosition);
              if (pickupLeg && activeRouteTarget &&
                  distMeters(activeRouteTarget, passengerPosition) > 40 &&
                  Date.now() - lastRerouteAt > 40000) {
                lastRerouteAt = Date.now();
                activeRouteTarget = passengerPosition;
                requestRoute(driverMarker.getPosition(), activeRouteTarget, fallbackRouteOrigin);
              }
          }

          function setTripStage(destinationLeg, lat, lng) {
            const stageChanged = pickupLeg === destinationLeg;
            pickupLeg = !destinationLeg;
            if (pickupMarker) pickupMarker.setMap(destinationLeg ? null : map);
            if (destinationMarker) destinationMarker.setMap(destinationLeg ? map : null);
            if (stageChanged) {
              routeViewportFitted = false;
              routePath = [];
              trimIndex = 0;
              if (routePolyline) routePolyline.setPath([]);
            }
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              updateRouteTarget(lat, lng);
            }
          }

        function initMap() {
          const driverPos = { lat: ${mapDriverLocation.lat}, lng: ${mapDriverLocation.lng} };
           const pickupPos = ${trip ? `{ lat: ${Number(trip.pickup_lat)}, lng: ${Number(trip.pickup_lng)} }` : 'null'};
           const destinationPos = ${trip ? `{ lat: ${Number(trip.dropoff_lat)}, lng: ${Number(trip.dropoff_lng)} }` : 'null'};
            const activeOrigin = ${JSON.stringify(routeOrigin)};
            const activeTarget = ${JSON.stringify(routeTarget)};
            pickupLeg = ${!isDestinationLeg};
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
               ${isDestinationLeg} ? null : map
             );
          }
          if (destinationPos) {
            destinationMarker = createMarker(
              destinationPos,
              '${destinationPinIcon}',
              'Destino',
              ${isDestinationLeg} ? map : null
            );
          }

          directionsService = new google.maps.DirectionsService();

          // En recogida se muestra el pasajero; en curso se muestra el destino.
          setTripStage(${isDestinationLeg}, activeTarget && activeTarget.lat, activeTarget && activeTarget.lng);
        }

         // Filtro de ruido GPS: un salto >180 km/h (50 m/s) respecto a la última
         // posición aceptada se IGNORA (ni marcador, ni recorte, ni reroute).
         // Tras 3 descartes seguidos se acepta la siguiente como nueva base.
         let lastAcceptedPos = null, lastAcceptedAt = 0, discardedCount = 0;

         // El marcador se interpola (~2.5s) entre posiciones para que el
         // movimiento se vea fluido aunque el GPS reporte cada ~6s.
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
              // La ruta se recorta localmente en AMBOS tramos, sin llamadas a Google.
              trimRouteTo(pos);
              if (t >= 1) { clearInterval(driverAnim); driverAnim = null; }
            }, 50);
          }
      </script>
      <script async defer src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap"></script>
    </body>
    </html>
  `
    // Los cambios de etapa se aplican por JavaScript para conservar el mapa cargado.
    : '', [trip?.id, trip?.pickup_lat, trip?.pickup_lng, trip?.dropoff_lat, trip?.dropoff_lng, trip?.trip_type]);
  const mapSource = useMemo(() => ({ html: mapHTML }), [mapHTML]);

  useEffect(() => {
    if (!trip) return;
    mapRef.current?.injectJavaScript(
      `window.setTripStage && window.setTripStage(${isDestinationLeg}, ${routeTarget.lat}, ${routeTarget.lng}); true;`
    );
  }, [isDestinationLeg, routeTarget.lat, routeTarget.lng, trip?.id]);

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
        ref={mapRef}
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
            `window.setTripStage && window.setTripStage(${isDestinationLeg}, ${routeTarget.lat}, ${routeTarget.lng}); true;`
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
        <Text style={styles.value}>🏁 Destino: {normalizeAddress(trip.dropoff_address)}</Text>
        <Text style={styles.price}>💰 ${Number(trip.price).toFixed(2)}</Text>

        {/* Sección de pago según método */}
        {trip.trip_type === 'delivery' ? (
          <View style={styles.paymentSection}>
            <Text style={styles.subtitle}>Pago de la entrega</Text>
            <Text style={styles.value}>El producto fue confirmado por el vendedor.</Text>
            <Text style={styles.value}>Tarifa de entrega en efectivo: ${Number(trip.price).toFixed(2)}</Text>
          </View>
        ) : isAppPayment ? (
          <View style={styles.paymentSection}>
            <Text style={styles.subtitle}>Pago automático</Text>
            <Text style={styles.value}>El pasajero pagará con saldo de la app al finalizar.</Text>
          </View>
        ) : (
          <>
            {trip.payment_status === 'paid' && (
              <View style={styles.paymentSection}>
                <Text style={styles.subtitle}>Comprobante de pago</Text>
                <Text style={styles.value}>🏦 Banco: {trip.payer_bank}</Text>
                <Text style={styles.value}>🆔 Cédula: {trip.payer_cedula}</Text>
                <Text style={styles.value}>📞 Teléfono: {trip.payer_phone}</Text>
                <Text style={styles.value}>🔢 Ref: {trip.payment_reference}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 }}>
                  <TouchableOpacity style={styles.verifyBtn} onPress={() => handleVerifyPayment('verify')}>
                    <Feather name="check" size={18} color="#fff" />
                    <Text style={styles.btnText}> Verificar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleVerifyPayment('reject')}>
                    <Feather name="x" size={18} color="#fff" />
                    <Text style={styles.btnText}> Rechazar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {trip.payment_status === 'verified' && (
              <View style={styles.verifiedBadge}>
                <Feather name="check-circle" size={20} color="#4CAF50" />
                <Text style={{ marginLeft: 8, color: '#4CAF50', fontWeight: '600' }}>Pago verificado</Text>
              </View>
            )}
            {trip.payment_status === 'pending' && (
              <Text style={styles.waiting}>⏳ Esperando comprobante de pago...</Text>
            )}
          </>
        )}

        {/* 🔘 BOTONES DE ACCIÓN */}
        {trip.status === 'accepted' && (
          <TouchableOpacity style={styles.arriveBtn} onPress={handleArrive}>
            <Feather name="map-pin" size={18} color="#fff" />
            <Text style={styles.btnText}> He llegado al origen</Text>
          </TouchableOpacity>
        )}
        {trip.status === 'arrived' && (
          <TouchableOpacity style={styles.startBtn} onPress={trip.trip_type === 'delivery' ? handleDeliveryPickedUp : handleStartTrip}>
            <Feather name={trip.trip_type === 'delivery' ? 'package' : 'user-check'} size={18} color="#fff" />
            <Text style={styles.btnText}>{trip.trip_type === 'delivery' ? ' Producto Recibido' : ' Pasajero a bordo'}</Text>
          </TouchableOpacity>
        )}
        {trip.trip_type === 'delivery' && trip.status === 'picked_up' && (
          <TouchableOpacity style={styles.completeBtn} onPress={handleDeliveryDelivered}>
            <Feather name="check-circle" size={18} color="#fff" />
            <Text style={styles.btnText}> Entregado</Text>
          </TouchableOpacity>
        )}
        {trip.status === 'in_progress' && (
          <TouchableOpacity style={styles.completeBtn} onPress={handleArriveDestination}>
            <Feather name="flag" size={18} color="#fff" />
            <Text style={styles.btnText}> He llegado al destino</Text>
          </TouchableOpacity>
        )}
        {trip.status === 'arrived_destination' && (
          <Text style={styles.completedText}>⏳ Esperando confirmación del pasajero...</Text>
        )}
        {trip.status === 'completed' && (
          <Text style={styles.completedText}>✅ Viaje finalizado</Text>
        )}

        {/* Botón cancelar SIEMPRE (excepto finalizado/cancelado) */}
        {trip.trip_type !== 'delivery' && ['accepted', 'arrived', 'in_progress', 'arrived_destination'].includes(trip.status) && (
          <TouchableOpacity
            style={[styles.completeBtn, { backgroundColor: '#FF5252', marginTop: 8 }]}
            onPress={handleCancelTrip}
          >
            <Feather name="x-circle" size={18} color="#fff" />
            <Text style={styles.btnText}> Cancelar viaje</Text>
          </TouchableOpacity>
        )}

        {/* Chat */}
        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => {
            setUnreadMessages(0);
            router.push({
              pathname: '/chat',
              params: {
                tripId,
                chatWith: trip.passenger?.username || trip.passenger?.userlogin || 'Pasajero',
                chatWithPhoto: passengerPic || '',
              }
            });
          }}
        >
          <Feather name="message-circle" size={20} color="#fff" />
          <Text style={styles.chatButtonText}> Chat</Text>
          {unreadMessages > 0 && <View style={styles.chatBadge}><Text style={styles.chatBadgeText}>{unreadMessages}</Text></View>}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.replace('/dashboard')}
        >
          <Feather name="home" size={20} color="#374151" />
          <Text style={styles.homeButtonText}> Volver al inicio</Text>
        </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {/* Modal imagen */}
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
  completedText: { marginTop: 10, color: '#4CAF50', fontWeight: '600' },
  deliveryBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#00C9A7', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 10 },
  deliveryBadgeText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
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
