import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Animated,
  KeyboardAvoidingView, Platform, Keyboard, ScrollView, StyleSheet, Image
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

// ---------- Register ----------
const RegisterScreen = () => {
  const [email, setEmail] = useState('');
  const [loginName, setLoginName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repass, setRepass] = useState('');
  const [nivel, setNivel] = useState(3);
  const { register, isLoading } = useAuth();

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

  const handleRegister = async () => {
    Keyboard.dismiss();
    const mail = email.trim().toLowerCase();
    if (!mail) return showToast('Ingresa tu correo electrónico');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) return showToast('Correo electrónico inválido');
    if (!loginName.trim()) return showToast('Ingresa un nombre de usuario');
    if (loginName.trim().length < 4) return showToast('El usuario debe tener al menos 4 caracteres');
    if (!password) return showToast('La contraseña es requerida');
    if (password.length < 6) return showToast('La contraseña debe tener al menos 6 caracteres');
    if (password !== repass) return showToast('Las contraseñas no coinciden');

    try {
      await register({
        usermail: mail,
        userlogin: loginName.trim(),
        username: username.trim(),
        userpass: password,
        userrepass: repass,
        nivel,
      });
      showToast('Registro exitoso, verifica tu correo', 'success');
      // Redirigir directamente a la pantalla de verificación de correo
      setTimeout(() => router.replace('/auth/VerifyEmail'), 500);
    } catch (err: any) {
      let msg = err?.message || 'Error al registrarse';
      if (msg === 'Invalid value') msg = 'Datos inválidos, revisa la información';
      showToast(msg);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <Toast message={toastMsg} type={toastType} visible={toastVisible} onHide={() => setToastVisible(false)} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center', marginBottom: 30 }}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Zas</Text>
          <Text style={styles.sub}>Crea tu cuenta y empieza a viajar</Text>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={styles.inputRow}><Feather name="mail" size={20} color="#9ca3af" style={{ marginRight: 12 }} /><TextInput placeholder="Correo electrónico" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={styles.input} placeholderTextColor="#9ca3af" /></View>
          <View style={styles.inputRow}><Feather name="user" size={20} color="#9ca3af" style={{ marginRight: 12 }} /><TextInput placeholder="Nombre de usuario" value={loginName} onChangeText={setLoginName} style={styles.input} placeholderTextColor="#9ca3af" /></View>
          <View style={styles.inputRow}><Feather name="edit-2" size={20} color="#9ca3af" style={{ marginRight: 12 }} /><TextInput placeholder="Nombre completo (opcional)" value={username} onChangeText={setUsername} style={styles.input} placeholderTextColor="#9ca3af" /></View>
          <View style={styles.inputRow}><Feather name="lock" size={20} color="#9ca3af" style={{ marginRight: 12 }} /><TextInput placeholder="Contraseña" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholderTextColor="#9ca3af" /></View>
          <View style={styles.inputRow}><Feather name="lock" size={20} color="#9ca3af" style={{ marginRight: 12 }} /><TextInput placeholder="Repetir contraseña" value={repass} onChangeText={setRepass} secureTextEntry style={styles.input} placeholderTextColor="#9ca3af" /></View>

          <Text style={styles.roleLabel}>Elige tu rol</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
            {[{ label: 'Pasajero', value: 3, icon: 'user' as const }, { label: 'Conductor', value: 2, icon: 'truck' as const }].map(rol => (
              <TouchableOpacity key={rol.value} onPress={() => setNivel(rol.value)} style={[styles.roleCard, { borderColor: nivel === rol.value ? '#00C9A7' : '#e5e7eb', backgroundColor: nivel === rol.value ? '#e6fffa' : '#fff' }]}>
                <Feather name={rol.icon} size={22} color={nivel === rol.value ? '#00C9A7' : '#9ca3af'} style={{ marginBottom: 4 }} />
                <Text style={{ fontWeight: '600', color: nivel === rol.value ? '#00C9A7' : '#6b7280', fontSize: 15 }}>{rol.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity onPress={handleRegister} disabled={isLoading} activeOpacity={0.8} style={[styles.btn, isLoading && { opacity: 0.7 }]}>
            {isLoading ? <Text style={styles.btnText}>Registrando...</Text> : <><Text style={styles.btnText}>Registrarse</Text><Feather name="arrow-right" size={20} color="#fff" style={{ marginLeft: 8 }} /></>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24 }}>
            <Text style={styles.link}>¿Ya tienes cuenta? <Text style={{ color: '#00C9A7', fontWeight: '600' }}>Inicia sesión</Text></Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdf9' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 30, paddingVertical: 40 },
  logo: { width: 120, height: 120, marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '800', color: '#1f2937', marginBottom: 4 },
  sub: { fontSize: 14, color: '#6b7280' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 16, marginBottom: 16, paddingHorizontal: 16, height: 52,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  roleLabel: { fontWeight: '600', color: '#374151', marginBottom: 12, marginTop: 4 },
  roleCard: { flex: 1, paddingVertical: 14, marginHorizontal: 4, borderRadius: 14, borderWidth: 2, alignItems: 'center' },
  btn: {
    backgroundColor: '#00C9A7', borderRadius: 16, height: 52,
    justifyContent: 'center', alignItems: 'center', flexDirection: 'row',
    shadowColor: '#00C9A7', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5, marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', color: '#6b7280', fontSize: 14 },
  toast: {
    position: 'absolute', top: 60, left: 20, right: 20,
    borderRadius: 20, padding: 18, zIndex: 1000,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 12,
  },
  toastContent: { flexDirection: 'row', alignItems: 'center' },
  toastText: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
});

export default RegisterScreen;