import { View, Text, Pressable } from 'react-native';
import { ThemedText } from '../../presentation/components/shared/themed-text';
import { usePermissionsStore } from '../../presentation/store/usePermissions';
import { useTheme } from '../../presentation/hooks/use-theme';

const PermissionsScreen = () => {
  const { locationStatus, requestLocationPermission } = usePermissionsStore();
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.background,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Pressable 
        onPress={requestLocationPermission}
        style={({ pressed }) => ({
          backgroundColor: pressed ? 'lightgray' : 'transparent',
          padding: 10,
          borderRadius: 5
        })}
      >
        <Text style={{ color: theme.text }}>Habilitar ubicación</Text>
      </Pressable>

      <ThemedText style={{ color: theme.text, marginTop: 20 }}>
        Estado actual: {locationStatus}
      </ThemedText>
    </View>
  );
};

export default PermissionsScreen;