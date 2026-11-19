import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { reportPassengerLocation } from '../apis/trips';
import { ApiClientError } from '../apis/Client';

export const PASSENGER_LOCATION_TASK = 'zas-passenger-location';
const ACTIVE_TRIP_ID_KEY = 'activePassengerTripId';
let taskOperation: Promise<void> = Promise.resolve();

const queueTaskOperation = (operation: () => Promise<void>) => {
  const next = taskOperation.catch(() => undefined).then(operation);
  taskOperation = next;
  return next;
};

TaskManager.defineTask(PASSENGER_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Falló el rastreo de ubicación en segundo plano:', error);
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
  const location = locations?.[locations.length - 1];
  if (!location) return;

  const tripId = await AsyncStorage.getItem(ACTIVE_TRIP_ID_KEY);
  if (!tripId) return;

  try {
    await reportPassengerLocation(
      tripId,
      location.coords.latitude,
      location.coords.longitude,
    );
  } catch (taskError) {
    console.error('No se pudo reportar la ubicación en segundo plano:', taskError);
    if (taskError instanceof ApiClientError && [401, 403, 404, 409].includes(taskError.status)) {
      try {
        await stopPassengerLocationTask(tripId);
      } catch (stopError) {
        console.error('No se pudo detener el rastreo:', stopError);
      }
    }
  }
});

export const startPassengerLocationTask = (tripId: string) => queueTaskOperation(async () => {
  if (Platform.OS === 'web' || !(await TaskManager.isAvailableAsync())) {
    throw new Error('El seguimiento en segundo plano no está disponible en esta aplicación.');
  }

  await AsyncStorage.setItem(ACTIVE_TRIP_ID_KEY, tripId);
  if (await Location.hasStartedLocationUpdatesAsync(PASSENGER_LOCATION_TASK)) return;

  await Location.startLocationUpdatesAsync(PASSENGER_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 10000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    activityType: Location.ActivityType.AutomotiveNavigation,
    foregroundService: {
      notificationTitle: 'Viaje activo',
      notificationBody: 'Compartiendo tu ubicación con el conductor.',
      notificationColor: '#00C9A7',
    },
  });
});

export const stopPassengerLocationTask = (tripId?: string) => queueTaskOperation(async () => {
  if (Platform.OS === 'web' || !(await TaskManager.isAvailableAsync())) return;

  const activeTripId = await AsyncStorage.getItem(ACTIVE_TRIP_ID_KEY);
  if (tripId && activeTripId && activeTripId !== tripId) return;
  if (await Location.hasStartedLocationUpdatesAsync(PASSENGER_LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(PASSENGER_LOCATION_TASK);
  }
  await AsyncStorage.removeItem(ACTIVE_TRIP_ID_KEY);
});
