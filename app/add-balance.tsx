import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { requestTopup } from '../apis/balance';
import { useAuth } from '../presentation/store/AuthStore';
import { apiClient } from '../apis/Client';

const BANK_INFO = {
  bank: 'Provincial (0108)',
  account: '30483682',
  phone: '04121998668',
  holder: 'Jonathan Jesus Blanco Solano',
};

const AddBalanceScreen = () => {
  const { user } = useAuth();
  // Cambiamos amount por amountVES: monto en bolívares
  const [amountVES, setAmountVES] = useState('');
  const [reference, setReference] = useState('');
  const [dolarRate, setDolarRate] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawInfo, setWithdrawInfo] = useState<{ canWithdraw: boolean; nextAllowedAt: string | null; lastWithdrawalAt: string | null } | null>(null);
  const [hasBankAccount, setHasBankAccount] = useState<boolean>(false);
  const [checkingBankAccount, setCheckingBankAccount] = useState(false);

  const currentBalance = Number(user?.balance) || 0;
  const isDriver = user?.nivel === 2;
  const parsedVES = parseFloat(amountVES);

  // Obtener tasa desde el backend (cacheada)
  useEffect(() => {
    let cancelled = false;
    const fetchRate = async () => {
      try {
        const baseUrl = process.env.EXPO_PUBLIC_API_URL;
        const res = await fetch(`${baseUrl}/public/exchange-rate`);
        const data = await res.json();
        if (!cancelled && data.result && data.content) {
          setDolarRate(data.content.rate);
        }
      } catch (err) {
        // silencioso
      }
    };
    fetchRate();
    return () => { cancelled = true; };
  }, []);

  // Obtener info de retiro si es conductor
  useEffect(() => {
    if (!isDriver) return;
    const fetchInfo = async () => {
      try {
        const res = await apiClient<{ result: boolean; content: any; error?: string[] }>('/private/withdrawals/info');
        if (res.result && res.content) {
          setWithdrawInfo(res.content);
        }
      } catch (err) {
        // silencioso
      }
    };
    fetchInfo();
  }, [isDriver]);

  // Verificar cuenta bancaria al cargar
  useEffect(() => {
    const checkBankAccount = async () => {
      setCheckingBankAccount(true);
      try {
        const res = await apiClient<{ result: boolean; content: any; error?: string[] }>('/private/bank-account');
        if (res.result) {
          setHasBankAccount(!!res.content);
        }
      } catch (err) {
        setHasBankAccount(false);
      } finally {
        setCheckingBankAccount(false);
      }
    };
    checkBankAccount();
  }, []);

  const handleSubmit = async () => {
    if (!hasBankAccount) {
      Alert.alert(
        'Datos de pago móvil requeridos',
        'Debes registrar tus datos de pago móvil antes de realizar operaciones de saldo.',
        [
          { text: 'Cancelar' },
          { text: 'Registrar ahora', onPress: () => router.push('/bank-account') }
        ]
      );
      return;
    }

    if (!dolarRate) {
      Alert.alert('Tasa no disponible', 'Espera un momento mientras cargamos la tasa de cambio.');
      return;
    }

    if (isNaN(parsedVES) || parsedVES <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto en bolívares mayor a 0');
      return;
    }

    if (!reference.trim()) {
      Alert.alert('Referencia requerida', 'Ingresa el número de referencia de la transferencia');
      return;
    }

    const usdEquivalent = parsedVES / dolarRate;
    const usdAmount = Math.round(usdEquivalent * 100) / 100; // redondear a 2 decimales

    if (usdAmount <= 0) {
      Alert.alert('Monto bajo', 'El monto en bolívares es demasiado bajo para generar una recarga.');
      return;
    }

    setSending(true);
    try {
      await requestTopup(usdAmount, reference.trim());
      Alert.alert('Solicitud enviada', 'Tu recarga queda pendiente de verificación.');
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo enviar la solicitud');
    } finally {
      setSending(false);
    }
  };

  const handleWithdraw = async () => {
    if (!isDriver) return;

    if (!hasBankAccount) {
      Alert.alert(
        'Datos de pago móvil requeridos',
        'Debes registrar tus datos de pago móvil antes de solicitar un retiro.',
        [
          { text: 'Cancelar' },
          { text: 'Registrar ahora', onPress: () => router.push('/bank-account') }
        ]
      );
      return;
    }

    if (!withdrawInfo?.canWithdraw) {
      const next = withdrawInfo?.nextAllowedAt ? new Date(withdrawInfo.nextAllowedAt) : null;
      const message = next
        ? `Solo puedes retirar cada 5 horas. Próximo retiro disponible: ${next.toLocaleString()}`
        : 'Solo puedes retirar cada 5 horas. Aún no tienes información.';
      Alert.alert('Retiro no disponible', message);
      return;
    }

    if (currentBalance <= 0) {
      Alert.alert('Sin saldo', 'No tienes saldo disponible para retirar.');
      return;
    }

    setWithdrawing(true);
    try {
      const res = await apiClient<{ result: boolean; content: any; error?: string[] }>('/private/withdrawals', {
        method: 'POST',
        body: JSON.stringify({ amount: currentBalance }),
      });
      if (res.result) {
        Alert.alert('Solicitud enviada', `Has solicitado retirar $${currentBalance.toFixed(2)}. Queda pendiente de aprobación.`);
        const infoRes = await apiClient<{ result: boolean; content: any; error?: string[] }>('/private/withdrawals/info');
        if (infoRes.result) setWithdrawInfo(infoRes.content);
      } else {
        Alert.alert('Error', res.error?.[0] || 'No se pudo enviar la solicitud');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo enviar la solicitud');
    } finally {
      setWithdrawing(false);
    }
  };

  const nextWithdrawalDate = withdrawInfo?.nextAllowedAt ? new Date(withdrawInfo.nextAllowedAt) : null;
  const usdEquivalent = dolarRate && parsedVES > 0 ? parsedVES / dolarRate : 0;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <Text style={styles.title}>Añadir saldo</Text>
          {dolarRate !== null && dolarRate > 0 && (
            <Text style={styles.rateBadge}>BCV: {dolarRate.toFixed(2)} Bs/USD</Text>
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

        {!hasBankAccount && !checkingBankAccount && (
          <TouchableOpacity style={styles.bankWarning} onPress={() => router.push('/bank-account')}>
            <Feather name="alert-circle" size={16} color="#FF9800" style={{ marginRight: 6 }} />
            <Text style={styles.bankWarningText}>Registra tus datos de pago móvil para operar tu saldo</Text>
          </TouchableOpacity>
        )}

        {isDriver && (
          <View style={styles.warningBox}>
            <Feather name="alert-triangle" size={14} color="#FF9800" style={{ marginRight: 6 }} />
            <Text style={styles.warningText}>Evita sobrepasar $10 de deuda o se bloquearán tus viajes.</Text>
          </View>
        )}

        {/* Sección de recarga con monto en bolívares */}
        <Text style={styles.label}>Monto transferido en bolívares</Text>
        <View style={styles.inputRow}>
          <Feather name="dollar-sign" size={18} color="#00C9A7" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.input}
            placeholder="Ej: 1000"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
            value={amountVES}
            onChangeText={setAmountVES}
          />
          <Text style={styles.currencySuffix}>Bs</Text>
        </View>

        {dolarRate && parsedVES > 0 ? (
          <View style={styles.conversionBox}>
            <Text style={styles.conversionText}>
              Equivale a: <Text style={styles.conversionAmount}>${usdEquivalent.toFixed(2)}</Text>
            </Text>
          </View>
        ) : (
          !dolarRate && (
            <Text style={styles.loadingRate}>Cargando tasa de cambio...</Text>
          )
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

        {/* Sección de retiro SOLO para conductores */}
        {isDriver && (
          <View style={styles.withdrawSection}>
            <View style={styles.withdrawHeader}>
              <Feather name="arrow-down-circle" size={20} color="#00C9A7" style={{ marginRight: 8 }} />
              <Text style={styles.withdrawTitle}>Retirar Dinero</Text>
            </View>

            <View style={styles.withdrawBalanceBox}>
              <Text style={styles.withdrawBalanceLabel}>Saldo disponible para retirar:</Text>
              <Text style={styles.withdrawBalanceAmount}>${currentBalance.toFixed(2)}</Text>
            </View>

            {withdrawInfo && !withdrawInfo.canWithdraw && nextWithdrawalDate && (
              <View style={styles.cooldownBox}>
                <Feather name="clock" size={16} color="#FF9800" style={{ marginRight: 6 }} />
                <Text style={styles.cooldownText}>
                  Solo puedes retirar cada 5 horas. Próximo retiro: {nextWithdrawalDate.toLocaleString()}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.withdrawButton,
                (withdrawing || Boolean(withdrawInfo && !withdrawInfo.canWithdraw) || currentBalance <= 0) && { opacity: 0.7 }
              ]}
              onPress={handleWithdraw}
              disabled={withdrawing || Boolean(withdrawInfo && !withdrawInfo.canWithdraw) || currentBalance <= 0}
              activeOpacity={0.8}
            >
              {withdrawing ? (
                <ActivityIndicator color="#00C9A7" />
              ) : (
                <>
                  <Feather name="arrow-down-circle" size={18} color="#00C9A7" style={{ marginRight: 8 }} />
                  <Text style={styles.withdrawButtonText}>
                    Solicitar retiro de ${currentBalance.toFixed(2)}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.noteContainer}>
          <Feather name="clock" size={14} color="#6B7280" style={{ marginRight: 6 }} />
          <Text style={styles.noteText}>
            El retiro o ingreso de saldo puede demorar unos minutos u horas. Por favor, sea paciente.
          </Text>
        </View>
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
  bankWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  bankWarningText: { color: '#E65100', fontSize: 14, flex: 1 },
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
  currencySuffix: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 4,
  },
  conversionBox: {
    backgroundColor: '#E6FFFA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  conversionText: {
    fontSize: 16,
    color: '#374151',
  },
  conversionAmount: {
    fontWeight: '700',
    color: '#00C9A7',
  },
  loadingRate: {
    textAlign: 'center',
    color: '#6B7280',
    marginBottom: 16,
  },
  conversionTextOld: {
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
  withdrawSection: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 20,
  },
  withdrawHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  withdrawTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  withdrawBalanceBox: {
    backgroundColor: '#E6FFFA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  withdrawBalanceLabel: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  withdrawBalanceAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#00C9A7',
  },
  cooldownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  cooldownText: {
    color: '#E65100',
    fontSize: 13,
    flex: 1,
  },
  withdrawButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#00C9A7',
    marginTop: 8,
  },
  withdrawButtonText: { color: '#00C9A7', fontWeight: '700', fontSize: 16 },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  noteText: {
    color: '#6B7280',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
});

export default AddBalanceScreen;