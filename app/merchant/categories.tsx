import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Category, createCategory, deleteCategory, getCategories } from '../../apis/restaurant';

const CategoriesScreen = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await getCategories());
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudieron cargar las categorías');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Nombre requerido', 'Escribe un nombre para la categoría.');
      return;
    }

    setSaving(true);
    try {
      await createCategory(name);
      setNewName('');
      setModalVisible(false);
      await loadCategories();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo crear la categoría');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (category: Category) => {
    Alert.alert('Eliminar categoría', `¿Quieres eliminar "${category.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory(category.id);
            await loadCategories();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'No se pudo eliminar la categoría');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>MENÚ</Text>
        <Text style={styles.title}>Categorías</Text>
        <Text style={styles.subtitle}>Organiza los productos de tu restaurante.</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#00C9A7" style={styles.loader} />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, categories.length === 0 && styles.emptyList]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Feather name="folder" size={34} color="#00C9A7" /></View>
              <Text style={styles.emptyTitle}>Aún no tienes categorías</Text>
              <Text style={styles.emptyText}>Crea una categoría para empezar a organizar tu menú.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.folderIcon}><Feather name="tag" size={19} color="#00A889" /></View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardCaption}>{item.active ? 'Activa' : 'Inactiva'}</Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Eliminar ${item.name}`}
                style={styles.deleteButton}
                onPress={() => handleDelete(item)}
              >
                <Feather name="trash-2" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Agregar categoría"
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={25} color="#FFFFFF" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}><Feather name="folder-plus" size={23} color="#00A889" /></View>
            <Text style={styles.modalTitle}>Nueva categoría</Text>
            <Text style={styles.modalSubtitle}>Elige un nombre fácil de reconocer.</Text>
            <TextInput
              autoFocus
              style={styles.input}
              placeholder="Ej. Bebidas"
              placeholderTextColor="#9CA3AF"
              value={newName}
              onChangeText={setNewName}
              maxLength={100}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createButton} onPress={handleCreate} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.createText}>Crear</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  heading: { paddingHorizontal: 20, paddingTop: 25, paddingBottom: 17 },
  eyebrow: { color: '#00A889', fontSize: 11, fontWeight: '800', letterSpacing: 1.1, marginBottom: 7 },
  title: { color: '#1F2937', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#6B7280', fontSize: 14, marginTop: 6 },
  loader: { marginTop: 50 },
  listContent: { paddingHorizontal: 18, paddingBottom: 110 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingHorizontal: 22, paddingBottom: 45 },
  emptyIcon: { width: 78, height: 78, borderRadius: 26, backgroundColor: '#DDF9F2', alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  emptyTitle: { color: '#1F2937', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#6B7280', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 7 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 14,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: '#E5F5F0',
    elevation: 2,
    shadowColor: '#163B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  folderIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#E6FFFA', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardInfo: { flex: 1 },
  cardTitle: { color: '#1F2937', fontSize: 15, fontWeight: '700' },
  cardCaption: { color: '#9CA3AF', fontSize: 12, marginTop: 3 },
  deleteButton: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2' },
  fab: { position: 'absolute', right: 22, bottom: 24, width: 58, height: 58, borderRadius: 20, backgroundColor: '#00C9A7', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#008F76', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 7 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(17, 24, 39, 0.42)' },
  modalCard: { padding: 22, borderRadius: 22, backgroundColor: '#FFFFFF' },
  modalIcon: { width: 47, height: 47, borderRadius: 16, backgroundColor: '#E6FFFA', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  modalTitle: { color: '#1F2937', fontSize: 21, fontWeight: '800' },
  modalSubtitle: { color: '#6B7280', fontSize: 13, marginTop: 5, marginBottom: 17 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, color: '#1F2937', fontSize: 15, backgroundColor: '#FFFFFF' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  cancelButton: { borderRadius: 12, backgroundColor: '#F3F4F6', paddingHorizontal: 17, paddingVertical: 12 },
  cancelText: { color: '#4B5563', fontSize: 14, fontWeight: '700' },
  createButton: { minWidth: 92, borderRadius: 12, backgroundColor: '#00C9A7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  createText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});

export default CategoriesScreen;
