import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Linking, Alert, StyleSheet, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../presentation/hooks/useAuth';

const KYCScreen = () => {
  const { startKYC, checkKYCStatus, isLoading, checkSession } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    handleCheckStatus();
  }, []);

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const result = await checkKYCStatus();
      setStatus(result);
      if (result === 'verified') {
        // Actualizar la sesión para que el dashboard reciba isKYCVerified = true
        await checkSession();
        Alert.alert('Verificación exitosa', 'Tu identidad ha sido verificada. Ya puedes usar todas las funciones.', [
          { text: 'Ir al dashboard', onPress: () => router.replace('/dashboard') }
        ]);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo consultar el estado');
    } finally {
      setChecking(false);
    }
  };

  const handleStartVerification = async () => {
    setActionLoading(true);
    try {
      const url = await startKYC();
      if (url) {
        Linking.openURL(url);
        Alert.alert(
          'Verificación iniciada',
          'Completa el proceso en el navegador. Luego regresa y presiona "Actualizar estado".',
          [{ text: 'Entendido' }]
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestart = () => {
    Alert.alert(
      'Reiniciar verificación',
      'Esto creará una nueva solicitud de verificación. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Reiniciar', onPress: handleStartVerification }
      ]
    );
  };

  if (checking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C9A7" />
        <Text style={{ marginTop: 12, color: '#6B7280' }}>Consultando estado...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Feather name="shield" size={56} color="#00C9A7" style={styles.icon} />

        <Text style={styles.title}>Verificación de identidad</Text>
        <Text style={styles.description}>
          Para garantizar la seguridad de todos, necesitamos validar tu identidad.
          {'\n'}Es rápido, en línea y solo toma unos minutos.
        </Text>

        {/* Estado actual */}
        <View style={styles.statusContainer}>
          <Feather name="info" size={18} color="#6B7280" />
          <Text style={styles.statusText}>
            Estado: {status === 'verified' ? 'Verificado ✅' : status === 'processing' ? 'En proceso 🔄' : status || 'No iniciado'}
          </Text>
        </View>

        {/* Acciones según estado */}
        {status === 'verified' ? (
          <View style={styles.verifiedBox}>
            <Feather name="check-circle" size={28} color="#4CAF50" />
            <Text style={styles.verifiedMessage}>¡Todo listo! Ya puedes usar la app sin restricciones.</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.replace('/dashboard')}
            >
              <Feather name="home" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryButtonText}>Ir al dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Botón principal */}
            {status === 'processing' ? (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleCheckStatus}
                disabled={actionLoading}
              >
                <Feather name="refresh-cw" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Actualizar estado</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleStartVerification}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="external-link" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryButtonText}>Iniciar verificación</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Botones secundarios */}
            {status === 'processing' && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleRestart}
                disabled={actionLoading}
              >
                <Feather name="rotate-cw" size={18} color="#00C9A7" style={{ marginRight: 8 }} />
                <Text style={styles.secondaryButtonText}>Reiniciar verificación</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.back()}
            >
              <Feather name="arrow-left" size={18} color="#00C9A7" style={{ marginRight: 8 }} />
              <Text style={styles.secondaryButtonText}>Volver al dashboard</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.footerText}>
          ¿Necesitas ayuda? Contacta a soporte.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#98FFD9',
    justifyContent: 'center',
    padding: 20,
  },
  centered: {
    flex: 1,
    backgroundColor: '#98FFD9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  icon: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    gap: 10,
  },
  statusText: {
    color: '#1F2937',
    fontSize: 16,
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#00C9A7',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
  },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: '#00C9A7',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#00C9A7',
    fontWeight: '600',
    fontSize: 16,
  },
  verifiedBox: {
    alignItems: 'center',
    marginBottom: 16,
  },
  verifiedMessage: {
    color: '#4CAF50',
    fontWeight: '600',
    fontSize: 16,
    marginTop: 12,
    marginBottom: 20,
    textAlign: 'center',
  },
  footerText: {
    color: '#9CA3AF',
    textAlign: 'center',
    fontSize: 13,
    marginTop: 8,
  },
});

export default KYCScreen;