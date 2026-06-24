import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BANK_INFO = {
  bank: 'Provincial (0108)',
  account: '30483682',
  phone: '04121998668',
  holder: 'ZAS Movilidad',
};

const AddBalanceScreen = () => {
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [dolarRate, setDolarRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Obtener tasa del dólar (USD a VES) para referencia informativa
  useEffect(() => {
    fetch('https://ve.dolar-api.com/api/v1/dollar/today')
      .then(res => res.json())
      .then(data => {
        if (data?.price) setDolarRate(data.price);
      })
      .catch(() => setDolarRate(null));
  }, []);

  const handleSubmit = async () => {
    const usd = parseFloat(amount);
    if (isNaN(usd) || usd <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a $0.00');
      return;
    }
    if (!reference.trim()) {
      Alert.alert('Referencia requerida', 'Ingresa el número de referencia de la transferencia');
      return;
    }

    setLoading(true);
    try {
      // Guardar localmente como pendiente (luego se conecta al backend)
      const pending = {
        amount: usd,
        reference: reference.trim(),
        date: new Date().toISOString(),
        status: 'pending',
      };
      const existing = await AsyncStorage.getItem('pending_balance_tops');
      const list = existing ? JSON.parse(existing) : [];
      list.push(pending);
      await AsyncStorage.setItem('pending_balance_tops', JSON.stringify(list));

      Alert.alert('Solicitud enviada', 'Tu recarga queda pendiente de verificación. Te avisaremos cuando se confirme.');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Añadir saldo</Text>

      {/* Datos bancarios */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Datos para transferencia</Text>
        <View style={styles.infoRow}>
          <Feather name="credit-card" size={16} color="#00C9A7" />
          <Text style={styles.infoText}>Banco: {BANK_INFO.bank}</Text>
        </View>
        <View style={styles.infoRow}>
          <Feather name="hash" size={16} color="#00C9A7" />
          <Text style={styles.infoText}>Cuenta: {BANK_INFO.account}</Text>
        </View>
        <View style={styles.infoRow}>
          <Feather name="phone" size={16} color="#00C9A7" />
          <Text style={styles.infoText}>Teléfono: {BANK_INFO.phone}</Text>
        </View>
        <View style={styles.infoRow}>
          <Feather name="user" size={16} color="#00C9A7" />
          <Text style={styles.infoText}>Titular: {BANK_INFO.holder}</Text>
        </View>
      </View>

      {/* Advertencia */}
      <View style={styles.warningBox}>
        <Feather name="alert-triangle" size={20} color="#FF9800" style={{ marginRight: 8 }} />
        <Text style={styles.warningText}>
          Evita pagar de más. Si tu deuda supera los $10.00, se bloquearán los viajes hasta que regularices.
        </Text>
      </View>

      {/* Formulario */}
      <Text style={styles.label}>Monto transferido (USD)</Text>
      <View style={styles.inputRow}>
        <Feather name="dollar-sign" size={20} color="#00C9A7" style={{ marginRight: 12 }} />
        <TextInput
          style={styles.input}
          placeholder="Ej: 5.00"
          placeholderTextColor="#9CA3AF"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
      </View>

      <Text style={styles.label}>Número de referencia</Text>
      <View style={styles.inputRow}>
        <Feather name="hash" size={20} color="#00C9A7" style={{ marginRight: 12 }} />
        <TextInput
          style={styles.input}
          placeholder="Ej: 12345678"
          placeholderTextColor="#9CA3AF"
          value={reference}
          onChangeText={setReference}
        />
      </View>

      {/* Tasa de referencia */}
      {dolarRate && (
        <Text style={styles.rateText}>
          Tasa de referencia hoy: 1 USD ≈ {dolarRate.toFixed(2)} VES
        </Text>
      )}

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Feather name="check-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Enviar comprobante</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 80, backgroundColor: '#F0FDF9', flexGrow: 1 },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937', marginBottom: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#E5F5F0' },
  cardTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  infoText: { color: '#374151', fontSize: 16, marginLeft: 12 },
  warningBox: { flexDirection: 'row', backgroundColor: '#FFF3E0', borderRadius: 12, padding: 14, marginBottom: 24, alignItems: 'flex-start' },
  warningText: { color: '#E65100', fontSize: 14, flex: 1 },
  label: { fontWeight: '600', color: '#374151', marginBottom: 10, fontSize: 15 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16,
    paddingHorizontal: 16, height: 52, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 20,
  },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  rateText: { textAlign: 'center', color: '#6B7280', marginBottom: 24, fontSize: 14 },
  button: {
    backgroundColor: '#00C9A7', borderRadius: 16, height: 52, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center', shadowColor: '#00C9A7',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5, marginTop: 8,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
});

export default AddBalanceScreen;