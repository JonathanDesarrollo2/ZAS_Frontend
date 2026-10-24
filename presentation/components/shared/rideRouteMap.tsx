import React, { useMemo } from 'react';
import { ActivityIndicator, NativeSyntheticEvent, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { themeColors } from '../../theme/themeColors';

export interface RideCoordinate {
  lat: number;
  lng: number;
}

export interface RideStop extends RideCoordinate {
  address: string;
}

interface RideRouteMapProps {
  origin: RideCoordinate | null;
  destination: RideCoordinate | null;
  stops?: RideStop[];
  currentLocation: RideCoordinate | null;
  onRouteDistance: (distanceKm: number) => void;
}

const GOOGLE_MAPS_API_KEY = 'AIzaSyCQQVLprlkXfH6sdrNv0VlVSkEN_2_M-eE';

const RideRouteMap: React.FC<RideRouteMapProps> = ({ origin, destination, stops = [], currentLocation, onRouteDistance }) => {
  const routeKey = origin && destination
    ? `${origin.lat}:${origin.lng}:${stops.map((stop) => `${stop.lat}:${stop.lng}`).join('|')}:${destination.lat}:${destination.lng}`
    : '';
  const html = useMemo(() => {
    const center = origin || currentLocation || destination || { lat: 10.071866, lng: -66.869583 };
    const routeStops = stops.filter((stop) =>
      Number.isFinite(stop.lat) && Number.isFinite(stop.lng)
    ).map(({ lat, lng }) => ({ lat, lng }));
    return `<!DOCTYPE html>
      <html><head><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>html,body,#map{height:100%;margin:0;padding:0}</style></head>
      <body><div id="map"></div><script>
        let map;
        function initMap() {
          const origin = ${origin ? JSON.stringify(origin) : 'null'};
          const destination = ${destination ? JSON.stringify(destination) : 'null'};
          const stops = ${JSON.stringify(routeStops)};
          const center = ${JSON.stringify(center)};
          map = new google.maps.Map(document.getElementById('map'), {
            center, zoom: 14, disableDefaultUI: true, zoomControl: true
          });
          const bounds = new google.maps.LatLngBounds();
          const markerIcon = {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#00967D',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 3
          };
          if (origin) {
            new google.maps.Marker({
              map, position: origin, title: 'Origen', icon: markerIcon,
              label: { text: 'A', color: '#FFFFFF', fontWeight: '700', fontSize: '11px' }
            });
            bounds.extend(origin);
          }
          if (destination) {
            new google.maps.Marker({
              map, position: destination, title: 'Destino', icon: markerIcon,
              label: { text: 'B', color: '#FFFFFF', fontWeight: '700', fontSize: '11px' }
            });
            bounds.extend(destination);
          }
          stops.forEach((stop, index) => {
            new google.maps.Marker({
              map, position: { lat: stop.lat, lng: stop.lng }, title: 'Parada ' + (index + 1),
              icon: markerIcon,
              label: { text: String(index + 1), color: '#FFFFFF', fontWeight: '700', fontSize: '11px' }
            });
            bounds.extend({ lat: stop.lat, lng: stop.lng });
          });
          if (origin && destination) {
            const service = new google.maps.DirectionsService();
            service.route({
              origin, destination, travelMode: 'DRIVING', provideRouteAlternatives: false,
              waypoints: stops.map((stop) => ({
                location: { lat: stop.lat, lng: stop.lng }, stopover: true
              })),
              optimizeWaypoints: false
            }, (response, status) => {
              if (status === 'OK') {
                new google.maps.DirectionsRenderer({
                  map, directions: response, suppressMarkers: true,
                  polylineOptions: { strokeColor: '${themeColors.brand}', strokeWeight: 6 }
                });
                const legs = response.routes[0] && response.routes[0].legs;
                if (legs && legs.length) {
                  const distanceKm = legs.reduce((total, leg) =>
                    total + (leg.distance ? leg.distance.value : 0), 0
                  ) / 1000;
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'routeDistance',
                    distanceKm,
                    routeKey: '${routeKey}'
                  }));
                }
                map.fitBounds(bounds, 44);
              }
            });
          } else if (origin || destination) {
            map.setCenter(origin || destination);
          }
        }
      </script>
      <script async defer src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap"></script>
      </body></html>`;
  }, [origin, destination, stops, currentLocation, routeKey]);

  if (!origin && !destination && !currentLocation) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={themeColors.brand} />
        <Text style={styles.loadingText}>Esperando ubicación...</Text>
      </View>
    );
  }

  return (
    <WebView
      style={styles.map}
      source={{ html }}
      javaScriptEnabled
      onMessage={(event: NativeSyntheticEvent<{ data: string }>) => {
        const message = JSON.parse(event.nativeEvent.data) as { type?: string; distanceKm?: number; routeKey?: string };
        if (
          message.type === 'routeDistance' &&
          message.routeKey === routeKey &&
          typeof message.distanceKm === 'number' &&
          Number.isFinite(message.distanceKm)
        ) {
          onRouteDistance(message.distanceKm);
        }
      }}
    />
  );
};

const styles = StyleSheet.create({
  map: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.surface },
  loadingText: { marginTop: 8, color: themeColors.muted },
});

export default RideRouteMap;
