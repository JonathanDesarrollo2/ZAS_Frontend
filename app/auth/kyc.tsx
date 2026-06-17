import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '../../presentation/hooks/useAuth';

const KYCScreen = () => {
  const { startKYC, checkKYCStatus, isLoading } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);

  const handleStart = async () => {
    try {
      const url = await startKYC();
      setVerificationUrl(url);
      // Abre el navegador para que el usuario haga la verificación
      Linking.openURL(url);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleCheck = async () => {
    try {
      const result = await checkKYCStatus();
      setStatus(result);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  useEffect(() => {
    handleCheck();
  }, []);

  return (
    <View style={{ flex: 1, padding: 30, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>Verificación de identidad</Text>

      {status === 'verified' ? (
        <Text style={{ color: 'green', fontSize: 18 }}>✅ Identidad verificada</Text>
      ) : (
        <>
          <Text style={{ marginBottom: 10 }}>Estado actual: {status || 'No iniciada'}</Text>
          <TouchableOpacity
            onPress={handleStart}
            disabled={isLoading}
            style={{ backgroundColor: '#3c87f7', padding: 15, borderRadius: 8, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff' }}>Iniciar verificación</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleCheck}
            style={{ marginTop: 15, alignItems: 'center' }}
          >
            <Text style={{ color: '#3c87f7' }}>Actualizar estado</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

export default KYCScreen;