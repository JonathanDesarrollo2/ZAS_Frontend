import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Animated,
  KeyboardAvoidingView, Platform, Keyboard, StyleSheet, ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { requestPasswordResetCode, resetPasswordWithCode } from '../../apis/auth';

const ForgotPasswordScreen = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg); setToastType(type); setToastVisible(true);
  }, []);

  const handleSendCode = async () => {
    Keyboard.dismiss();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return showToast('Ingresa tu correo electrónico');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return showToast('Correo electrónico inválido');

    setLoading(true);
    try {
      await requestPasswordResetCode(trimmedEmail);
      showToast('Código enviado. Revisa tu correo.', 'success');
      setStep('reset');
    } catch (err: any) {
      showToast(err.message || 'No se pudo enviar el código');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    Keyboard.dismiss();
    if (!code.trim()) return showToast('Ingresa el código de 6 dígitos');
    if (newPassword.length < 6) return showToast('La nueva contraseña debe tener al menos 6 caracteres');

    setLoading(true);
    try {
      const trimmedEmail = email.trim().toLowerCase();
      const response = await resetPasswordWithCode(trimmedEmail, code.trim(), newPassword);
      if (response.result) {
        showToast('Contraseña restablecida correctamente', 'success');
        setTimeout(() => router.back(), 1500);
      } else {
        showToast(response.error?.[0] || 'Error al restablecer contraseña');
      }
    } catch (err: any) {
      showToast(err.message || 'Error al restablecer contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.innerContainer}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center', marginBottom: 40 }}>
          <Feather name="lock" size={48} color="#00C9A7" />
          <Text style={styles.title}>Recuperar contraseña</Text>
          <Text style={styles.subtitle}>Te enviaremos un código a tu correo</Text>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.inputRow}>
            <Feather name="mail" size={20} color="#9ca3af" style={{ marginRight: 12 }} />
            <TextInput
              placeholder="Correo electrónico"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
              editable={step === 'email'}
              placeholderTextColor="#9ca3af"
            />
          </View>

          {step === 'reset' && (
            <>
              <View style={styles.inputRow}>
                <Feather name="hash" size={20} color="#9ca3af" style={{ marginRight: 12 }} />
                <TextInput
                  placeholder="Código de 6 dígitos"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="numeric"
                  maxLength={6}
                  style={styles.input}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.inputRow}>
                <Feather name="lock" size={20} color="#9ca3af" style={{ marginRight: 12 }} />
                <TextInput
                  placeholder="Nueva contraseña (mín. 6 caracteres)"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  style={styles.input}
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </>
          )}

          {step === 'email' ? (
            <TouchableOpacity
              onPress={handleSendCode}
              disabled={loading}
              activeOpacity={0.8}
              style={[styles.btn, loading && { opacity: 0.7 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Enviar código</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleResetPassword}
              disabled={loading}
              activeOpacity={0.8}
              style={[styles.btn, loading && { opacity: 0.7 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Restablecer contraseña</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24 }}>
            <Text style={styles.linkText}>Volver al inicio de sesión</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {toastVisible && (
        <View style={[styles.toast, { backgroundColor: toastType === 'error' ? '#FF6B6B' : '#00C9A7' }]}>
          <Feather name={toastType === 'error' ? 'alert-circle' : 'check-circle'} size={22} color="#fff" style={{ marginRight: 12 }} />
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdf9' },
  innerContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  title: { fontSize: 28, fontWeight: '800', color: '#1f2937', marginTop: 16 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 16, marginBottom: 16, paddingHorizontal: 16, height: 52,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  btn: {
    backgroundColor: '#00C9A7', borderRadius: 16, height: 52,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#00C9A7', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5, marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkText: { textAlign: 'center', color: '#6b7280', fontSize: 14 },
  toast: {
    position: 'absolute', top: 60, left: 20, right: 20,
    borderRadius: 20, padding: 18, zIndex: 1000,
    flexDirection: 'row', alignItems: 'center',
  },
  toastText: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
});

export default ForgotPasswordScreen;