const GOOGLE_MAPS_API_KEY = 'AIzaSyCQQVLprlkXfH6sdrNv0VlVSkEN_2_M-eE';

export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&language=es`
    );
    const json = await res.json();
    if (json.status === 'OK' && json.results[0]) {
      return json.results[0].formatted_address;
    }
  } catch (e) {}
  return 'Dirección no encontrada';
};

export const getPlaceDetails = async (placeId: string): Promise<{ lat: number; lng: number } | null> => {
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`
    );
    const json = await res.json();
    if (json.result?.geometry?.location) {
      return {
        lat: json.result.geometry.location.lat,
        lng: json.result.geometry.location.lng,
      };
    }
  } catch (e) {}
  return null;
};