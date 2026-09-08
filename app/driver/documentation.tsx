// app/driver/documentation.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Switch
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { getToken, apiClient } from '../../apis/Client';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api';

type FileSelection = DocumentPicker.DocumentPickerResult | ImagePicker.ImagePickerResult | null;

function getSelectedFileName(file: FileSelection): string {
  if (!file || file.canceled || !file.assets?.length) return '';
  const asset = file.assets[0] as any;
  return asset.name || asset.fileName || 'archivo';
}

function getSelectedFileUri(file: FileSelection): string | null {
  if (!file || file.canceled || !file.assets?.length) return null;
  return file.assets[0].uri;
}

function getSelectedFileType(file: FileSelection): string {
  if (!file || file.canceled || !file.assets?.length) return 'application/octet-stream';
  const asset = file.assets[0] as any;
  return asset.mimeType || 'application/octet-stream';
}

const DriverDocumentationScreen = () => {
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>(null);
  const [form, setForm] = useState({
    marca_modelo: '', año: '', color: '', placa: '', cilindrada: '',
  });
  const [hasAntecedentes, setHasAntecedentes] = useState(true);

  const [files, setFiles] = useState<Record<string, FileSelection>>({
    cedula: null,
    licencia: null,
    certificado_medico: null,
    antecedentes_penales: null,
    carnet_circulacion: null,
    traspaso_notariado: null,
    poliza_rcv: null,
    // Nombres correctos para backend
    foto_vehiculo_1: null,
    foto_vehiculo_2: null,
    foto_vehiculo_3: null,
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDoc();
  }, []);

  const fetchDoc = async () => {
    try {
      const res = await apiClient<{ result: boolean; content: any }>('/private/driver-docs/mine');
      if (res.result && res.content) {
        setDoc(res.content);
        const c = res.content;
        setForm({
          marca_modelo: c.marca_modelo || '',
          año: c.año?.toString() || '',
          color: c.color || '',
          placa: c.placa || '',
          cilindrada: c.cilindrada?.toString() || '',
        });
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo cargar la documentación');
    } finally {
      setLoading(false);
    }
  };

  const pickFile = async (field: string) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: false,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setFiles(prev => ({ ...prev, [field]: result }));
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo seleccionar el archivo');
    }
  };

  const pickImage = async (field: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la galería para seleccionar las fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setFiles(prev => ({ ...prev, [field]: result }));
    }
  };

  const handleSubmit = async () => {
    if (hasAntecedentes && !files.antecedentes_penales) {
      Alert.alert('Archivo requerido', 'Adjunta el certificado de antecedentes penales o marca que no tienes.');
      return;
    }

    if (!form.marca_modelo || !form.año || !form.color || !form.placa || !form.cilindrada) {
      Alert.alert('Campos requeridos', 'Completa todos los campos de la moto');
      return;
    }

    const vehiclePhotos = [files.foto_vehiculo_1, files.foto_vehiculo_2, files.foto_vehiculo_3].filter(Boolean);
    if (vehiclePhotos.length < 2) {
      Alert.alert('Fotos requeridas', 'Debes subir al menos 2 fotos del vehículo desde diferentes ángulos.');
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      const formData = new FormData();

      // Adjuntar archivos con nombres correctos
      for (const [field, fileSelection] of Object.entries(files)) {
        if (!fileSelection || fileSelection.canceled || !fileSelection.assets?.length) continue;
        const uri = getSelectedFileUri(fileSelection)!;
        const type = getSelectedFileType(fileSelection);
        const name = getSelectedFileName(fileSelection) || `${field}.jpg`;

        let backendFieldName = field;
        if (
          ['cedula', 'licencia', 'certificado_medico', 'antecedentes_penales', 'carnet_circulacion', 'traspaso_notariado', 'poliza_rcv'].includes(field)
        ) {
          backendFieldName = `${field}_file`;
        } else if (['foto_vehiculo_1', 'foto_vehiculo_2', 'foto_vehiculo_3'].includes(field)) {
          backendFieldName = field; // sin sufijo
        }

        formData.append(backendFieldName, { uri, type, name } as any);
      }

      // Adjuntar campos de texto
      formData.append('marca_modelo', form.marca_modelo);
      formData.append('anio', form.año);
      formData.append('color', form.color);
      formData.append('placa', form.placa);
      formData.append('cilindrada', form.cilindrada);
      formData.append('has_antecedentes', hasAntecedentes ? 'true' : 'false');

      const response = await fetch(`${BASE_URL}/private/driver-docs/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.[0] || 'Error al enviar');
      }
      Alert.alert('Enviado', 'Documentación enviada para revisión');
      fetchDoc();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo enviar');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C9A7" />
      </View>
    );
  }

  const status = doc?.documentacion_status;
  const canEdit = !status || status === 'pending' || status === 'rejected';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Documentación del conductor</Text>

        <View style={styles.stepsBox}>
          <Text style={styles.stepText}>📋 Paso 1: Sube tus documentos</Text>
          <Text style={styles.stepText}>🔍 Paso 2: Revisión administrativa presencial</Text>
          <Text style={styles.stepText}>🏍️ Paso 3: ¡A rodar!</Text>
        </View>

        {doc && (
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Estado de documentación:</Text>
            <Text style={[styles.statusValue, { color: status === 'approved' ? 'green' : status === 'rejected' ? 'red' : 'orange' }]}>
              {status === 'approved' ? 'Aprobada' : status === 'rejected' ? 'Rechazada' : 'Pendiente'}
            </Text>
            {doc.observaciones && <Text style={styles.obs}>Motivo: {doc.observaciones}</Text>}
            <Text style={styles.statusLabel}>Inspección física:</Text>
            <Text style={{ color: doc.inspeccion_fisica_aprobada ? 'green' : 'orange' }}>
              {doc.inspeccion_fisica_aprobada ? 'Aprobada' : 'Pendiente'}
            </Text>
          </View>
        )}

        {canEdit && (
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>Tus documentos</Text>
            <FileField label="Cédula de identidad" field="cedula" file={files.cedula} onPick={() => pickFile('cedula')} optional />
            <FileField label="Licencia de conducir" field="licencia" file={files.licencia} onPick={() => pickFile('licencia')} optional />
            <FileField label="Certificado médico vial" field="certificado_medico" file={files.certificado_medico} onPick={() => pickFile('certificado_medico')} optional />

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>¿Tienes antecedentes penales?</Text>
              <Switch
                value={hasAntecedentes}
                onValueChange={setHasAntecedentes}
                trackColor={{ false: '#E5E7EB', true: '#00C9A7' }}
                thumbColor="#fff"
              />
            </View>
            {hasAntecedentes && (
              <FileField label="Antecedentes penales" field="antecedentes_penales" file={files.antecedentes_penales} onPick={() => pickFile('antecedentes_penales')} />
            )}

            <Text style={styles.sectionTitle}>Datos de la moto</Text>
            <TextInputField label="Marca y modelo" value={form.marca_modelo} onChange={(v: string) => setForm({ ...form, marca_modelo: v })} />
            <TextInputField label="Año" value={form.año} onChange={(v: string) => setForm({ ...form, año: v })} keyboardType="numeric" />
            <TextInputField label="Color" value={form.color} onChange={(v: string) => setForm({ ...form, color: v })} />
            <TextInputField label="Placa" value={form.placa} onChange={(v: string) => setForm({ ...form, placa: v })} />
            <TextInputField label="Cilindrada (cc)" value={form.cilindrada} onChange={(v: string) => setForm({ ...form, cilindrada: v })} keyboardType="numeric" />

            <Text style={styles.sectionTitle}>Documentos del vehículo</Text>
            <FileField label="Carnet de circulación" field="carnet_circulacion" file={files.carnet_circulacion} onPick={() => pickFile('carnet_circulacion')} />
            <FileField label="Traspaso notariado (si aplica)" field="traspaso_notariado" file={files.traspaso_notariado} onPick={() => pickFile('traspaso_notariado')} optional />
            <FileField label="Póliza de RCV" field="poliza_rcv" file={files.poliza_rcv} onPick={() => pickFile('poliza_rcv')} />

            <Text style={styles.sectionTitle}>Fotos del vehículo (mínimo 2)</Text>
            <FileField label="Foto 1 (frente)" field="foto_vehiculo_1" file={files.foto_vehiculo_1} onPick={() => pickImage('foto_vehiculo_1')} />
            <FileField label="Foto 2 (lateral)" field="foto_vehiculo_2" file={files.foto_vehiculo_2} onPick={() => pickImage('foto_vehiculo_2')} />
            <FileField label="Foto 3 (trasera)" field="foto_vehiculo_3" file={files.foto_vehiculo_3} onPick={() => pickImage('foto_vehiculo_3')} optional />

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Enviar documentación</Text>}
            </TouchableOpacity>
          </View>
        )}

        {status === 'approved' && doc.inspeccion_fisica_aprobada && (
          <Text style={styles.readyText}>🎉 ¡Ya puedes empezar a trabajar!</Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Componentes FileField y TextInputField sin cambios
const FileField = ({ label, field, file, onPick, optional }: {
  label: string;
  field: string;
  file: FileSelection;
  onPick: () => void;
  optional?: boolean;
}) => {
  const selectedName = getSelectedFileName(file);
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label} {optional ? '(opcional)' : ''}</Text>
      <TouchableOpacity style={styles.filePicker} onPress={onPick}>
        <Feather name="upload" size={16} color="#00C9A7" style={{ marginRight: 8 }} />
        <Text style={[styles.filePickerText, selectedName ? { color: '#1F2937' } : null]}>
          {selectedName || 'Seleccionar archivo'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const TextInputField = ({ label, value, onChange, keyboardType = 'default' }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: any;
}) => (
  <View style={styles.fieldContainer}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={styles.textInput}
      value={value}
      onChangeText={onChange}
      keyboardType={keyboardType}
      placeholder={label}
      placeholderTextColor="#9CA3AF"
    />
  </View>
);

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 80, paddingBottom: 60, backgroundColor: '#F0FDF9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0FDF9' },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937', marginBottom: 20 },
  stepsBox: { backgroundColor: '#E0F2FE', borderRadius: 12, padding: 16, marginBottom: 20 },
  stepText: { fontSize: 16, fontWeight: '500', color: '#075985', marginBottom: 8 },
  statusCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  statusLabel: { fontWeight: '600', marginBottom: 4 },
  statusValue: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  obs: { color: '#6B7280', marginBottom: 8 },
  formSection: { marginBottom: 30 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#1F2937', marginBottom: 16, marginTop: 20 },
  fieldContainer: { marginBottom: 16 },
  fieldLabel: { fontWeight: '600', color: '#374151', marginBottom: 6 },
  filePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filePickerText: { color: '#9CA3AF', fontSize: 16, flex: 1 },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  toggleLabel: { fontSize: 15, color: '#374151', fontWeight: '500' },
  submitButton: {
    backgroundColor: '#00C9A7',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  submitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
  readyText: { textAlign: 'center', color: '#00C9A7', fontWeight: '700', fontSize: 18, marginTop: 20 },
});

export default DriverDocumentationScreen;