// LEIDO
import React, { useCallback, useEffect, useState } from 'react';
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
import { useFocusEffect } from 'expo-router';
import { getMyRestaurant, requestDriverLink, updateRestaurant } from '../../apis/restaurant';
import { connectSocket } from '../../services/socketClient';
import {
  cancelRestaurantDriverLinkRequest,
  getRestaurantDriverLinks,
  RestaurantDriverLink,
  RestaurantDriverLinkRequest,
  unlinkRestaurantDriver,
} from '../../apis/driverLinks';

const RestaurantEditScreen = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [hasOwnDelivery, setHasOwnDelivery] = useState(false);
  const [driverNotificationScope, setDriverNotificationScope] = useState<'linked' | 'unlinked' | 'all'>('all');
  const [driverCode, setDriverCode] = useState('');
  const [requestingLink, setRequestingLink] = useState(false);
  const [linkedDrivers, setLinkedDrivers] = useState<RestaurantDriverLink[]>([]);
  const [pendingLinkRequests, setPendingLinkRequests] = useState<RestaurantDriverLinkRequest[]>([]);
  const [linkRequestHistory, setLinkRequestHistory] = useState<RestaurantDriverLinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRestaurant();
  }, []);

  const loadDriverLinks = useCallback(async () => {
    try {
      const response = await getRestaurantDriverLinks();
      if (!response.result) throw new Error(response.error?.[0] || 'No se pudieron cargar los vínculos.');
      setLinkedDrivers(response.content.drivers);
      setPendingLinkRequests(response.content.requests.filter((request) => request.status === 'pending'));
      setLinkRequestHistory(response.content.requests.filter((request) => request.status !== 'pending'));
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudieron cargar los vínculos.');
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadDriverLinks(); }, [loadDriverLinks]));

  useEffect(() => {
    let active = true;
    let connectedSocket: Awaited<ReturnType<typeof connectSocket>> | null = null;
    const refresh = () => { void loadDriverLinks(); };
    const events = ['restaurant:driver_link_response', 'restaurant:driver_unlinked'] as const;

    connectSocket().then((socket) => {
      if (!active) return;
      connectedSocket = socket;
      events.forEach((event) => socket.on(event, refresh));
    }).catch((error: unknown) => {
      console.error('No se pudieron escuchar los cambios de vínculos de conductores', error);
    });

    return () => {
      active = false;
      events.forEach((event) => connectedSocket?.off(event, refresh));
    };
  }, [loadDriverLinks]);

  const loadRestaurant = async () => {
    try {
      const restaurant = await getMyRestaurant();
      setName(restaurant.name || '');
      setDescription(restaurant.description || '');
      setAddress(restaurant.address || '');
      setHasOwnDelivery(restaurant.has_own_delivery || false);
      setDriverNotificationScope(restaurant.driver_notification_scope || 'all');
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
        driver_notification_scope: driverNotificationScope,
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
      await loadDriverLinks();
      Alert.alert('Solicitud enviada', 'El mototaxista debe aceptar la solicitud para completar el enlace.');
    } catch (error) {
      Alert.alert('No se pudo enlazar', error instanceof Error ? error.message : 'Intenta nuevamente.');
    } finally {
      setRequestingLink(false);
    }
  };

  const confirmUnlinkDriver = (link: RestaurantDriverLink) => {
    const driverName = link.driver?.user?.username || link.driver?.user?.userlogin || 'este mototaxista';
    Alert.alert('Desvincular mototaxista', `¿Deseas desvincular a ${driverName}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desvincular',
        style: 'destructive',
        onPress: async () => {
          try {
            await unlinkRestaurantDriver(link.driver_id);
            await loadDriverLinks();
          } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo desvincular al mototaxista.');
          }
        },
      },
    ]);
  };

  const confirmCancelRequest = (request: RestaurantDriverLinkRequest) => {
    Alert.alert('Cancelar solicitud', '¿Deseas cancelar esta solicitud pendiente?', [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Cancelar solicitud',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelRestaurantDriverLinkRequest(request.id);
            await loadDriverLinks();
          } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo cancelar la solicitud.');
          }
        },
      },
    ]);
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

        <View style={styles.scopeCard}>
          <Text style={styles.label}>Alcance de avisos de delivery externo</Text>
          <Text style={styles.scopeDescription}>Los pedidos con delivery propio no se envían a la flota de mototaxistas.</Text>
          {([
            ['linked', 'Solo conductores vinculados'],
            ['unlinked', 'Solo conductores no vinculados'],
            ['all', 'Todos los conductores elegibles'],
          ] as const).map(([scope, label]) => {
            const selected = driverNotificationScope === scope;
            return (
              <TouchableOpacity
                key={scope}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={styles.scopeOption}
                onPress={() => setDriverNotificationScope(scope)}
              >
                <Feather name={selected ? 'check-circle' : 'circle'} size={19} color={selected ? '#00A889' : '#9CA3AF'} />
                <Text style={styles.scopeOptionText}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.linkCard}>
          <Text style={styles.label}>Conductores del restaurante</Text>
          <Text style={styles.linkDescription}>Puedes vincular varios mototaxistas con el código de seis dígitos.</Text>
          <Text style={styles.listHeading}>Vínculos activos</Text>
          {linkedDrivers.length === 0 ? (
            <Text style={styles.emptyLinks}>Todavía no hay mototaxistas vinculados.</Text>
          ) : linkedDrivers.map((link) => {
            const driverName = link.driver?.user?.username || link.driver?.user?.userlogin || `Conductor ${link.driver_id.slice(0, 8)}`;
            return (
              <View key={link.driver_id} style={styles.driverRow}>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>{driverName}</Text>
                  <Text style={styles.driverStatus}>Vinculado</Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Desvincular ${driverName}`}
                  onPress={() => confirmUnlinkDriver(link)}
                  style={styles.unlinkButton}
                >
                  <Feather name="user-x" size={17} color="#B42318" />
                </TouchableOpacity>
              </View>
            );
          })}

          <Text style={styles.listHeading}>Solicitudes pendientes</Text>
          {pendingLinkRequests.length === 0 ? (
            <Text style={styles.emptyLinks}>No hay solicitudes pendientes.</Text>
          ) : pendingLinkRequests.map((request) => {
            const driverName = request.driver?.user?.username || request.driver?.user?.userlogin || 'Mototaxista';
            return (
              <View key={request.id} style={styles.driverRow}>
                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>{driverName}</Text>
                  <Text style={styles.driverStatus}>Esperando aceptación</Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Cancelar solicitud a ${driverName}`}
                  onPress={() => confirmCancelRequest(request)}
                  style={styles.unlinkButton}
                >
                  <Feather name="x" size={19} color="#B42318" />
                </TouchableOpacity>
              </View>
            );
          })}

          {linkRequestHistory.length > 0 && (
            <>
              <Text style={styles.listHeading}>Historial de solicitudes</Text>
              {linkRequestHistory.map((request) => {
                const driverName = request.driver?.user?.username || request.driver?.user?.userlogin || 'Mototaxista';
                const status = request.status === 'accepted'
                  ? 'Aceptada'
                  : request.status === 'rejected'
                    ? 'Rechazada'
                    : 'Cancelada';
                return (
                  <View key={request.id} style={styles.driverRow}>
                    <View style={styles.driverInfo}>
                      <Text style={styles.driverName}>{driverName}</Text>
                      <Text style={styles.driverStatus}>{status}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          )}

          <Text style={[styles.listHeading, styles.inviteHeading]}>Enviar nueva solicitud</Text>
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
  scopeCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderColor: '#D1FAE5', borderWidth: 1, padding: 14, marginBottom: 20 },
  scopeDescription: { color: '#6B7280', fontSize: 13, lineHeight: 18, marginBottom: 7 },
  scopeOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  scopeOptionText: { color: '#374151', fontSize: 14, flex: 1 },
  linkCard: { backgroundColor: '#FFFFFF', borderRadius: 14, borderColor: '#D1FAE5', borderWidth: 1, padding: 14, marginBottom: 22 },
  linkDescription: { color: '#6B7280', fontSize: 13, marginBottom: 10 },
  listHeading: { color: '#374151', fontSize: 13, fontWeight: '700', marginTop: 10, marginBottom: 7 },
  inviteHeading: { marginTop: 17 },
  emptyLinks: { color: '#6B7280', fontSize: 13, paddingVertical: 8 },
  driverRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#ECFDF5' },
  driverInfo: { flex: 1 },
  driverName: { color: '#1F2937', fontSize: 14, fontWeight: '700' },
  driverStatus: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  unlinkButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
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