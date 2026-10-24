import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { submitMarketplaceReview } from '../apis/marketplace';

interface Props {
  orderId: string | null;
  visible: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function MarketplaceReviewModal({ orderId, visible, onClose, onSubmitted }: Props) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!orderId || saving) return;
    setSaving(true);
    try {
      const response = await submitMarketplaceReview(orderId, { rating, comment: comment.trim() });
      if (!response.result) throw new Error(response.error?.[0] || 'No se pudo guardar la calificación.');
      setComment('');
      setRating(5);
      onSubmitted();
      onClose();
    } catch (error) {
      Alert.alert('No se pudo calificar', error instanceof Error ? error.message : 'Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Calificar Venta</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar">
              <Feather name="x" size={23} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>¿Cómo fue tu experiencia con esta compra?</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <TouchableOpacity
                key={value}
                onPress={() => setRating(value)}
                accessibilityRole="button"
                accessibilityLabel={`${value} estrellas`}
              >
                <Feather name="star" size={34} color={value <= rating ? '#00C9A7' : '#D1D5DB'} />
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.comment}
            value={comment}
            onChangeText={setComment}
            placeholder="Deja un comentario (opcional)"
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={2000}
            textAlignVertical="top"
          />
          <TouchableOpacity style={[styles.submitButton, saving && styles.disabled]} onPress={() => void submit()} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>Enviar calificación</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(17,24,39,0.5)' },
  modal: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#1F2937', fontSize: 21, fontWeight: '800' },
  subtitle: { color: '#6B7280', fontSize: 14, marginTop: 10 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 20 },
  comment: { minHeight: 105, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, color: '#1F2937', fontSize: 14 },
  submitButton: { minHeight: 48, borderRadius: 12, backgroundColor: '#00C9A7', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  submitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.65 },
});
