import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Image, Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../presentation/hooks/useAuth';
import { apiClient } from '../apis/Client';

type FeatherIconName =
  | 'navigation' | 'package' | 'map-pin' | 'plus-circle' | 'list' | 'truck'
  | 'toggle-right' | 'chevron-right' | 'bell' | 'clock' | 'log-out' | 'menu'
  | 'x' | 'user' | 'shield' | 'file-text' | 'credit-card' | 'search';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MENU_WIDTH = SCREEN_WIDTH * 0.75;

const LogoIcon = () => (
  <View style={styles.logoContainer}>
    <Image source={require('../assets/images/logo.png')} style={styles.logoImage} resizeMode="contain" />
    <View style={styles.pinDot} />
  </View>
);

const ServiceCard = ({ icon, title, desc, onPress }: { icon: FeatherIconName; title: string; desc: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.serviceCard} onPress={onPress} activeOpacity={0.8}>
    <Feather name={icon} size={24} color="#00C9A7" style={{ marginRight: 16 }} />
    <View style={{ flex: 1 }}>
      <Text style={styles.serviceTitle}>{title}</Text>
      <Text style={styles.serviceDesc}>{desc}</Text>
    </View>
    <Feather name="chevron-right" size={20} color="#ccc" />
  </TouchableOpacity>
);

