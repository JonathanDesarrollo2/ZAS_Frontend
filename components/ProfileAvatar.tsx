// components/ProfileAvatar.tsx
import React, { useState } from 'react';
import {
  TouchableOpacity,
  Image,
  ActivityIndicator,
  View,
  Modal,
  StyleSheet,
  Dimensions,
  StatusBar,
  Text,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../presentation/store/AuthStore';
import { getToken } from '../apis/Client';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  size?: number;
}

const ProfileAvatar: React.FC<Props> = ({ size = 50 }) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [canChange, setCanChange] = useState(false);

  const launchPicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setAlertMessage('Necesitas dar acceso a la galería para cambiar la foto.');
      setCanChange(false);
      setShowAlert(true);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.length > 0) {
      setUploading(true);
      try {
        const asset = result.assets[0];
        const formData = new FormData();
        formData.append('profile_pic', {
          uri: asset.uri,
          type: asset.mimeType || 'image/jpeg',
          name: (asset as any).fileName || 'profile.jpg',
        } as any);

        const token = await getToken();
        if (!token) throw new Error('No hay token de autenticación');

        const baseUrl = process.env.EXPO_PUBLIC_API_URL;
        if (!baseUrl) throw new Error('API URL no configurada');

        const response = await fetch(`${baseUrl}/private/user/profile-pic`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await response.json();

        if (data.result) {
          // Actualizar store con la nueva foto y fecha
          useAuth.setState((prev) => ({
            user: {
              ...prev.user!,
              profile_pic_url: data.content.url,
              profile_pic_updated_at: new Date().toISOString(),
            },
          }));
        } else {
          setAlertMessage(data.error?.[0] || 'No se pudo subir la foto');
          setCanChange(false);
          setShowAlert(true);
        }
      } catch (error: any) {
        setAlertMessage(error.message);
        setCanChange(false);
        setShowAlert(true);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleEditPress = () => {
    setModalVisible(false); // cerrar modal de foto ampliada

    const lastChange = user?.profile_pic_updated_at;
    const now = new Date();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    // Verificar si ya cambió la foto en los últimos 3 días
    if (lastChange) {
      const diffMs = now.getTime() - new Date(lastChange).getTime();
      if (diffMs < threeDaysMs) {
        // Alerta 2: ya cambió la foto recientemente
        setAlertMessage(
          '\nSolo puedes cambiar tu foto de perfil una vez cada 3 días.'
        );
        setCanChange(false);
        setShowAlert(true);
        return;
      }
    }

    // Alerta 1: regla general, aún puede cambiar
    setAlertMessage(
      '\nSolo puedes cambiar tu foto de perfil cada 3 días. Asegúrate de usar una foto real de ti.'
    );
    setCanChange(true);
    setShowAlert(true);
  };

  const handleChangePhoto = () => {
    setShowAlert(false);
    launchPicker();
  };

  const openModal = () => {
    if (user?.profile_pic_url) {
      setModalVisible(true);
    } else {
      handleEditPress(); // si no hay foto, aplica misma validación
    }
  };

  const cameraSize = size * 0.35;

  return (
    <View>
      <TouchableOpacity
        style={[styles.avatarContainer, { width: size, height: size, borderRadius: size / 2 }]}
        onPress={openModal}
        disabled={uploading}
        activeOpacity={0.7}
      >
        {uploading ? (
          <ActivityIndicator size="small" color="#00C9A7" />
        ) : user?.profile_pic_url ? (
          <Image
            source={{ uri: user.profile_pic_url }}
            style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]}
          />
        ) : (
          <Feather name="user" size={size * 0.6} color="#00C9A7" />
        )}

        <Feather
          name="camera"
          size={cameraSize}
          color="#00C9A7"
          style={styles.cameraIcon}
        />
      </TouchableOpacity>

      {/* Modal para ver la foto ampliada */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <StatusBar barStyle="light-content" backgroundColor="black" />
          <View style={styles.warningContainer}>
            <Feather name="alert-circle" size={16} color="#FFD700" />
            <Text style={styles.warningText}>Usa una foto real de ti</Text>
          </View>

          <View style={styles.modalTopBar}>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
              <Feather name="x" size={28} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleEditPress} style={styles.editButton}>
              <Feather name="edit-2" size={24} color="white" />
            </TouchableOpacity>
          </View>

          <View style={styles.imageContainer}>
            <Image
              source={{ uri: user?.profile_pic_url || '' }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </Modal>

      {/* Alerta personalizada estilo ZAS */}
      <Modal
        visible={showAlert}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAlert(false)}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Feather name="info" size={48} color="#00C9A7" />
            <Text style={styles.alertTitle}>Cambio de foto de perfil</Text>
            <Text style={styles.alertMessage}>{alertMessage}</Text>
            <View style={styles.alertButtonsRow}>
              <TouchableOpacity style={styles.alertCancelButton} onPress={() => setShowAlert(false)}>
                <Text style={styles.alertCancelText}>Cerrar</Text>
              </TouchableOpacity>
              {canChange && (
                <TouchableOpacity style={styles.alertConfirmButton} onPress={handleChangePhoto}>
                  <Text style={styles.alertConfirmText}>Cambiar foto</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  avatarContainer: {
    backgroundColor: '#E6FFFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: { resizeMode: 'cover' },
  cameraIcon: { position: 'absolute', bottom: 0, right: 0 },
  modalBackground: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  warningText: { color: '#FFD700', fontSize: 14, marginLeft: 8 },
  modalTopBar: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  closeButton: { padding: 10 },
  editButton: { padding: 10 },
  imageContainer: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  alertBox: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
    lineHeight: 22,
  },
  alertButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  alertCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  alertCancelText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 16,
  },
  alertConfirmButton: {
    flex: 1,
    backgroundColor: '#00C9A7',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  alertConfirmText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default ProfileAvatar;