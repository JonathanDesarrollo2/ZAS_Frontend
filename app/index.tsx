import { View } from 'react-native';
import React from 'react';
import { ThemedText } from '../presentation/components/shared/themed-text';
import { useTheme } from '../presentation/hooks/use-theme';
import { Colors } from '../presentation/hooks/theme';

const MapsApp = () => {
    const theme = useTheme(); 
  return (
    <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
      {/* Pasa el color explícitamente */}
      <ThemedText style={{ color: theme.text }}>MapsApp</ThemedText>
    </View>
  );
};

export default MapsApp;