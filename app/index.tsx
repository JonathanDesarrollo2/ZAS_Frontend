import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Image, Text } from 'react-native';
import { router } from 'expo-router'
import { useAuth } from '../presentation/store/AuthStore';   // ← importa useAuth

const IndexScreen = () => {
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      router.replace(isAuthenticated ? '/dashboard' : '/auth/Login');
    }
  }, [isLoading, isAuthenticated]);

  return (
    <View style={styles.container}>
      <Image source={require('../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
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
  title: { fontSize: 48, fontWeight: '600', color: '#FFFFFF', fontFamily: 'SpaceMono', letterSpacing: 6 },
  subtitle: { color: '#FFFFFF', fontSize: 16, marginTop: 10, fontWeight: '500' },
});

export default IndexScreen;