// LEIDO
// app/request-ride.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Animated, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, ActivityIndicator, TextInput, Modal, FlatList,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { createTrip, estimatePrice, getActiveTrip } from '../apis/trips';
import { useAutocomplete } from '../presentation/hooks/use-autocomplete';
import { reverseGeocode } from '../utils/geocoding';
import MapSelector from '../presentation/components/shared/mapSelector';
import { apiClient } from '../apis/Client';
import RideRouteMap from '../presentation/components/shared/rideRouteMap';
import { createSavedLocation, deleteSavedLocation, getSavedLocations, SavedLocation, updateSavedLocation } from '../apis/savedLocations';
import { themeColors } from '../presentation/theme/themeColors';
import { useAuth } from '../presentation/store/AuthStore';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

type StopDraft = {
  address: string;
  lat: number | null;
  lng: number | null;
};

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

// ---------- Modal de sugerencias ----------
const SuggestionsModal = ({
  visible,
  suggestions,
  onSelect,
  onClose,
}: {
  visible: boolean;
  suggestions: { description: string; placeId: string }[];
  onSelect: (placeId: string) => void;
  onClose: () => void;
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.suggestionsModalOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.suggestionsModalContainer}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.placeId}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.suggestionItem} onPress={() => onSelect(item.placeId)}>
                <Feather name="map-pin" size={16} color="#6B7280" style={{ marginRight: 8 }} />
                <Text style={styles.suggestionText}>{item.description}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const RequestRideScreen = () => {
  const { user } = useAuth();
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoaded, setLocationLoaded] = useState(false);

  // Autocompletado sin restricción de ubicación
  const originAuto = useAutocomplete();
  const destAuto = useAutocomplete();

  const [origin, setOrigin] = useState('');
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState('');
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [stops, setStops] = useState<StopDraft[]>([]);
  const [activeStopIndex, setActiveStopIndex] = useState<number | null>(null);
  const [scheduledTrip, setScheduledTrip] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [schedulePickerMode, setSchedulePickerMode] = useState<'date' | 'time' | null>(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [saveLocationModalVisible, setSaveLocationModalVisible] = useState(false);
  const [saveLocationName, setSaveLocationName] = useState('');
  const [saveLocationField, setSaveLocationField] = useState<'origin' | 'dest'>('origin');
  const [resettingGps, setResettingGps] = useState(false);

  const [selectedVehicle, setSelectedVehicle] = useState('moto');
  const [loading, setLoading] = useState(false);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isCustomPrice, setIsCustomPrice] = useState(false);
  const [customPrice, setCustomPrice] = useState('');

  const [mapSelectorVisible, setMapSelectorVisible] = useState(false);
  const [mapTargetField, setMapTargetField] = useState<'origin' | 'dest' | 'stop'>('dest');
  const [mapTargetStopIndex, setMapTargetStopIndex] = useState<number | null>(null);

  const [suggestionsModalVisible, setSuggestionsModalVisible] = useState(false);
  const [activeSuggestionField, setActiveSuggestionField] = useState<'origin' | 'dest' | 'stop'>('dest');

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg); setToastType(type); setToastVisible(true);
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }, []);

  // Obtener tasa de cambio
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
    getSavedLocations()
      .then((response) => {
        if (response.result) setSavedLocations(response.content);
      })
      .catch(() => showToast('No se pudieron cargar tus ubicaciones guardadas'));
  }, [showToast]);

  // Obtener ubicación actual y usarla como origen por defecto
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showToast('Permiso de ubicación denegado');
        setLocationLoaded(true); // para no bloquear la pantalla
        return;
      }
      try {
        let location = await Location.getCurrentPositionAsync({});
        const loc = { latitude: location.coords.latitude, longitude: location.coords.longitude };
        setCurrentLocation(loc);
        setOriginCoords({ lat: loc.latitude, lng: loc.longitude });
        const addr = await reverseGeocode(loc.latitude, loc.longitude);
        setOrigin(addr);
      } catch (e) {
        showToast('No se pudo obtener tu ubicación');
      } finally {
        setLocationLoaded(true);
      }
    })();
  }, []);

  const handleOriginSelect = async (placeId: string) => {
    const coords = await originAuto.selectSuggestion(placeId);
    if (coords) {
      setOriginCoords(coords);
      const addr = await reverseGeocode(coords.lat, coords.lng);
      setOrigin(addr);
      setSuggestionsModalVisible(false);
    }
  };

  const handleDestSelect = async (placeId: string) => {
    const coords = await destAuto.selectSuggestion(placeId);
    if (coords) {
      setDestCoords(coords);
      const addr = await reverseGeocode(coords.lat, coords.lng);
      setDestination(addr);
      setSuggestionsModalVisible(false);
    }
  };

  const handleStopSelect = async (placeId: string) => {
    if (activeStopIndex === null) return;
    const coords = await destAuto.selectSuggestion(placeId);
    if (!coords) return;
    const address = await reverseGeocode(coords.lat, coords.lng);
    setStops((current) => current.map((stop, index) =>
      index === activeStopIndex ? { address, lat: coords.lat, lng: coords.lng } : stop
    ));
    setSuggestionsModalVisible(false);
    destAuto.clearSuggestions();
  };

  const openSuggestions = (field: 'origin' | 'dest' | 'stop') => {
    setActiveSuggestionField(field);
    setSuggestionsModalVisible(true);
  };

  const openMapForField = (field: 'origin' | 'dest' | 'stop', stopIndex?: number) => {
    setMapTargetField(field);
    if (field !== 'stop') setSaveLocationField(field);
    setMapTargetStopIndex(stopIndex ?? null);
    setMapSelectorVisible(true);
  };

  const getMapInitialCoords = (): { lat: number; lng: number } => {
    const gpsCoords = currentLocation
      ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
      : null;
    const fallbackCoords = { lat: 10.071866, lng: -66.869583 };
    if (mapTargetField === 'origin') return originCoords || gpsCoords || destCoords || fallbackCoords;
    if (mapTargetField === 'stop' && mapTargetStopIndex !== null) {
      const stop = stops[mapTargetStopIndex];
      if (stop?.lat !== null && stop?.lat !== undefined && stop?.lng !== null && stop?.lng !== undefined) {
        return { lat: stop.lat, lng: stop.lng };
      }
      return originCoords || gpsCoords || destCoords || fallbackCoords;
    }
    return destCoords || originCoords || gpsCoords || fallbackCoords;
  };

  const handleMapConfirm = (address: string, lat: number, lng: number) => {
    if (mapTargetField === 'origin') {
      setOrigin(address);
      setOriginCoords({ lat, lng });
      originAuto.clearSuggestions();
    } else if (mapTargetField === 'dest') {
      setDestination(address);
      setDestCoords({ lat, lng });
      destAuto.clearSuggestions();
    } else if (mapTargetStopIndex !== null) {
      setStops((current) => current.map((stop, index) =>
        index === mapTargetStopIndex ? { address, lat, lng } : stop
      ));
      destAuto.clearSuggestions();
    }
    setMapSelectorVisible(false);
  };

  const addStop = () => {
    if (stops.length >= 8) {
      showToast('Puedes agregar hasta 8 paradas');
      return;
    }
    setStops((current) => [...current, { address: '', lat: null, lng: null }]);
  };

  const removeStop = (indexToRemove: number) => {
    setStops((current) => current.filter((_, index) => index !== indexToRemove));
    setActiveStopIndex((current) =>
      current === indexToRemove ? null : current !== null && current > indexToRemove ? current - 1 : current
    );
  };

  const chooseSavedLocation = (location: SavedLocation, field: 'origin' | 'dest') => {
    const point = { lat: Number(location.lat), lng: Number(location.lng) };
    if (field === 'origin') {
      setOrigin(location.address);
      setOriginCoords(point);
      originAuto.clearSuggestions();
    } else {
      setDestination(location.address);
      setDestCoords(point);
      destAuto.clearSuggestions();
    }
  };

  const resetOriginToGps = async () => {
    if (resettingGps) return;
    setResettingGps(true);
    setOrigin('');
    setOriginCoords(null);
    originAuto.setQuery('');
    originAuto.clearSuggestions();
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('Permite el acceso a tu ubicación para volver al GPS.');
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setCurrentLocation(coords);
      setOriginCoords({ lat: coords.latitude, lng: coords.longitude });
      setOrigin(await reverseGeocode(coords.latitude, coords.longitude));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo actualizar la ubicación GPS');
    } finally {
      setResettingGps(false);
    }
  };

  const confirmDeleteSavedLocation = (location: SavedLocation) => {
    Alert.alert(
      'Eliminar ubicación',
      '¿Estás seguro de eliminar esta ubicación guardada?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await deleteSavedLocation(location.id);
              if (!response.result) throw new Error('No se pudo eliminar la ubicación guardada');
              setSavedLocations((current) => current.filter((saved) => saved.id !== location.id));
              showToast('Ubicación eliminada', 'success');
            } catch (error) {
              showToast(error instanceof Error ? error.message : 'No se pudo eliminar la ubicación');
            }
          },
        },
      ],
    );
  };

  const saveCurrentLocation = async (field: 'origin' | 'dest', name: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      showToast('Escribe un nombre para la ubicación');
      return false;
    }
    const coords = field === 'origin' ? originCoords : destCoords;
    const address = field === 'origin' ? origin : destination;
    if (!coords || !address.trim()) {
      showToast(`Selecciona una ubicación válida para guardar ${normalizedName.toLowerCase()}`);
      return false;
    }
    try {
      const existing = savedLocations.find((item) => item.name.toLowerCase() === normalizedName.toLowerCase());
      const payload = { name: normalizedName, address, lat: coords.lat, lng: coords.lng };
      const response = existing
        ? await updateSavedLocation(existing.id, payload)
        : await createSavedLocation(payload);
      if (!response.result) throw new Error('No se pudo guardar la ubicación');
      const refreshed = await getSavedLocations();
      if (refreshed.result) setSavedLocations(refreshed.content);
      showToast(`${normalizedName} guardado`, 'success');
      return true;
    } catch (error: any) {
      showToast(error.message || 'No se pudo guardar la ubicación');
      return false;
    }
  };

  const openSaveLocationModal = (field: 'origin' | 'dest') => {
    setSaveLocationField(field);
    setSaveLocationName('');
    setSaveLocationModalVisible(true);
  };

  const confirmSaveLocation = async () => {
    if (await saveCurrentLocation(saveLocationField, saveLocationName)) {
      setSaveLocationModalVisible(false);
    }
  };

  const distanceKm = originCoords && destCoords
    ? (() => {
        const radians = (degrees: number) => degrees * Math.PI / 180;
        const latDelta = radians(destCoords.lat - originCoords.lat);
        const lngDelta = radians(destCoords.lng - originCoords.lng);
        const a = Math.sin(latDelta / 2) ** 2 +
          Math.cos(radians(originCoords.lat)) * Math.cos(radians(destCoords.lat)) *
          Math.sin(lngDelta / 2) ** 2;
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      })()
    : null;
  const displayedDistanceKm = routeDistanceKm ?? distanceKm;
  const validMapStops = stops.flatMap((stop) =>
    stop.lat !== null && stop.lng !== null ? [{ lat: stop.lat, lng: stop.lng, address: stop.address }] : []
  );
  const stopRouteKey = validMapStops.map((stop) => `${stop.lat}:${stop.lng}`).join('|');
  const stopSurcharge = validMapStops.length * 0.5;
  const basePrice = isCustomPrice && customPrice ? parseFloat(customPrice) : (estimatedPrice || 0);
  const displayedPrice = basePrice + stopSurcharge;

  const renderSavedLocationChips = (field: 'origin' | 'dest') => (
    <View style={styles.savedLocationRow}>
      {savedLocations.map((saved) => {
        const iconName = saved.name.toLowerCase() === 'casa'
          ? 'home'
          : saved.name.toLowerCase() === 'trabajo'
            ? 'briefcase'
            : 'map-pin';
        return (
          <TouchableOpacity
            key={`${field}-${saved.id}`}
            style={styles.favoriteChip}
            onLongPress={() => confirmDeleteSavedLocation(saved)}
            delayLongPress={2000}
            onPress={() => {
              setSaveLocationField(field);
              chooseSavedLocation(saved, field);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Usar ${saved.name} como ${field === 'origin' ? 'origen' : 'destino'}`}
          >
            <Feather name={iconName} size={14} color={themeColors.brand} />
            <Text style={styles.favoriteText}>{saved.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // Cálculo del precio estimado usando las coordenadas del origen seleccionado
  useEffect(() => {
    if (destCoords && originCoords) {
      estimatePrice(originCoords.lat, originCoords.lng, destCoords.lat, destCoords.lng)
        .then(setEstimatedPrice).catch(() => setEstimatedPrice(null));
    }
  }, [destCoords, originCoords, selectedVehicle]);

  useEffect(() => {
    setRouteDistanceKm(null);
  }, [originCoords?.lat, originCoords?.lng, destCoords?.lat, destCoords?.lng, stopRouteKey]);

  const handleRequestRide = async () => {
    if (!origin.trim() || !destination.trim()) { showToast('Completa origen y destino'); return; }
    if (!originCoords) { showToast('Selecciona un origen válido'); return; }
    if (!destCoords) { showToast('Selecciona un destino válido'); return; }
    if (selectedVehicle !== 'moto') { showToast('Solo moto disponible'); return; }
    if (stops.some((stop) => !stop.address.trim() || stop.lat === null || stop.lng === null)) {
      showToast('Selecciona una ubicación válida para cada parada');
      return;
    }
    if (scheduledTrip && scheduledAt.getTime() <= Date.now() + 15 * 60 * 1000) {
      showToast('Programa el viaje con al menos 15 minutos de anticipación');
      return;
    }

    // Verificar si ya hay un viaje activo antes de crear otro
    try {
      const activeRes = await getActiveTrip();
      if (activeRes.result && activeRes.content) {
        Alert.alert('Viaje en curso', 'Ya tienes un viaje activo. Continúa con él.');
        const activeTrip = activeRes.content;
        router.replace({
          pathname: '/trip-active',
          params: {
            tripId: activeTrip.id,
            driverId: activeTrip.driver_id,
            driverName: activeTrip.driver?.username || activeTrip.driver?.userlogin || 'Conductor',
            vehicle: activeTrip.vehicle_type || 'Moto',
          },
        });
        return;
      }
    } catch (err) { /* Silencioso */ }

    setLoading(true);
    try {
      const payload = {
        pickup_lat: originCoords.lat,
        pickup_lng: originCoords.lng,
        pickup_address: origin,
        dropoff_lat: destCoords.lat,
        dropoff_lng: destCoords.lng,
        dropoff_address: destination,
        vehicle_type: selectedVehicle,
        trip_type: 'ride' as const,
        stops: validMapStops,
        is_scheduled: scheduledTrip,
        scheduled_at: scheduledTrip ? scheduledAt.toISOString() : null,
        price: isCustomPrice && basePrice > 0 ? basePrice : undefined,
        payment_method: 'cash',
      };
      const response = await createTrip(payload);
      if (response.result) {
        showToast(scheduledTrip ? 'Viaje programado' : 'Viaje solicitado', 'success');
        setTimeout(() => router.push({
          pathname: '/trip-waiting',
          params: {
            tripId: response.content?.id,
            isScheduled: scheduledTrip ? 'true' : 'false',
            scheduledAt: scheduledTrip ? scheduledAt.toISOString() : '',
          },
        }), 500);
      } else {
        const errorMsg = response.error?.[0] || 'No se pudo solicitar el viaje';
        if (errorMsg.toLowerCase().includes('zona')) {
          Alert.alert('Zona no disponible', 'El origen seleccionado está fuera de nuestra área de servicio.');
        } else {
          showToast(errorMsg);
        }
      }
    } catch (err: any) {
      const msg = err.message || 'Error al solicitar viaje';
      if (msg.toLowerCase().includes('zona')) {
        Alert.alert('Zona no disponible', 'El origen seleccionado está fuera de nuestra área de servicio.');
      } else {
        showToast(msg);
      }
    } finally { setLoading(false); }
  };

  const handleRequestRidePress = () => {
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
    void handleRequestRide();
  };

  if (!locationLoaded) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator size="large" color="#00C9A7" />
        <Text style={{ marginTop: 16, color: '#6B7280' }}>Obteniendo ubicación...</Text>
      </View>
    );
  }

  const activeSuggestions = activeSuggestionField === 'origin' ? originAuto.suggestions : destAuto.suggestions;

  return (
    <View style={styles.screen}>
      <Toast message={toastMsg} type={toastType} visible={toastVisible} onHide={() => setToastVisible(false)} />
      <View style={styles.mapPane}>
        <RideRouteMap
          origin={originCoords}
          destination={destCoords}
          stops={validMapStops}
          currentLocation={currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : null}
          onRouteDistance={setRouteDistanceKm}
        />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.bottomSheet}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Origen */}
            <View style={styles.fieldContainer}>
              <Feather name="circle" size={14} color="#00967D" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Dirección de recogida"
                value={originAuto.showSuggestions ? originAuto.query : origin}
                onFocus={() => {
                  setSaveLocationField('origin');
                  originAuto.setShowSuggestions(true);
                  originAuto.setQuery(origin);
                  openSuggestions('origin');
                }}
                onChangeText={(t) => {
                  setSaveLocationField('origin');
                  originAuto.setQuery(t);
                  originAuto.fetchSuggestions(t);
                }}
                onBlur={() => {
                  if (!originAuto.suggestions.length) {
                    // Si no hay sugerencias, conservar el texto como dirección (sin coordenadas)
                    setOrigin(originAuto.query || origin);
                  }
                  originAuto.clearSuggestions();
                }}
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity
                style={styles.gpsResetButton}
                onPress={() => void resetOriginToGps()}
                disabled={resettingGps}
                accessibilityRole="button"
                accessibilityLabel="Restablecer origen a mi ubicación GPS"
              >
                {resettingGps
                  ? <ActivityIndicator size="small" color="#DC2626" />
                  : <Feather name="crosshair" size={17} color="#DC2626" />}
                <Text style={styles.gpsResetText}>Mi ubicación</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openMapForField('origin')}>
                <Feather name="map" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            {renderSavedLocationChips('origin')}

            {stops.map((stop, index) => (
              <View key={`stop-${index}`} style={styles.stopRow}>
                <Feather name="more-vertical" size={16} color="#00967D" />
                <TextInput
                  style={styles.fieldInput}
                  placeholder={`Parada ${index + 1}`}
                  value={activeStopIndex === index && destAuto.showSuggestions ? destAuto.query : stop.address}
                  onFocus={() => {
                    setActiveStopIndex(index);
                    setSaveLocationField('dest');
                    destAuto.setShowSuggestions(true);
                    destAuto.setQuery(stop.address);
                    openSuggestions('stop');
                  }}
                  onChangeText={(text) => {
                    setActiveStopIndex(index);
                    setStops((current) => current.map((item, stopIndex) =>
                      stopIndex === index ? { ...item, address: text, lat: null, lng: null } : item
                    ));
                    destAuto.setQuery(text);
                    destAuto.fetchSuggestions(text);
                  }}
                  onBlur={() => {
                    if (!destAuto.suggestions.length) {
                      setStops((current) => current.map((item, stopIndex) =>
                        stopIndex === index
                          ? { ...item, address: destAuto.query || item.address }
                          : item
                      ));
                    }
                    if (!suggestionsModalVisible) destAuto.clearSuggestions();
                  }}
                  placeholderTextColor="#9CA3AF"
                />
                <TouchableOpacity
                  onPress={() => openMapForField('stop', index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Seleccionar parada ${index + 1} en el mapa`}
                >
                  <Feather name="map" size={20} color="#9CA3AF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => removeStop(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Eliminar parada ${index + 1}`}
                >
                  <Feather name="x-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            ))}

            {/* Destino */}
            <View style={styles.fieldContainer}>
              <Feather name="map-pin" size={14} color="#00967D" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Destino final"
                value={destAuto.showSuggestions ? destAuto.query : destination}
                onFocus={() => {
                  setSaveLocationField('dest');
                  destAuto.setShowSuggestions(true);
                  destAuto.setQuery(destination);
                  openSuggestions('dest');
                }}
                onChangeText={(t) => {
                  setSaveLocationField('dest');
                  destAuto.setQuery(t);
                  destAuto.fetchSuggestions(t);
                }}
                onBlur={() => {
                  if (!destAuto.suggestions.length) {
                    setDestination(destAuto.query || destination);
                  }
                  destAuto.clearSuggestions();
                }}
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity onPress={() => openMapForField('dest')}>
                <Feather name="map" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            {renderSavedLocationChips('dest')}
            <TouchableOpacity
              style={styles.addStopButton}
              onPress={addStop}
              accessibilityRole="button"
            >
              <Feather name="plus-circle" size={17} color="#00967D" />
              <Text style={styles.addStopText}>Añadir parada</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveLocationButton}
              onPress={() => openSaveLocationModal(saveLocationField)}
              accessibilityRole="button"
            >
              <Feather name="bookmark" size={16} color="#00967D" />
              <Text style={styles.saveLocationButtonText}>Guardar esta ubicación</Text>
              <Text style={styles.saveLocationFieldText}>
                {saveLocationField === 'origin' ? 'Origen' : 'Destino'}
              </Text>
            </TouchableOpacity>

            <View style={styles.tripSummary}>
              <Text style={styles.distanceText}>
                Distancia: {displayedDistanceKm === null ? '--' : `${displayedDistanceKm.toFixed(1)} km`}
              </Text>
              <View style={styles.priceBlock}>
                <Text style={styles.priceText}>
                  {estimatedPrice === null ? 'Calculando...' : `$${displayedPrice.toFixed(2)}`}
                </Text>
                {estimatedPrice !== null && exchangeRate !== null && (
                  <Text style={styles.vesPrice}>≈ Bs. {(displayedPrice * exchangeRate).toFixed(2)}</Text>
                )}
              </View>
            </View>
            {stops.length > 0 && (
              <Text style={styles.stopSurchargeText}>
                Incluye $0.50 adicionales por cada parada
              </Text>
            )}

            <TouchableOpacity
              style={[styles.scheduleToggle, scheduledTrip && styles.scheduleToggleSelected]}
              onPress={() => {
                setScheduledTrip((current) => !current);
                setSchedulePickerMode(null);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: scheduledTrip }}
            >
              <Feather name="calendar" size={18} color={scheduledTrip ? '#FFFFFF' : '#00967D'} />
              <Text style={[styles.scheduleToggleText, scheduledTrip && styles.scheduleToggleTextSelected]}>
                {scheduledTrip ? 'Viaje programado' : 'Programar viaje para más tarde'}
              </Text>
              <Feather name={scheduledTrip ? 'check-circle' : 'chevron-down'} size={18} color={scheduledTrip ? '#FFFFFF' : '#6B7280'} />
            </TouchableOpacity>
            {scheduledTrip && (
              <View style={styles.scheduleCard}>
                <Text style={styles.scheduleDescription}>Selecciona fecha y hora (mínimo 15 minutos desde ahora).</Text>
                <View style={styles.schedulePickerRow}>
                  <TouchableOpacity
                    style={styles.schedulePickerButton}
                    onPress={() => setSchedulePickerMode('date')}
                  >
                    <Feather name="calendar" size={16} color="#00967D" />
                    <Text style={styles.schedulePickerText}>
                      {scheduledAt.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.schedulePickerButton}
                    onPress={() => setSchedulePickerMode('time')}
                  >
                    <Feather name="clock" size={16} color="#00967D" />
                    <Text style={styles.schedulePickerText}>
                      {scheduledAt.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </TouchableOpacity>
                </View>
                {schedulePickerMode && (
                  <>
                    <DateTimePicker
                      value={scheduledAt}
                      mode={schedulePickerMode}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      minimumDate={new Date()}
                      onChange={(event: DateTimePickerEvent, value?: Date) => {
                        if (Platform.OS !== 'ios' || event.type === 'dismissed') {
                          setSchedulePickerMode(null);
                        }
                        if (value && event.type !== 'dismissed') setScheduledAt(value);
                      }}
                    />
                    {Platform.OS === 'ios' && (
                      <TouchableOpacity
                        style={styles.schedulePickerDone}
                        onPress={() => setSchedulePickerMode(null)}
                      >
                        <Text style={styles.schedulePickerDoneText}>Listo</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            )}

            {/* Vehículo */}
            <Text style={styles.sectionTitle}>Vehículo</Text>
            <View style={styles.vehicleRow}>
              <TouchableOpacity
                style={[styles.vehicleCard, selectedVehicle === 'moto' && styles.vehicleSelected]}
                onPress={() => setSelectedVehicle('moto')}
              >
                 <MaterialCommunityIcons name="motorbike" size={26} color={selectedVehicle === 'moto' ? '#fff' : '#00C9A7'} />
                <Text style={[styles.vehicleLabel, selectedVehicle === 'moto' && { color: '#fff' }]}>Moto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.vehicleCard, styles.vehicleDisabled]} disabled>
                 <MaterialCommunityIcons name="car" size={26} color="#B0BEC5" />
                <Text style={[styles.vehicleLabel, { color: '#B0BEC5' }]}>Auto (próximo)</Text>
              </TouchableOpacity>
            </View>

            {!isCustomPrice && estimatedPrice && (
              <TouchableOpacity
                style={styles.adjustButton}
                onPress={() => { setIsCustomPrice(true); setCustomPrice(estimatedPrice.toFixed(2)); }}
              >
                <Text style={styles.adjustButtonText}>Ajustalo tú</Text>
              </TouchableOpacity>
            )}
            {isCustomPrice && (
              <View style={styles.customPriceRow}>
                <TextInput
                  style={styles.customPriceInput}
                  keyboardType="decimal-pad"
                  value={customPrice}
                  onChangeText={setCustomPrice}
                  placeholder="Precio"
                />
                <TouchableOpacity style={styles.confirmPriceButton} onPress={() => { setIsCustomPrice(true); showToast(`Precio ajustado a $${parseFloat(customPrice).toFixed(2)}`, 'success'); }}>
                  <Feather name="check" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelPriceButton} onPress={() => setIsCustomPrice(false)}>
                  <Feather name="x" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            {/* Botón solicitar */}
            <TouchableOpacity
              style={[styles.requestBtn, loading && { opacity: 0.7 }]}
              onPress={handleRequestRidePress}
              disabled={loading || selectedVehicle !== 'moto'}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Feather name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.requestBtnText}>Solicitar viaje</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal sugerencias */}
      <SuggestionsModal
        visible={suggestionsModalVisible && activeSuggestions.length > 0}
        suggestions={activeSuggestions}
        onSelect={
          activeSuggestionField === 'origin'
            ? handleOriginSelect
            : activeSuggestionField === 'stop'
              ? handleStopSelect
              : handleDestSelect
        }
        onClose={() => setSuggestionsModalVisible(false)}
      />

      {/* Modal mapa */}
      <MapSelector
        visible={mapSelectorVisible}
        initialCoords={getMapInitialCoords()}
        onConfirm={handleMapConfirm}
        onCancel={() => setMapSelectorVisible(false)}
      />

      <Modal
        visible={saveLocationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSaveLocationModalVisible(false)}
      >
        <View style={styles.saveLocationModalOverlay}>
          <View style={styles.saveLocationModal}>
            <Text style={styles.saveLocationModalTitle}>Guardar ubicación</Text>
            <Text style={styles.saveLocationModalDescription}>Escribe un nombre para encontrarla fácilmente.</Text>
            <TextInput
              style={styles.saveLocationNameInput}
              value={saveLocationName}
              onChangeText={setSaveLocationName}
              placeholder="Ej. Casa, trabajo..."
              placeholderTextColor="#9CA3AF"
              maxLength={50}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmSaveLocation}
            />
            <View style={styles.saveLocationModalActions}>
              <TouchableOpacity
                style={styles.saveLocationCancelButton}
                onPress={() => setSaveLocationModalVisible(false)}
              >
                <Text style={styles.saveLocationCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveLocationConfirmButton, !saveLocationName.trim() && styles.saveLocationConfirmDisabled]}
                onPress={confirmSaveLocation}
                disabled={!saveLocationName.trim()}
              >
                <Text style={styles.saveLocationConfirmText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  mapPane: { flex: 2, minHeight: 200 },
  bottomSheet: {
    flex: 3, backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    marginTop: -16, paddingTop: 4, elevation: 12,
  },
  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  fieldContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 12, paddingHorizontal: 12, height: 48, marginBottom: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  stopRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 12, paddingHorizontal: 12, height: 48, marginBottom: 10,
    borderWidth: 1, borderColor: '#D1FAE5',
  },
  fieldInput: { flex: 1, fontSize: 15, color: '#111827', marginLeft: 7 },
  gpsResetButton: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 7 },
  gpsResetText: { color: '#B91C1C', fontSize: 10, fontWeight: '700' },
  savedLocationRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: -4, marginBottom: 8 },
  favoriteChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#ECFDF8' },
  favoriteText: { color: themeColors.foreground, fontSize: 12, fontWeight: '600' },
  saveLocationButton: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 2, marginTop: -4, marginBottom: 5 },
  saveLocationButtonText: { color: '#008F79', fontSize: 12, fontWeight: '700' },
  saveLocationFieldText: { color: '#6B7280', fontSize: 11, fontWeight: '500' },
  addStopButton: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingVertical: 6, marginTop: -5, marginBottom: 5 },
  addStopText: { color: '#008F79', fontSize: 13, fontWeight: '700' },
  saveLocationModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  saveLocationModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    elevation: 10,
  },
  saveLocationModalTitle: { color: '#111827', fontSize: 18, fontWeight: '700' },
  saveLocationModalDescription: { color: '#6B7280', fontSize: 14, marginTop: 6, marginBottom: 16 },
  saveLocationNameInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#111827',
    fontSize: 16,
  },
  saveLocationModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  saveLocationCancelButton: { paddingHorizontal: 14, paddingVertical: 11 },
  saveLocationCancelText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  saveLocationConfirmButton: { backgroundColor: '#00C9A7', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
  saveLocationConfirmDisabled: { opacity: 0.5 },
  saveLocationConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  tripSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5, marginBottom: 1 },
  stopSurchargeText: { color: '#6B7280', fontSize: 11, textAlign: 'right', marginBottom: 4 },
  scheduleToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F0FDF9', borderRadius: 12, borderWidth: 1, borderColor: '#D1FAE5',
    paddingHorizontal: 12, paddingVertical: 11, marginTop: 8,
  },
  scheduleToggleSelected: { backgroundColor: '#00967D', borderColor: '#00967D' },
  scheduleToggleText: { flex: 1, marginHorizontal: 10, color: '#1F2937', fontSize: 14, fontWeight: '600' },
  scheduleToggleTextSelected: { color: '#FFFFFF' },
  scheduleCard: { padding: 12, backgroundColor: '#F9FAFB', borderRadius: 12, marginTop: 8, marginBottom: 8 },
  scheduleDescription: { color: '#6B7280', fontSize: 12, marginBottom: 10 },
  schedulePickerRow: { flexDirection: 'row', gap: 8 },
  schedulePickerButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 10, backgroundColor: '#FFFFFF',
  },
  schedulePickerText: { color: '#1F2937', fontSize: 13, fontWeight: '600' },
  schedulePickerDone: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 8 },
  schedulePickerDoneText: { color: '#008F79', fontSize: 14, fontWeight: '700' },
  distanceText: { color: themeColors.muted, fontSize: 13, fontWeight: '500' },
  priceBlock: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  suggestionsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    paddingTop: 140,
    paddingHorizontal: 20,
  },
  suggestionsModalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionText: { fontSize: 15, color: '#374151' },
  sectionTitle: { fontWeight: '600', color: '#374151', fontSize: 14, marginBottom: 7, marginTop: 12 },
  vehicleRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  vehicleCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#E5E7EB', gap: 8,
  },
  vehicleSelected: { backgroundColor: '#00C9A7', borderColor: '#00C9A7' },
  vehicleDisabled: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' },
  vehicleLabel: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  priceText: { fontSize: 25, fontWeight: '800', color: themeColors.foreground },
  vesPrice: { fontSize: 12, color: '#6B7280' },
  adjustButton: { alignSelf: 'flex-end', marginBottom: 9 },
  adjustButtonText: { color: '#008F79', fontWeight: '600', fontSize: 14, textDecorationLine: 'underline' },
  customPriceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  customPriceInput: { flex: 1, backgroundColor: '#F5F7FA', borderRadius: 12, paddingHorizontal: 14, height: 44, fontSize: 16, borderWidth: 1, borderColor: '#00C9A7' },
  confirmPriceButton: { backgroundColor: '#00C9A7', borderRadius: 12, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  cancelPriceButton: { backgroundColor: '#EF4444', borderRadius: 12, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  requestBtn: {
    backgroundColor: '#00967D', borderRadius: 14, height: 54, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', shadowColor: '#006E5C',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
  requestBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
  toast: {
    position: 'absolute', top: 60, left: 20, right: 20, borderRadius: 20, padding: 18, zIndex: 1000,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 12,
  },
  toastContent: { flexDirection: 'row', alignItems: 'center' },
  toastText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', flex: 1 },
});

export default RequestRideScreen;
