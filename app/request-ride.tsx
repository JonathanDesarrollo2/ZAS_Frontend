// app/request-ride.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Animated, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, ActivityIndicator, TextInput, Modal, FlatList,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { createTrip, estimatePrice, getActiveTrip } from '../apis/trips';
import { useAutocomplete } from '../presentation/hooks/use-autocomplete';
import { reverseGeocode } from '../utils/geocoding';
import MapSelector from '../presentation/components/shared/mapSelector';
import { useAuth } from '../presentation/store/AuthStore';

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

  const originAuto = useAutocomplete(currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined);
  const destAuto = useAutocomplete(currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : undefined);

  const [origin, setOrigin] = useState('');
  const [originCoords, setOriginCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState('');
  const [destCoords, setDestCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [selectedVehicle, setSelectedVehicle] = useState('moto');
  const [loading, setLoading] = useState(false);
  const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'app'>('cash');
  const [isCustomPrice, setIsCustomPrice] = useState(false);
  const [customPrice, setCustomPrice] = useState('');

  const [mapSelectorVisible, setMapSelectorVisible] = useState(false);
  const [mapTargetField, setMapTargetField] = useState<'origin' | 'dest'>('dest');

  const [suggestionsModalVisible, setSuggestionsModalVisible] = useState(false);
  const [activeSuggestionField, setActiveSuggestionField] = useState<'origin' | 'dest'>('dest');

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg); setToastType(type); setToastVisible(true);
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }, []);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { showToast('Permiso de ubicación denegado'); return; }
      let location = await Location.getCurrentPositionAsync({});
      const loc = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setCurrentLocation(loc);
      setOriginCoords({ lat: loc.latitude, lng: loc.longitude });
      const addr = await reverseGeocode(loc.latitude, loc.longitude);
      setOrigin(addr);
      setLocationLoaded(true);
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

  const openSuggestions = (field: 'origin' | 'dest') => {
    setActiveSuggestionField(field);
    setSuggestionsModalVisible(true);
  };

  const openMapForField = (field: 'origin' | 'dest') => {
    setMapTargetField(field);
    setMapSelectorVisible(true);
  };

  const getMapInitialCoords = (): { lat: number; lng: number } => {
    const defaultCoords = currentLocation ? { lat: currentLocation.latitude, lng: currentLocation.longitude } : { lat: 10.071866, lng: -66.869583 };
    if (mapTargetField === 'origin') return originCoords || defaultCoords;
    return destCoords || defaultCoords;
  };

  const handleMapConfirm = (address: string, lat: number, lng: number) => {
    if (mapTargetField === 'origin') {
      setOrigin(address);
      setOriginCoords({ lat, lng });
      originAuto.clearSuggestions();
    } else {
      setDestination(address);
      setDestCoords({ lat, lng });
      destAuto.clearSuggestions();
    }
    setMapSelectorVisible(false);
  };

  useEffect(() => {
    if (destCoords && currentLocation) {
      estimatePrice(currentLocation.latitude, currentLocation.longitude, destCoords.lat, destCoords.lng)
        .then(setEstimatedPrice).catch(() => setEstimatedPrice(null));
    }
  }, [destCoords, selectedVehicle]);

  const finalPrice = isCustomPrice && customPrice ? parseFloat(customPrice) : (estimatedPrice || 0);
  const canPayWithApp = (user?.balance || 0) >= finalPrice;

  const handleRequestRide = async () => {
    if (!origin.trim() || !destination.trim()) { showToast('Completa origen y destino'); return; }
    if (!destCoords) { showToast('Selecciona un destino válido'); return; }
    if (selectedVehicle !== 'moto') { showToast('Solo moto disponible'); return; }
    if (paymentMethod === 'app' && !canPayWithApp) { showToast('Saldo insuficiente'); return; }

    // ✅ Verificar si ya hay un viaje activo antes de crear otro
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
    } catch (err) {
      // Silencioso, continuar con la creación
    }

    setLoading(true);
    try {
      const payload = {
        pickup_lat: originCoords?.lat || currentLocation!.latitude,
        pickup_lng: originCoords?.lng || currentLocation!.longitude,
        pickup_address: origin,
        dropoff_lat: destCoords.lat,
        dropoff_lng: destCoords.lng,
        dropoff_address: destination,
        vehicle_type: selectedVehicle,
        trip_type: 'ride' as const,
        price: finalPrice > 0 ? finalPrice : undefined,
        payment_method: paymentMethod,
      };
      const response = await createTrip(payload as any);
      if (response.result) {
        showToast('Viaje solicitado', 'success');
        setTimeout(() => router.push({ pathname: '/trip-waiting', params: { tripId: response.content?.id } }), 500);
      } else {
        showToast(response.error?.[0] || 'No se pudo solicitar el viaje');
      }
    } catch (err: any) { showToast(err.message); }
    finally { setLoading(false); }
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Origen */}
            <View style={styles.fieldContainer}>
              <Feather name="circle" size={14} color="#00C9A7" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Dirección de recogida"
                value={originAuto.showSuggestions ? originAuto.query : origin}
                onFocus={() => {
                  originAuto.setShowSuggestions(true);
                  originAuto.setQuery(origin);
                  openSuggestions('origin');
                }}
                onChangeText={(t) => { originAuto.fetchSuggestions(t); }}
                onBlur={() => originAuto.clearSuggestions()}
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity onPress={() => openMapForField('origin')}>
                <Feather name="map" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Destino */}
            <View style={styles.fieldContainer}>
              <Feather name="map-pin" size={14} color="#FF6B6B" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.fieldInput}
                placeholder="Destino"
                value={destAuto.showSuggestions ? destAuto.query : destination}
                onFocus={() => {
                  destAuto.setShowSuggestions(true);
                  destAuto.setQuery(destination);
                  openSuggestions('dest');
                }}
                onChangeText={(t) => { destAuto.fetchSuggestions(t); }}
                onBlur={() => destAuto.clearSuggestions()}
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity onPress={() => openMapForField('dest')}>
                <Feather name="map" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Vehículo */}
            <Text style={styles.sectionTitle}>Vehículo</Text>
            <View style={styles.vehicleRow}>
              <TouchableOpacity
                style={[styles.vehicleCard, selectedVehicle === 'moto' && styles.vehicleSelected]}
                onPress={() => setSelectedVehicle('moto')}
              >
                <Feather name="crosshair" size={24} color={selectedVehicle === 'moto' ? '#fff' : '#00C9A7'} />
                <Text style={[styles.vehicleLabel, selectedVehicle === 'moto' && { color: '#fff' }]}>Moto</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.vehicleCard, styles.vehicleDisabled]} disabled>
                <Feather name="truck" size={24} color="#B0BEC5" />
                <Text style={[styles.vehicleLabel, { color: '#B0BEC5' }]}>Auto (próximo)</Text>
              </TouchableOpacity>
            </View>

            {/* Precio */}
            <View style={styles.priceRow}>
              <Feather name="dollar-sign" size={18} color="#374151" style={{ marginRight: 6 }} />
              {estimatedPrice !== null ? (
                <Text style={styles.priceText}>Precio estimado: ${estimatedPrice.toFixed(2)}</Text>
              ) : (
                <Text style={styles.priceText}>Calculando precio...</Text>
              )}
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

            {/* Saldo */}
            <View style={styles.balanceRow}>
              <Feather name="dollar-sign" size={18} color="#00C9A7" style={{ marginRight: 8 }} />
              <Text style={styles.balanceText}>
                Saldo: ${user?.balance != null ? Number(user.balance).toFixed(2) : '0.00'}
              </Text>
            </View>

            {/* Método de pago */}
            <Text style={styles.sectionTitle}>Método de pago</Text>
            <View style={styles.paymentRow}>
              <TouchableOpacity
                style={[styles.paymentOption, paymentMethod === 'cash' && styles.paymentOptionSelected]}
                onPress={() => setPaymentMethod('cash')}
              >
                <Feather name="user" size={18} color={paymentMethod === 'cash' ? '#fff' : '#00C9A7'} />
                <Text style={[styles.paymentText, paymentMethod === 'cash' && { color: '#fff' }]}>Pago al conductor</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentOption, paymentMethod === 'app' && styles.paymentOptionSelected]}
                onPress={() => setPaymentMethod('app')}
              >
                <Feather name="smartphone" size={18} color={paymentMethod === 'app' ? '#fff' : '#00C9A7'} />
                <Text style={[styles.paymentText, paymentMethod === 'app' && { color: '#fff' }]}>App</Text>
              </TouchableOpacity>
            </View>
            {!canPayWithApp && paymentMethod === 'app' && (
              <Text style={styles.errorText}>Saldo insuficiente para pagar con la app</Text>
            )}

            {/* Botón solicitar */}
            <TouchableOpacity
              style={[styles.requestBtn, loading && { opacity: 0.7 }]}
              onPress={handleRequestRide}
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
        onSelect={activeSuggestionField === 'origin' ? handleOriginSelect : handleDestSelect}
        onClose={() => setSuggestionsModalVisible(false)}
      />

      {/* Modal mapa */}
      <MapSelector
        visible={mapSelectorVisible}
        initialCoords={getMapInitialCoords()}
        onConfirm={handleMapConfirm}
        onCancel={() => setMapSelectorVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 80, paddingBottom: 40 },
  fieldContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderRadius: 14, paddingHorizontal: 14, height: 52, marginBottom: 16,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  fieldInput: { flex: 1, fontSize: 16, color: '#111827', marginLeft: 8 },
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
  sectionTitle: { fontWeight: '600', color: '#374151', fontSize: 15, marginBottom: 10, marginTop: 20 },
  vehicleRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  vehicleCard: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', gap: 8,
  },
  vehicleSelected: { backgroundColor: '#00C9A7', borderColor: '#00C9A7' },
  vehicleDisabled: { backgroundColor: '#F5F5F5', borderColor: '#E0E0E0' },
  vehicleLabel: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  priceText: { fontSize: 17, fontWeight: '600', color: '#1F2937' },
  adjustButton: { alignSelf: 'flex-end', marginBottom: 16 },
  adjustButtonText: { color: '#00C9A7', fontWeight: '600', fontSize: 15, textDecorationLine: 'underline' },
  customPriceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  customPriceInput: { flex: 1, backgroundColor: '#F5F7FA', borderRadius: 12, paddingHorizontal: 14, height: 44, fontSize: 16, borderWidth: 1, borderColor: '#00C9A7' },
  confirmPriceButton: { backgroundColor: '#00C9A7', borderRadius: 12, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  cancelPriceButton: { backgroundColor: '#EF4444', borderRadius: 12, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  balanceRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12,
    marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB',
  },
  balanceText: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  paymentRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  paymentOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', gap: 8,
  },
  paymentOptionSelected: { backgroundColor: '#00C9A7', borderColor: '#00C9A7' },
  paymentText: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  errorText: { color: '#EF4444', fontSize: 14, marginTop: -12, marginBottom: 12, marginLeft: 4 },
  requestBtn: {
    backgroundColor: '#00C9A7', borderRadius: 16, height: 56, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', shadowColor: '#00C9A7',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
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