import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { reverseGeocodeCoordinates } from '../services/addressValidation';
import { MapPin, Search, CheckCircle2, X, RefreshCw, Navigation, Globe, Compass } from 'lucide-react';

interface MapLocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAddress?: string;
  initialLat?: number | null;
  initialLng?: number | null;
  onSelectLocation: (data: { address: string; lat: number; lng: number }) => void;
  onLoadingStateChange?: (isLoading: boolean) => void;
}

// Default center: Araçatuba - SP
const DEFAULT_LAT = -21.2089;
const DEFAULT_LNG = -50.4328;

export default function MapLocationPickerModal({
  isOpen,
  onClose,
  initialAddress,
  initialLat,
  initialLng,
  onSelectLocation,
  onLoadingStateChange
}: MapLocationPickerModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerInstanceRef = useRef<L.Marker | null>(null);

  const [selectedLat, setSelectedLat] = useState<number>(initialLat || DEFAULT_LAT);
  const [selectedLng, setSelectedLng] = useState<number>(initialLng || DEFAULT_LNG);
  const [resolvedAddress, setResolvedAddress] = useState<string>(initialAddress || '');
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);

  useEffect(() => {
    if (onLoadingStateChange) {
      onLoadingStateChange(isResolving || isSearching);
    }
  }, [isResolving, isSearching, onLoadingStateChange]);

  // Load Leaflet CSS CDN if not present
  useEffect(() => {
    const cssId = 'leaflet-css-cdn';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
  }, []);

  // Initialize or update map when modal opens
  useEffect(() => {
    if (!isOpen) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }

    const startLat = initialLat || DEFAULT_LAT;
    const startLng = initialLng || DEFAULT_LNG;

    setSelectedLat(startLat);
    setSelectedLng(startLng);
    if (initialAddress) {
      setResolvedAddress(initialAddress);
    } else {
      handleReverseGeocode(startLat, startLng);
    }

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [startLat, startLng],
        zoom: initialLat && initialLng ? 16 : 14,
        zoomControl: true,
        attributionControl: false
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      const pinIcon = L.divIcon({
        className: 'custom-map-picker-pin',
        html: `
          <div style="
            background: linear-gradient(135deg, #ea4335, #c5221f);
            width: 36px;
            height: 36px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          ">
            <div style="
              width: 10px;
              height: 10px;
              background-color: white;
              border-radius: 50%;
            "></div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36]
      });

      const marker = L.marker([startLat, startLng], {
        icon: pinIcon,
        draggable: true
      }).addTo(map);

      markerInstanceRef.current = marker;

      // Handle marker drag end
      marker.on('dragend', async () => {
        const position = marker.getLatLng();
        setSelectedLat(position.lat);
        setSelectedLng(position.lng);
        handleReverseGeocode(position.lat, position.lng);
      });

      // Handle map click
      map.on('click', async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setSelectedLat(lat);
        setSelectedLng(lng);
        handleReverseGeocode(lat, lng);
      });

      mapInstanceRef.current = map;
    }, 150);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  const handleReverseGeocode = async (lat: number, lng: number) => {
    setIsResolving(true);
    try {
      const addr = await reverseGeocodeCoordinates(lat, lng);
      setResolvedAddress(addr);
    } catch (e) {
      console.error('Failed to reverse geocode:', e);
    } finally {
      setIsResolving(false);
    }
  };

  const handleSearchAddressOnMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      let query = searchQuery.trim();
      if (!query.toLowerCase().includes('araçatuba') && !query.toLowerCase().includes('sp')) {
        query += ', Araçatuba - SP';
      }

      const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=br&limit=1`;
      const res = await fetch(osmUrl, {
        headers: { 'User-Agent': 'AracatubaServicosManager/1.0' }
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const item = data[0];
          const newLat = parseFloat(item.lat);
          const newLng = parseFloat(item.lon);

          setSelectedLat(newLat);
          setSelectedLng(newLng);
          setResolvedAddress(item.display_name);

          if (mapInstanceRef.current && markerInstanceRef.current) {
            mapInstanceRef.current.setView([newLat, newLng], 17);
            markerInstanceRef.current.setLatLng([newLat, newLng]);
          }
        }
      }
    } catch (e) {
      console.error('Search on map failed:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = () => {
    onSelectLocation({
      address: resolvedAddress || `Lat: ${selectedLat.toFixed(5)}, Lng: ${selectedLng.toFixed(5)}`,
      lat: selectedLat,
      lng: selectedLng
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-[1000] animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-white font-bold text-sm sm:text-base">
            <div className="p-2 bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 rounded-xl">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3>Selecionar Localização Exata no Mapa</h3>
              <p className="text-[11px] text-slate-400 font-normal">
                Clique no mapa ou arraste o marcador vermelho para definir a coordenada do imóvel.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Map Search */}
        <div className="p-4 space-y-3 bg-slate-900 flex-1 flex flex-col overflow-hidden">
          
          {/* Search bar inside modal */}
          <form onSubmit={handleSearchAddressOnMap} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar rua, bairro ou ponto de referência no mapa..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-600/30"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              {isSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Compass className="w-3.5 h-3.5" />}
              <span>Localizar</span>
            </button>
          </form>

          {/* Interactive Map Area */}
          <div className="relative flex-1 min-h-[300px] w-full rounded-xl overflow-hidden border border-slate-800 shadow-inner z-0">
            <div ref={mapContainerRef} className="w-full h-full min-h-[300px]" />
            
            {/* Live Coordinate Badge Overlay */}
            <div className="absolute top-3 right-3 bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-[10px] font-mono text-slate-200 shadow-lg z-[1000] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                📍 {selectedLat.toFixed(5)}, {selectedLng.toFixed(5)}
              </span>
            </div>
          </div>

          {/* Selected Address Resolved Preview */}
          <div className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl flex items-start gap-3">
            <Globe className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-left space-y-0.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Endereço Mapeado:
              </div>
              <div className="text-xs font-semibold text-white">
                {isResolving ? (
                  <span className="text-indigo-400 flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Obtendo endereço do ponto selecionado...
                  </span>
                ) : (
                  resolvedAddress || 'Nenhum endereço selecionado'
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-all cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirmar Localização</span>
          </button>
        </div>
      </div>
    </div>
  );
}
