import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { EarningsPeriod, EarningsSummary, getDriverEarnings } from '../../apis/community';

const periods: Array<{ key: EarningsPeriod; label: string }> = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
];

const formatAmount = (amount: number) =>
  new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(amount || 0);

const formatDate = (date: string) => {
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  return new Intl.DateTimeFormat('es-VE', { day: 'numeric', month: 'short' }).format(parsed);
};

export default function DriverEarningsScreen() {
  const [period, setPeriod] = useState<EarningsPeriod>('week');
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadEarnings = useCallback(async () => {
    setError('');
    try {
      const response = await getDriverEarnings(period);
      setSummary(response.content);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las ganancias');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => {
    setLoading(true);
    void loadEarnings();
  }, [loadEarnings]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={22} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis ganancias</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadEarnings(); }} tintColor="#00C9A7" />}
      >
        <View style={styles.totalCard}>
          <View style={styles.totalIcon}><Feather name="trending-up" size={22} color="#00A98D" /></View>
          <Text style={styles.totalLabel}>Ganancia total · {periods.find((item) => item.key === period)?.label}</Text>
          {loading ? (
            <ActivityIndicator color="#00C9A7" style={{ marginTop: 12, alignSelf: 'flex-start' }} />
          ) : (
            <>
              <Text style={styles.totalAmount}>{formatAmount(summary?.total_earnings || 0)}</Text>
              <Text style={styles.totalTrips}>{summary?.completed_trip_count || 0} viajes completados</Text>
            </>
          )}
        </View>

        <View style={styles.filters}>
          {periods.map((item) => (
            <TouchableOpacity
              key={item.key}
              onPress={() => setPeriod(item.key)}
              style={[styles.filter, period === item.key && styles.filterActive]}
            >
              <Text style={[styles.filterText, period === item.key && styles.filterTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Resumen por día</Text>
        {!!error && (
          <TouchableOpacity style={styles.errorCard} onPress={() => { setLoading(true); void loadEarnings(); }}>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retryText}>Toca para volver a intentar</Text>
          </TouchableOpacity>
        )}
        {!loading && !error && (!summary?.by_date || summary.by_date.length === 0) && (
          <View style={styles.emptyCard}>
            <Feather name="bar-chart-2" size={30} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Aún no hay ganancias</Text>
            <Text style={styles.emptyText}>Los viajes completados aparecerán aquí.</Text>
          </View>
        )}
        {summary?.by_date?.map((item) => (
          <View key={item.date} style={styles.receipt}>
            <View style={styles.receiptIcon}><Feather name="file-text" size={19} color="#00A98D" /></View>
            <View style={styles.receiptDetails}>
              <Text style={styles.receiptDate}>{formatDate(item.date)}</Text>
              <Text style={styles.receiptTrips}>{item.completed_trip_count} {item.completed_trip_count === 1 ? 'viaje' : 'viajes'}</Text>
            </View>
            <Text style={styles.receiptTotal}>{formatAmount(item.earnings)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingHorizontal: 18, paddingTop: 56, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { color: '#1F2937', fontSize: 20, fontWeight: '800', flex: 1, textAlign: 'center' },
  headerSpacer: { width: 40 },
  content: { paddingHorizontal: 20, paddingBottom: 36 },
  totalCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#E5F5F0', elevation: 2 },
  totalIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#E6FFFA', alignItems: 'center', justifyContent: 'center' },
  totalLabel: { color: '#6B7280', fontSize: 14, marginTop: 16 },
  totalAmount: { color: '#00A98D', fontSize: 32, fontWeight: '800', marginTop: 4 },
  totalTrips: { color: '#6B7280', fontSize: 13, marginTop: 5 },
  filters: { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 12, padding: 4, marginTop: 20, marginBottom: 24 },
  filter: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  filterActive: { backgroundColor: '#FFFFFF', elevation: 1 },
  filterText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  filterTextActive: { color: '#008F79' },
  sectionTitle: { color: '#1F2937', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  receipt: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 14, marginBottom: 10 },
  receiptIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E6FFFA', alignItems: 'center', justifyContent: 'center' },
  receiptDetails: { flex: 1, marginLeft: 12 },
  receiptDate: { color: '#1F2937', fontWeight: '700', fontSize: 15, textTransform: 'capitalize' },
  receiptTrips: { color: '#6B7280', fontSize: 13, marginTop: 3 },
  receiptTotal: { color: '#00A98D', fontWeight: '800', fontSize: 15 },
  emptyCard: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 14, alignItems: 'center' },
  emptyTitle: { color: '#1F2937', fontWeight: '700', marginTop: 12 },
  emptyText: { color: '#6B7280', fontSize: 13, marginTop: 5, textAlign: 'center' },
  errorCard: { backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16 },
  errorText: { color: '#B91C1C' },
  retryText: { color: '#7F1D1D', marginTop: 6, fontSize: 12 },
});
