import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { useAuth } from '../../presentation/hooks/useAuth';
import { router } from 'expo-router';

const VerifyEmailScreen = () => {
  const [code, setCode] = useState('');
  const { sendEmailCode, confirmEmailCode, isLoading, error, checkSession } = useAuth();

  const handleVerify = async () => {
    if (code.length !== 8) {
      Alert.alert('Código inválido', 'El código debe tener 8 caracteres');
      return;
    }
    try {
      await confirmEmailCode(code);
      await checkSession(); // refrescar sesión para actualizar isEmailVerified
      Alert.alert('¡Verificado!', 'Tu correo ha sido confirmado', [
        { text: 'OK', onPress: () => router.replace('/dashboard') }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleResend = async () => {
    try {
      await sendEmailCode();
      Alert.alert('Código reenviado', 'Revisa tu bandeja de entrada');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  return (
    <View style={{ flex: 1, padding: 30, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>Verificar correo</Text>
      <Text style={{ marginBottom: 10 }}>Introduce el código de 8 caracteres enviado a tu email.</Text>

      <TextInput
        placeholder="Código"
        value={code}
        onChangeText={setCode}
        maxLength={8}
        autoCapitalize="characters"
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 8,
          padding: 12,
          fontSize: 20,
          textAlign: 'center',
          letterSpacing: 4,
        }}
      />

      <TouchableOpacity
        onPress={handleVerify}
        disabled={isLoading}
        style={{ backgroundColor: '#3c87f7', padding: 15, borderRadius: 8, marginTop: 20, alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>Verificar</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleResend} style={{ marginTop: 15 }}>
        <Text style={{ color: '#3c87f7', textAlign: 'center' }}>Reenviar código</Text>
      </TouchableOpacity>
    </View>
  );
};

export default VerifyEmailScreen;