import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../presentation/hooks/useAuth';
import { requestTopup } from '../apis/balance';

// ---- Constantes ----
const BANK_INFO = {
  bank: 'Provincial (0108)',
  account: '30483682',
  phone: '04121998668',
  holder: 'ZAS Movilidad',
};

const COTIZAVE_API_KEY = 'ctz_live_3sN7IBdxdW8KMZqLi8RnDLoTSfi5b1RkaCYljQ';
const COTIZAVE_URL = 'https://api.cotizave.com/v1/fx/rates';

interface CotizaveRate {
  market: string;
  type: string;
  ask: number | null;
  bid: number | null;
  mid: number;
  updated_at: string;
}

const AddBalanceScreen = () => {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [dolarRate, setDolarRate] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  const currentBalance = Number(user?.balance) || 0;
  const isDriver = user?.nivel === 2;
  const parsedAmount = parseFloat(amount);

  // Obtener tasa BCV
  useEffect(() => {
    let cancelled = false;
    const fetchRate = async () => {
      try {
        const res = await fetch(COTIZAVE_URL, {
          headers: { 'X-API-Key': COTIZAVE_API_KEY, 'Accept': 'application/json' },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          const bcvRate = (data.rates as CotizaveRate[]).find(r => r.market === 'reference');
          if (bcvRate) setDolarRate(bcvRate.mid);
        }
      } catch (err) {}
    };
    fetchRate();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async () => {
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a $0.00');
      return;
    }
    if (!reference.trim()) {
      Alert.alert('Referencia requerida', 'Ingresa el número de referencia de la transferencia');
      return;
    }

    setSending(true);
    try {
      await requestTopup(parsedAmount, reference.trim());
      Alert.alert('Solicitud enviada', 'Tu recarga queda pendiente de verificación.');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo enviar la solicitud');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <Text style={styles.title}>Añadir saldo</Text>
          {dolarRate && (
            <Text style={styles.rateBadge}>BCV: {dolarRate.toFixed(2)}</Text>
          )}
        </View>

        <View style={styles.balanceRow}>
          <Feather name="dollar-sign" size={16} color="#00C9A7" style={{ marginRight: 6 }} />
          <Text style={styles.balanceText}>Saldo actual: ${currentBalance.toFixed(2)}</Text>
        </View>

        <View style={styles.bankBox}>
          <Text style={styles.bankTitle}>Transferencia bancaria</Text>
          <Text style={styles.bankText}>{BANK_INFO.bank} | Cta: {BANK_INFO.account}</Text>
          <Text style={styles.bankText}>Tel: {BANK_INFO.phone} | Titular: {BANK_INFO.holder}</Text>
        </View>

        {isDriver && (
          <View style={styles.warningBox}>
            <Feather name="alert-triangle" size={14} color="#FF9800" style={{ marginRight: 6 }} />
            <Text style={styles.warningText}>Evita sobrepasar $10 de deuda o se bloquearán tus viajes.</Text>
          </View>
        )}

        <Text style={styles.label}>Monto a transferir (USD)</Text>
        <View style={styles.inputRow}>
          <Feather name="dollar-sign" size={18} color="#00C9A7" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.input}
            placeholder="Ej: 5.00"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        {!isNaN(parsedAmount) && parsedAmount > 0 && dolarRate && (
          <Text style={styles.conversionText}>≈ {(parsedAmount * dolarRate).toFixed(2)} VES</Text>
        )}

        <Text style={styles.label}>Número de referencia</Text>
        <View style={styles.inputRow}>
          <Feather name="hash" size={18} color="#00C9A7" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.input}
            placeholder="Ej: 12345678"
            placeholderTextColor="#9CA3AF"
            value={reference}
            onChangeText={setReference}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, sending && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="check-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>Enviar comprobante</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  container: { padding: 20, paddingTop: 80, paddingBottom: 40 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937' },
  rateBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#00C9A7',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  balanceText: { fontSize: 16, fontWeight: '500', color: '#1F2937' },
  bankBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bankTitle: { fontWeight: '600', color: '#1F2937', marginBottom: 6 },
  bankText: { color: '#374151', fontSize: 14, marginBottom: 2 },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 20,
  },
  warningText: { color: '#E65100', fontSize: 13, flex: 1 },
  label: { fontWeight: '600', color: '#374151', marginBottom: 8, fontSize: 15 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  conversionText: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    marginTop: -4,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#00C9A7',
    borderRadius: 14,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00C9A7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginTop: 8,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});

export default AddBalanceScreen;