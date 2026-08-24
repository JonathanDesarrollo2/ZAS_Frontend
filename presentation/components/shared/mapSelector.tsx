import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, TextInput, FlatList,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import { reverseGeocode, getPlaceDetails } from '../../../utils/geocoding';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCQQVLprlkXfH6sdrNv0VlVSkEN_2_M-eE';

interface MapSelectorProps {
  visible: boolean;
  initialCoords: { lat: number; lng: number };
  onConfirm: (address: string, lat: number, lng: number) => void;
  onCancel: () => void;
}

const MapSelector: React.FC<MapSelectorProps> = ({ visible, initialCoords, onConfirm, onCancel }) => {
  const webViewRef = useRef<WebView>(null);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [selectedCoords, setSelectedCoords] = useState(initialCoords);
  const [searchQuery, setSearchQuery] = useState('');
  const [mapSuggestions, setMapSuggestions] = useState<{ description: string; placeId: string }[]>([]);
  const [showMapSuggestions, setShowMapSuggestions] = useState(false);

  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        html, body, #map { height: 100%; margin: 0; padding: 0; }
        .pin { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -100%); z-index: 1000; pointer-events: none; }
        .pin::after { content: '📍'; font-size: 36px; }
      </style>
    </head>
    <body>
      <div class="pin"></div>
      <div id="map"></div>
      <script>
        let map;
        function initMap() {
          const center = { lat: ${initialCoords.lat}, lng: ${initialCoords.lng} };
          map = new google.maps.Map(document.getElementById('map'), {
            zoom: 15,
            center: center,
            disableDefaultUI: true,
            zoomControl: false,
            gestureHandling: 'greedy',
          });
          map.addListener('idle', () => {
            const c = map.getCenter();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'mapIdle',
              lat: c.lat(),
              lng: c.lng(),
            }));
          });
          map.addListener('click', (e) => {
            map.panTo(e.latLng);
          });
        }
        function goToLocation(lat, lng) {
          map.panTo({ lat, lng });
          setTimeout(() => {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'mapIdle',
              lat: lat,
              lng: lng,
            }));
          }, 500);
        }
      </script>
      <script async defer src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap"></script>
    </body>
    </html>
  `;

  useEffect(() => {
    reverseGeocode(selectedCoords.lat, selectedCoords.lng).then(addr => setSelectedAddress(addr));
  }, [selectedCoords]);

  const handleMessage = (event: WebViewMessageEvent) => {
    const data = JSON.parse(event.nativeEvent.data);
    if (data.type === 'mapIdle') {
      setSelectedCoords({ lat: data.lat, lng: data.lng });
    }
  };

  const fetchMapSuggestions = async (input: string) => {
    if (input.length < 3) {
      setMapSuggestions([]);
      return;
    }
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_MAPS_API_KEY}&language=es&components=country:ve`
      );
      const json = await res.json();
      if (json.status === 'OK') {
        setMapSuggestions(json.predictions.map((p: any) => ({ description: p.description, placeId: p.place_id })));
        setShowMapSuggestions(true);
      }
    } catch (e) {}
  };

  const selectMapSuggestion = async (placeId: string) => {
    const coords = await getPlaceDetails(placeId);
    if (coords) {
      webViewRef.current?.injectJavaScript(`goToLocation(${coords.lat}, ${coords.lng});`);
      setShowMapSuggestions(false);
      setSearchQuery('');
    }
  };

  const handleConfirm = () => {
    onConfirm(selectedAddress, selectedCoords.lat, selectedCoords.lng);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.mapScreen}>
        <WebView
          ref={webViewRef}
          style={styles.mapFull}
          source={{ html: mapHTML }}
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleMessage}
        />
        <View style={styles.mapOverlay}>
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={onCancel}>
              <Feather name="arrow-left" size={24} color="#333" />
            </TouchableOpacity>
            <View style={styles.mapSearchContainer}>
              <Feather name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.mapSearchInput}
                placeholder="Buscar ubicación"
                value={searchQuery}
                onChangeText={(t) => { setSearchQuery(t); fetchMapSuggestions(t); }}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
          {showMapSuggestions && mapSuggestions.length > 0 && (
            <FlatList
              style={styles.mapSuggestions}
              data={mapSuggestions}
              keyExtractor={(item) => item.placeId}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.mapSuggestionItem} onPress={() => selectMapSuggestion(item.placeId)}>
                  <Feather name="map-pin" size={16} color="#6B7280" style={{ marginRight: 8 }} />
                  <Text style={styles.mapSuggestionText}>{item.description}</Text>
                </TouchableOpacity>
              )}
            />
          )}
          <View style={styles.addressBox}>
            <Text style={styles.addressText} numberOfLines={2}>{selectedAddress}</Text>
          </View>
          <TouchableOpacity style={styles.mapConfirmBtn} onPress={handleConfirm}>
            <Text style={styles.mapConfirmText}>Confirmar ubicación</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  mapScreen: { flex: 1 },
  mapFull: { flex: 1 },
  mapOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 10,
  },
  mapHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  mapSearchContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, height: 44, marginLeft: 12,
  },
  mapSearchInput: { flex: 1, fontSize: 16, color: '#1F2937' },
  mapSuggestions: { backgroundColor: '#FFF', borderRadius: 10, marginBottom: 10, maxHeight: 150 },
  mapSuggestionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  mapSuggestionText: { fontSize: 15, color: '#374151' },
  addressBox: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 12, marginBottom: 20 },
  addressText: { fontSize: 16, color: '#1F2937' },
  mapConfirmBtn: { backgroundColor: '#00C9A7', borderRadius: 14, padding: 16, alignItems: 'center' },
  mapConfirmText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});

export default MapSelector;