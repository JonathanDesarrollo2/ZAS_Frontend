import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Animated,
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { createSharedRide } from '../../apis/driver';

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
  return (
    <Animated.View style={[styles.toast, { backgroundColor: type === 'error' ? '#FF6B6B' : '#00C9A7', opacity, transform: [{ translateY }] }]}>
      <Feather name={type === 'error' ? 'alert-circle' : 'check-circle'} size={22} color="#fff" style={{ marginRight: 12 }} />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

const CreateRideScreen = () => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [seats, setSeats] = useState('2');
  const [pricePerSeat, setPricePerSeat] = useState('5');
  const [loading, setLoading] = useState(false);
  const [toastV, setToastV] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = (msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg); setToastType(type); setToastV(true);
  };

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }, []);

  const handleCreate = async () => {
    if (!origin.trim() || !destination.trim()) {
      return showToast('Completa origen y destino');
    }
    const price = parseFloat(pricePerSeat);
    if (isNaN(price) || price <= 0) {
      return showToast('Ingresa un precio válido por puesto (USD)');
    }
    setLoading(true);
    try {
      await createSharedRide({
        origin_address: origin.trim(),
        origin_lat: 0, origin_lng: 0,
        destination_address: destination.trim(),
        destination_lat: 0, destination_lng: 0,
        total_seats: parseInt(seats) || 1,
        price_per_seat_usd: price,   // Asegúrate de agregar esta propiedad en CreateSharedRidePayload (apis/driver.ts)
        trunk_full: false,
      });
      showToast('Viaje publicado', 'success');
      setTimeout(() => router.back(), 1000);
    } catch (e: any) { showToast(e.message); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.screen}>
      <Toast message={toastMsg} type={toastType} visible={toastV} onHide={() => setToastV(false)} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.heading}>¿A dónde vas?</Text>

          <View style={styles.inputRow}>
            <Feather name="circle" size={20} color="#00C9A7" style={{ marginRight: 12 }} />
            <TextInput
              placeholder="Dirección de origen"
              value={origin}
              onChangeText={setOrigin}
              style={styles.input}
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View style={styles.inputRow}>
            <Feather name="map-pin" size={20} color="#FF6B6B" style={{ marginRight: 12 }} />
            <TextInput
              placeholder="Dirección de destino"
              value={destination}
              onChangeText={setDestination}
              style={styles.input}
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.seatsRow}>
            <Feather name="users" size={20} color="#374151" />
            <Text style={styles.seatsLabel}>Puestos</Text>
            <View style={styles.seatControl}>
              <TouchableOpacity onPress={() => setSeats(Math.max(1, parseInt(seats)-1).toString())}>
                <Feather name="minus-circle" size={28} color="#9ca3af" />
              </TouchableOpacity>
              <Text style={styles.seatCount}>{seats}</Text>
              <TouchableOpacity onPress={() => setSeats((parseInt(seats)+1).toString())}>
                <Feather name="plus-circle" size={28} color="#00C9A7" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputRow}>
            <Feather name="dollar-sign" size={20} color="#00C9A7" style={{ marginRight: 12 }} />
            <TextInput
              placeholder="Precio por puesto (USD) - ej: 5"
              value={pricePerSeat}
              onChangeText={setPricePerSeat}
              keyboardType="numeric"
              style={styles.input}
              placeholderTextColor="#9ca3af"
            />
          </View>

          <TouchableOpacity
            onPress={handleCreate}
            disabled={loading}
            activeOpacity={0.8}
            style={[styles.button, loading && { opacity: 0.7 }]}
          >
            <Feather name="search" size={22} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>{loading ? 'Publicando…' : 'Publicar viaje'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 80 },
  heading: { fontSize: 32, fontWeight: '700', color: '#1F2937', marginBottom: 30 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  seatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  seatsLabel: { color: '#374151', fontSize: 16, marginLeft: 12, flex: 1 },
  seatControl: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  seatCount: { color: '#1F2937', fontSize: 20, fontWeight: '700', minWidth: 28, textAlign: 'center' },
  button: {
    backgroundColor: '#00C9A7',
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00C9A7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
  toast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    borderRadius: 20,
    padding: 18,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  toastText: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
});

export default CreateRideScreen;