import { View, Text, Button } from 'react-native';
import { useEffect } from 'react';
import { usePermissionsStore } from '../../presentation/store/usePermissions';
import { router } from 'expo-router';

const MapScreen = () => {
  const { locationStatus, checkLocationPermission, requestLocationPermission } = usePermissionsStore();

  useEffect(() => {
    checkLocationPermission();
  }, []);

  useEffect(() => {
    if (locationStatus !== 'GRANTED' && locationStatus !== 'checking') {
      router.replace('/permissions');
    }
  }, [locationStatus]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Mapa principal</Text>
      <Text>Estado: {locationStatus}</Text>
    </View>
  );
};

export default MapScreen;