// app/history.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../apis/Client';

interface HistoryTrip {
  id: string;
  price: number;
  status: string;
  createdAt: string;
  origin_address: string;
  destination_address: string;
  counterpartName: string;
  counterpartPicUrl: string | null;
}

const HistoryScreen = () => {
  const [trips, setTrips] = useState<HistoryTrip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      // ✅ Usamos la MISMA ruta que en el dashboard
      const res = await apiClient<{ result: boolean; content: HistoryTrip[] }>(
        '/private/trips/history'
      );
      if (res.result && Array.isArray(res.content)) {
        setTrips(res.content);
      } else {
        setTrips([]);
      }
    } catch (err) {
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  const renderTrip = ({ item }: { item: HistoryTrip }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {item.counterpartPicUrl ? (
          <Image source={{ uri: item.counterpartPicUrl }} style={styles.avatar} />
        ) : (
          <Feather name="user" size={24} color="#9CA3AF" style={styles.avatarPlaceholder} />
        )}
        <Text style={styles.name}>{item.counterpartName}</Text>
        <Text style={styles.price}>${Number(item.price).toFixed(2)}</Text>
      </View>

      <View style={styles.route}>
        <Text style={styles.address}>📍 {item.origin_address}</Text>
        <Text style={styles.address}>🏁 {item.destination_address}</Text>
      </View>

      <Text style={styles.date}>
        {new Date(item.createdAt).toLocaleDateString()}
      </Text>
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Historial de viajes</Text>
      </View>

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="clock" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No tienes viajes realizados</Text>
          </View>
        }
        renderItem={renderTrip}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0FDF9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: { marginRight: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#1F2937', flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5F5F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  avatarPlaceholder: {
    marginRight: 8,
  },
  name: {
    flex: 1,
    fontWeight: '600',
    color: '#1F2937',
  },
  price: {
    fontWeight: '700',
    color: '#00C9A7',
  },
  route: {
    marginBottom: 4,
  },
  address: {
    color: '#374151',
    fontSize: 14,
    marginBottom: 2,
  },
  date: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
    marginTop: 12,
  },
});

export default HistoryScreen;