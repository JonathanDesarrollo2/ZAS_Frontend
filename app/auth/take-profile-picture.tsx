import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import Svg, { Defs, Ellipse, Mask, Rect } from 'react-native-svg';
import { uploadProfilePicture } from '../../apis/auth';
import { useAuth } from '../../presentation/store/AuthStore';

const { width: screenWidth } = Dimensions.get('window');
const frameWidth = Math.min(screenWidth - 64, 300);
const frameHeight = frameWidth * 1.22;
const screenHeight = Dimensions.get('window').height;

export default function TakeProfilePictureScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [uploading, setUploading] = useState(false);
  const checkSession = useAuth((state) => state.checkSession);

  const takeAndUploadPhoto = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permiso requerido', 'Permite el acceso a la cámara para tomar tu foto de perfil.');
        return;
      }
    }

    try {
      setUploading(true);
      const picture = await cameraRef.current?.takePictureAsync({ quality: 0.5 });
      if (!picture?.uri) {
        throw new Error('No se pudo capturar la foto. Inténtalo de nuevo.');
      }

      const upload = await uploadProfilePicture(
        picture.uri,
        'image/jpeg',
        `profile-${Date.now()}.jpg`,
      );
      if (!upload.result) {
        throw new Error(upload.error?.[0] || 'No se pudo guardar la foto.');
      }
      await checkSession();

      const user = useAuth.getState().user;
      if (!user?.profile_pic_url) {
        throw new Error('La foto se guardó, pero no pudimos confirmar tu perfil. Inténtalo nuevamente.');
      }
      router.replace('/dashboard');
    } catch (error) {
      Alert.alert(
        'No se pudo guardar la foto',
        error instanceof Error ? error.message : 'Inténtalo de nuevo.',
      );
    } finally {
      setUploading(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Feather name="camera" size={42} color="#00C9A7" />
        <Text style={styles.title}>Tu foto de perfil</Text>
        <Text style={styles.description}>
          Necesitamos acceso a la cámara para verificar tu identidad visual y completar tu perfil.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => void requestPermission()}>
          <Text style={styles.primaryButtonText}>Permitir acceso a la cámara</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width={screenWidth} height={screenHeight}>
        <Defs>
          <Mask id="ovalCutout" x="0" y="0" width={screenWidth} height={screenHeight}>
            <Rect width={screenWidth} height={screenHeight} fill="#FFFFFF" />
            <Ellipse
              cx={screenWidth / 2}
              cy={screenHeight / 2}
              rx={frameWidth / 2}
              ry={frameHeight / 2}
              fill="#000000"
            />
          </Mask>
        </Defs>
        <Rect
          width={screenWidth}
          height={screenHeight}
          fill="#000000"
          fillOpacity={0.62}
          mask="url(#ovalCutout)"
        />
        <Ellipse
          cx={screenWidth / 2}
          cy={screenHeight / 2}
          rx={frameWidth / 2}
          ry={frameHeight / 2}
          fill="transparent"
          stroke="#FFFFFF"
          strokeWidth={3}
        />
      </Svg>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Foto de perfil obligatoria</Text>
        <Text style={styles.headerText}>Centra tu rostro dentro del óvalo</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.hint}>
          Busca buena iluminación y mira directamente a la cámara. No podrás continuar sin una foto.
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, uploading && styles.disabledButton]}
          onPress={() => void takeAndUploadPhoto()}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Feather name="camera" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Tomar foto</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111827', justifyContent: 'space-between' },
  permissionScreen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: { color: '#1F2937', fontSize: 24, fontWeight: '800', marginTop: 20 },
  description: { color: '#6B7280', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10 },
  header: { paddingTop: 72, alignItems: 'center', paddingHorizontal: 24 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  headerText: { color: '#E5E7EB', fontSize: 14, marginTop: 8 },
  footer: { paddingHorizontal: 28, paddingBottom: 44, alignItems: 'center' },
  hint: { color: '#F3F4F6', textAlign: 'center', fontSize: 13, lineHeight: 19, marginBottom: 18 },
  primaryButton: {
    minHeight: 54,
    width: '100%',
    backgroundColor: '#00C9A7',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  disabledButton: { opacity: 0.65 },
});
