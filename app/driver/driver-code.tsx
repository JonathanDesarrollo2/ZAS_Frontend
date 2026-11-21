import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { connectSocket } from '../../services/socketClient';
import {
  getDriverLinkData,
  respondToDriverLinkRequest,
  RestaurantDriverLinkRequest,
  unlinkDriverRestaurant,
} from '../../apis/driverLinks';

export default function DriverCodeScreen() {
  const [code, setCode] = useState('');
  const [requests, setRequests] = useState<RestaurantDriverLinkRequest[]>([]);
  const [requestHistory, setRequestHistory] = useState<RestaurantDriverLinkRequest[]>([]);
  const [restaurants, setRestaurants] = useState<{ id: string; name: string; address?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getDriverLinkData();
      if (!response.result) throw new Error(response.error?.[0] || 'No se pudo cargar la información.');
      setCode(response.content.driver_code);
      setRequests(response.content.requests);
      setRequestHistory(response.content.requestHistory || []);
      setRestaurants(response.content.restaurants || []);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo cargar la información.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  useEffect(() => {
    let active = true;
    let connectedSocket: Awaited<ReturnType<typeof connectSocket>> | null = null;
    const refresh = () => { void load(); };
    const events = [
      'restaurant:driver_link_request',
      'restaurant:driver_link_cancelled',
      'restaurant:driver_unlinked',
    ] as const;

    connectSocket().then((socket) => {
      if (!active) return;
      connectedSocket = socket;
      events.forEach((event) => socket.on(event, refresh));
    }).catch((error: unknown) => {
      console.error('No se pudieron escuchar los cambios de vínculos de restaurantes', error);
    });

    return () => {
      active = false;
      events.forEach((event) => connectedSocket?.off(event, refresh));
    };
  }, [load]);

  const respond = async (request: RestaurantDriverLinkRequest, decision: 'accept' | 'reject') => {
    setRespondingId(request.id);
    try {
      const response = await respondToDriverLinkRequest(request.id, decision);
      if (!response.result) throw new Error(response.error?.[0] || 'No se pudo responder la solicitud.');
      await load();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo responder la solicitud.');
    } finally {
      setRespondingId(null);
    }
  };

  const confirmUnlink = (restaurant: { id: string; name: string }) => {
    Alert.alert('Desvincular restaurante', `¿Deseas desvincularte de ${restaurant.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desvincular',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await unlinkDriverRestaurant(restaurant.id);
            if (!response.result) throw new Error(response.error?.[0] || 'No se pudo desvincular el restaurante.');
            await load();
          } catch (error) {
            Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo desvincular el restaurante.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Volver">
          <Feather name="arrow-left" size={23} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Mi Código</Text>
        <View style={{ width: 23 }} />
      </View>
      {loading ? <ActivityIndicator style={styles.loading} size="large" color="#00C9A7" /> : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.codeCard}>
            <Feather name="hash" size={25} color="#00C9A7" />
            <Text style={styles.caption}>Comparte este código con restaurantes</Text>
            <Text style={styles.code}>{code || '------'}</Text>
          </View>
          <Text style={styles.sectionTitle}>Restaurantes vinculados</Text>
          {restaurants.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="link-2" size={30} color="#9CA3AF" />
              <Text style={styles.emptyText}>Aún no tienes restaurantes vinculados.</Text>
            </View>
          ) : restaurants.map((restaurant) => (
            <View key={restaurant.id} style={styles.requestCard}>
              <Text style={styles.restaurantName}>{restaurant.name}</Text>
              {!!restaurant.address && <Text style={styles.address}>{restaurant.address}</Text>}
              <TouchableOpacity style={styles.unlinkButton} onPress={() => confirmUnlink(restaurant)}>
                <Text style={styles.unlinkText}>Desvincularme</Text>
              </TouchableOpacity>
            </View>
          ))}
          <Text style={styles.sectionTitle}>Solicitudes de restaurantes</Text>
          {requests.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="inbox" size={32} color="#9CA3AF" />
              <Text style={styles.emptyText}>No tienes solicitudes pendientes.</Text>
            </View>
          ) : requests.map((request) => (
            <View key={request.id} style={styles.requestCard}>
              <Text style={styles.restaurantName}>{request.restaurant?.name || 'Restaurante'}</Text>
              {!!request.restaurant?.address && <Text style={styles.address}>{request.restaurant.address}</Text>}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => void respond(request, 'reject')}
                  disabled={respondingId === request.id}
                >
                  <Text style={styles.rejectText}>Rechazar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={() => void respond(request, 'accept')}
                  disabled={respondingId === request.id}
                >
                  {respondingId === request.id
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={styles.acceptText}>Aceptar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {requestHistory.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Historial de solicitudes</Text>
              {requestHistory.map((request) => {
                const status = request.status === 'accepted'
                  ? 'Aceptada'
                  : request.status === 'rejected'
                    ? 'Rechazada'
                    : 'Cancelada';
                return (
                  <View key={request.id} style={styles.requestCard}>
                    <Text style={styles.restaurantName}>{request.restaurant?.name || 'Restaurante'}</Text>
                    <Text style={styles.historyStatus}>{status}</Text>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  header: { paddingTop: 58, paddingHorizontal: 20, paddingBottom: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF' },
  title: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  loading: { marginTop: 40 },
  content: { padding: 20, paddingBottom: 36 },
  codeCard: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 24, elevation: 2 },
  caption: { color: '#6B7280', marginTop: 12, fontSize: 14 },
  code: { marginTop: 8, color: '#00A98E', fontSize: 36, fontWeight: '800', letterSpacing: 8 },
  sectionTitle: { color: '#1F2937', fontSize: 17, fontWeight: '700', marginTop: 28, marginBottom: 12 },
  empty: { minHeight: 130, borderRadius: 16, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', padding: 18 },
  emptyText: { color: '#6B7280', marginTop: 10, textAlign: 'center' },
  requestCard: { backgroundColor: '#FFFFFF', borderRadius: 15, padding: 16, marginBottom: 12, elevation: 1 },
  unlinkButton: { alignSelf: 'flex-start', borderRadius: 10, backgroundColor: '#FEF2F2', paddingHorizontal: 13, paddingVertical: 9, marginTop: 12 },
  unlinkText: { color: '#B42318', fontWeight: '700' },
  restaurantName: { color: '#1F2937', fontSize: 16, fontWeight: '700' },
  address: { color: '#6B7280', fontSize: 13, marginTop: 4 },
  historyStatus: { color: '#6B7280', fontSize: 13, marginTop: 7 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionButton: { flex: 1, minHeight: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rejectButton: { backgroundColor: '#FEF2F2' },
  acceptButton: { backgroundColor: '#00C9A7' },
  rejectText: { color: '#B42318', fontWeight: '700' },
  acceptText: { color: '#FFFFFF', fontWeight: '700' },
});
