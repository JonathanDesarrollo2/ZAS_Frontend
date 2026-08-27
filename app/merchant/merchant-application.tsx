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
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { submitMerchantApplication } from '../../apis/merchant';

const LEGAL_TERMS = `TÉRMINOS Y CONDICIONES PARA COMERCIOS ZAS

1. OBJETO Y ALCANCE
ZAS actúa exclusivamente como una plataforma intermediaria que conecta a comercios con usuarios que solicitan productos. No compra, vende, ni entrega productos por sí misma.

2. COMISIÓN POR VENTAS
El comercio acepta pagar a ZAS una comisión del 5% sobre el monto total de las ventas realizadas a través de la plataforma. Ejemplo: si vende Bs. 100 en un día, ZAS retiene Bs. 5 como comisión.

3. RESPONSABILIDADES DEL COMERCIO
El comercio es el único responsable de la calidad, preparación, entrega y facturación de sus productos. Debe cumplir con las normativas sanitarias y tributarias venezolanas.

4. RELACIÓN CONTRACTUAL
No existe relación laboral entre ZAS y el comercio. Ambas partes son independientes.

5. PROTECCIÓN DE DATOS
Los datos proporcionados serán utilizados únicamente para fines administrativos y de contacto. ZAS no compartirá información con terceros sin autorización.

6. MODIFICACIONES
ZAS podrá modificar estos términos notificando al comercio con al menos 15 días de anticipación.

7. ACEPTACIÓN
Al marcar la casilla de aceptación, el comercio declara haber leído y aceptado íntegramente estos términos.`;

const MerchantApplicationScreen = () => {
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [hasOwnDelivery, setHasOwnDelivery] = useState(false);
  const [rifDocument, setRifDocument] = useState<any>(null);
  const [otherDocs, setOtherDocs] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const pickRifDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setRifDocument(result.assets[0]);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar el documento del RIF');
    }
  };

  const pickOtherDocuments = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setOtherDocs(result.assets);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron seleccionar los documentos');
    }
  };

  const handleSubmit = async () => {
    if (
      !ownerName.trim() ||
      !ownerEmail.trim() ||
      !phone.trim() ||
      !businessName.trim() ||
      !businessAddress.trim()
    ) {
      Alert.alert('Campos requeridos', 'Completa todos los campos obligatorios');
      return;
    }

    if (!rifDocument) {
      Alert.alert('Documento requerido', 'Debes adjuntar el documento del RIF');
      return;
    }

    if (!acceptedTerms) {
      Alert.alert('Términos y condiciones', 'Debes aceptar los términos y condiciones para continuar');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('owner_name', ownerName.trim());
      formData.append('owner_email', ownerEmail.trim().toLowerCase());
      formData.append('phone', phone.trim());
      formData.append('business_name', businessName.trim());
      formData.append('business_address', businessAddress.trim());
      formData.append('has_own_delivery', hasOwnDelivery ? 'true' : 'false');

      formData.append('rif_document', {
        uri: rifDocument.uri,
        type: rifDocument.mimeType || 'application/pdf',
        name: rifDocument.name || 'rif.pdf',
      } as any);

      otherDocs.forEach((doc, index) => {
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

          <View style={styles.docField}>
            <Feather name="file-text" size={20} color="#00C9A7" style={{ marginRight: 10 }} />
            <Text style={styles.docLabel}>Documento RIF (obligatorio)</Text>
            <TouchableOpacity style={styles.uploadButton} onPress={pickRifDocument}>
              <Feather name="upload" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          {rifDocument && (
            <Text style={styles.selectedFile}>{rifDocument.name || 'Documento seleccionado'}</Text>
          )}
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
          <Text style={styles.sectionTitle}>Documentos adicionales (opcional, máx. 5)</Text>
          <TouchableOpacity style={styles.docButton} onPress={pickOtherDocuments}>
            <Feather name="upload" size={16} color="#00C9A7" style={{ marginRight: 8 }} />
            <Text style={styles.docButtonText}>
              {otherDocs.length > 0
                ? `${otherDocs.length} documento(s) seleccionado(s)`
                : 'Adjuntar PDFs o imágenes'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Términos y condiciones */}
        <View style={styles.termsContainer}>
          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setAcceptedTerms(!acceptedTerms)}
          >
            <Feather
              name={acceptedTerms ? 'check-square' : 'square'}
              size={20}
              color={acceptedTerms ? '#00C9A7' : '#9CA3AF'}
            />
            <Text style={styles.termsText}>
              Acepto los{' '}
              <Text
                style={styles.termsLink}
                onPress={() => setShowTerms(true)}
              >
                Términos y Condiciones
              </Text>
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

      {/* Modal de términos */}
      <Modal
        visible={showTerms}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTerms(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Términos y Condiciones</Text>
              <TouchableOpacity onPress={() => setShowTerms(false)}>
                <Feather name="x" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.modalText}>{LEGAL_TERMS}</Text>
            </ScrollView>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setAcceptedTerms(true);
                setShowTerms(false);
              }}
            >
              <Text style={styles.modalButtonText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  docField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  docLabel: { flex: 1, fontSize: 14, color: '#374151' },
  uploadButton: {
    backgroundColor: '#00C9A7',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedFile: {
    color: '#00C9A7',
    fontSize: 13,
    marginBottom: 12,
    marginLeft: 42,
  },
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
  termsContainer: {
    marginBottom: 20,
    marginTop: 4,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  termsText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  termsLink: {
    color: '#00C9A7',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  modalScroll: { padding: 16 },
  modalText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  modalButton: {
    backgroundColor: '#00C9A7',
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});

export default MerchantApplicationScreen;