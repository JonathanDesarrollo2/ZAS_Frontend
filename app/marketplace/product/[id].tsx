import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Dimensions, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import MapSelector from '../../../presentation/components/shared/mapSelector';
import { createMarketplaceOrder, getMarketplaceProduct, MarketplaceProduct } from '../../../apis/marketplace';
import ReportModal from '../../../components/ReportModal';

const GALLERY_WIDTH = Dimensions.get('window').width - 40;

const ProductDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<MarketplaceProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let mounted = true;
    if (!id) {
      return;
    }
    getMarketplaceProduct(id)
      .then((response) => {
        if (!response.result) throw new Error('No se pudo cargar el producto');
        if (mounted) setProduct(response.content);
      })
      .catch((error: unknown) => {
        if (mounted) Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo cargar el producto');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [id]);

  const createOrderAndOpenChat = async (dropoff: { address: string; lat: number; lng: number }) => {
    if (!product) return;
    setBuying(true);
    try {
      const response = await createMarketplaceOrder({ product_id: product.id, quantity, dropoff });
      if (!response.result) throw new Error('No se pudo crear la orden');
      setMapVisible(false);
      router.push({
        pathname: '/marketplace/chat/[orderId]',
        params: {
          orderId: response.content.id,
          chatWith: product.seller?.username || product.seller?.userlogin || 'Vendedor',
        },
      });
    } catch (error) {
      Alert.alert('No se pudo iniciar la compra', error instanceof Error ? error.message : 'Intenta nuevamente.');
    } finally {
      setBuying(false);
    }
  };

  if (!id) {
    return <View style={styles.centered}><Text style={styles.errorText}>Producto no válido.</Text></View>;
  }
  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#00C9A7" /></View>;
  }
  if (!product) {
    return <View style={styles.centered}><Text style={styles.errorText}>Producto no disponible.</Text></View>;
  }

  const sellerName = product.seller?.username || product.seller?.userlogin || 'Vendedor ZAS';
  const productImages = product.image_urls?.length
    ? product.image_urls
    : product.image_url
      ? [product.image_url]
      : [];
  const initialCoords = {
    lat: Number(product.pickup_lat) || 10.071866,
    lng: Number(product.pickup_lng) || -66.869583,
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {productImages.length > 0 ? (
          <FlatList
            horizontal
            pagingEnabled
            data={productImages}
            keyExtractor={(imageUrl, index) => `${imageUrl}-${index}`}
            showsHorizontalScrollIndicator={productImages.length > 1}
            style={styles.imageGallery}
            getItemLayout={(_, index) => ({ length: GALLERY_WIDTH, offset: GALLERY_WIDTH * index, index })}
            renderItem={({ item: imageUrl }) => (
              <Image source={{ uri: imageUrl }} style={styles.galleryImage} resizeMode="cover" />
            )}
          />
        ) : (
          <View style={[styles.image, styles.placeholder]}><Feather name="image" size={52} color="#00C9A7" /></View>
        )}
        <Text style={styles.title}>{product.title}</Text>
        <Text style={styles.price}>${Number(product.price).toFixed(2)}</Text>
        <Text style={styles.stock}>Disponibles: {product.stock}</Text>
        <View style={styles.quantityRow}>
          <Text style={styles.quantityLabel}>Cantidad</Text>
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => setQuantity((current) => Math.max(1, current - 1))}
              disabled={quantity <= 1}
              accessibilityLabel="Reducir cantidad"
            >
              <Feather name="minus" size={17} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.quantityValue}>{quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => setQuantity((current) => Math.min(Number(product.stock) || 1, current + 1))}
              disabled={quantity >= Number(product.stock)}
              accessibilityLabel="Aumentar cantidad"
            >
              <Feather name="plus" size={17} color="#1F2937" />
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={styles.sellerCard}
          onPress={() => {
            const sellerId = product.seller?.id || product.seller_id;
            if (sellerId) router.push({ pathname: '/profile/[userId]', params: { userId: sellerId } });
          }}
          accessibilityRole="button"
        >
          <Feather name="user" size={19} color="#00C9A7" />
          <View style={{ flex: 1 }}>
            <Text style={styles.sellerLabel}>Vendido por</Text>
            <Text style={styles.sellerName}>{sellerName}</Text>
          </View>
          <Text style={styles.sellerProfileLink}>Ver perfil</Text>
        </TouchableOpacity>
        <Text style={styles.sectionTitle}>Descripción</Text>
        <Text style={styles.description}>{product.description}</Text>
        <TouchableOpacity style={styles.reportButton} onPress={() => setReportVisible(true)}>
          <Feather name="flag" size={15} color="#6B7280" />
          <Text style={styles.reportText}>Reportar producto</Text>
        </TouchableOpacity>
        <View style={styles.pickup}>
          <Feather name="map-pin" size={17} color="#00C9A7" />
          <Text style={styles.pickupText}>Recogida: {product.pickup_address}</Text>
        </View>
        <TouchableOpacity
          style={[styles.buyButton, buying && styles.disabled]}
          onPress={() => setMapVisible(true)}
          disabled={buying || Number(product.stock) < 1}
        >
          {buying ? <ActivityIndicator color="#FFFFFF" /> : <><Feather name="message-circle" size={19} color="#FFFFFF" /><Text style={styles.buyText}>Comprar y hablar con vendedor</Text></>}
        </TouchableOpacity>
      </ScrollView>
      <MapSelector
        visible={mapVisible}
        initialCoords={initialCoords}
        onConfirm={(address, lat, lng) => void createOrderAndOpenChat({ address, lat, lng })}
        onCancel={() => setMapVisible(false)}
      />
      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        productId={product.id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 20, paddingTop: 58, paddingBottom: 36 },
  image: { width: '100%', height: 260, borderRadius: 18, backgroundColor: '#ECFDF8' },
  imageGallery: { width: '100%', height: 260, borderRadius: 18 },
  galleryImage: { width: GALLERY_WIDTH, height: 260, borderRadius: 18, backgroundColor: '#ECFDF8' },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  title: { color: '#1F2937', fontSize: 25, fontWeight: '800', marginTop: 20 },
  price: { color: '#00A98E', fontSize: 29, fontWeight: '800', marginTop: 8 },
  stock: { color: '#6B7280', fontSize: 13, fontWeight: '600', marginTop: 4 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingVertical: 10 },
  quantityLabel: { color: '#374151', fontWeight: '700', fontSize: 14 },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  quantityButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  quantityValue: { color: '#1F2937', fontWeight: '800', fontSize: 16, minWidth: 20, textAlign: 'center' },
  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, marginTop: 18 },
  sellerLabel: { color: '#6B7280', fontSize: 12 },
  sellerName: { color: '#1F2937', fontSize: 15, fontWeight: '700', marginTop: 2 },
  sellerProfileLink: { color: '#008F79', fontSize: 13, fontWeight: '700' },
  sectionTitle: { color: '#1F2937', fontSize: 17, fontWeight: '700', marginTop: 22, marginBottom: 7 },
  description: { color: '#4B5563', fontSize: 15, lineHeight: 22 },
  reportButton: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 },
  reportText: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  pickup: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 20 },
  pickupText: { flex: 1, color: '#4B5563', fontSize: 14, lineHeight: 20 },
  buyButton: { minHeight: 54, backgroundColor: '#00C9A7', borderRadius: 14, marginTop: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 12 },
  buyText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.65 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 24 },
  errorText: { color: '#6B7280', fontSize: 16 },
});

export default ProductDetailScreen;
