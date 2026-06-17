import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { startVerification, getVerificationStatus } from '../../apis/Verification';

type VerificationStatus = 'not_started' | 'pending' | 'processing' | 'verified' | 'rejected';

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

const VerificationScreen = () => {
  const [status, setStatus] = useState<VerificationStatus>('not_started');
  const [loading, setLoading] = useState(false);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg); setToastType(type); setToastVisible(true);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  // Consulta estado actual al montar
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const response = await getVerificationStatus();
      if (response.result) {
        const apiStatus = response.content.status;
        if (apiStatus === 'verified') setStatus('verified');
        else if (apiStatus === 'rejected') setStatus('rejected');
        else if (apiStatus === 'processing') setStatus('processing');
        else if (apiStatus === 'pending') setStatus('pending');
        else setStatus('not_started');
      }
    } catch (error: any) {
      setStatus('not_started');
    }
  };

  const handleStartVerification = async () => {
    setLoading(true);
    try {
      const response = await startVerification();
      if (response.result) {
        const url = response.content.verificationUrl;
        setVerificationUrl(url);
        setStatus('pending');
        if (url) {
          try {
            await Linking.openURL(url);
          } catch (linkError) {
            showToast('No se pudo abrir el enlace, cópialo manualmente.', 'error');
          }
        }
      } else {
        showToast(response.error?.[0] || 'Error al iniciar verificación', 'error');
      }
    } catch (error: any) {
      showToast(error.message || 'Error al iniciar verificación', 'error');
    } finally {
      setLoading(false);
    }
  };

  const retryVerification = () => {
    setStatus('not_started');
    setVerificationUrl(null);
    handleStartVerification();
  };

  const renderContent = () => {
    switch (status) {
      case 'not_started':
        return (
          <View style={styles.statusContainer}>
            <View style={[styles.iconCircle, { backgroundColor: '#E6FFFA' }]}>
              <Feather name="shield" size={48} color="#00C9A7" />
            </View>
            <Text style={styles.statusTitle}>Verificación de identidad</Text>
            <Text style={styles.statusDescription}>
              Para usar Zas necesitas verificar tu identidad.{'\n'}
              Es rápido y seguro a través de Didit.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleStartVerification}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="check-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryButtonText}>Iniciar verificación</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        );

      case 'pending':
      case 'processing':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color="#00C9A7" style={{ marginBottom: 24 }} />
            <Text style={styles.statusTitle}>Verificación en proceso</Text>
            <Text style={styles.statusDescription}>
              Estamos revisando tus documentos.{'\n'}
              Puede tomar unos minutos.
            </Text>
            {verificationUrl && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => Linking.openURL(verificationUrl)}
              >
                <Feather name="external-link" size={18} color="#00C9A7" style={{ marginRight: 8 }} />
                <Text style={styles.secondaryButtonText}>Continuar verificación</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.linkButton} onPress={checkStatus}>
              <Text style={styles.linkButtonText}>Actualizar estado</Text>
            </TouchableOpacity>
          </View>
        );

      case 'verified':
        return (
          <View style={styles.statusContainer}>
            <View style={[styles.iconCircle, { backgroundColor: '#E6FFFA' }]}>
              <Feather name="check" size={48} color="#00C9A7" />
            </View>
            <Text style={styles.statusTitle}>¡Verificado!</Text>
            <Text style={styles.statusDescription}>
              Tu identidad ha sido verificada exitosamente.{'\n'}
              Ya puedes usar todas las funciones de Zas.
            </Text>
          </View>
        );

      case 'rejected':
        return (
          <View style={styles.statusContainer}>
            <View style={[styles.iconCircle, { backgroundColor: '#FFE5E5' }]}>
              <Feather name="x" size={48} color="#FF6B6B" />
            </View>
            <Text style={styles.statusTitle}>Verificación rechazada</Text>
            <Text style={styles.statusDescription}>
              No pudimos verificar tu identidad.{'\n'}
              Inténtalo de nuevo con documentos legibles.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={retryVerification}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Feather name="refresh-cw" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Intentar de nuevo</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.screen}>
      <Toast message={toastMsg} type={toastType} visible={toastVisible} onHide={() => setToastVisible(false)} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.logoRow}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Verificación</Text>
          </View>

          <View style={styles.card}>
            {renderContent()}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F0FDF9',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
  },
  logoRow: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#E5F5F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    minHeight: 300,
    justifyContent: 'center',
  },
  statusContainer: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  statusDescription: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  primaryButton: {
    backgroundColor: '#00C9A7',
    borderRadius: 16,
    height: 52,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    shadowColor: '#00C9A7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    width: '100%',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  secondaryButtonText: {
    color: '#00C9A7',
    fontWeight: '600',
    fontSize: 16,
  },
  linkButton: {
    paddingVertical: 8,
  },
  linkButtonText: {
    color: '#6B7280',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  toast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    borderRadius: 20,
    padding: 18,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
});

export default VerificationScreen;