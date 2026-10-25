// LEIDO
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
import { getMyRestaurant, requestDriverLink, updateRestaurant } from '../../apis/restaurant';

const RestaurantEditScreen = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [hasOwnDelivery, setHasOwnDelivery] = useState(false);
  const [driverCode, setDriverCode] = useState('');
  const [requestingLink, setRequestingLink] = useState(false);
  const [hasDriverLinked, setHasDriverLinked] = useState(false);
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
      setHasDriverLinked(Boolean(restaurant.linked_driver_id));
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

  const handleDriverLinkRequest = async () => {
    const code = driverCode.trim();
    if (!/^\d{6}$/.test(code)) {
      Alert.alert('Código no válido', 'Ingresa el código de 6 dígitos del mototaxista.');
      return;
    }
    setRequestingLink(true);
    try {
      const response = await requestDriverLink(code);
      if (!response.result) throw new Error(response.error?.[0] || 'No se pudo enviar la solicitud.');
      setDriverCode('');
      Alert.alert('Solicitud enviada', 'El mototaxista debe aceptar la solicitud para completar el enlace.');
    } catch (error) {
      Alert.alert('No se pudo enlazar', error instanceof Error ? error.message : 'Intenta nuevamente.');
    } finally {
      setRequestingLink(false);
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

        <View style={styles.linkCard}>
          <Text style={styles.label}>Enlazar Mototaxista</Text>
          <Text style={styles.linkDescription}>
            {hasDriverLinked ? 'Ya hay un mototaxista enlazado a este restaurante.' : 'Ingresa el código de 6 dígitos del mototaxista.'}
          </Text>
          {!hasDriverLinked && (
            <>
              <TextInput
                style={styles.input}
                value={driverCode}
                onChangeText={(value) => setDriverCode(value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Código de 6 dígitos"
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity
                style={[styles.linkButton, requestingLink && { opacity: 0.65 }]}
                onPress={() => void handleDriverLinkRequest()}
                disabled={requestingLink}
              >
                {requestingLink ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.linkButtonText}>Enviar solicitud</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>

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
  linkCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderColor: '#D1FAE5', borderWidth: 1, padding: 14, marginBottom: 22 },
  linkDescription: { color: '#6B7280', fontSize: 13, marginBottom: 10 },
  linkButton: { backgroundColor: '#00C9A7', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11, marginTop: 10 },
  linkButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
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