import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Animated,
  KeyboardAvoidingView, Platform, Keyboard, StyleSheet, Image
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../presentation/hooks/useAuth';

// ---------- Toast ----------
const Toast = ({ message, type = 'error', visible, onHide }: { message: string; type?: 'error' | 'success'; visible: boolean; onHide: () => void }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-80)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, friction: 8, tension: 100, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -80, duration: 250, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => onHide());
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [visible]);
  if (!visible) return null;
  const bgColor = type === 'error' ? '#FF6B6B' : '#00C9A7';
  const iconName = type === 'error' ? 'alert-circle' : 'check-circle';
  return (
    <Animated.View style={[styles.toast, { backgroundColor: bgColor, opacity, transform: [{ translateY }] }]}>
      <View style={styles.toastContent}>
        <Feather name={iconName} size={22} color="#fff" style={{ marginRight: 12 }} />
        <Text style={styles.toastText}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuth();

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

  const handleLogin = async () => {
    Keyboard.dismiss();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return showToast('Ingresa tu correo electrónico');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) return showToast('Correo electrónico inválido');
    if (!password) return showToast('La contraseña es requerida');
    if (password.length < 6) return showToast('La contraseña debe tener al menos 6 caracteres');
    try {
      await login({ usermail: trimmedEmail, userpass: password });
      showToast('¡Bienvenido! Redirigiendo...', 'success');
      setTimeout(() => router.replace('/dashboard'), 1000);
    } catch (err: any) {
      let mensaje = err?.message || 'Error al iniciar sesión';
      if (mensaje === 'Invalid value') mensaje = 'Correo o contraseña incorrectos';
      showToast(mensaje);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <Toast message={toastMsg} type={toastType} visible={toastVisible} onHide={() => setToastVisible(false)} />
      <View style={styles.innerContainer}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center', marginBottom: 40 }}>
          {/* Solo la imagen del logo, sin fondo */}
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>Zas</Text>
          <Text style={styles.subtitle}>Tu viaje, a un toque</Text>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.inputRow}>
            <Feather name="mail" size={20} color="#9ca3af" style={{ marginRight: 12 }} />
            <TextInput placeholder="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={styles.input} placeholderTextColor="#9ca3af" />
          </View>
          <View style={styles.inputRow}>
            <Feather name="lock" size={20} color="#9ca3af" style={{ marginRight: 12 }} />
            <TextInput placeholder="Contraseña" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} style={styles.input} placeholderTextColor="#9ca3af" />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleLogin} disabled={isLoading} activeOpacity={0.8} style={[styles.btn, isLoading && { opacity: 0.7 }]}>
            {isLoading ? <Text style={styles.btnText}>Verificando...</Text> : <><Text style={styles.btnText}>Entrar</Text><Feather name="arrow-right" size={20} color="#fff" style={{ marginLeft: 8 }} /></>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/auth/register')} style={{ marginTop: 24 }}>
            <Text style={styles.linkText}>¿No tienes cuenta? <Text style={{ color: '#00C9A7', fontWeight: '600' }}>Regístrate</Text></Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdf9' },
  innerContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  logo: {
    width: 120,       // Ajusta según el tamaño deseado
    height: 120,
    marginBottom: 20,
  },
  appName: { fontSize: 32, fontWeight: '800', color: '#1f2937', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280' },
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
    justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
    shadowColor: '#00C9A7', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5, marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkText: { textAlign: 'center', color: '#6b7280', fontSize: 14 },
  toast: {
    position: 'absolute', top: 60, left: 20, right: 20,
    borderRadius: 20, padding: 18, zIndex: 1000,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 12,
  },
  toastContent: { flexDirection: 'row', alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
});

export default LoginScreen;