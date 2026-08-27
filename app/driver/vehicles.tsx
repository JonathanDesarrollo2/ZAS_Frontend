// app/driver/vehicles.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Animated, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { apiClient } from '../../apis/Client';

interface Vehicle {
  id: string;
  vehicle_type: string;
  plate: string;
  is_active: boolean;
}

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
    <Animated.View style={[vs.toast, { backgroundColor: type === 'error' ? '#FF6B6B' : '#00C9A7', opacity, transform: [{ translateY }] }]}>
      <View style={vs.toastInner}>
        <Feather name={type === 'error' ? 'alert-circle' : 'check-circle'} size={22} color="#fff" style={{ marginRight: 12 }} />
        <Text style={vs.toastText}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const VehiclesScreen = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastV, setToastV] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg);
    setToastType(type);
    setToastV(true);
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }, []);

  const loadVehicles = async () => {
    try {
      const res = await apiClient<{ result: boolean; content: Vehicle[] }>('/private/vehicles/list');
      if (res.result) {
        setVehicles(res.content);
      } else {
        setVehicles([]);
      }
    } catch (e: any) {
      showToast(e.message || 'Error al cargar vehículos');
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, []);

const handleActivateVehicle = async (vehicleId: string) => {
  try {
    const res = await apiClient<{ result: boolean; error?: string[] }>(
      '/private/vehicles/set-active',
      {
        method: 'POST',
        body: JSON.stringify({ vehicle_id: vehicleId }),
      }
    );
    if (res.result) {
      showToast('Vehículo activado', 'success');
      loadVehicles();
    } else {
      showToast(res.error?.[0] || 'No se pudo activar');
    }
  } catch (e: any) {
    showToast(e.message || 'Error al activar');
  }
};

  const renderVehicle = ({ item }: { item: Vehicle }) => {
    const isActive = item.is_active;
    return (
      <TouchableOpacity
        style={[vs.card, isActive && vs.cardActive]}
        onPress={() => {
          if (!isActive) {
            Alert.alert(
              'Activar vehículo',
              `¿Deseas activar la moto con placa ${item.plate}?`,
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Activar', onPress: () => handleActivateVehicle(item.id) },
              ]
            );
          } else {
            showToast('Este vehículo ya está activo', 'success');
          }
        }}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="motorbike" size={28} color={isActive ? '#00C9A7' : '#6B7280'} style={{ marginRight: 16 }} />
        <View style={{ flex: 1 }}>
          <Text style={vs.vehicleName}>Moto</Text>
          <Text style={vs.detail}>Placa: {item.plate}</Text>
        </View>
        {isActive ? (
          <View style={vs.activeBadge}>
            <Feather name="check-circle" size={14} color="#fff" style={{ marginRight: 4 }} />
            <Text style={vs.activeBadgeText}>Activo</Text>
          </View>
        ) : (
          <View style={vs.inactiveBadge}>
            <Text style={vs.inactiveBadgeText}>Inactivo</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={vs.screen}>
      <Toast message={toastMsg} type={toastType} visible={toastV} onHide={() => setToastV(false)} />
      <Animated.View style={{ opacity: fadeAnim, flex: 1, paddingTop: 60 }}>
        <Text style={vs.heading}>Mis vehículos</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#00C9A7" style={{ marginTop: 40 }} />
        ) : vehicles.length === 0 ? (
          <View style={vs.emptyState}>
            <MaterialCommunityIcons name="motorbike" size={64} color="#9CA3AF" />
            <Text style={vs.emptyText}>No has registrado ningún vehículo</Text>
            <Text style={vs.emptySub}>Espera a que un administrador apruebe tu documentación.</Text>
          </View>
        ) : (
          <FlatList
            data={vehicles}
            keyExtractor={(item) => item.id}
            renderItem={renderVehicle}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          />
        )}
      </Animated.View>
    </View>
  );
};

const vs = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0fdf9' },
  heading: { fontSize: 28, fontWeight: '700', color: '#1f2937', textAlign: 'center', marginBottom: 20 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#e5e7eb', flexDirection: 'row', alignItems: 'center',
  },
  cardActive: { borderColor: '#00C9A7', borderWidth: 2 },
  vehicleName: { fontWeight: '600', fontSize: 16, color: '#1f2937', marginBottom: 4 },
  detail: { color: '#6b7280', fontSize: 14 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00C9A7', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  activeBadgeText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  inactiveBadge: { backgroundColor: '#E5E7EB', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  inactiveBadgeText: { color: '#6B7280', fontWeight: '600', fontSize: 12 },
  emptyState: { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 12, marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  toast: { position: 'absolute', top: 60, left: 20, right: 20, borderRadius: 20, padding: 18, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 12 },
  toastInner: { flexDirection: 'row', alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
});

export default VehiclesScreen;