import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import MapSelector from '../../presentation/components/shared/mapSelector';
import { createMarketplaceProduct, getMyMarketplaceProducts, updateMarketplaceProduct } from '../../apis/marketplace';
import LegalDocumentModal from '../../components/LegalDocumentModal';
import { SELLER_DECLARATION } from '../../legal/LegalTexts';
import { getToken } from '../../apis/Client';

const DEFAULT_LOCATION = { lat: 10.071866, lng: -66.869583 };

const CreateMarketplaceProductScreen = () => {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const editing = Boolean(productId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pickup, setPickup] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [sellerDeclarationAccepted, setSellerDeclarationAccepted] = useState(false);
  const [declarationVisible, setDeclarationVisible] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(editing);

  useEffect(() => {
    if (!productId) return;
    let active = true;
    getMyMarketplaceProducts()
      .then(({ result, content: products }) => {
        if (!result) throw new Error('No se pudo cargar el producto');
        const content = products.find((product) => product.id === productId);
        if (!content) throw new Error('No encontramos el producto en tu inventario');
        if (!active) return;
        setTitle(content.title);
        setDescription(content.description);
        setPrice(String(content.price));
        setStock(String(content.stock));
        setPickup({
          address: content.pickup_address,
          lat: Number(content.pickup_lat),
          lng: Number(content.pickup_lng),
        });
      })
      .catch((error: unknown) => {
        if (active) Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo cargar el producto');
      })
      .finally(() => { if (active) setLoadingProduct(false); });
    return () => { active = false; };
  }, [productId]);

  useEffect(() => {
    let cancelled = false;
    const loadLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const location = await Location.getCurrentPositionAsync({});
        if (!cancelled) {
          setCurrentLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
        }
      } catch {
        if (!cancelled) {
          try {
            const lastKnown = await Location.getLastKnownPositionAsync({});
            if (lastKnown) {
              setCurrentLocation({ lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude });
            }
          } catch {
            // El mapa conserva la ubicación alternativa si el dispositivo no ofrece una ubicación.
          }
        }
      }
    };
    void loadLocation();
    return () => { cancelled = true; };
  }, []);

  const chooseImages = async () => {
    if (images.length >= 6) {
      Alert.alert('Límite alcanzado', 'Puedes agregar un máximo de 6 imágenes.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Permite el acceso a tus fotos para agregar imágenes al producto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: 6 - images.length,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImages((current) => [...current, ...result.assets]
        .filter((asset, index, assets) => assets.findIndex((item) => item.uri === asset.uri) === index)
        .slice(0, 6));
    }
  };

  const publish = async () => {
    const numericPrice = Number(price.replace(',', '.'));
    const numericStock = Number(stock);
    if (!title.trim() || !description.trim() || !Number.isFinite(numericPrice) || numericPrice <= 0 || !Number.isInteger(numericStock) || numericStock < (editing ? 0 : 1) || !pickup) {
      Alert.alert('Datos incompletos', 'Completa el producto, un precio válido, stock entero no negativo y selecciona el punto de recogida.');
      return;
    }
    if (!editing && !sellerDeclarationAccepted) {
      Alert.alert('Confirmación requerida', 'Debes aceptar la declaración de responsabilidad del vendedor para publicar.');
      return;
    }
    setSaving(true);
    try {
      if (editing && productId) {
        const response = await updateMarketplaceProduct(productId, {
          title: title.trim(),
          description: description.trim(),
          price: numericPrice,
          stock: numericStock,
        });
        if (!response.result) throw new Error('No se pudo actualizar el producto');
        Alert.alert('Cambios guardados', 'El producto fue actualizado.', [
          { text: 'Continuar', onPress: () => router.back() },
        ]);
      } else {
        const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL;
        if (!apiBaseUrl) throw new Error('API URL no configurada.');
        const token = await getToken();
        if (!token) throw new Error('Debes iniciar sesión para subir imágenes.');

        const uploadedUrls: string[] = [];
        const uploadUrl = `${apiBaseUrl.replace(/\/+$/, '')}/private/marketplace/upload-image`;
        for (const [index, image] of images.entries()) {
          setUploadProgress(`Subiendo imagen ${index + 1} de ${images.length}...`);
          const uploadResponse = await FileSystem.uploadAsync(uploadUrl, image.uri, {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: 'image',
            mimeType: image.mimeType || 'image/jpeg',
            headers: {
              Authorization: 'Bearer ' + token,
              Accept: 'application/json',
            },
          });

          let uploadResult: {
            result?: boolean;
            content?: { url?: string };
            error?: string[];
          };
          try {
            uploadResult = JSON.parse(uploadResponse.body);
          } catch {
            throw new Error(`Respuesta inválida al subir la imagen ${index + 1}.`);
          }
          if (
            uploadResponse.status < 200 ||
            uploadResponse.status >= 300 ||
            !uploadResult.result ||
            typeof uploadResult.content?.url !== 'string'
          ) {
            throw new Error(uploadResult.error?.[0] || `No se pudo subir la imagen ${index + 1}.`);
          }
          uploadedUrls.push(uploadResult.content.url);
        }

        setUploadProgress('Publicando producto...');
        const response = await createMarketplaceProduct({
          title: title.trim(),
          description: description.trim(),
          price: numericPrice,
          stock: numericStock,
          seller_declaration_accepted: sellerDeclarationAccepted,
          image_urls: uploadedUrls,
          pickup,
        });
        if (!response.result) throw new Error('No se pudo publicar el producto');
        Alert.alert('Producto publicado', 'Tu producto ya está disponible en el MarketPlace.', [
          { text: 'Continuar', onPress: () => router.replace('/marketplace') },
        ]);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo publicar el producto');
    } finally {
      setSaving(false);
      setUploadProgress('');
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loadingProduct ? <ActivityIndicator size="large" color="#00C9A7" /> : null}
        <Text style={styles.heading}>{editing ? 'Editar producto' : 'Publicar producto'}</Text>
        <Text style={styles.subtitle}>{editing ? 'Actualiza los datos y el inventario del producto.' : 'Completa la información para ofrecerlo a la comunidad.'}</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Nombre del producto" placeholderTextColor="#9CA3AF" maxLength={160} />
        <TextInput style={[styles.input, styles.description]} value={description} onChangeText={setDescription} placeholder="Descripción" placeholderTextColor="#9CA3AF" multiline />
        <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="Precio (USD)" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />
        <TextInput style={styles.input} value={stock} onChangeText={setStock} placeholder="Unidades disponibles" placeholderTextColor="#9CA3AF" keyboardType="number-pad" />
        {!editing && <TouchableOpacity style={styles.imagePicker} onPress={() => void chooseImages()}>
          <Feather name="image" size={19} color="#00C9A7" />
          <Text style={styles.imagePickerText}>Agregar imágenes ({images.length}/6)</Text>
          <Feather name="plus" size={19} color="#00C9A7" />
        </TouchableOpacity>}
        {images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageStrip}>
            {images.map((image) => (
              <View key={image.uri} style={styles.thumbnailWrap}>
                <Image source={{ uri: image.uri }} style={styles.thumbnail} />
                {!editing && <TouchableOpacity
                  style={styles.removeImage}
                  onPress={() => setImages((current) => current.filter((item) => item.uri !== image.uri))}
                  accessibilityLabel="Quitar imagen"
                >
                  <Feather name="x" size={14} color="#FFFFFF" />
                </TouchableOpacity>}
              </View>
            ))}
          </ScrollView>
        )}
        {editing ? (
          <View style={styles.locationButton}>
            <Feather name="map-pin" size={19} color="#00C9A7" />
            <Text style={styles.locationText}>{pickup?.address || 'Ubicación de recogida'}</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.locationButton} onPress={() => setMapVisible(true)}>
            <Feather name="map-pin" size={19} color="#00C9A7" />
            <Text style={styles.locationText}>{pickup?.address || 'Marcar punto de recogida en el mapa'}</Text>
            <Feather name="chevron-right" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
        {!editing && <TouchableOpacity
          style={styles.declarationRow}
          onPress={() => setSellerDeclarationAccepted((accepted) => !accepted)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: sellerDeclarationAccepted }}
        >
          <Feather name={sellerDeclarationAccepted ? 'check-square' : 'square'} size={21} color={sellerDeclarationAccepted ? '#00C9A7' : '#6B7280'} />
          <Text style={styles.declarationText}>
            Acepto la{' '}
            <Text style={styles.declarationLink} onPress={() => setDeclarationVisible(true)}>declaración de responsabilidad del vendedor</Text>
            {' '}y asumo la responsabilidad legal del producto publicado.
          </Text>
        </TouchableOpacity>}
        <TouchableOpacity style={[styles.publishButton, (saving || loadingProduct) && styles.disabled]} onPress={() => void publish()} disabled={saving || loadingProduct}>
          {saving ? <><ActivityIndicator color="#FFFFFF" /><Text style={styles.publishText}>{uploadProgress || 'Guardando...'}</Text></> : <><Feather name={editing ? 'save' : 'upload'} size={18} color="#FFFFFF" /><Text style={styles.publishText}>{editing ? 'Guardar cambios' : 'Publicar producto'}</Text></>}
        </TouchableOpacity>
      </ScrollView>
      {!editing && <MapSelector
        visible={mapVisible}
        initialCoords={pickup ? { lat: pickup.lat, lng: pickup.lng } : currentLocation || DEFAULT_LOCATION}
        onConfirm={(address, lat, lng) => {
          setPickup({ address, lat, lng });
          setMapVisible(false);
        }}
        onCancel={() => setMapVisible(false)}
      />}
      <LegalDocumentModal
        visible={declarationVisible}
        title="Declaración del vendedor"
        content={SELLER_DECLARATION}
        onClose={() => setDeclarationVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { paddingHorizontal: 20, paddingTop: 62, paddingBottom: 36 },
  heading: { color: '#1F2937', fontSize: 27, fontWeight: '800' },
  subtitle: { color: '#6B7280', fontSize: 14, lineHeight: 20, marginTop: 7, marginBottom: 22 },
  input: { backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, height: 52, fontSize: 15, color: '#1F2937', marginBottom: 13 },
  description: { height: 110, textAlignVertical: 'top', paddingTop: 14 },
  imagePicker: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, marginBottom: 12 },
  imagePickerText: { flex: 1, marginLeft: 10, color: '#1F2937', fontSize: 15, fontWeight: '600' },
  imageStrip: { marginBottom: 15 },
  thumbnailWrap: { width: 76, height: 76, marginRight: 10 },
  thumbnail: { width: 76, height: 76, borderRadius: 10, backgroundColor: '#ECFDF8' },
  removeImage: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center' },
  locationButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, marginBottom: 18 },
  locationText: { flex: 1, color: '#374151', fontSize: 14 },
  declarationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 3, marginBottom: 16 },
  declarationText: { flex: 1, color: '#4B5563', fontSize: 13, lineHeight: 19 },
  declarationLink: { color: '#008F79', fontWeight: '700' },
  publishButton: { height: 54, borderRadius: 14, backgroundColor: '#00C9A7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  disabled: { opacity: 0.65 },
  publishText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default CreateMarketplaceProductScreen;
