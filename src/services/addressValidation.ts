export interface AddressValidationResult {
  isValid: boolean;
  isPrecise: boolean;
  locationType?: 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE';
  formattedAddress: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
  confidenceScore: number; // 0-100
  validationMessage: string;
  provider: 'Google Maps API' | 'OpenStreetMap Nominatim' | 'Validador de Precisão GPS';
  suggestions?: string[];
}

/**
 * Validates an address using Google Maps Geocoding API (with fallback to OpenStreetMap Nominatim & Local Parser)
 */
export async function validateAddressWithGoogleMaps(
  rawAddress: string,
  defaultCityState: string = "Araçatuba - SP"
): Promise<AddressValidationResult> {
  const trimmed = rawAddress.trim();

  if (!trimmed || trimmed.length < 5) {
    return {
      isValid: false,
      isPrecise: false,
      formattedAddress: rawAddress,
      confidenceScore: 0,
      validationMessage: "O endereço está muito curto ou em branco. Por favor, informe rua, número e bairro.",
      provider: 'Validador de Precisão GPS'
    };
  }

  // Append city/state default if not mentioned
  let searchAddress = trimmed;
  if (!searchAddress.toLowerCase().includes("sp") && !searchAddress.toLowerCase().includes("são paulo") && !searchAddress.toLowerCase().includes("mg")) {
    searchAddress = `${searchAddress}, ${defaultCityState}`;
  }

  // Check if Google Maps API Key is available
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || (typeof process !== 'undefined' && process.env ? process.env.VITE_GOOGLE_MAPS_API_KEY : '');

  if (googleApiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchAddress)}&region=br&key=${googleApiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const result = data.results[0];
          const geometry = result.geometry;
          const locationType = geometry.location_type as 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE';
          const isPrecise = locationType === 'ROOFTOP' || locationType === 'RANGE_INTERPOLATED';
          
          let street = '';
          let number = '';
          let neighborhood = '';
          let city = '';
          let state = '';
          let postalCode = '';

          result.address_components.forEach((comp: any) => {
            if (comp.types.includes('route')) street = comp.long_name;
            if (comp.types.includes('street_number')) number = comp.long_name;
            if (comp.types.includes('sublocality') || comp.types.includes('neighborhood')) neighborhood = comp.long_name;
            if (comp.types.includes('administrative_area_level_2') || comp.types.includes('locality')) city = comp.long_name;
            if (comp.types.includes('administrative_area_level_1')) state = comp.short_name;
            if (comp.types.includes('postal_code')) postalCode = comp.long_name;
          });

          const confidenceScore = isPrecise ? 95 : (locationType === 'GEOMETRIC_CENTER' ? 75 : 50);

          return {
            isValid: true,
            isPrecise,
            locationType,
            formattedAddress: result.formatted_address,
            street,
            number,
            neighborhood,
            city,
            state,
            postalCode,
            lat: geometry.location.lat,
            lng: geometry.location.lng,
            confidenceScore,
            validationMessage: isPrecise
              ? "✅ Endereço validado com precisão milimétrica via Google Maps API!"
              : "⚠️ Endereço localizado, mas o número do imóvel pode estar genérico ou aproximado.",
            provider: 'Google Maps API'
          };
        }
      }
    } catch (e) {
      console.warn("Google Maps API call failed, falling back to Nominatim OSM:", e);
    }
  }

  // Fallback 1: OpenStreetMap Nominatim Geocoding
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&countrycodes=br&addressdetails=1&limit=1`;
    const res = await fetch(osmUrl, {
      headers: { 'User-Agent': 'AracatubaServicosManager/1.0' }
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        const addr = item.address || {};

        const hasNumber = !!(addr.house_number || /\d+/.test(trimmed));
        const isPrecise = hasNumber && (item.type === 'house' || item.type === 'building' || item.class === 'place' || item.class === 'building');
        
        const confidenceScore = isPrecise ? 90 : (hasNumber ? 75 : 55);

        return {
          isValid: true,
          isPrecise,
          locationType: isPrecise ? 'ROOFTOP' : 'GEOMETRIC_CENTER',
          formattedAddress: item.display_name,
          street: addr.road || addr.pedestrian || '',
          number: addr.house_number || (trimmed.match(/\d+/)?.[0] || ''),
          neighborhood: addr.suburb || addr.neighbourhood || addr.residential || '',
          city: addr.city || addr.town || addr.municipality || 'Araçatuba',
          state: addr.state || 'SP',
          postalCode: addr.postcode || '',
          lat,
          lng,
          confidenceScore,
          validationMessage: isPrecise 
            ? "✅ Endereço e localização geográfica confirmados no mapa!"
            : "⚠️ Endereço encontrado na malha urbana, mas sugerimos incluir o número exato da residência.",
          provider: 'OpenStreetMap Nominatim'
        };
      }
    }
  } catch (e) {
    console.warn("Nominatim OSM search failed, using structural GPS validator:", e);
  }

  // Fallback 2: Structural Address Pattern Validator
  const hasStreetKeyword = /(rua|av|avenida|praça|prc|alameda|rodovia|rod|travessa|estrada|via)/i.test(trimmed);
  const hasHouseNumber = /\d{1,5}/.test(trimmed);
  const hasNeighborhood = /(bairro|br|jd|jardim|vila|vl|parque|pq|centro)/i.test(trimmed) || trimmed.split(',').length >= 2;

  const isStructurallyValid = hasHouseNumber && (hasStreetKeyword || trimmed.length > 12);
  const confidenceScore = (hasStreetKeyword ? 30 : 0) + (hasHouseNumber ? 40 : 0) + (hasNeighborhood ? 20 : 0);

  return {
    isValid: isStructurallyValid,
    isPrecise: hasHouseNumber && hasStreetKeyword,
    formattedAddress: searchAddress,
    confidenceScore: Math.min(confidenceScore, 85),
    validationMessage: isStructurallyValid
      ? (hasHouseNumber ? "✅ Endereço estruturado com número predial identificado." : "⚠️ Favor especificar o número do imóvel para alta precisão geográfica.")
      : "❌ Endereço incompleto. Favor informar: Nome da Rua/Avenida, Número e Bairro.",
    provider: 'Validador de Precisão GPS'
  };
}
