// app/my-reservations.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { getMyReservations, Reservation } from '../apis/sharedRides';

const MyReservationsScreen = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReservations();
  }, []);

  const loadReservations = async () => {
    setLoading(true);
    try {
      const data = await getMyReservations();
      setReservations(data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_payment': return '#FFA500';
      case 'paid': return '#00C9A7';
      case 'verified': return '#00C9A7';
      case 'expired': return '#FF6B6B';
      case 'cancelled': return '#9CA3AF';
      default: return '#333';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending_payment': return 'Pendiente de pago';
      case 'paid': return 'Pagado';
      case 'verified': return 'Verificado';
      case 'expired': return 'Expirado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const renderItem = ({ item }: { item: Reservation }) => (
    <View style={styles.card}>
      <View style={styles.routeRow}>
        <Feather name="circle" size={14} color="#00C9A7" />
        <Text style={styles.address}>{item.ride?.origin_address}</Text>
      </View>
      <View style={styles.dottedLine} />
      <View style={styles.routeRow}>
        <Feather name="map-pin" size={14} color="#FF6B6B" />
        <Text style={styles.address}>{item.ride?.destination_address}</Text>
      </View>

      <View style={styles.infoRow}>
        <Feather name="users" size={14} color="#6B7280" style={{ marginRight: 6 }} />
        <Text style={styles.detail}>Puestos: {item.seat_count}</Text>
      </View>
      <View style={styles.infoRow}>
        <Feather name="clock" size={14} color="#6B7280" style={{ marginRight: 6 }} />
        <Text style={styles.detail}>
          {new Date(item.reserved_at).toLocaleString()}
        </Text>
      </View>

      <View style={styles.statusBadge}>
        <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
          {getStatusText(item.status)}
        </Text>
      </View>

      {item.payment_reference && (
        <View style={styles.infoRow}>
          <Feather name="hash" size={14} color="#6B7280" style={{ marginRight: 6 }} />
          <Text style={styles.reference}>Ref: {item.payment_reference}</Text>
        </View>
      )}

      {item.status === 'pending_payment' && (
        <TouchableOpacity
          style={styles.payButton}
          onPress={() =>
            router.push({
              pathname: '/payment',
              params: {
                rideId: item.ride!.id,
                reservationId: item.id,
              },
            })
          }
        >
          <Feather name="credit-card" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.payButtonText}>Ir a pagar</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C9A7" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Mis Reservas</Text>
        <TouchableOpacity onPress={loadReservations}>
          <Feather name="refresh-cw" size={22} color="#00C9A7" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={reservations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="file-text" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No tienes reservas aún</Text>
            <Text style={styles.emptySub}>Tus viajes reservados aparecerán aquí</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937' },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5F5F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  address: { color: '#1F2937', fontSize: 16, fontWeight: '500', marginLeft: 12, flex: 1 },
  dottedLine: { height: 20, borderLeftWidth: 2, borderColor: '#E5E7EB', marginLeft: 6, marginVertical: 4 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  detail: { color: '#6B7280', fontSize: 14 },
  statusBadge: { marginTop: 10 },
  statusText: { fontWeight: '700', fontSize: 14 },
  reference: { color: '#6B7280', fontSize: 14 },
  payButton: {
    backgroundColor: '#00C9A7',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00C9A7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  payButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0FDF9' },
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 18, color: '#6B7280', fontWeight: '600', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
});

export default MyReservationsScreen;