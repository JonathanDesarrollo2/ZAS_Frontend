import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Animated, ScrollView, Image,
  ActivityIndicator, StyleSheet, TextInput
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../../apis/Client';

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
  { code: '0191', name: 'Banco Nacional de Crédito (BNC)' }
];

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

const BankAccountScreen = () => {
  const [bankCode, setBankCode] = useState('');
  const [cedula, setCedula] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showBankPicker, setShowBankPicker] = useState(false);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg); setToastType(type); setToastVisible(true);
  }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fetchAccount();
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const fetchAccount = async () => {
    try {
      const data = await apiClient<{ result: boolean; content: any }>('/private/bank-account');
      if (data.result && data.content) {
        setBankCode(data.content.bankName || '');
        setCedula(data.content.cedula || '');
        setPhone(data.content.phone || '');
      }
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setFetching(false);
    }
  };

  const handleSave = async () => {
    if (!bankCode || !cedula || !phone) {
      showToast('Todos los campos son obligatorios');
      return;
    }
    setLoading(true);
    try {
      await apiClient('/private/bank-account', {
        method: 'POST',
        body: JSON.stringify({ bankName: bankCode, cedula, phone }),
      });
      showToast('Cuenta bancaria guardada', 'success');
    } catch (err: any) {
      showToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedBank = BANKS.find(b => b.code === bankCode);
  const bankLabel = selectedBank ? selectedBank.name : 'Selecciona tu banco';

  return (
    <View style={styles.screen}>
      <Toast message={toastMsg} type={toastType} visible={toastVisible} onHide={() => setToastVisible(false)} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.logoRow}>
            <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Cuenta Bancaria</Text>
            <Text style={styles.subtitle}>Datos para recibir tus pagos</Text>
          </View>

          <View style={styles.card}>
            <TouchableOpacity
              style={styles.inputRow}
              onPress={() => setShowBankPicker(true)}
              activeOpacity={0.7}
            >
              <Feather name="credit-card" size={20} color="#00C9A7" style={{ marginRight: 12 }} />
              <Text style={[styles.input, !bankCode && { color: '#9CA3AF' }]}>{bankLabel}</Text>
              <Feather name="chevron-down" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {showBankPicker && (
              <View style={styles.pickerContainer}>
                {BANKS.map(bank => (
                  <TouchableOpacity
                    key={bank.code}
                    style={[styles.pickerItem, bankCode === bank.code && styles.pickerItemSelected]}
                    onPress={() => { setBankCode(bank.code); setShowBankPicker(false); }}
                  >
                    <Text style={[styles.pickerItemText, bankCode === bank.code && styles.pickerItemTextSelected]}>
                      {bank.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.inputRow}>
              <Feather name="user" size={20} color="#00C9A7" style={{ marginRight: 12 }} />
              <TextInput
                style={styles.input}
                placeholder="Cédula del titular"
                value={cedula}
                onChangeText={setCedula}
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.inputRow}>
              <Feather name="phone" size={20} color="#00C9A7" style={{ marginRight: 12 }} />
              <TextInput
                style={styles.input}
                placeholder="Teléfono"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, (loading || fetching) && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={loading || fetching}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Guardar</Text>}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  logoRow: { alignItems: 'center', marginBottom: 30 },
  logo: { width: 100, height: 100, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20,
    borderWidth: 1, borderColor: '#E5F5F0', marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F7FA',
    borderRadius: 14, paddingHorizontal: 16, height: 52, marginBottom: 14,
  },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  button: {
    backgroundColor: '#00C9A7', borderRadius: 16, height: 52,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#00C9A7', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  pickerContainer: {
    backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB',
    marginBottom: 14, overflow: 'hidden',
  },
  pickerItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  pickerItemSelected: { backgroundColor: '#E6FFFA' },
  pickerItemText: { fontSize: 15, color: '#1F2937' },
  pickerItemTextSelected: { color: '#00C9A7', fontWeight: '600' },
  toast: {
    position: 'absolute', top: 60, left: 20, right: 20, borderRadius: 20,
    padding: 18, zIndex: 1000, shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 12,
  },
  toastContent: { flexDirection: 'row', alignItems: 'center' },
  toastText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', flex: 1 },
});

export default BankAccountScreen;