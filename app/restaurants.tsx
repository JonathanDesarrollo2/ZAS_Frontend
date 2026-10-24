import React, { useEffect, useState } from 'react';
import {
  TextInput,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../apis/Client';

interface Restaurant {
  id: string;
  name: string;
  description?: string;
  address: string;
  distance?: number;
}

const RestaurantsScreen = () => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadRestaurants();
  }, []);

  const loadRestaurants = async () => {
    try {
      const lat = 10.071866;
      const lng = -66.869583;
      const res = await apiClient<{ result: boolean; content: Restaurant[] }>(
        `/public/restaurants/nearby?lat=${lat}&lng=${lng}&radius=5`
      );
      setRestaurants(res.content);
    } catch (err) {
      console.error('Error cargando locales', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRestaurants = restaurants.filter((restaurant) => {
    const query = search.trim().toLocaleLowerCase();
    return !query || [
      restaurant.name,
      restaurant.description,
      restaurant.address,
    ].some((value) => value?.toLocaleLowerCase().includes(query));
  });

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Feather name="arrow-left" size={21} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.title}>Locales de Comida</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={searchVisible ? 'Cerrar búsqueda' : 'Buscar locales'}
          onPress={() => {
            setSearchVisible((visible) => !visible);
            setSearch('');
          }}
          style={styles.headerButton}
        >
          <Feather name={searchVisible ? 'x' : 'search'} size={20} color="#1F2937" />
        </TouchableOpacity>
      </View>
      {searchVisible && (
        <View style={styles.searchContainer}>
          <Feather name="search" size={17} color="#9CA3AF" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar locales"
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
            autoFocus
            returnKeyType="search"
          />
        </View>
      )}
      {loading ? (
        <ActivityIndicator size="large" color="#00C9A7" style={styles.loading} />
      ) : (
        <FlatList
          data={filteredRestaurants}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Feather name="shopping-bag" size={29} color="#00C9A7" />
              </View>
              <Text style={styles.emptyTitle}>
                {search ? 'No encontramos locales' : 'No hay locales disponibles'}
              </Text>
              <Text style={styles.empty}>
                {search ? 'Prueba con otro nombre o dirección.' : 'Vuelve a revisar más tarde.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/restaurant-menu?restaurantId=${item.id}` as any)}
              activeOpacity={0.8}
            >
              <View style={styles.restaurantIcon}>
                <Feather name="shopping-bag" size={22} color="#00A889" />
              </View>
              <View style={styles.details}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {item.description ? <Text numberOfLines={2} style={styles.cardDesc}>{item.description}</Text> : null}
                <View style={styles.addressRow}>
                  <Feather name="map-pin" size={13} color="#9CA3AF" />
                  <Text numberOfLines={1} style={styles.cardAddress}>{item.address}</Text>
                </View>
                {item.distance !== undefined && (
                  <View style={styles.distancePill}>
                    <Feather name="navigation" size={12} color="#008F76" />
                    <Text style={styles.cardDistance}>{item.distance.toFixed(1)} km</Text>
                  </View>
                )}
              </View>
              <View style={styles.chevron}>
                <Feather name="chevron-right" size={19} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9', paddingHorizontal: 18 },
  loading: { flex: 1, justifyContent: 'center' },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5F5F0',
  },
  title: { flex: 1, textAlign: 'center', fontSize: 19, fontWeight: '800', color: '#1F2937' },
  searchContainer: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1FAF0',
    borderRadius: 14,
    paddingHorizontal: 13,
    marginBottom: 13,
  },
  searchInput: { flex: 1, color: '#1F2937', fontSize: 14, paddingVertical: 10 },
  list: { paddingTop: 2, paddingBottom: 24, flexGrow: 1 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 13,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5F5F0',
    elevation: 3,
    shadowColor: '#164E43',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 7,
  },
  restaurantIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#E6FFFA', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  details: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1F2937', marginBottom: 4 },
  cardDesc: { fontSize: 13, lineHeight: 18, color: '#6B7280', marginBottom: 7 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardAddress: { flex: 1, fontSize: 12, color: '#6B7280' },
  distancePill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E6FFFA', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, marginTop: 8 },
  cardDistance: { fontSize: 11, color: '#008F76', fontWeight: '700' },
  chevron: { width: 28, alignItems: 'flex-end', marginLeft: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 25 },
  emptyIcon: { width: 68, height: 68, borderRadius: 23, backgroundColor: '#DDF9F2', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { color: '#1F2937', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  empty: { textAlign: 'center', color: '#6B7280', fontSize: 13, marginTop: 6, lineHeight: 20 },
});

export default RestaurantsScreen;
