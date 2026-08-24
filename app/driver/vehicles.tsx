// app/driver/vehicles.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Animated, StyleSheet, ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { apiClient } from '../../apis/Client';

interface VehicleInfo {
  placa: string;
  marca_modelo: string;
  color: string;
  vehicle_type?: string;
}

const Toast = ({ message, type = 'error', visible, onHide }: { message: string; type?: 'error' | 'success'; visible: boolean; onHide: () => void }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-80)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, friction: 8, tension: 100, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true })
      ]).start();
      const t = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true })
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
  const [vehicles, setVehicles] = useState<VehicleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastV, setToastV] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg); setToastType(type); setToastV(true);
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }, []);

  const load = async () => {
    try {
      const res = await apiClient<{ result: boolean; content: any }>('/private/driver-docs/mine');
      if (res.result && res.content) {
        const doc = res.content;
        setVehicles([
          {
            placa: doc.placa,
            marca_modelo: doc.marca_modelo,
            color: doc.color,
          }
        ]);
      }
    } catch (e: any) {
      // Simplemente ignoramos el error para no mostrar toast
      console.log('Error al cargar documentación (vehículo):', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const renderVehicle = ({ item }: { item: VehicleInfo }) => (
    <View style={vs.card}>
      <Feather name="truck" size={24} color="#00C9A7" style={{ marginRight: 16 }} />
      <View style={{ flex: 1 }}>
        <Text style={vs.vehicleName}>{item.marca_modelo}</Text>
        <Text style={vs.detail}>Placa: {item.placa}</Text>
        <Text style={vs.detail}>Color: {item.color}</Text>
      </View>
    </View>
  );

  return (
    <View style={vs.screen}>
      <Toast message={toastMsg} type={toastType} visible={toastV} onHide={() => setToastV(false)} />
      <Animated.View style={{ opacity: fadeAnim, flex: 1, paddingTop: 60 }}>
        <Text style={vs.heading}>Mis vehículos</Text>
        
        {loading ? (
          <ActivityIndicator size="large" color="#00C9A7" style={{ marginTop: 40 }} />
        ) : vehicles.length === 0 ? (
          <View style={vs.emptyState}>
            <Feather name="truck" size={48} color="#9CA3AF" />
            <Text style={vs.emptyText}>No has registrado ningún vehículo</Text>
            <TouchableOpacity
              style={vs.docButton}
              onPress={() => router.push('/driver/documentation')}
            >
              <Feather name="file-text" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={vs.docButtonText}>Completar documentación</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            <FlatList
              data={vehicles}
              keyExtractor={(item) => item.placa}
              renderItem={renderVehicle}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
            <TouchableOpacity
              style={[vs.docButton, { marginTop: 20 }]}
              onPress={() => router.push('/driver/documentation')}
            >
              <Feather name="edit" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={vs.docButtonText}>Editar documentación</Text>
            </TouchableOpacity>
          </View>
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
    borderWidth: 1, borderColor: '#e5e7eb', flexDirection: 'row', alignItems: 'center'
  },
  vehicleName: { fontWeight: '600', fontSize: 16, color: '#1f2937', marginBottom: 4 },
  detail: { color: '#6b7280', fontSize: 14 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 12, marginBottom: 24, textAlign: 'center' },
  docButton: {
    backgroundColor: '#00C9A7', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#00C9A7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  docButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  toast: { position: 'absolute', top: 60, left: 20, right: 20, borderRadius: 20, padding: 18, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 12 },
  toastInner: { flexDirection: 'row', alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
});

export default VehiclesScreen;