import { PropsWithChildren, useEffect } from 'react';
import PermissionsScreen from '../../app/permissions/index';
import { router } from 'expo-router';
import { usePermissionsStore } from '../store/usePermissions';
import { PermissionStatus } from '../../infraestructure/interfaces/location';

const PermissionsCheckerProvider = ({ children }: PropsWithChildren) => {
  const { locationStatus, checkLocationPermission } = usePermissionsStore();

  useEffect(() => {
    if (locationStatus === PermissionStatus.GRANTED) {
      router.replace('/map');
    } else if (locationStatus !== PermissionStatus.CHECKING) {
      router.replace('/permissions');
    }
  }, [locationStatus]);

  useEffect(() => {
    checkLocationPermission();
  }, []);

  // TODO:
  // Estar pendiente cuando el estado de la aplicación cambie

  return <>{children}</>;
};

export default PermissionsCheckerProvider;