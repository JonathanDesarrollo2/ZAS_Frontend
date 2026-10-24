import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { createReport } from '../apis/community';

export const REPORT_CATEGORIES = [
  'Robo/Estafa',
  'Conducta inapropiada',
  'Producto ilegal',
  'Mala atención',
  'Otro',
] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
  reportedUserId?: string;
  productId?: string;
}

export default function ReportModal({ visible, onClose, reportedUserId, productId }: Props) {
  const [category, setCategory] = useState<string>(REPORT_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (description.trim().length < 10) {
      Alert.alert('Informe incompleto', 'Describe el motivo con al menos 10 caracteres.');
      return;
    }
    setSaving(true);
    try {
      const response = await createReport({
        ...(reportedUserId ? { reported_user_id: reportedUserId } : {}),
        ...(productId ? { product_id: productId } : {}),
        category,
        description: description.trim(),
      });
      if (!response.result) throw new Error(response.error?.[0] || 'No se pudo enviar el reporte');
      setDescription('');
      Alert.alert('Reporte enviado', 'Revisaremos la información que compartiste.');
      onClose();
    } catch (error) {
      Alert.alert('No se pudo enviar', error instanceof Error ? error.message : 'Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Reportar</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar reporte">
              <Feather name="x" size={23} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Motivo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
            {REPORT_CATEGORIES.map((item) => (
              <TouchableOpacity key={item} style={[styles.category, category === item && styles.categorySelected]} onPress={() => setCategory(item)}>
                <Text style={[styles.categoryText, category === item && styles.categoryTextSelected]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>Cuéntanos qué ocurrió</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="Incluye los detalles relevantes (mínimo 10 caracteres)"
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={5000}
            textAlignVertical="top"
          />
          <TouchableOpacity style={[styles.submit, saving && styles.disabled]} onPress={() => void submit()} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Enviar reporte</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.45)' },
  sheet: { maxHeight: '85%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  title: { color: '#1F2937', fontSize: 21, fontWeight: '800' },
  label: { color: '#374151', fontSize: 14, fontWeight: '700', marginBottom: 9, marginTop: 7 },
  categories: { gap: 8, paddingBottom: 9 },
  category: { borderRadius: 18, borderWidth: 1, borderColor: '#D1D5DB', paddingHorizontal: 12, paddingVertical: 9 },
  categorySelected: { borderColor: '#00C9A7', backgroundColor: '#E6FFFA' },
  categoryText: { color: '#4B5563', fontSize: 13, fontWeight: '600' },
  categoryTextSelected: { color: '#008F79' },
  input: { minHeight: 125, backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', borderWidth: 1, borderRadius: 12, padding: 13, color: '#1F2937', fontSize: 14 },
  submit: { minHeight: 50, backgroundColor: '#00C9A7', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.65 },
});
