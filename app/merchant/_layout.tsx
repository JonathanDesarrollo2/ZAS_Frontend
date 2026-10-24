import React, { useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { getMyRestaurant } from '../../apis/restaurant';
import { useAuth } from '../../presentation/store/AuthStore';

const MerchantLayout = () => {
  const [restaurantName, setRestaurantName] = useState('Mi restaurante');
  const logout = useAuth((state) => state.logout);

  useEffect(() => {
    getMyRestaurant()
      .then((restaurant) => setRestaurantName(restaurant.name || 'Mi restaurante'))
      .catch((error: unknown) => {
        console.error('No se pudo cargar el nombre del restaurante', error);
      });
  }, []);

  const confirmLogout = () => {
    Alert.alert('Cerrar sesión', '¿Deseas salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
            router.replace('/auth/Login');
          } catch (error: unknown) {
            Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo cerrar sesión');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <View style={styles.brandIcon}>
          <Feather name="coffee" size={20} color="#00C9A7" />
        </View>
        <Text numberOfLines={1} style={styles.restaurantName}>{restaurantName}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          onPress={confirmLogout}
          style={styles.logoutButton}
        >
          <Feather name="log-out" size={19} color="#6B7280" />
        </TouchableOpacity>
      </View>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F0FDF9' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="dashboard" />
        <Stack.Screen name="categories" />
        <Stack.Screen name="products" />
        <Stack.Screen name="product-edit" />
        <Stack.Screen name="orders" />
        <Stack.Screen name="restaurant-edit" />
      </Stack>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    minHeight: 62,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5F5F0',
    backgroundColor: '#FFFFFF',
  },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6FFFA',
    marginRight: 11,
  },
  restaurantName: { flex: 1, color: '#1F2937', fontSize: 16, fontWeight: '700' },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    marginLeft: 10,
  },
});

export default MerchantLayout;
