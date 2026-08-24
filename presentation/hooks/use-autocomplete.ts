import { useState, useCallback } from 'react';
import { getPlaceDetails } from '../../utils/geocoding';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCQQVLprlkXfH6sdrNv0VlVSkEN_2_M-eE';

interface Suggestion {
  description: string;
  placeId: string;
}

export function useAutocomplete(userLocation?: { lat: number; lng: number }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchSuggestions = useCallback(async (input: string) => {
    setQuery(input);
    if (input.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_MAPS_API_KEY}&language=es&components=country:ve`;
      if (userLocation) {
        url += `&location=${userLocation.lat},${userLocation.lng}&radius=5000`;
      }
      const res = await fetch(url);
      const json = await res.json();
      console.log('Google Places response:', json.status, json.predictions?.length);  // <-- verifica en consola
      if (json.status === 'OK') {
        setSuggestions(json.predictions.map((p: any) => ({ description: p.description, placeId: p.place_id })));
        setShowSuggestions(true);
      } else {
        console.warn('Places API error:', json.status, json.error_message);
        setSuggestions([]);
      }
    } catch (e) {
      console.error('Error fetching suggestions:', e);
    }
  }, [userLocation]);

  const selectSuggestion = useCallback(async (placeId: string) => {
    const coords = await getPlaceDetails(placeId);
    if (coords) {
      setShowSuggestions(false);
      setQuery('');
      setSuggestions([]);
      return coords;
    }
    return null;
  }, []);

  const clearSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setQuery('');
    setSuggestions([]);
  }, []);

  return {
    query,
    setQuery,
    suggestions,
    showSuggestions,
    setShowSuggestions,
    fetchSuggestions,
    selectSuggestion,
    clearSuggestions,
  };
}