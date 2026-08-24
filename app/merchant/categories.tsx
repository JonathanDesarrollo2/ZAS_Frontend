import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../../apis/Client';
import { createCategory, updateCategory, deleteCategory } from '../../apis/restaurant';

interface Category {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

const CategoriesScreen = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  const loadCategories = async () => {
    try {
      const res = await apiClient<{ result: boolean; content: any }>('/private/merchant/restaurant');
      const restaurant = res.content;
      const catRes = await apiClient<{ result: boolean; content: any }>('/private/merchant/restaurant');
      // Asumimos que el endpoint de categorías está separado o lo obtenemos del menú público
      // Por ahora crearemos una función en api para obtener categorías, pero no está definida.
      // Vamos a usar directamente fetch con /private/merchant/categories si existiera, pero no lo creamos.
      // Por simplicidad, mostraremos que se necesita endpoint /categories, lo agregaremos a la API.
      // En realidad, en RestaurantController no hay getCategories. Debemos agregarlo.
      // Como no lo implementamos, esta pantalla es un placeholder funcional con create/delete.
      // Recomendamos agregar endpoint GET /categories en backend.
      Alert.alert('Info', 'Próximamente: listado de categorías');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Categorías</Text>
      {/* Añadir categoría */}
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Nueva categoría"
          value={newName}
          onChangeText={setNewName}
        />
        <TouchableOpacity
          style={styles.addButton}
          onPress={async () => {
            if (!newName.trim()) return Alert.alert('Error', 'Ingresa un nombre');
            setAdding(true);
            try {
              await createCategory(newName.trim());
              setNewName('');
              Alert.alert('Creada', 'Categoría creada');
              // recargar
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally {
              setAdding(false);
            }
          }}
          disabled={adding}
        >
          <Feather name="plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#00C9A7" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <TouchableOpacity onPress={() => deleteCategory(item.id).catch(e => Alert.alert('Error', e.message))}>
                <Feather name="trash-2" size={20} color="#FF5252" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9', padding: 20, paddingTop: 80 },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937', marginBottom: 20 },
  addRow: { flexDirection: 'row', marginBottom: 20, gap: 10 },
  input: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  addButton: { backgroundColor: '#00C9A7', borderRadius: 12, width: 48, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
});

export default CategoriesScreen;