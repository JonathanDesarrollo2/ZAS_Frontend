// app/index.tsx
import { View, ActivityIndicator, StyleSheet, Image, Text } from 'react-native';
import { useEffect } from 'react';
import { useAuth } from '../presentation/hooks/useAuth';
import { router } from 'expo-router';

const IndexScreen = () => {
  const { checkSession, isAuthenticated } = useAuth();

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (isAuthenticated !== undefined) {
      if (isAuthenticated) {
        router.replace('/dashboard');
      } else {
        router.replace('/auth/Login');
      }
    }
  }, [isAuthenticated]);

  // Seguridad: si después de 8 segundos no se ha resuelto la sesión, forzar ida al login
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isAuthenticated === undefined) {
        router.replace('/auth/Login');
      }
    }, 8000);
    return () => clearTimeout(timeout);
  }, [isAuthenticated]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>ZAS</Text>
      <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 30 }} />
      <Text style={styles.subtitle}>Cargando...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#98FFD9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: { width: 120, height: 120, marginBottom: 20 },
  title: {
    fontSize: 48,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'SpaceMono',
    letterSpacing: 6,
  },
  subtitle: { color: '#FFFFFF', fontSize: 16, marginTop: 10, fontWeight: '500' },
});

export default IndexScreen;