const MenuItem = ({ icon, label, onPress }: { icon: FeatherIconName; label: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
    <Feather name={icon} size={22} color="#1F2937" style={{ marginRight: 16 }} />
    <Text style={styles.menuItemText}>{label}</Text>
  </TouchableOpacity>
);

const DashboardScreen = () => {
  const { user, logout } = useAuth();
  const isDriver = user?.nivel === 2;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuSlide = useRef(new Animated.Value(-MENU_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const openMenu = () => {
    setMenuOpen(true);
    Animated.parallel([
      Animated.timing(menuSlide, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  };
  const closeMenu = () => {
    Animated.parallel([
      Animated.timing(menuSlide, { toValue: -MENU_WIDTH, duration: 200, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setMenuOpen(false));
  };

  const handleLogout = async () => {
    closeMenu();
    await logout();
    router.replace('/auth/Login');
  };

  // Verificar cuenta bancaria antes de publicar
  const navigateToPublish = async () => {
    try {
      const res = await apiClient<{ result: boolean; content: any }>('/private/bank-account');
      if (res.result && res.content) {
        router.push('/driver/create-ride');
      } else {
        alert('Debes agregar tu cuenta bancaria antes de publicar viajes.');
        router.push('/bank-account');
      }
    } catch (error) {
      router.push('/driver/create-ride');
    }
  };

  const driverModules = (
  <>
      <ServiceCard icon="search" title="Encontrar viajes" desc="Ve los viajes que te están esperando" onPress={() => router.push('/driver/find-trip')} />
      <View style={styles.separator} />
      <ServiceCard icon="plus-circle" title="Publicar viaje" desc="Crea un viaje con cupos disponibles" onPress={navigateToPublish} />
      <View style={styles.separator} />
      <ServiceCard icon="list" title="Mis viajes" desc="Gestiona los viajes que has creado" onPress={() => router.push('/driver/my-rides')} />
      <View style={styles.separator} />
      <ServiceCard icon="truck" title="Mis vehículos" desc="Añade, edita y selecciona tu vehículo activo" onPress={() => router.push('/driver/vehicles')} />
      <View style={styles.separator} />
      <ServiceCard icon="toggle-right" title="Disponibilidad" desc="Activa o desactiva tu disponibilidad" onPress={() => router.push('/driver/availability')} />
    </>
  );

  const passengerModules = (
    <>
      <ServiceCard icon="navigation" title="Taxis" desc="Viajes compartidos disponibles" onPress={() => router.push('/shared-rides')} />
      <View style={styles.separator} />
      <ServiceCard icon="package" title="Delivery" desc="Pide comida a negocios locales" onPress={() => alert('Próximamente: Delivery')} />
      <View style={styles.separator} />
      <ServiceCard icon="map-pin" title="Pedir Taxi" desc="Solicita un viaje ahora" onPress={() => router.push('/request-ride')} />
    </>
  );

  return (
    <View style={styles.screen}>
      {menuOpen && (
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeMenu}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
        </TouchableOpacity>
      )}

      <Animated.View style={[styles.menuPanel, { transform: [{ translateX: menuSlide }] }]}>
        <View style={styles.menuHeader}>
          <View style={styles.menuAvatar}>
            <Feather name="user" size={28} color="#00C9A7" />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.menuUserName}>{user?.sesionUser || 'Usuario'}</Text>
            <Text style={styles.menuUserEmail}>{user?.sesionEmail || ''}</Text>
          </View>
          <TouchableOpacity onPress={closeMenu} style={styles.menuCloseBtn}>
            <Feather name="x" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.menuScroll} contentContainerStyle={{ paddingBottom: 30 }}>
          <MenuItem icon="shield" label="Verificación" onPress={() => { closeMenu(); router.push('/verification'); }} />
          <MenuItem icon="file-text" label="Historial" onPress={() => { closeMenu(); alert('Historial (próximamente)'); }} />
          <MenuItem icon="credit-card" label="Cuenta Bancaria" onPress={() => { closeMenu(); router.push('/bank-account'); }} />
          <View style={styles.menuDivider} />
          <MenuItem icon="log-out" label="Cerrar sesión" onPress={handleLogout} />
        </ScrollView>
      </Animated.View>

      <Animated.View style={[styles.mainContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={openMenu} style={{ marginRight: 12 }}>
            <Feather name="menu" size={24} color="#1F2937" />
          </TouchableOpacity>
          <LogoIcon />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <TouchableOpacity onPress={() => alert('Notificaciones (próximamente)')}>
              <Feather name="bell" size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.greeting}>Hola, {user?.sesionUser || 'Usuario'}</Text>
        <View style={styles.servicesContainer}>{isDriver ? driverModules : passengerModules}</View>
        <Text style={styles.sectionTitle}>Actividad reciente</Text>
        <View style={styles.emptyActivity}>
          <Feather name="clock" size={40} color="#ccc" />
          <Text style={styles.emptyText}>Aún no tienes actividad</Text>
          <Text style={styles.emptySub}>Tus viajes y entregas aparecerán aquí</Text>
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Feather name="log-out" size={18} color="#6B7280" style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
        <Text style={styles.footerText}>© 2026 ZAS · Movilidad inteligente</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  mainContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 60 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  logoContainer: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#E6FFFA', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#00C9A7' },
  logoImage: { width: 32, height: 32 },
  pinDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: '#00C9A7' },
  greeting: { fontSize: 28, fontWeight: '700', color: '#1F2937', marginBottom: 24 },
  servicesContainer: { backgroundColor: '#FFFFFF', borderRadius: 20, marginBottom: 28, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3, borderWidth: 1, borderColor: '#E5F5F0', overflow: 'hidden' },
  serviceCard: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  separator: { height: 1, backgroundColor: '#E5F5F0', marginHorizontal: 18 },
  serviceTitle: { color: '#1F2937', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  serviceDesc: { color: '#6B7280', fontSize: 14 },
  sectionTitle: { color: '#6B7280', fontSize: 16, fontWeight: '600', marginBottom: 16 },
  emptyActivity: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5F5F0' },
  emptyText: { color: '#1F2937', fontSize: 17, fontWeight: '600', marginTop: 16 },
  emptySub: { color: '#6B7280', fontSize: 14, marginTop: 8 },
  footer: { borderTopWidth: 1, borderColor: '#E5F5F0', paddingVertical: 20, alignItems: 'center' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  logoutText: { color: '#6B7280', fontWeight: '500' },
  footerText: { color: '#888', fontSize: 12 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 10 },
  menuPanel: { position: 'absolute', top: 0, left: 0, bottom: 0, width: MENU_WIDTH, backgroundColor: '#FFFFFF', zIndex: 20, borderTopRightRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 15, paddingTop: 60 },
  menuHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderColor: '#E5F5F0', marginBottom: 8 },
  menuAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E6FFFA', justifyContent: 'center', alignItems: 'center' },
  menuUserName: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  menuUserEmail: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  menuCloseBtn: { padding: 8 },
  menuScroll: { flex: 1, paddingHorizontal: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  menuItemText: { fontSize: 16, fontWeight: '500', color: '#1F2937' },
  menuDivider: { height: 1, backgroundColor: '#E5F5F0', marginVertical: 8 },
});

export default DashboardScreen;