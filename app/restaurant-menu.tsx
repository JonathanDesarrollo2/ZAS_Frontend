// LEIDO
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { apiClient } from '../apis/Client';
import { useCartStore } from '../presentation/store/cartStore';
import { CartOption } from '../presentation/store/cartStore';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number | string;
  image?: string;
  optionGroups?: OptionGroup[];
}

interface ProductOption {
  id: string;
  name: string;
  extra_price: number | string;
}

interface OptionGroup {
  id: string;
  name: string;
  required: boolean;
  min_select: number;
  max_select: number;
  options?: ProductOption[];
}

interface MenuCategory {
  id: string;
  name: string;
  products?: Product[];
}

interface RestaurantMenu {
  id: string;
  name: string;
  categories?: MenuCategory[];
}

const RestaurantMenuScreen = () => {
  const { restaurantId } = useLocalSearchParams<{ restaurantId: string }>();
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const addItem = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((state) => state.items);

  useEffect(() => {
    void loadMenu();
  }, [restaurantId]);

  const loadMenu = async () => {
    setLoading(true);
    setLoadError(null);
    setMenu(null);
    try {
      const res = await apiClient<{ result: boolean; content: RestaurantMenu; error?: string[] }>(
        `/public/restaurants/${restaurantId}`
      );
      if (!res.result || !res.content) throw new Error(res.error?.[0] || 'No se pudo cargar el menú');
      setMenu(res.content);
      setFailedImages(new Set());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'No se pudo cargar el menú');
    } finally {
      setLoading(false);
    }
  };

  const getQuantityInCart = (productId: string) => {
    return cartItems
      .filter((item) => item.productId === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  const addProductToCart = (product: Product, options: CartOption[]) => {
    const basePrice = Number(product.price);
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      Alert.alert('Precio no válido', 'Actualiza el menú e inténtalo de nuevo.');
      return;
    }

    if (options.some((option) => !Number.isFinite(option.extra_price) || option.extra_price < 0)) {
      Alert.alert('Opción no válida', 'Actualiza el menú e inténtalo de nuevo.');
      return;
    }
    const extraPrice = options.reduce((sum, option) => sum + option.extra_price, 0);
    const addResult = addItem({
      productId: product.id,
      product_name: product.name,
      base_price: basePrice,
      price: Number((basePrice + extraPrice).toFixed(2)),
      quantity: 1,
      restaurant_id: restaurantId!,
      options,
    });

    if (addResult === 'different_restaurant') {
      Alert.alert('Un solo restaurante por pedido', 'Vacía el carrito antes de agregar productos de otro restaurante.');
      return;
    }
    if (addResult === 'quantity_limit') {
      Alert.alert('Límite alcanzado', 'Puedes agregar hasta 99 unidades de cada variante al pedido.');
      return;
    }
    setSelectedProduct(null);
    setSelectedOptions({});
  };

  const openProduct = (product: Product) => {
    if (product.optionGroups?.length) {
      setSelectedProduct(product);
      setSelectedOptions({});
    } else {
      addProductToCart(product, []);
    }
  };

  const toggleOption = (group: OptionGroup, optionId: string) => {
    const selected = selectedOptions[group.id] || [];
    if (selected.includes(optionId)) {
      setSelectedOptions((current) => ({
        ...current,
        [group.id]: selected.filter((id) => id !== optionId),
      }));
      return;
    }
    if (selected.length >= group.max_select) {
      Alert.alert('Límite alcanzado', `Puedes elegir hasta ${group.max_select} opción(es) en "${group.name}".`);
      return;
    }
    setSelectedOptions((current) => ({ ...current, [group.id]: [...selected, optionId] }));
  };

  const selectedProductOptions = selectedProduct?.optionGroups || [];
  const selectionIsValid = selectedProductOptions.every((group) => {
    const count = (selectedOptions[group.id] || []).length;
    const minimum = Math.max(group.required ? 1 : 0, group.min_select);
    return count >= minimum && count <= group.max_select;
  });

  const addSelectedProduct = () => {
    if (!selectedProduct || !selectionIsValid) return;
    const options = selectedProductOptions.flatMap((group) =>
      (selectedOptions[group.id] || []).flatMap((optionId) => {
        const option = group.options?.find((item) => item.id === optionId);
        if (!option) return [];
        return [{
          id: option.id,
          group_id: group.id,
          group_name: group.name,
          name: option.name,
          extra_price: Number(option.extra_price),
        }];
      })
    );
    addProductToCart(selectedProduct, options);
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#00C9A7" style={{ flex: 1, justifyContent: 'center' }} />;
  }

  if (!menu) {
    return (
      <View style={styles.stateScreen}>
        <Feather name="alert-circle" size={32} color="#B42318" />
        <Text style={styles.stateText}>{loadError || 'No se pudo cargar el menú.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void loadMenu()}>
          <Text style={styles.retryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Feather name="arrow-left" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.title}>{menu.name}</Text>
        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => router.push('/cart' as any)}
        >
          <Feather name="shopping-cart" size={22} color="#00C9A7" />
          {cartItems.length > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cartItems.reduce((sum, item) => sum + item.quantity, 0)}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={menu.categories || []}
        keyExtractor={(category) => category.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={<Text style={styles.emptyMenu}>Este restaurante todavía no tiene productos disponibles.</Text>}
        renderItem={({ item: category }) => (
          <View style={styles.categorySection}>
            <Text style={styles.categoryTitle}>{category.name}</Text>
            {category.products?.map((product) => {
              const productPrice = Number(product.price);
              return (
              <View key={product.id} style={styles.productCard}>
                {product.image && !failedImages.has(product.id) ? (
                  <Image
                    source={{ uri: product.image }}
                    style={styles.productImage}
                    onError={() => setFailedImages((previous) => new Set(previous).add(product.id))}
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Feather name="image" size={20} color="#9CA3AF" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{product.name}</Text>
                  {product.description ? (
                    <Text style={styles.productDesc}>{product.description}</Text>
                  ) : null}
                  <Text style={styles.productPrice}>
                    {Number.isFinite(productPrice) ? `$${productPrice.toFixed(2)}` : 'Precio no disponible'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.addButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Agregar ${product.name} al carrito`}
                  onPress={() => openProduct(product)}
                >
                  <Feather name="plus" size={18} color="#fff" />
                </TouchableOpacity>
                {getQuantityInCart(product.id) > 0 && (
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyText}>{getQuantityInCart(product.id)}</Text>
                  </View>
                )}
              </View>
            );})}
          </View>
        )}
      />
      <Modal
        visible={Boolean(selectedProduct)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedProduct(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.optionsModal}>
            <View style={styles.modalHeading}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedProduct?.name}</Text>
                <Text style={styles.modalBasePrice}>Precio base ${Number(selectedProduct?.price || 0).toFixed(2)}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedProduct(null)} accessibilityLabel="Cerrar opciones">
                <Feather name="x" size={23} color="#374151" />
              </TouchableOpacity>
            </View>
            {!!selectedProduct?.description && <Text style={styles.modalDescription}>{selectedProduct.description}</Text>}
            <ScrollView style={styles.optionsScroll}>
              {selectedProductOptions.map((group) => (
                <View key={group.id} style={styles.optionGroup}>
                  <Text style={styles.optionGroupTitle}>{group.name}</Text>
                  <Text style={styles.optionGroupRule}>
                    {group.required ? 'Obligatorio' : 'Opcional'} · Elige {Math.max(group.required ? 1 : 0, group.min_select)}–{group.max_select}
                  </Text>
                  {(group.options || []).map((option) => {
                    const selected = (selectedOptions[group.id] || []).includes(option.id);
                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={styles.optionRow}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        onPress={() => toggleOption(group, option.id)}
                      >
                        <Feather name={selected ? 'check-square' : 'square'} size={19} color={selected ? '#00A889' : '#9CA3AF'} />
                        <Text style={styles.optionName}>{option.name}</Text>
                        <Text style={styles.optionPrice}>+${Number(option.extra_price).toFixed(2)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            <View style={styles.modalPriceSummary}>
              <Text style={styles.modalPriceLabel}>Precio por unidad</Text>
              <Text style={styles.modalPriceValue}>
                ${(
                  Number(selectedProduct?.price || 0) +
                  selectedProductOptions.reduce((sum, group) => sum +
                    (group.options || [])
                      .filter((option) => (selectedOptions[group.id] || []).includes(option.id))
                      .reduce((optionSum, option) => optionSum + Number(option.extra_price), 0), 0)
                ).toFixed(2)}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.modalAddButton, !selectionIsValid && styles.disabledButton]}
              onPress={addSelectedProduct}
              disabled={!selectionIsValid}
            >
              <Text style={styles.modalAddText}>Agregar al carrito</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  stateScreen: { flex: 1, backgroundColor: '#F0FDF9', justifyContent: 'center', alignItems: 'center', padding: 28 },
  stateText: { color: '#4B5563', fontSize: 15, textAlign: 'center', marginTop: 12, lineHeight: 22 },
  retryButton: { backgroundColor: '#00C9A7', borderRadius: 12, paddingHorizontal: 22, paddingVertical: 12, marginTop: 16 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  emptyMenu: { color: '#6B7280', textAlign: 'center', padding: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: { fontSize: 24, fontWeight: '700', color: '#1F2937', flex: 1, textAlign: 'center' },
  cartButton: { position: 'relative', padding: 4 },
  cartBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF5252',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17, 24, 39, 0.45)' },
  optionsModal: { maxHeight: '85%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 28 },
  modalHeading: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  modalTitle: { color: '#1F2937', fontSize: 20, fontWeight: '800' },
  modalBasePrice: { color: '#00A889', fontWeight: '700', marginTop: 4 },
  modalDescription: { color: '#6B7280', fontSize: 13, lineHeight: 19, marginBottom: 8 },
  optionsScroll: { flexGrow: 0 },
  optionGroup: { borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingVertical: 12 },
  optionGroupTitle: { color: '#1F2937', fontSize: 15, fontWeight: '700' },
  optionGroupRule: { color: '#6B7280', fontSize: 12, marginTop: 3, marginBottom: 6 },
  optionRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 9 },
  optionName: { flex: 1, color: '#374151', fontSize: 14 },
  optionPrice: { color: '#374151', fontSize: 13, fontWeight: '600' },
  modalPriceSummary: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 13, marginTop: 4 },
  modalPriceLabel: { color: '#374151', fontSize: 14, fontWeight: '600' },
  modalPriceValue: { color: '#008F76', fontSize: 16, fontWeight: '800' },
  modalAddButton: { backgroundColor: '#00C9A7', minHeight: 48, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginTop: 14 },
  disabledButton: { opacity: 0.45 },
  modalAddText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  categorySection: { marginBottom: 20, paddingHorizontal: 20 },
  categoryTitle: { fontSize: 20, fontWeight: '600', color: '#1F2937', marginBottom: 10 },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  productImage: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
  imagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F7F3',
  },
  productName: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  productDesc: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  productPrice: { fontSize: 15, color: '#00C9A7', fontWeight: '700' },
  addButton: {
    backgroundColor: '#00C9A7',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBadge: {
    position: 'absolute',
    top: -6,
    right: 40,
    backgroundColor: '#FF9800',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  qtyText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});

export default RestaurantMenuScreen;