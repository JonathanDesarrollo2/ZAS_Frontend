import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';

const MerchantDashboardScreen = () => {
  const modules = [
    {
      icon: 'edit',
      title: 'Mi restaurante',
      desc: 'Edita información, horarios y delivery',
      route: '/merchant/restaurant-edit',
    },
    {
      icon: 'list',
      title: 'Categorías',
      desc: 'Administra las categorías del menú',
      route: '/merchant/categories',
    },
    {
      icon: 'package',
      title: 'Productos',
      desc: 'Gestiona platillos y precios',
      route: '/merchant/products',
    },
    {
      icon: 'clipboard',
      title: 'Pedidos',
      desc: 'Revisa los pedidos entrantes',
      route: '/merchant/orders',
    },
  ];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Panel del comercio</Text>
        <Text style={styles.subtitle}>Bienvenido, gestiona tu negocio desde aquí</Text>

        <View style={styles.modulesContainer}>
          {modules.map((mod, index) => (
            <TouchableOpacity
              key={index}
              style={styles.moduleCard}
              onPress={() => router.push(mod.route as any)}
              activeOpacity={0.8}
            >
              <Feather name={mod.icon as any} size={24} color="#00C9A7" style={{ marginRight: 16 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.moduleTitle}>{mod.title}</Text>
                <Text style={styles.moduleDesc}>{mod.desc}</Text>
              </View>
              <Feather name="chevron-right" size={20} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  container: { padding: 20, paddingTop: 80, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280', marginBottom: 30 },
  modulesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5F5F0',
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E5F5F0',
  },
  moduleTitle: { color: '#1F2937', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  moduleDesc: { color: '#6B7280', fontSize: 14 },
});

export default MerchantDashboardScreen;