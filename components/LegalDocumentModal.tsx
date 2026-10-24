import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  visible: boolean;
  title: string;
  content: string;
  onClose: () => void;
}

export default function LegalDocumentModal({ visible, title, content, onClose }: Props) {
  const safeTitle = typeof title === 'string' ? title : '';
  const safeContent = typeof content === 'string' ? content.trim() : '';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>{safeTitle}</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar documento">
            <Text style={styles.close}>Cerrar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text selectable style={styles.body}>{safeContent}</Text>
        </ScrollView>
        <Text style={styles.notice}>
          Documento informativo sujeto a revisión jurídica local. La lectura aquí no sustituye asesoría legal.
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC', paddingTop: 54 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderColor: '#E5E7EB' },
  title: { flex: 1, color: '#1F2937', fontSize: 18, fontWeight: '800', marginRight: 14 },
  close: { color: '#008F79', fontWeight: '700' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingVertical: 18 },
  body: { color: '#374151', fontSize: 14, lineHeight: 22 },
  notice: { color: '#6B7280', fontSize: 11, lineHeight: 16, borderTopWidth: 1, borderColor: '#E5E7EB', padding: 14 },
});
