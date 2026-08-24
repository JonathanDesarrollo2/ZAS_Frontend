import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
  KeyboardAvoidingView, Platform, Dimensions, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../presentation/store/AuthStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CODE_LENGTH = 8;
const BOX_GAP = 8;
const CARD_PADDING = 30;
const SCREEN_PADDING = 20;

const VerifyEmailScreen = () => {
  const { sendEmailCode, confirmEmailCode, checkSession } = useAuth();
  const [codeDigits, setCodeDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [initialSendDone, setInitialSendDone] = useState(false);

  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (!initialSendDone) {
      handleAutoSend();
    }
  }, []);

  const handleAutoSend = async () => {
    setResending(true);
    try {
      await sendEmailCode();
      setInitialSendDone(true);
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo enviar el código. Intenta reenviarlo.');
    } finally {
      setResending(false);
    }
  };

  const handleDigitChange = (text: string, index: number) => {
    // Si el texto pegado contiene múltiples caracteres, rellenamos todas las cajas
    if (text.length > 1) {
      const pasted = text.replace(/\D/g, ''); // solo números
      const newDigits = Array(CODE_LENGTH).fill('');
      for (let i = 0; i < Math.min(CODE_LENGTH, pasted.length); i++) {
        newDigits[i] = pasted[i];
      }
      setCodeDigits(newDigits);
      // Mover foco al último campo o al primer vacío
      const focusIndex = pasted.length < CODE_LENGTH ? pasted.length : CODE_LENGTH - 1;
      inputs.current[focusIndex]?.focus();
      return;
    }

    if (text.length === 0) {
      // Borrado normal (un solo carácter)
      const newDigits = [...codeDigits];
      newDigits[index] = '';
      setCodeDigits(newDigits);
      // Si no hay texto y no es el primer índice, retroceder el foco
      if (index > 0) {
        inputs.current[index - 1]?.focus();
      }
      return;
    }

    // Un solo dígito
    const newDigits = [...codeDigits];
    newDigits[index] = text;
    setCodeDigits(newDigits);

    // Avanzar al siguiente campo
    if (index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace') {
      if (!codeDigits[index] && index > 0) {
        // Si el campo está vacío y presiona Backspace, borra el anterior y mueve el foco
        const newDigits = [...codeDigits];
        newDigits[index - 1] = '';
        setCodeDigits(newDigits);
        inputs.current[index - 1]?.focus();
      } else if (codeDigits[index]) {
        // Si hay un dígito, se borra automáticamente en onChangeText, así que no hacemos nada extra
      }
    }
  };

  const handleClearAll = () => {
    setCodeDigits(Array(CODE_LENGTH).fill(''));
    inputs.current[0]?.focus();
  };

  const handleVerify = async () => {
    const code = codeDigits.join('');
    if (code.length !== CODE_LENGTH) {
      Alert.alert('Código incompleto', `Ingresa los ${CODE_LENGTH} dígitos`);
      return;
    }

    setLoading(true);
    try {
      await confirmEmailCode(code);
      await checkSession();
      router.replace('/dashboard');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await sendEmailCode();
      Alert.alert('Código reenviado', 'Revisa tu bandeja de entrada');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setResending(false);
    }
  };

  const availableWidth = SCREEN_WIDTH - SCREEN_PADDING * 2 - CARD_PADDING * 2;
  const totalGap = BOX_GAP * (CODE_LENGTH - 1);
  const boxWidth = Math.min(48, (availableWidth - totalGap) / CODE_LENGTH);

  return (
    <View style={styles.background}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.innerContainer}>
          <View style={styles.header}>
            <Text style={styles.logo}>ZAS</Text>
            <Text style={styles.subtitle}>Verifica tu correo electrónico</Text>
          </View>

          <View style={styles.card}>
            <Feather name="mail" size={48} color="#00C9A7" style={{ alignSelf: 'center', marginBottom: 20 }} />
            {!initialSendDone && resending ? (
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <ActivityIndicator size="small" color="#00C9A7" />
                <Text style={styles.instruction}>Enviando código...</Text>
              </View>
            ) : (
              <Text style={styles.instruction}>
                Ingresa el código de 8 dígitos que enviamos a tu correo.
              </Text>
            )}

            <View style={styles.codeRow}>
              {codeDigits.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => { inputs.current[index] = ref; }}
                  style={[styles.codeInput, { width: boxWidth, height: boxWidth * 1.5, fontSize: boxWidth * 0.55 }]}
                  value={digit}
                  onChangeText={(text) => handleDigitChange(text, index)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                  keyboardType="numeric"
                  maxLength={1}
                  selectTextOnFocus
                  caretHidden
                />
              ))}
            </View>

            {/* Botón para limpiar todo el código */}
            <TouchableOpacity onPress={handleClearAll} style={styles.clearButton}>
              <Feather name="x-circle" size={20} color="#6B7280" />
              <Text style={styles.clearButtonText}>Limpiar todo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.7 }]}
              onPress={handleVerify}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verificar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendLink}
              onPress={handleResend}
              disabled={resending}
            >
              {resending ? (
                <ActivityIndicator size="small" color="#00C9A7" />
              ) : (
                <Text style={styles.resendText}>Reenviar código</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#98FFD9' },
  screen: { flex: 1 },
  innerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SCREEN_PADDING },
  header: { alignItems: 'center', marginBottom: 30, width: '100%' },
  logo: { fontSize: 48, fontWeight: '600', color: '#FFFFFF', fontFamily: 'SpaceMono', letterSpacing: 6 },
  subtitle: { fontSize: 18, color: '#FFFFFF', marginTop: 10, fontWeight: '500' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: CARD_PADDING, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  instruction: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 24 },
  codeRow: { flexDirection: 'row', justifyContent: 'center', gap: BOX_GAP, marginBottom: 20 },
  codeInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    textAlign: 'center',
    fontWeight: '700',
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    textAlignVertical: 'center', // centrado vertical en Android
    padding: 0, // elimina padding extra que pueda cortar el texto
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 6,
  },
  clearButtonText: {
    color: '#6B7280',
    fontWeight: '500',
    fontSize: 14,
  },
  button: { backgroundColor: '#00C9A7', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
  resendLink: { alignItems: 'center', paddingVertical: 10 },
  resendText: { color: '#00C9A7', fontWeight: '600', fontSize: 16, textDecorationLine: 'underline' },
});

export default VerifyEmailScreen;