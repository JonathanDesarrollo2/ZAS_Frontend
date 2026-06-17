import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Switch, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getAvailability, toggleAvailability } from '../../apis/driver';

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
  return (
    <Animated.View style={[styles.toast, { backgroundColor: type === 'error' ? '#FF6B6B' : '#00C9A7', opacity, transform: [{ translateY }] }]}>
      <Feather name={type === 'error' ? 'alert-circle' : 'check-circle'} size={22} color="#fff" style={{ marginRight: 12 }} />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

const AvailabilityScreen = () => {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastV, setToastV] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => { setToastMsg(msg); setToastType(type); setToastV(true); }, []);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start(); }, []);

  useEffect(() => {
    (async () => { try { const st = await getAvailability(); setAvailable(st); } catch (e: any) { showToast(e.message); } finally { setLoading(false); } })();
  }, []);

  const handleToggle = async (val: boolean) => {
    try { await toggleAvailability(); setAvailable(val); showToast(val ? 'Ahora estás disponible' : 'Disponibilidad desactivada', 'success'); } catch (e: any) { showToast(e.message); }
  };

  return (
    <View style={styles.screen}>
      <Toast message={toastMsg} type={toastType} visible={toastV} onHide={() => setToastV(false)} />
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <Text style={styles.title}>Estado del conductor</Text>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Image source={require('../../assets/images/logo.png')} style={{ width: 40, height: 40 }} resizeMode="contain" />
            <Text style={styles.statusText}>{available ? 'Disponible' : 'No disponible'}</Text>
            <Switch
              value={available ?? false}
              onValueChange={handleToggle}
              trackColor={{ false: '#E5E7EB', true: '#00C9A7' }}
              thumbColor="#fff"
              disabled={loading}
            />
          </View>
          <Text style={styles.hint}>Toca el interruptor para cambiar tu estado</Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  container: { flex: 1, paddingTop: 80, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937', marginBottom: 24 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5F5F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statusText: {
    color: '#1F2937',
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    marginLeft: 16,
  },
  hint: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
  toast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    borderRadius: 20,
    padding: 18,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  toastText: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
});

export default AvailabilityScreen;