import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { listMarketplaceProducts, MarketplaceProduct } from '../../apis/marketplace';
import { acceptMarketplaceTerms, getLegalConsent } from '../../apis/auth';
import { MARKETPLACE_TERMS_VERSION, MARKETPLACE_TERMS } from '../../legal/LegalTexts';

const MarketplaceScreen = () => {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marketTermsVisible, setMarketTermsVisible] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await listMarketplaceProducts();
      if (!response.result) throw new Error('No se pudieron cargar los productos');
      setProducts(response.content);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los productos');
    } finally {
      setLoading(false);
    }
  }, []);

  const checkTermsAndLoad = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const consent = await getLegalConsent();
      if (consent.marketplace_terms_version !== MARKETPLACE_TERMS_VERSION) {
        setMarketTermsVisible(true);
        setLoading(false);
        return;
      }
      setMarketTermsVisible(false);
      await loadProducts();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo verificar la aceptación del Mercado');
      setLoading(false);
    }
  }, [loadProducts]);

  useFocusEffect(useCallback(() => {
    void checkTermsAndLoad();
  }, [checkTermsAndLoad]));

  const acceptTerms = async () => {
    if (!termsChecked || acceptingTerms) return;
    setAcceptingTerms(true);
    try {
      const response = await acceptMarketplaceTerms();
      if (!response.result) throw new Error(response.error?.[0] || 'No se pudo registrar la aceptación');
      setMarketTermsVisible(false);
      await loadProducts();
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'No se pudo aceptar los términos');
    } finally {
      setAcceptingTerms(false);
    }
  };

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleProducts = products.filter((product) =>
    `${product.title} ${product.description} ${product.seller?.username || product.seller?.userlogin || ''}`
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );

  const renderProduct = ({ item }: { item: MarketplaceProduct }) => (
    <TouchableOpacity
      style={styles.productCard}
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: '/marketplace/product/[id]', params: { id: item.id } })}
    >
      {(item.image_urls?.[0] || item.image_url) ? (
        <Image source={{ uri: item.image_urls?.[0] || item.image_url! }} style={styles.productImage} resizeMode="cover" />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Feather name="image" size={34} color="#00C9A7" />
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.price}>${Number(item.price).toFixed(2)}</Text>
        <Text style={styles.seller}>Disponibles: {item.stock}</Text>
        <Text style={styles.seller} numberOfLines={1}>
          {item.seller?.username || item.seller?.userlogin || 'Vendedor ZAS'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.heading}>MarketPlace</Text>
          <Text style={styles.subtitle}>Encuentra algo que te guste</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.ordersButton}
            onPress={() => router.push('/marketplace/my-orders')}
            accessibilityRole="button"
            accessibilityLabel="Mis Pedidos"
          >
            <Feather name="shopping-bag" size={17} color="#008F79" />
            <Text style={styles.ordersText}>Mis Pedidos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.publishButton} onPress={() => router.push('/marketplace/create')}>
            <Feather name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.publishText}>Publicar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Feather name="search" size={19} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar productos"
          placeholderTextColor="#9CA3AF"
          returnKeyType="search"
        />
        {!!query && (
          <TouchableOpacity onPress={() => setQuery('')} accessibilityLabel="Limpiar búsqueda">
            <Feather name="x-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#00C9A7" /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={36} color="#FF6B6B" />
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity onPress={() => void checkTermsAndLoad()} style={styles.retryButton}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visibleProducts}
          keyExtractor={(item) => item.id}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          refreshing={loading}
          onRefresh={() => void checkTermsAndLoad()}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Feather name="shopping-bag" size={40} color="#00C9A7" />
              <Text style={styles.emptyText}>
                {normalizedQuery ? 'No encontramos productos con esa búsqueda.' : 'Todavía no hay productos disponibles.'}
              </Text>
            </View>
          }
        />
      )}
      <Modal visible={marketTermsVisible} animationType="slide" onRequestClose={() => {}}>
        <View style={styles.termsScreen}>
          <Text style={styles.termsTitle}>Términos del Mercado</Text>
          <Text style={styles.termsVersion}>Versión {MARKETPLACE_TERMS_VERSION}</Text>
          <ScrollView style={styles.termsScroll} contentContainerStyle={styles.termsContent}>
            <Text style={styles.termsBody}>{MARKETPLACE_TERMS.trim()}</Text>
          </ScrollView>
          <TouchableOpacity
            style={styles.termsCheck}
            onPress={() => setTermsChecked((checked) => !checked)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: termsChecked }}
          >
            <Feather name={termsChecked ? 'check-square' : 'square'} size={21} color={termsChecked ? '#00C9A7' : '#6B7280'} />
            <Text style={styles.termsCheckText}>He leído y acepto los Términos del Mercado.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.termsButton, (!termsChecked || acceptingTerms) && styles.disabled]} onPress={() => void acceptTerms()} disabled={!termsChecked || acceptingTerms}>
            {acceptingTerms ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.termsButtonText}>Aceptar y entrar</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F9FAFB', paddingTop: 56 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, paddingHorizontal: 18, marginBottom: 18 },
  headerTitleContainer: { flex: 1, minWidth: 130 },
  headerActions: { flexDirection: 'column', alignItems: 'stretch', gap: 7 },
  heading: { color: '#1F2937', fontSize: 27, fontWeight: '800' },
  subtitle: { color: '#6B7280', fontSize: 14, marginTop: 3 },
  publishButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#00C9A7', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  publishText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  ordersButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: '#B7F0E2', backgroundColor: '#ECFDF8', paddingHorizontal: 11, paddingVertical: 10, borderRadius: 12 },
  ordersText: { color: '#008F79', fontWeight: '700', fontSize: 12 },
  searchBox: { height: 48, marginHorizontal: 18, marginBottom: 16, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, color: '#1F2937', fontSize: 15 },
  grid: { paddingHorizontal: 12, paddingBottom: 32, flexGrow: 1 },
  gridRow: { gap: 10 },
  productCard: { flex: 1, marginHorizontal: 5, marginBottom: 12, backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB', elevation: 2 },
  productImage: { width: '100%', height: 145, backgroundColor: '#ECFDF8' },
  imagePlaceholder: { width: '100%', height: 145, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF8' },
  productInfo: { padding: 11 },
  productTitle: { color: '#1F2937', fontSize: 14, fontWeight: '600', minHeight: 38 },
  price: { color: '#00A98E', fontSize: 19, fontWeight: '800', marginTop: 7 },
  seller: { color: '#6B7280', fontSize: 12, marginTop: 5 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  emptyText: { color: '#6B7280', textAlign: 'center', fontSize: 15 },
  retryButton: { backgroundColor: '#00C9A7', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  termsScreen: { flex: 1, backgroundColor: '#F8FAFC', padding: 22, paddingTop: 58 },
  termsTitle: { color: '#1F2937', fontSize: 25, fontWeight: '800' },
  termsVersion: { color: '#9CA3AF', fontSize: 12, marginTop: 4, marginBottom: 15 },
  termsScroll: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  termsContent: { padding: 16 },
  termsBody: { color: '#374151', fontSize: 14, lineHeight: 22 },
  termsCheck: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  termsCheckText: { color: '#374151', fontSize: 14, flex: 1 },
  termsButton: { minHeight: 52, backgroundColor: '#00C9A7', alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  termsButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});

export default MarketplaceScreen;
