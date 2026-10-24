import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import * as Location from 'expo-location';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import MapSelector from '../../presentation/components/shared/mapSelector';
import { ActiveGeofence, getActiveGeofences } from '../../apis/sharedRides';
import { createSharedRide } from '../../apis/driver';

const toPoints = (polygon: ActiveGeofence['polygon']): { lat: number; lng: number }[] => {
  const parsed: unknown = typeof polygon === 'string' ? JSON.parse(polygon) : polygon;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((point): point is { lat: number; lng: number } => {
    if (!point || typeof point !== 'object') return false;
    const value = point as { lat?: unknown; lng?: unknown };
    return typeof value.lat === 'number' && Number.isFinite(value.lat) &&
      typeof value.lng === 'number' && Number.isFinite(value.lng);
  });
};

const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const CreateSharedRideScreen = () => {
  const [zones, setZones] = useState<ActiveGeofence[]>([]);
  const [selectedZone, setSelectedZone] = useState<ActiveGeofence | null>(null);
  const [loadingZones, setLoadingZones] = useState(true);
  const [zoneModalVisible, setZoneModalVisible] = useState(false);
  const [destinationAddress, setDestinationAddress] = useState('');
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [seats, setSeats] = useState('3');
  const [price, setPrice] = useState('');
  const [departureDate, setDepartureDate] = useState(localDate());
  const [departureTime, setDepartureTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let mounted = true;
    getActiveGeofences()
      .then((loadedZones) => { if (mounted) setZones(loadedZones); })
      .catch((error: unknown) => {
        if (mounted) Alert.alert('Error', error instanceof Error ? error.message : 'No se pudieron cargar las zonas');
      })
      .finally(() => { if (mounted) setLoadingZones(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadDriverLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const location = await Location.getCurrentPositionAsync({});
        if (!cancelled) {
          setDriverLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
        }
      } catch {
        if (!cancelled) {
          try {
            const location = await Location.getLastKnownPositionAsync({});
            if (location) {
              setDriverLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
            }
          } catch {
            // La geocerca seleccionada sigue siendo la alternativa preferida para centrar el mapa.
          }
        }
      }
    };
    void loadDriverLocation();
    return () => { cancelled = true; };
  }, []);

  const originPoint = useMemo(() => {
    if (!selectedZone) return null;
    try {
      const points = toPoints(selectedZone.polygon);
      if (!points.length) return null;
      return {
        lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
        lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
      };
    } catch {
      return null;
    }
  }, [selectedZone]);

  const publish = async () => {
    const seatCount = Number(seats);
    const seatPrice = Number(price.replace(',', '.'));
    const parsedDate = new Date(`${departureDate}T${departureTime}:00`);
    if (!selectedZone || !originPoint) {
      Alert.alert('Origen requerido', 'Selecciona una zona activa válida para el origen.');
      return;
    }
    if (!destinationAddress.trim() || !destinationCoords) {
      Alert.alert('Destino requerido', 'Escribe el destino y márcalo en el mapa.');
      return;
    }
    if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > 8) {
      Alert.alert('Puestos no válidos', 'Indica entre 1 y 8 puestos.');
      return;
    }
    if (!Number.isFinite(seatPrice) || seatPrice <= 0) {
      Alert.alert('Precio no válido', 'Indica un precio mayor que cero por puesto.');
      return;
    }
    if (Number.isNaN(parsedDate.getTime()) || !/^\d{2}:\d{2}$/.test(departureTime)) {
      Alert.alert('Hora no válida', 'Usa una fecha YYYY-MM-DD y hora HH:mm.');
      return;
    }
    setSubmitting(true);
    try {
      await createSharedRide({
        origin_address: selectedZone.name,
        origin_lat: originPoint.lat,
        origin_lng: originPoint.lng,
        destination_address: destinationAddress.trim(),
        destination_lat: destinationCoords.lat,
        destination_lng: destinationCoords.lng,
        total_seats: seatCount,
        price_per_seat_usd: seatPrice,
        departure_time: parsedDate.toISOString(),
        trunk_full: false,
      });
      Alert.alert('Viaje publicado', 'Tu taxi compartido ya está disponible.', [
        { text: 'Continuar', onPress: () => router.replace('/driver/my-rides') },
      ]);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo publicar el viaje');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Publicar taxi compartido</Text>
        <Text style={styles.subtitle}>Define la ruta, los puestos y la hora de salida.</Text>

        <Text style={styles.label}>Zona de origen</Text>
        <TouchableOpacity style={styles.inputRow} onPress={() => setZoneModalVisible(true)} disabled={loadingZones}>
          {loadingZones ? <ActivityIndicator color="#00C9A7" /> : <Feather name="map-pin" size={19} color="#00C9A7" />}
          <Text style={[styles.fieldValue, !selectedZone && styles.placeholder]}>
            {loadingZones ? 'Cargando zonas...' : selectedZone?.name || 'Seleccionar zona activa'}
          </Text>
          <Feather name="chevron-down" size={18} color="#6B7280" />
        </TouchableOpacity>
        {selectedZone && originPoint && (
          <Text style={styles.helper}>Origen aproximado: {originPoint.lat.toFixed(5)}, {originPoint.lng.toFixed(5)}</Text>
        )}

        <Text style={styles.label}>Destino final</Text>
        <TextInput
          style={styles.inputRow}
          value={destinationAddress}
          onChangeText={setDestinationAddress}
          placeholder="Ej. Plaza Bolívar"
          placeholderTextColor="#9CA3AF"
        />
        <TouchableOpacity style={styles.mapButton} onPress={() => setMapVisible(true)} disabled={!originPoint}>
          <Feather name="map" size={18} color="#00C9A7" />
          <Text style={styles.mapButtonText}>{destinationCoords ? 'Actualizar punto en el mapa' : 'Marcar destino en el mapa'}</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Puestos disponibles</Text>
        <TextInput style={styles.inputRow} value={seats} onChangeText={setSeats} keyboardType="number-pad" placeholder="Ej. 3" placeholderTextColor="#9CA3AF" />

        <Text style={styles.label}>Precio por puesto (USD)</Text>
        <TextInput style={styles.inputRow} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Ej. 5.00" placeholderTextColor="#9CA3AF" />

        <Text style={styles.label}>Salida</Text>
        <View style={styles.dateTimeRow}>
          <TextInput style={[styles.inputRow, styles.dateInput]} value={departureDate} onChangeText={setDepartureDate} placeholder="YYYY-MM-DD" placeholderTextColor="#9CA3AF" />
          <TextInput style={[styles.inputRow, styles.timeInput]} value={departureTime} onChangeText={setDepartureTime} keyboardType="numbers-and-punctuation" placeholder="HH:mm" placeholderTextColor="#9CA3AF" maxLength={5} />
        </View>

        <TouchableOpacity style={[styles.submitButton, submitting && styles.disabled]} onPress={() => void publish()} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <><Feather name="send" size={18} color="#FFFFFF" /><Text style={styles.submitText}>Publicar viaje</Text></>}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={zoneModalVisible} transparent animationType="fade" onRequestClose={() => setZoneModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.zonePanel}>
            <Text style={styles.modalTitle}>Selecciona una zona activa</Text>
            {zones.length ? zones.map((zone) => {
              let selectable = false;
              try { selectable = toPoints(zone.polygon).length > 0; } catch { selectable = false; }
              return (
                <TouchableOpacity
                  key={zone.id}
                  style={[styles.zoneOption, !selectable && styles.disabled]}
                  disabled={!selectable}
                  onPress={() => { setSelectedZone(zone); setZoneModalVisible(false); }}
                >
                  <Feather name="map-pin" size={17} color="#00C9A7" />
                  <Text style={styles.zoneName}>{zone.name}</Text>
                  <Feather name="chevron-right" size={17} color="#9CA3AF" />
                </TouchableOpacity>
              );
            }) : <Text style={styles.emptyText}>No hay geocercas activas disponibles.</Text>}
            <TouchableOpacity style={styles.cancelButton} onPress={() => setZoneModalVisible(false)}>
              <Text style={styles.cancelText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <MapSelector
        visible={mapVisible}
        initialCoords={originPoint || driverLocation || { lat: 10.071866, lng: -66.869583 }}
        onConfirm={(address, lat, lng) => {
          setDestinationAddress(address);
          setDestinationCoords({ lat, lng });
          setMapVisible(false);
        }}
        onCancel={() => setMapVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { padding: 20, paddingTop: 58, paddingBottom: 36 },
  heading: { color: '#1F2937', fontSize: 25, fontWeight: '800' },
  subtitle: { color: '#6B7280', fontSize: 14, marginTop: 6, marginBottom: 22 },
  label: { color: '#374151', fontSize: 14, fontWeight: '700', marginBottom: 7, marginTop: 4 },
  inputRow: { minHeight: 50, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 13, marginBottom: 12, color: '#1F2937', flexDirection: 'row', alignItems: 'center', gap: 10, fontSize: 15 },
  fieldValue: { flex: 1, color: '#1F2937', fontSize: 15 },
  placeholder: { color: '#9CA3AF' },
  helper: { color: '#6B7280', fontSize: 12, marginTop: -5, marginBottom: 10 },
  mapButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#ECFDF8', borderRadius: 12, paddingHorizontal: 13, marginBottom: 14 },
  mapButtonText: { color: '#1F2937', fontSize: 14, fontWeight: '600' },
  dateTimeRow: { flexDirection: 'row', gap: 10 },
  dateInput: { flex: 1, marginBottom: 12 },
  timeInput: { width: 110, marginBottom: 12 },
  submitButton: { height: 54, marginTop: 8, borderRadius: 14, backgroundColor: '#00C9A7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  overlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.4)' },
  zonePanel: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, maxHeight: '80%' },
  modalTitle: { color: '#1F2937', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  zoneOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  zoneName: { flex: 1, color: '#1F2937', fontSize: 15 },
  emptyText: { color: '#6B7280', paddingVertical: 14 },
  cancelButton: { alignItems: 'center', padding: 12, marginTop: 8 },
  cancelText: { color: '#00A98E', fontWeight: '700' },
});

export default CreateSharedRideScreen;
