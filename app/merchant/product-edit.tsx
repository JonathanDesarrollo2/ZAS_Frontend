import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  Category,
  createOption,
  createOptionGroup,
  createProduct,
  deleteOption,
  deleteOptionGroup,
  deleteProduct,
  getCategories,
  getProducts,
  OptionGroup,
  Product,
  ProductOption,
  updateOption,
  updateOptionGroup,
  updateProduct,
} from '../../apis/restaurant';
import { router, useLocalSearchParams } from 'expo-router';

type ConfigModal = { type: 'group'; groupId?: string } | { type: 'option'; groupId: string; optionId?: string };

const ProductEditScreen = () => {
  const { categoryId, categoryName, productId } = useLocalSearchParams<{
    categoryId?: string;
    categoryName?: string;
    productId?: string;
  }>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [currentImage, setCurrentImage] = useState<string | undefined>();
  const [imageFailed, setImageFailed] = useState(false);
  const [active, setActive] = useState(true);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(Boolean(productId));
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(categoryId || '');
  const [selectedCategoryName, setSelectedCategoryName] = useState(categoryName || '');
  const [loadingCategories, setLoadingCategories] = useState(!categoryId && !productId);
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [configModal, setConfigModal] = useState<ConfigModal | null>(null);
  const [configName, setConfigName] = useState('');
  const [extraPrice, setExtraPrice] = useState('0');
  const [required, setRequired] = useState(false);
  const [minSelect, setMinSelect] = useState('0');
  const [maxSelect, setMaxSelect] = useState('1');
  const [savingConfig, setSavingConfig] = useState(false);

  const reloadProduct = useCallback(async () => {
    if (!productId) return;
    const products = await getProducts();
    const product = products.find((item) => item.id === productId);
    if (!product) throw new Error('No se encontró el producto en tu restaurante');
    setName(product.name);
    setDescription(product.description || '');
    setPrice(String(product.price));
    setCurrentImage(product.image);
    setImageFailed(false);
    setActive(product.active);
    setSelectedCategoryId(product.category_id);
    setSelectedCategoryName(product.category?.name || '');
    setOptionGroups(product.optionGroups || []);
  }, [productId]);

  useEffect(() => {
    if (categoryId) setSelectedCategoryId(categoryId);
    if (categoryName) setSelectedCategoryName(categoryName);
    if (productId) {
      reloadProduct()
        .catch((error: unknown) => {
          Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo cargar el producto');
        })
        .finally(() => setLoadingProduct(false));
      return;
    }

    getCategories()
      .then(setCategories)
      .catch((error: unknown) => {
        Alert.alert('Error', error instanceof Error ? error.message : 'No se pudieron cargar las categorías');
      })
      .finally(() => setLoadingCategories(false));
  }, [categoryId, productId, reloadProduct]);

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Se necesita acceso a la galería para elegir una fotografía.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets.length > 0) {
        setImage(result.assets[0]);
        setImageFailed(false);
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo abrir la galería');
    }
  };

  const handleSave = async () => {
    const parsedPrice = Number(price);
    if (!name.trim() || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      Alert.alert('Campos requeridos', 'Ingresa un nombre y un precio válido.');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        description: description.trim(),
        price: parsedPrice,
        active,
        imageFile: image
          ? {
              uri: image.uri,
              type: image.mimeType || 'image/jpeg',
              name: image.fileName || 'product.jpg',
            }
          : undefined,
      };

      if (productId) {
        await updateProduct(productId, data);
        Alert.alert('Guardado', 'Producto actualizado.');
      } else if (selectedCategoryId) {
        await createProduct(selectedCategoryId, data);
        Alert.alert('Guardado', 'Producto creado.');
      } else {
        throw new Error('Selecciona una categoría para el producto');
      }

      if (router.canGoBack()) router.back();
      else {
        router.replace({
          pathname: '/merchant/products',
          params: { categoryId: selectedCategoryId, categoryName: selectedCategoryName },
        });
      }
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo guardar el producto');
    } finally {
      setSaving(false);
    }
  };

  const toggleProductActive = async (nextActive: boolean) => {
    if (!productId) {
      setActive(nextActive);
      return;
    }
    if (updatingAvailability) return;
    setUpdatingAvailability(true);
    try {
      await updateProduct(productId, { active: nextActive });
      setActive(nextActive);
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo actualizar la disponibilidad');
    } finally {
      setUpdatingAvailability(false);
    }
  };

  const confirmDeleteProduct = () => {
    if (!productId) return;
    Alert.alert('Eliminar producto', `¿Quieres eliminar "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProduct(productId);
            if (router.canGoBack()) router.back();
            else router.replace('/merchant/categories');
          } catch (error: unknown) {
            Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo eliminar el producto');
          }
        },
      },
    ]);
  };

  const openGroupModal = (group?: OptionGroup) => {
    setConfigModal({ type: 'group', groupId: group?.id });
    setConfigName(group?.name || '');
    setRequired(group?.required || false);
    setMinSelect(String(group?.min_select ?? 0));
    setMaxSelect(String(group?.max_select ?? 1));
  };

  const openOptionModal = (groupId: string, option?: ProductOption) => {
    setConfigModal({ type: 'option', groupId, optionId: option?.id });
    setConfigName(option?.name || '');
    setExtraPrice(String(option?.extra_price ?? 0));
  };

  const saveConfiguration = async () => {
    if (!configModal || !configName.trim()) {
      Alert.alert('Campo requerido', 'Escribe un nombre.');
      return;
    }
    setSavingConfig(true);
    try {
      if (configModal.type === 'group') {
        const min = Number(minSelect);
        const max = Number(maxSelect);
        if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 1 || min > max) {
          throw new Error('Revisa la cantidad mínima y máxima de opciones.');
        }
        const data = { name: configName.trim(), required, min_select: min, max_select: max };
        if (configModal.groupId) await updateOptionGroup(configModal.groupId, data);
        else if (productId) await createOptionGroup(productId, data);
        else throw new Error('Guarda el producto antes de crear grupos de opciones.');
      } else {
        const parsedExtra = Number(extraPrice);
        if (!Number.isFinite(parsedExtra) || parsedExtra < 0) {
          throw new Error('El precio adicional debe ser un monto válido igual o mayor que cero.');
        }
        const data = { name: configName.trim(), extra_price: parsedExtra };
        if (configModal.optionId) await updateOption(configModal.optionId, data);
        else await createOption(configModal.groupId, data);
      }
      setConfigModal(null);
      await reloadProduct();
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo guardar el grupo u opción');
    } finally {
      setSavingConfig(false);
    }
  };

  const confirmDeleteGroup = (group: OptionGroup) => {
    Alert.alert('Eliminar grupo', `Se eliminará "${group.name}" y sus opciones.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteOptionGroup(group.id);
            await reloadProduct();
          } catch (error: unknown) {
            Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo eliminar el grupo');
          }
        },
      },
    ]);
  };

  const confirmDeleteOption = (option: ProductOption) => {
    Alert.alert('Eliminar opción', `¿Quieres eliminar "${option.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteOption(option.id);
            await reloadProduct();
          } catch (error: unknown) {
            Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo eliminar la opción');
          }
        },
      },
    ]);
  };

  const toggleOptionActive = async (option: ProductOption) => {
    try {
      await updateOption(option.id, { active: !option.active });
      await reloadProduct();
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo actualizar la opción');
    }
  };

  if (loadingProduct) {
    return <ActivityIndicator size="large" color="#00C9A7" style={styles.loader} />;
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{productId ? 'Editar producto' : 'Nuevo producto'}</Text>
        {!!selectedCategoryName && <Text style={styles.categoryLabel}>Categoría: {selectedCategoryName}</Text>}

        {!productId && !categoryId && (
          <>
            <Text style={styles.label}>Categoría</Text>
            {loadingCategories ? (
              <ActivityIndicator color="#00C9A7" style={styles.categoryLoading} />
            ) : categories.length === 0 ? (
              <Text style={styles.noCategories}>Primero crea una categoría para poder agregar productos.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categories}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[styles.categoryOption, selectedCategoryId === category.id && styles.selectedCategory]}
                    onPress={() => {
                      setSelectedCategoryId(category.id);
                      setSelectedCategoryName(category.name);
                    }}
                  >
                    <Text style={[styles.categoryText, selectedCategoryId === category.id && styles.selectedCategoryText]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </>
        )}

        <Text style={styles.label}>Nombre</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nombre del producto" maxLength={150} />

        <Text style={styles.label}>Descripción</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Descripción"
          multiline
        />

        <Text style={styles.label}>Precio</Text>
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        {productId && (
          <View style={styles.availabilityRow}>
            <View>
              <Text style={styles.label}>Disponible para la venta</Text>
              <Text style={styles.helperText}>{active ? 'Visible en el menú público' : 'Oculto del menú público'}</Text>
            </View>
            <Switch
              value={active}
              onValueChange={toggleProductActive}
              disabled={updatingAvailability}
              trackColor={{ true: '#00C9A7' }}
            />
          </View>
        )}

        <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
          <Feather name="image" size={18} color="#00C9A7" style={styles.imageIcon} />
          <Text style={styles.imagePickerText}>
            {image ? 'Cambiar imagen seleccionada' : currentImage ? 'Reemplazar fotografía' : 'Seleccionar fotografía'}
          </Text>
        </TouchableOpacity>
        {(image || currentImage) && !imageFailed && (
          <Image
            source={{ uri: image?.uri || currentImage }}
            style={styles.imagePreview}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        )}
        {imageFailed && (
          <Text style={styles.imageError}>No se pudo cargar la imagen actual. Puedes seleccionar otra fotografía.</Text>
        )}

        {productId && (
          <View style={styles.optionsSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleBlock}>
                <Text style={styles.sectionTitle}>Grupos y adicionales</Text>
                <Text style={styles.helperText}>Configura extras y sus precios adicionales.</Text>
              </View>
              <TouchableOpacity accessibilityLabel="Agregar grupo" style={styles.smallAddButton} onPress={() => openGroupModal()}>
                <Feather name="plus" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {optionGroups.length === 0 ? (
              <Text style={styles.noOptions}>Este producto todavía no tiene grupos de opciones.</Text>
            ) : optionGroups.map((group) => (
              <View key={group.id} style={styles.groupCard}>
                <View style={styles.groupHeading}>
                  <View style={styles.groupText}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <Text style={styles.helperText}>
                      {group.required ? 'Obligatorio' : 'Opcional'} · mínimo {group.min_select} · máximo {group.max_select}
                    </Text>
                  </View>
                  <TouchableOpacity accessibilityLabel={`Editar grupo ${group.name}`} onPress={() => openGroupModal(group)} style={styles.iconButton}>
                    <Feather name="edit-2" size={16} color="#008F76" />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityLabel={`Eliminar grupo ${group.name}`} onPress={() => confirmDeleteGroup(group)} style={styles.iconButton}>
                    <Feather name="trash-2" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
                {(group.options || []).map((option) => (
                  <View key={option.id} style={styles.optionRow}>
                    <View style={styles.optionInfo}>
                      <Text style={[styles.optionName, !option.active && styles.inactiveText]}>{option.name}</Text>
                      <Text style={styles.optionPrice}>+${Number(option.extra_price).toFixed(2)}</Text>
                    </View>
                    <TouchableOpacity
                      accessibilityLabel={`${option.active ? 'Desactivar' : 'Activar'} ${option.name}`}
                      onPress={() => toggleOptionActive(option)}
                      style={styles.iconButton}
                    >
                      <Feather name={option.active ? 'eye' : 'eye-off'} size={16} color={option.active ? '#008F76' : '#9CA3AF'} />
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityLabel={`Editar ${option.name}`} onPress={() => openOptionModal(group.id, option)} style={styles.iconButton}>
                      <Feather name="edit-2" size={16} color="#008F76" />
                    </TouchableOpacity>
                    <TouchableOpacity accessibilityLabel={`Eliminar ${option.name}`} onPress={() => confirmDeleteOption(option)} style={styles.iconButton}>
                      <Feather name="trash-2" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addOptionButton} onPress={() => openOptionModal(group.id)}>
                  <Feather name="plus" size={15} color="#008F76" />
                  <Text style={styles.addOptionText}>Agregar opción</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={[styles.saveButton, saving && styles.disabledButton]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Guardar producto</Text>}
        </TouchableOpacity>
        {productId && (
          <TouchableOpacity style={styles.deleteProductButton} onPress={confirmDeleteProduct}>
            <Feather name="trash-2" size={16} color="#DC2626" />
            <Text style={styles.deleteProductText}>Eliminar producto</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal
        visible={configModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfigModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {configModal?.type === 'group' ? (configModal.groupId ? 'Editar grupo' : 'Nuevo grupo') :
                (configModal && configModal.type === 'option' && configModal.optionId ? 'Editar opción' : 'Nueva opción')}
            </Text>
            <Text style={styles.label}>{configModal?.type === 'group' ? 'Nombre del grupo' : 'Nombre de la opción'}</Text>
            <TextInput value={configName} onChangeText={setConfigName} style={styles.input} placeholder="Ej. Extras" maxLength={100} />
            {configModal?.type === 'group' ? (
              <>
                <View style={styles.modalSwitchRow}>
                  <Text style={styles.label}>Selección obligatoria</Text>
                  <Switch value={required} onValueChange={setRequired} trackColor={{ true: '#00C9A7' }} />
                </View>
                <Text style={styles.label}>Mínimo de selecciones</Text>
                <TextInput value={minSelect} onChangeText={setMinSelect} style={styles.input} keyboardType="number-pad" />
                <Text style={styles.label}>Máximo de selecciones</Text>
                <TextInput value={maxSelect} onChangeText={setMaxSelect} style={styles.input} keyboardType="number-pad" />
              </>
            ) : (
              <>
                <Text style={styles.label}>Precio adicional</Text>
                <TextInput value={extraPrice} onChangeText={setExtraPrice} style={styles.input} keyboardType="decimal-pad" placeholder="0.00" />
              </>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setConfigModal(null)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveConfigButton} onPress={saveConfiguration} disabled={savingConfig}>
                {savingConfig ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F0FDF9' },
  loader: { flex: 1, backgroundColor: '#F0FDF9' },
  container: { padding: 20, paddingTop: 22, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  categoryLabel: { color: '#008F76', fontWeight: '700', marginBottom: 20 },
  categoryLoading: { marginBottom: 16 },
  categories: { paddingBottom: 16, gap: 8 },
  categoryOption: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  selectedCategory: { backgroundColor: '#00C9A7', borderColor: '#00C9A7' },
  categoryText: { color: '#374151', fontWeight: '600' },
  selectedCategoryText: { color: '#FFFFFF' },
  noCategories: { color: '#6B7280', marginBottom: 16 },
  label: { fontWeight: '600', color: '#374151', marginBottom: 8, fontSize: 15 },
  input: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB', color: '#1F2937' },
  textArea: { height: 80, textAlignVertical: 'top' },
  availabilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  helperText: { color: '#6B7280', fontSize: 12, marginTop: 3 },
  imagePicker: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E6FFFA', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#00C9A7' },
  imageIcon: { marginRight: 8 },
  imagePickerText: { color: '#008F76', fontWeight: '600' },
  imagePreview: { width: '100%', height: 200, borderRadius: 14, backgroundColor: '#E5E7EB', marginBottom: 16 },
  imageError: { color: '#B45309', marginBottom: 16 },
  optionsSection: { marginTop: 12, marginBottom: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 },
  sectionTitleBlock: { flex: 1 },
  sectionTitle: { color: '#1F2937', fontSize: 19, fontWeight: '800' },
  smallAddButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#00C9A7', alignItems: 'center', justifyContent: 'center' },
  noOptions: { color: '#6B7280', backgroundColor: '#FFFFFF', borderRadius: 13, padding: 14 },
  groupCard: { backgroundColor: '#FFFFFF', borderRadius: 15, padding: 13, borderWidth: 1, borderColor: '#E5F5F0', marginBottom: 10 },
  groupHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  groupText: { flex: 1 },
  groupName: { color: '#1F2937', fontSize: 15, fontWeight: '800' },
  iconButton: { width: 32, height: 34, alignItems: 'center', justifyContent: 'center' },
  optionRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 7, marginTop: 7 },
  optionInfo: { flex: 1 },
  optionName: { color: '#374151', fontWeight: '600' },
  inactiveText: { color: '#9CA3AF' },
  optionPrice: { color: '#008F76', fontSize: 12, marginTop: 2 },
  addOptionButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 10, paddingVertical: 5 },
  addOptionText: { color: '#008F76', fontWeight: '700', marginLeft: 5, fontSize: 13 },
  saveButton: { backgroundColor: '#00C9A7', borderRadius: 14, height: 52, justifyContent: 'center', alignItems: 'center' },
  disabledButton: { opacity: 0.7 },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  deleteProductButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', padding: 14, marginTop: 8 },
  deleteProductText: { color: '#DC2626', fontWeight: '700', marginLeft: 7 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(17, 24, 39, 0.42)' },
  modalCard: { maxHeight: '90%', padding: 20, borderRadius: 20, backgroundColor: '#FFFFFF' },
  modalTitle: { color: '#1F2937', fontSize: 20, fontWeight: '800', marginBottom: 17 },
  modalSwitchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  cancelButton: { borderRadius: 12, backgroundColor: '#F3F4F6', paddingHorizontal: 17, paddingVertical: 12 },
  cancelText: { color: '#4B5563', fontSize: 14, fontWeight: '700' },
  saveConfigButton: { minWidth: 90, borderRadius: 12, backgroundColor: '#00C9A7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 12 },
});

export default ProductEditScreen;
