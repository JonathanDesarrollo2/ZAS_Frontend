// app/driver/vehicles.tsx
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, Animated, StyleSheet
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getVehicles, addVehicle, setActiveVehicle } from '../../apis/driver';

const VEHICLE_TYPES = ['Moto', 'Sedán', 'SUV', 'Van', 'Camioneta'] as const;

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
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('Moto');
  const [plate, setPlate] = useState('');
  const [toastV, setToastV] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg); setToastType(type); setToastV(true);
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }, []);

  const load = async () => { try { const d = await getVehicles(); setVehicles(d); } catch (e: any) { showToast(e.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!selectedType || !plate) return showToast('Selecciona un tipo e ingresa la placa');
    try {
      await addVehicle(selectedType.toLowerCase(), plate);
      setPlate('');
      showToast('Vehículo agregado', 'success');
      load();
    } catch (e: any) { showToast(e.message); }
  };

  const setActive = async (id: string) => { try { await setActiveVehicle(id); showToast('Vehículo activado', 'success'); load(); } catch (e: any) { showToast(e.message); } };

  return (
    <View style={vs.screen}>
      <Toast message={toastMsg} type={toastType} visible={toastV} onHide={() => setToastV(false)} />
      <Animated.View style={{ opacity: fadeAnim, flex: 1, paddingTop: 60 }}>
        <Text style={vs.heading}>Mis vehículos</Text>
        <FlatList
          data={vehicles}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={vs.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Feather name="truck" size={24} color="#00C9A7" style={{ marginRight: 16 }} />
                <View style={{ flex: 1 }}>
                  <Text style={vs.vehicleName}>{item.vehicle_type} - {item.plate}</Text>
                  {item.is_active ? <Text style={{ color: '#00C9A7', fontWeight: '600' }}>Activo</Text> : <TouchableOpacity onPress={() => setActive(item.id)}><Text style={{ color: '#3c87f7', fontWeight: '600' }}>Seleccionar como activo</Text></TouchableOpacity>}
                </View>
                {item.is_active && <Feather name="check-circle" size={22} color="#00C9A7" />}
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#6b7280', marginTop: 40 }}>No tienes vehículos registrados</Text>}
        />

        <View style={{ paddingHorizontal: 20, marginTop: 20 }}>
          <Text style={{ fontWeight: '600', marginBottom: 12, color: '#1f2937', fontSize: 18 }}>Agregar vehículo</Text>
          <Text style={vs.label}>Tipo de vehículo</Text>
          <View style={vs.typeRow}>
            {VEHICLE_TYPES.map((vt) => (
              <TouchableOpacity
                key={vt}
                style={[vs.typeChip, selectedType === vt && vs.typeChipSelected]}
                onPress={() => setSelectedType(vt)}
              >
                <Text style={[vs.typeChipText, selectedType === vt && vs.typeChipTextSelected]}>{vt}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={vs.inputRow}>
            <Feather name="hash" size={20} color="#9ca3af" style={{ marginRight: 12 }} />
            <TextInput placeholder="Placa" value={plate} onChangeText={setPlate} style={vs.input} placeholderTextColor="#9ca3af" />
          </View>
          <TouchableOpacity style={vs.addBtn} onPress={handleAdd} activeOpacity={0.8}>
            <Feather name="plus" size={20} color="#fff" style={{ marginRight: 8 }} /><Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Agregar vehículo</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const vs = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0fdf9' },
  heading: { fontSize: 28, fontWeight: '700', color: '#1f2937', textAlign: 'center', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb', flexDirection: 'row', alignItems: 'center' },
  vehicleName: { fontWeight: '600', fontSize: 16, color: '#1f2937', marginBottom: 4 },
  label: { fontWeight: '600', color: '#374151', marginBottom: 8, fontSize: 14 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  typeChip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  typeChipSelected: { backgroundColor: '#00C9A7', borderColor: '#00C9A7' },
  typeChipText: { fontSize: 14, fontWeight: '500', color: '#374151' },
  typeChipTextSelected: { color: '#FFFFFF' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, paddingHorizontal: 16, height: 48, borderWidth: 1, borderColor: '#e5e7eb' },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  addBtn: { backgroundColor: '#00C9A7', borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8, shadowColor: '#00C9A7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  toast: { position: 'absolute', top: 60, left: 20, right: 20, borderRadius: 20, padding: 18, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 12 },
  toastInner: { flexDirection: 'row', alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
});

export default VehiclesScreen;