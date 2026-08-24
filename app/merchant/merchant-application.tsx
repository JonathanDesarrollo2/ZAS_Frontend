import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { submitMerchantApplication } from '../../apis/merchant';

const MerchantApplicationScreen = () => {
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [rif, setRif] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [hasOwnDelivery, setHasOwnDelivery] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const pickDocuments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setDocuments(result.assets);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron seleccionar los documentos');
    }
  };

  const handleSubmit = async () => {
    if (!ownerName.trim() || !ownerEmail.trim() || !phone.trim() || !rif.trim() || !businessName.trim() || !businessAddress.trim()) {
      Alert.alert('Campos requeridos', 'Completa todos los campos obligatorios');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('owner_name', ownerName.trim());
      formData.append('owner_email', ownerEmail.trim().toLowerCase());
      formData.append('phone', phone.trim());
      formData.append('rif', rif.trim());
      formData.append('business_name', businessName.trim());
      formData.append('business_address', businessAddress.trim());
      formData.append('has_own_delivery', hasOwnDelivery ? 'true' : 'false');

      // Adjuntar documentos (si hay)
      documents.forEach((doc, index) => {
        formData.append('documents', {
          uri: doc.uri,
          type: doc.mimeType || 'application/pdf',
          name: doc.name || `document_${index}.pdf`,
        } as any);
      });

      await submitMerchantApplication(formData);

      Alert.alert(
        'Solicitud enviada',
        'Hemos recibido tu solicitud de afiliación. Nuestro equipo se pondrá en contacto contigo.',
        [{ text: 'Entendido', onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo enviar la solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Feather name="briefcase" size={48} color="#00C9A7" />
          <Text style={styles.title}>Afíliate como comercio</Text>
          <Text style={styles.subtitle}>
            Completa el formulario y adjunta los documentos requeridos. Nuestro equipo revisará tu solicitud.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Datos del propietario</Text>

          <View style={styles.inputRow}>
            <Feather name="user" size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
            <TextInput
              style={styles.input}
              placeholder="Nombre completo"
              value={ownerName}
              onChangeText={setOwnerName}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputRow}>
            <Feather name="mail" size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
            <TextInput
              style={styles.input}
              placeholder="Correo electrónico"
              value={ownerEmail}
              onChangeText={setOwnerEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputRow}>
            <Feather name="phone" size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
            <TextInput
              style={styles.input}
              placeholder="Teléfono"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputRow}>
            <Feather name="credit-card" size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
            <TextInput
              style={styles.input}
              placeholder="RIF"
              value={rif}
              onChangeText={setRif}
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Datos del negocio</Text>

          <View style={styles.inputRow}>
            <Feather name="shopping-bag" size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
            <TextInput
              style={styles.input}
              placeholder="Nombre del negocio"
              value={businessName}
              onChangeText={setBusinessName}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputRow}>
            <Feather name="map-pin" size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
            <TextInput
              style={styles.input}
              placeholder="Dirección del negocio"
              value={businessAddress}
              onChangeText={setBusinessAddress}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>¿Tienes delivery propio?</Text>
            <Switch
              value={hasOwnDelivery}
              onValueChange={setHasOwnDelivery}
              trackColor={{ false: '#E5E7EB', true: '#00C9A7' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Documentos (opcional, máx. 5)</Text>
          <TouchableOpacity style={styles.docButton} onPress={pickDocuments}>
            <Feather name="upload" size={16} color="#00C9A7" style={{ marginRight: 8 }} />
            <Text style={styles.docButtonText}>
              {documents.length > 0 ? `${documents.length} documento(s) seleccionado(s)` : 'Adjuntar PDFs o imágenes'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.submitButtonText}>Enviar solicitud</Text>
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
  header: { alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 26, fontWeight: '700', color: '#1F2937', marginTop: 16 },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  input: { flex: 1, fontSize: 16, color: '#111827' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
  },
  toggleLabel: { fontSize: 15, color: '#374151', fontWeight: '500' },
  docButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#00C9A7',
  },
  docButtonText: { color: '#00C9A7', fontWeight: '600', flex: 1, marginLeft: 4 },
  submitButton: {
    backgroundColor: '#00C9A7',
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00C9A7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
});

export default MerchantApplicationScreen;