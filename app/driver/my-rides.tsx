import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, TextInput, Animated, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { getDriverRides, cancelRide, markRideAsFull, addManualPassenger } from '../../apis/driver';

const Toast = ({ message, type = 'error', visible, onHide }: { message: string; type?: 'error' | 'success'; visible: boolean; onHide: () => void }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-80)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([Animated.spring(translateY, { toValue: 0, friction: 8, tension: 100, useNativeDriver: true }), Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true })]).start();
      const t = setTimeout(() => { Animated.parallel([Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }), Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true })]).start(() => onHide()); }, 4000);
      return () => clearTimeout(t);
    }
  }, [visible]);
  if (!visible) return null;
  return <Animated.View style={[styles.toast, { backgroundColor: type === 'error' ? '#FF6B6B' : '#00C9A7', opacity, transform: [{ translateY }] }]}><View style={styles.toastInner}><Feather name={type === 'error' ? 'alert-circle' : 'check-circle'} size={22} color="#fff" style={{ marginRight: 12 }} /><Text style={styles.toastText}>{message}</Text></View></Animated.View>;
};

const DriverRidesScreen = () => {
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualSeats, setManualSeats] = useState('1');
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [toastV, setToastV] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => { setToastMsg(msg); setToastType(type); setToastV(true); }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }, []);

  const load = async () => { try { const d = await getDriverRides(); setRides(d); } catch (e: any) { showToast(e.message); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const handleCancel = (id: string) => {
    cancelRide(id).then(() => { showToast('Viaje cancelado', 'success'); load(); }).catch(e => showToast(e.message));
  };
  const handleFull = (id: string) => { markRideAsFull(id).then(() => { showToast('Viaje marcado como lleno', 'success'); load(); }).catch(e => showToast(e.message)); };
  const openModal = (id: string) => { setSelectedId(id); setManualSeats('1'); setManualName(''); setManualPhone(''); setModalVisible(true); };
  const addManual = async () => {
    const n = parseInt(manualSeats);
    if (!n || n < 1) return showToast('Cantidad inválida');
    try { await addManualPassenger(selectedId!, n, manualName || undefined, manualPhone || undefined); showToast('Pasajero agregado', 'success'); setModalVisible(false); load(); } catch (e: any) { showToast(e.message); }
  };

  return (
    <View style={styles.screen}>
      <Toast message={toastMsg} type={toastType} visible={toastV} onHide={() => setToastV(false)} />
      <Animated.View style={{ opacity: fadeAnim, flex: 1, paddingTop: 60 }}>
        <Text style={styles.heading}>Mis viajes</Text>
        <FlatList
          data={rides}
          keyExtractor={i => i.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {/* Sección de ruta y botón para ver reservas */}
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/driver/ride-reservation', params: { rideId: item.id } })}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.route}>📍 {item.origin_address}</Text>
                  <Text style={styles.route}>🏁 {item.destination_address}</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#ccc" />
              </TouchableOpacity>
              <Text style={styles.detail}>Puestos: {item.available_seats}/{item.total_seats} · {item.status}</Text>
              {item.status === 'active' && (
                <View style={styles.actions}>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FF9800' }]} onPress={() => handleFull(item.id)}><Feather name="x-circle" size={16} color="#fff" style={{ marginRight: 4 }} /><Text style={styles.actionText}>Lleno</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#00C9A7' }]} onPress={() => openModal(item.id)}><Feather name="plus-circle" size={16} color="#fff" style={{ marginRight: 4 }} /><Text style={styles.actionText}>+ Pasajero</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FF5252' }]} onPress={() => handleCancel(item.id)}><Feather name="trash-2" size={16} color="#fff" style={{ marginRight: 4 }} /><Text style={styles.actionText}>Cancelar</Text></TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />

        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Agregar pasajero</Text>
              <View style={styles.inputRow}><Feather name="users" size={20} color="#9ca3af" style={{ marginRight: 12 }} /><TextInput placeholder="Puestos" keyboardType="numeric" value={manualSeats} onChangeText={setManualSeats} style={styles.input} /></View>
              <View style={styles.inputRow}><Feather name="user" size={20} color="#9ca3af" style={{ marginRight: 12 }} /><TextInput placeholder="Nombre (opcional)" value={manualName} onChangeText={setManualName} style={styles.input} /></View>
              <View style={styles.inputRow}><Feather name="phone" size={20} color="#9ca3af" style={{ marginRight: 12 }} /><TextInput placeholder="Teléfono (opcional)" keyboardType="phone-pad" value={manualPhone} onChangeText={setManualPhone} style={styles.input} /></View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#00C9A7' }]} onPress={addManual}><Text style={styles.modalBtnText}>Agregar</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#9ca3af' }]} onPress={() => setModalVisible(false)}><Text style={styles.modalBtnText}>Cancelar</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0fdf9' },
  heading: { fontSize: 28, fontWeight: '700', color: '#1f2937', textAlign: 'center', marginBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: '#E5F5F0' },
  route: { fontWeight: '600', fontSize: 16, color: '#1f2937' },
  detail: { color: '#6b7280', marginTop: 8, fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 14 },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modal: { width: '90%', backgroundColor: '#fff', borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 20, color: '#1f2937' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf9', borderRadius: 12, marginBottom: 12, paddingHorizontal: 16, height: 48, borderWidth: 1, borderColor: '#e5e7eb' },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', marginHorizontal: 6 },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  toast: { position: 'absolute', top: 60, left: 20, right: 20, borderRadius: 20, padding: 18, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 12 },
  toastInner: { flexDirection: 'row', alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
});

export default DriverRidesScreen;