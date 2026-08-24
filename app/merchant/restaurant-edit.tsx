import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getMyRestaurant, updateRestaurant } from '../../apis/restaurant';

const RestaurantEditScreen = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [hasOwnDelivery, setHasOwnDelivery] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRestaurant();
  }, []);

  const loadRestaurant = async () => {
    try {
      const restaurant = await getMyRestaurant();
      setName(restaurant.name || '');
      setDescription(restaurant.description || '');
      setAddress(restaurant.address || '');
      setHasOwnDelivery(restaurant.has_own_delivery || false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo cargar el restaurante');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !address.trim()) {
      Alert.alert('Campos requeridos', 'Nombre y dirección son obligatorios');
      return;
    }

    setSaving(true);
    try {
      await updateRestaurant({
        name: name.trim(),
        description: description.trim(),
        address: address.trim(),
        has_own_delivery: hasOwnDelivery,
      });
      Alert.alert('Guardado', 'Datos actualizados correctamente');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00C9A7" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Mi restaurante</Text>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Nombre del restaurante"
          />
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Breve descripción"
            multiline
          />
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Dirección</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Dirección del restaurante"
          />
        </View>

        <TouchableOpacity style={styles.toggleRow} onPress={() => setHasOwnDelivery(!hasOwnDelivery)}>
          <Feather name={hasOwnDelivery ? 'check-circle' : 'circle'} size={20} color={hasOwnDelivery ? '#00C9A7' : '#ccc'} />
          <Text style={styles.toggleText}>¿Tienes delivery propio?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar cambios</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 20, paddingTop: 80, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937', marginBottom: 30 },
  fieldContainer: { marginBottom: 20 },
  label: { fontWeight: '600', color: '#374151', marginBottom: 8, fontSize: 15 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    fontSize: 16,
    color: '#111827',
  },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  toggleText: { fontSize: 16, color: '#374151' },
  saveButton: {
    backgroundColor: '#00C9A7',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00C9A7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});

export default RestaurantEditScreen;