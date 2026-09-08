// app/dashboard.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Image, Dimensions,
  Alert, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../presentation/store/AuthStore';
import LoadingOverlay from '../presentation/components/shared/LoadingOverlay';
import { connectSocket } from './socket/socketClient';
import ToastNotification from '../presentation/components/shared/toastNotification';
import { apiClient } from '../apis/Client';
import { getActiveTrip } from '../apis/trips';
import { getAppConfig } from '../apis/appConfig';
import ProfileAvatar from '../components/ProfileAvatar';
import UpdateRequiredModal from '../components/updateRequiredModal';

type FeatherIconName =
  | 'search' | 'plus-circle' | 'list' | 'truck' | 'toggle-right'
  | 'chevron-right' | 'bell' | 'log-out' | 'menu'
  | 'x' | 'user' | 'shield' | 'file-text' | 'credit-card' | 'mail'
  | 'alert-triangle' | 'clock' | 'navigation' | 'package' | 'map-pin';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MENU_WIDTH = SCREEN_WIDTH * 0.75;

const LogoIcon = () => (
  <Image
    source={require('../assets/images/logo.png')}
    style={styles.logoImage}
    resizeMode="contain"
  />
);

const ServiceCard = ({
  icon,
  title,
  desc,
  onPress,
  disabled,
}: {
  icon: FeatherIconName;
  title: string;
  desc: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <TouchableOpacity
    style={[styles.serviceCard, disabled && { opacity: 0.5 }]}
    onPress={onPress}
    activeOpacity={0.8}
    disabled={disabled}
  >
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
  const { user, logout, checkSession, isLoading } = useAuth();
  const isKYC = user?.isKYCVerified;
  const isEmailVerified = user?.isEmailVerified;
  const isDriver = user?.nivel === 2;

  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [updateUrl, setUpdateUrl] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [recentTrips, setRecentTrips] = useState<any[]>([]);

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

  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const [spinnerVisible, setSpinnerVisible] = useState(false);

  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToastMsg(msg);
    setToastType(type);
    setToastVisible(true);
  }, []);

  const handleLogout = async () => {
    closeMenu();
    setSpinnerVisible(true);
    try {
      await logout();
    } catch (error) {
      showToast('Error al cerrar sesión');
    } finally {
      setSpinnerVisible(false);
      router.replace('/auth/Login');
    }
  };

  // ✅ Configurar socket: balance y notificaciones
  useEffect(() => {
    const setupSocket = async () => {
      const socket = await connectSocket();
      const handleBalanceUpdate = () => {
        checkSession();
      };
      const handleAdminNotification = (data: any) => {
        // Si quieres abrir el enlace directamente al recibir la notificación,
        // descomenta la siguiente línea:
        // if (data?.link) Linking.openURL(data.link);
        // De lo contrario, la notificación solo se guardará en el historial local.
      };
      socket.on('adminNotification', handleAdminNotification);
      socket.on('adminNotification', handleAdminNotification);
      return () => {
        socket.off('balanceUpdated', handleBalanceUpdate);
        socket.off('adminNotification', handleAdminNotification);
      };
    };
    setupSocket();
  }, []);

  // ✅ Verificar versión mínima
      useEffect(() => {
        const checkVersion = async () => {
          try {
            const config = await getAppConfig();
            const packageJson = require('../package.json');
            const currentVersion = packageJson.version;
            const necesitaActualizar = config.min_version && compareVersions(currentVersion, config.min_version) < 0;
            if (necesitaActualizar) {
              setUpdateUrl(config.update_url || '');
              setUpdateModalVisible(true);
            } else {
              setUpdateModalVisible(false); // 👈 Esto asegura que se oculte
            }
          } catch (e) {
            // Silencioso
          }
        };
        checkVersion();
      }, []);

  useEffect(() => {
    if (!user || isLoading) return;

    const checkActiveTrip = async () => {
      try {
        const res = await getActiveTrip();
        if (res.result && res.content) {
          const trip = res.content;
          if (user.nivel === 2) {
            router.replace({
              pathname: '/driver/active-trip',
              params: { tripId: trip.id },
            });
          } else if (user.nivel === 3) {
            router.replace({
              pathname: '/trip-active',
              params: {
                tripId: trip.id,
                driverId: trip.driver_id,
                driverName: trip.driver?.username || trip.driver?.userlogin || 'Conductor',
                vehicle: trip.vehicle_type || 'Moto',
              },
            });
          }
        }
      } catch (err) {
        // silencioso
      }
    };

    checkActiveTrip();
  }, [user?.id, user?.nivel, isLoading]);

  useEffect(() => {
    if (!user?.id) return;
    const fetchRecentTrips = async () => {
      try {
        const res = await apiClient<{ result: boolean; content: any[] }>('/private/trips/history');
        if (res.result) {
          setRecentTrips(res.content);
        }
      } catch (err) {
        // silencioso
      }
    };
    fetchRecentTrips();
  }, [user?.id]);

  const handleKYCRequired = () => {
    showToast('KYC requerido: Debes verificar tu identidad primero.');
  };

  const checkDocsAndNavigate = async (destination: string) => {
    if (!isKYC) {
      handleKYCRequired();
      return;
    }
    try {
      const res = await apiClient<{ result: boolean; content: any }>('/private/driver-docs/mine');
      if (res.result && res.content) {
        const doc = res.content;
        if (doc.documentacion_status === 'approved' && doc.inspeccion_fisica_aprobada) {
          router.push(destination as any);
        } else {
          Alert.alert('Documentación requerida', 'Debes tener tu documentación aprobada e inspección física.');
          router.push('/driver/documentation');
        }
      } else {
        Alert.alert('Documentación requerida', 'Debes enviar tu documentación antes de publicar viajes.');
        router.push('/driver/documentation');
      }
    } catch (err) {
      router.push(destination as any);
    }
  };

  const driverModules = (
    <>
      <ServiceCard
        icon="search"
        title="Encontrar viajes"
        desc="Ve los viajes que te están esperando"
        onPress={() => checkDocsAndNavigate('/driver/find-trip')}
        disabled={!isKYC}
      />
      <View style={styles.separator} />
      <ServiceCard
        icon="plus-circle"
        title="Publicar viaje"
        desc="Crea un viaje con cupos disponibles"
        onPress={() => checkDocsAndNavigate('/driver/create-ride')}
        disabled={!isKYC}
      />
      <View style={styles.separator} />
      <ServiceCard
        icon="list"
        title="Mis viajes"
        desc="Gestiona los viajes que has creado"
        onPress={isKYC ? () => router.push('/driver/my-rides') : handleKYCRequired}
        disabled={!isKYC}
      />
      <View style={styles.separator} />
      <ServiceCard
        icon="truck"
        title="Mis vehículos"
        desc="Añade, edita y selecciona tu vehículo activo"
        onPress={isKYC ? () => router.push('/driver/vehicles') : handleKYCRequired}
        disabled={!isKYC}
      />
      <View style={styles.separator} />
      <ServiceCard
        icon="file-text"
        title="Documentación"
        desc="Envía tus papeles y los del vehículo"
        onPress={() => router.push('/driver/documentation')}
        disabled={false}
      />
      <View style={styles.separator} />
      <ServiceCard
        icon="toggle-right"
        title="Disponibilidad"
        desc="Activa o desactiva tu disponibilidad"
        onPress={isKYC ? () => router.push('/driver/availability') : handleKYCRequired}
        disabled={!isKYC}
      />
    </>
  );

  const passengerModules = (
    <>
      <ServiceCard
        icon="navigation"
        title="Taxis"
        desc="Viajes compartidos disponibles"
        onPress={isKYC ? () => router.push('/shared-rides') : handleKYCRequired}
        disabled={!isKYC}
      />
      <View style={styles.separator} />
      <ServiceCard
        icon="package"
        title="Delivery"
        desc="Pide comida a negocios locales"
        onPress={isKYC ? () => router.push('/merchant/restaurant') : handleKYCRequired}
        disabled={!isKYC}
      />
      <View style={styles.separator} />
      <ServiceCard
        icon="map-pin"
        title="Pedir Taxi"
        desc="Solicita un viaje ahora"
        onPress={isKYC ? () => router.push('/request-ride') : handleKYCRequired}
        disabled={!isKYC}
      />
    </>
  );

  return (
    <View style={styles.screen}>
      <ToastNotification
        visible={toastVisible}
        message={toastMsg}
        type={toastType}
        onHide={() => setToastVisible(false)}
      />
      <LoadingOverlay visible={spinnerVisible} message="Cerrando sesión..." />

      {menuOpen && (
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeMenu}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
        </TouchableOpacity>
      )}

      <Animated.View style={[styles.menuPanel, { transform: [{ translateX: menuSlide }] }]}>
        <View style={styles.menuHeader}>
          <ProfileAvatar size={95} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.menuUserName}>{user?.sesionUser || 'Usuario'}</Text>
            <Text
              style={styles.menuUserEmail}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {user?.sesionEmail || ''}
            </Text>
          </View>
          <TouchableOpacity onPress={closeMenu} style={styles.menuCloseBtn}>
            <Feather name="x" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.menuScroll} contentContainerStyle={{ paddingBottom: 30 }}>
          <MenuItem
            icon="shield"
            label="Verificación"
            onPress={() => {
              closeMenu();
              router.push('/verification' as any);
            }}
          />
          <MenuItem
            icon="mail"
            label="Verificar correo"
            onPress={() => {
              closeMenu();
              router.push('/auth/VerifyEmail');
            }}
          />
          <MenuItem
            icon="file-text"
            label="Historial"
            onPress={() => {
              closeMenu();
              router.push('/history');
            }}
          />
          <MenuItem
            icon="credit-card"
            label="Datos de pago móvil"
            onPress={() => {
              closeMenu();
              router.push('/bank-account' as any);
            }}
          />
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
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => router.push('/notifications')} style={{ marginLeft: 16 }}>
            <Feather name="bell" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.greeting}>Hola, {user?.sesionUser || 'Usuario'}</Text>

          <View style={styles.bannersContainer}>
            {!isKYC && (
              <View style={styles.compactWarning}>
                <Feather name="alert-triangle" size={16} color="#FF9800" />
                <Text style={styles.compactWarningText}>KYC pendiente</Text>
                <TouchableOpacity onPress={() => router.push('/auth/kyc')}>
                  <Text style={styles.compactLink}>Verificar</Text>
                </TouchableOpacity>
              </View>
            )}
            {!isEmailVerified && (
              <View style={styles.compactWarning}>
                <Feather name="mail" size={16} color="#FF9800" />
                <Text style={styles.compactWarningText}>Correo sin verificar</Text>
                <TouchableOpacity onPress={() => router.push('/auth/VerifyEmail')}>
                  <Text style={styles.compactLink}>Verificar</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.servicesContainer}>
            {isDriver ? driverModules : passengerModules}
          </View>

          <Text style={styles.sectionTitle}>Actividad reciente</Text>
          {recentTrips.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Feather name="clock" size={40} color="#ccc" />
              <Text style={styles.emptyText}>Aún no tienes actividad</Text>
              <Text style={styles.emptySub}>Tus viajes aparecerán aquí</Text>
            </View>
          ) : (
            <View style={styles.tripsContainer}>
              {recentTrips.slice(0, 2).map((trip) => (
                <View key={trip.id} style={styles.tripCard}>
                  <View style={styles.tripHeader}>
                    {trip.counterpartPicUrl ? (
                      <Image source={{ uri: trip.counterpartPicUrl }} style={styles.tripAvatar} />
                    ) : (
                      <Feather name="user" size={24} color="#9CA3AF" style={styles.tripAvatarPlaceholder} />
                    )}
                    <Text style={styles.tripName}>{trip.counterpartName}</Text>
                    <Text style={styles.tripPrice}>${Number(trip.price).toFixed(2)}</Text>
                  </View>
                  <View style={styles.tripRoute}>
                    <Text style={styles.tripAddress}>📍 {trip.origin_address}</Text>
                    <Text style={styles.tripAddress}>🏁 {trip.destination_address}</Text>
                  </View>
                  <Text style={styles.tripDate}>
                    {new Date(trip.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              ))}

              <TouchableOpacity
                style={styles.viewAllButton}
                onPress={() => router.push('/history')}
              >
                <Text style={styles.viewAllText}>Ver historial completo</Text>
                <Feather name="chevron-right" size={18} color="#00C9A7" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.footer}>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Feather name="log-out" size={18} color="#6B7280" style={{ marginRight: 8 }} />
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </TouchableOpacity>
            <Text style={styles.footerText}>© 2026 ZAS · Movilidad inteligente</Text>
          </View>
        </ScrollView>
      </Animated.View>
      <UpdateRequiredModal
        visible={updateModalVisible}
        updateUrl={updateUrl}
      />
    </View>
  );
};

function compareVersions(a: string, b: string): number {
  const normalize = (v: string) => v.replace(/^v/i, '').split('.').map(Number);
  const pa = normalize(a);
  const pb = normalize(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  mainContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 60 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  logoImage: {
    width: 70,
    height: 70,
    resizeMode: 'contain',
    marginRight: 8,
  },
  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  greeting: { fontSize: 28, fontWeight: '700', color: '#1F2937', marginBottom: 24 },
  bannersContainer: { marginBottom: 16 },
  compactWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
    gap: 6,
  },
  compactWarningText: { color: '#E65100', fontSize: 13, flex: 1 },
  compactLink: { color: '#3c87f7', fontWeight: '600', fontSize: 13 },
  servicesContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5F5F0',
    overflow: 'hidden',
  },
  serviceCard: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  separator: { height: 1, backgroundColor: '#E5F5F0', marginHorizontal: 18 },
  serviceTitle: { color: '#1F2937', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  serviceDesc: { color: '#6B7280', fontSize: 14 },
  sectionTitle: { color: '#6B7280', fontSize: 16, fontWeight: '600', marginBottom: 16 },
  emptyActivity: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5F5F0',
  },
  emptyText: { color: '#1F2937', fontSize: 17, fontWeight: '600', marginTop: 16 },
  emptySub: { color: '#6B7280', fontSize: 14, marginTop: 8 },
  footer: {
    borderTopWidth: 1,
    borderColor: '#E5F5F0',
    paddingTop: 20,
    marginTop: 20,
    alignItems: 'center',
  },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  logoutText: { color: '#6B7280', fontWeight: '500' },
  footerText: { color: '#888', fontSize: 12 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 10,
  },
  menuPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: MENU_WIDTH,
    backgroundColor: '#FFFFFF',
    zIndex: 20,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 15,
    paddingTop: 60,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderColor: '#E5F5F0',
    marginBottom: 8,
  },
  menuAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E6FFFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuUserName: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  menuUserEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    flexShrink: 1,
  },
  menuCloseBtn: { padding: 8 },
  menuScroll: { flex: 1, paddingHorizontal: 20 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  menuItemText: { fontSize: 16, fontWeight: '500', color: '#1F2937' },
  menuDivider: { height: 1, backgroundColor: '#E5F5F0', marginVertical: 8 },
  tripsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5F5F0',
  },
  tripCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tripAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  tripAvatarPlaceholder: {
    marginRight: 8,
  },
  tripName: {
    flex: 1,
    fontWeight: '600',
    color: '#1F2937',
  },
  tripPrice: {
    fontWeight: '700',
    color: '#00C9A7',
  },
  tripRoute: {
    marginBottom: 4,
  },
  tripAddress: {
    color: '#374151',
    fontSize: 14,
    marginBottom: 2,
  },
  tripDate: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  viewAllText: {
    color: '#00C9A7',
    fontWeight: '600',
    fontSize: 16,
    marginRight: 4,
  },
});

export default DashboardScreen;