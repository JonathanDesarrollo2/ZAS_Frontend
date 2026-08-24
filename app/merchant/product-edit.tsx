import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { createProduct, updateProduct } from '../../apis/restaurant';
import { router, useLocalSearchParams } from 'expo-router';

const ProductEditScreen = () => {
  const { categoryId, productId } = useLocalSearchParams<{ categoryId?: string; productId?: string }>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la galería');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setImage(result.assets[0]);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || isNaN(parseFloat(price))) {
      Alert.alert('Campos requeridos', 'Nombre y precio son obligatorios');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price),
        imageFile: image ? { uri: image.uri, type: image.mimeType || 'image/jpeg', name: image.fileName || 'product.jpg' } : undefined,
      };

      if (productId) {
        await updateProduct(productId, data);
      } else if (categoryId) {
        await createProduct(categoryId, data);
      } else {
        throw new Error('Falta categoryId o productId');
      }

      Alert.alert('Guardado', 'Producto guardado', [
        { text: 'Ok', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{productId ? 'Editar producto' : 'Nuevo producto'}</Text>

      <Text style={styles.label}>Nombre</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nombre del producto" />

      <Text style={styles.label}>Descripción</Text>
      <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Descripción" multiline />

      <Text style={styles.label}>Precio</Text>
      <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" />

      <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
        <Feather name="image" size={18} color="#00C9A7" style={{ marginRight: 8 }} />
        <Text style={styles.imagePickerText}>{image ? 'Imagen seleccionada' : 'Seleccionar imagen'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  container: { padding: 20, paddingTop: 80, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937', marginBottom: 30 },
  label: { fontWeight: '600', color: '#374151', marginBottom: 8, fontSize: 15 },
  input: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  textArea: { height: 80, textAlignVertical: 'top' },
  imagePicker: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E6FFFA', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#00C9A7' },
  imagePickerText: { color: '#00C9A7', fontWeight: '600' },
  saveButton: { backgroundColor: '#00C9A7', borderRadius: 14, height: 52, justifyContent: 'center', alignItems: 'center' },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default ProductEditScreen;