import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { ReviewRole, submitReview } from '../apis/community';

interface Props {
  visible: boolean;
  tripId: string;
  revieweeId: string;
  reviewerRole: ReviewRole;
  onClose: () => void;
  onSubmitted?: () => void;
}

const roleTags: Record<ReviewRole, string[]> = {
  passenger: ['Manejo seguro', 'Puntual', 'Amable', 'Vehículo limpio'],
  driver: ['Puntual', 'Amable', 'Respetuoso', 'Comunicación clara'],
};

export default function ReviewModal({
  visible,
  tripId,
  revieweeId,
  reviewerRole,
  onClose,
  onSubmitted,
}: Props) {
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setRating(0);
      setTags([]);
      setComment('');
      setError('');
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!tripId || !revieweeId || rating < 1) {
      setError('Selecciona una calificación para continuar.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitReview({
        trip_id: tripId,
        reviewee_id: revieweeId,
        reviewer_role: reviewerRole,
        rating,
        tags,
        comment: comment.trim(),
      });
      onSubmitted?.();
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo enviar la reseña.');
    } finally {
      setSubmitting(false);
    }
  };

  const tagsForRole = roleTags[reviewerRole];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.topRow}>
            <View style={styles.icon}><Feather name="check" size={22} color="#00C9A7" /></View>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar reseña">
              <Feather name="x" size={22} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>¿Cómo estuvo tu viaje?</Text>
          <Text style={styles.subtitle}>Tu opinión ayuda a mantener la comunidad segura.</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <TouchableOpacity key={value} onPress={() => setRating(value)} accessibilityLabel={`${value} estrellas`}>
                <MaterialIcons
                  name={value <= rating ? 'star' : 'star-outline'}
                  size={34}
                  color={value <= rating ? '#00C9A7' : '#D1D5DB'}
                />
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.tags}>
            {tagsForRole.map((tag) => {
              const selected = tags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => setTags((current) => selected
                    ? current.filter((item) => item !== tag)
                    : [...current, tag])}
                  style={[styles.tag, selected && styles.tagSelected]}
                >
                  <Text style={[styles.tagText, selected && styles.tagTextSelected]}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Cuéntanos más (opcional)"
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
            style={styles.input}
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            style={[styles.submit, submitting && styles.disabled]}
            onPress={() => void handleSubmit()}
            disabled={submitting}
          >
            <Text style={styles.submitText}>{submitting ? 'Enviando...' : 'Enviar reseña'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.later} onPress={onClose}>
            <Text style={styles.laterText}>Ahora no</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.55)', justifyContent: 'center', padding: 22 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 22 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E6FFFA', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#1F2937', fontSize: 22, fontWeight: '800', marginTop: 18 },
  subtitle: { color: '#6B7280', fontSize: 14, lineHeight: 20, marginTop: 6 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginVertical: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 8 },
  tagSelected: { borderColor: '#00C9A7', backgroundColor: '#E6FFFA' },
  tagText: { color: '#4B5563', fontSize: 13 },
  tagTextSelected: { color: '#008F79', fontWeight: '700' },
  input: { minHeight: 78, textAlignVertical: 'top', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, marginTop: 16, color: '#1F2937' },
  error: { color: '#B91C1C', fontSize: 13, marginTop: 10 },
  submit: { minHeight: 48, borderRadius: 14, backgroundColor: '#00C9A7', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  submitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.6 },
  later: { alignItems: 'center', paddingVertical: 12 },
  laterText: { color: '#6B7280', fontWeight: '600' },
});
