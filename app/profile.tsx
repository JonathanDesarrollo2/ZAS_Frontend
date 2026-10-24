import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import ProfileAvatar from '../components/ProfileAvatar';

const ProfileScreen = () => (
  <View style={styles.screen}>
    <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
      <Feather name="arrow-left" size={22} color="#1F2937" />
      <Text style={styles.backText}>Volver</Text>
    </TouchableOpacity>
    <View style={styles.content}>
      <ProfileAvatar size={120} />
      <Text style={styles.title}>Tu foto de perfil</Text>
      <Text style={styles.description}>
        Toca tu foto para subir o actualizar una imagen real. La foto ayuda a identificarte durante tus viajes.
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9', paddingTop: 56 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  backText: { color: '#1F2937', fontSize: 15, fontWeight: '600' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 80 },
  title: { color: '#1F2937', fontSize: 23, fontWeight: '800', marginTop: 24 },
  description: { color: '#6B7280', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10 },
});

export default ProfileScreen;
