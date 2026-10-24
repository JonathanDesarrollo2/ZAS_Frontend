import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { acceptLegalConsent } from '../../apis/auth';
import LegalDocumentModal from '../../components/LegalDocumentModal';
import { GENERAL_TERMS, LEGAL_TERMS_VERSION, PRIVACY_POLICY } from '../../legal/LegalTexts';
import { useAuth } from '../../presentation/store/AuthStore';

export default function LegalConsentScreen() {
  const [accepted, setAccepted] = useState(false);
  const [document, setDocument] = useState<'terms' | 'privacy' | null>(null);
  const [saving, setSaving] = useState(false);
  const checkSession = useAuth((state) => state.checkSession);

  const continueToApp = async () => {
    if (!accepted || saving) return;
    setSaving(true);
    try {
      const response = await acceptLegalConsent();
      if (!response.result) throw new Error(response.error?.[0] || 'No se pudo guardar la aceptación');
      if (
        typeof response.content?.terms_version !== 'string' ||
        !response.content.terms_version.trim() ||
        typeof response.content?.privacy_policy_version !== 'string' ||
        !response.content.privacy_policy_version.trim()
      ) {
        throw new Error('El servidor no confirmó la versión de los documentos aceptados.');
      }
      useAuth.setState((state) => state.user ? ({
        user: {
          ...state.user,
          terms_version: response.content.terms_version,
          privacy_policy_version: response.content.privacy_policy_version,
        },
      }) : {});
      await checkSession();
      router.replace('/dashboard');
    } catch (error) {
      Alert.alert('No se pudo continuar', error instanceof Error ? error.message : 'Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.icon}><Feather name="file-text" size={28} color="#00A98E" /></View>
        <Text style={styles.title}>Actualizamos nuestros documentos</Text>
        <Text style={styles.description}>
          Para continuar usando ZAS, revisa y acepta los Términos y Condiciones y la Política de Privacidad vigentes.
        </Text>
        <TouchableOpacity style={styles.documentRow} onPress={() => setDocument('terms')}>
          <Text style={styles.documentTitle}>Términos y Condiciones</Text>
          <Feather name="chevron-right" size={20} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.documentRow} onPress={() => setDocument('privacy')}>
          <Text style={styles.documentTitle}>Política de Privacidad</Text>
          <Feather name="chevron-right" size={20} color="#6B7280" />
        </TouchableOpacity>
        <Text style={styles.version}>Versión {LEGAL_TERMS_VERSION}</Text>
        <TouchableOpacity
          style={styles.acceptRow}
          onPress={() => setAccepted((value) => !value)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
        >
          <Feather name={accepted ? 'check-square' : 'square'} size={22} color={accepted ? '#00C9A7' : '#6B7280'} />
          <Text style={styles.acceptText}>He leído y acepto ambos documentos.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, (!accepted || saving) && styles.disabled]} disabled={!accepted || saving} onPress={() => void continueToApp()}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Aceptar y continuar</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.logout} onPress={() => void useAuth.getState().logout()}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
      <LegalDocumentModal
        visible={document !== null}
        title={document === 'privacy' ? 'Política de Privacidad' : 'Términos y Condiciones'}
        content={document === 'privacy' ? PRIVACY_POLICY : GENERAL_TERMS}
        onClose={() => setDocument(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC', justifyContent: 'center' },
  content: { padding: 24, justifyContent: 'center', flexGrow: 1 },
  icon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#E6FFFA', alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  title: { color: '#1F2937', fontSize: 25, fontWeight: '800' },
  description: { color: '#6B7280', fontSize: 15, lineHeight: 22, marginTop: 10, marginBottom: 22 },
  documentRow: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  documentTitle: { color: '#1F2937', fontWeight: '700', fontSize: 15 },
  version: { color: '#9CA3AF', fontSize: 12, marginTop: 2, marginBottom: 22 },
  acceptRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  acceptText: { color: '#374151', fontSize: 14, flex: 1 },
  button: { minHeight: 52, borderRadius: 13, backgroundColor: '#00C9A7', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  disabled: { opacity: 0.5 },
  logout: { alignItems: 'center', padding: 16 },
  logoutText: { color: '#6B7280', fontWeight: '600' },
});
