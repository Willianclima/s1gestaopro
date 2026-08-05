import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { ServiceOrder, Client } from '../types';
import { MapPin, Navigation, Eye, Filter, CheckCircle2, Clock, AlertTriangle, Layers, Building2, User, RefreshCw, CheckCheck, Compass, Target, Locate, LocateFixed } from 'lucide-react';

interface ServiceOrdersMapProps {
  orders: ServiceOrder[];
  clients: Client[];
  onSelectOrder?: (order: ServiceOrder) => void;
  onNavigate?: (tab: any) => void;
}

// Regional center defaults
const REGIONAL_CENTERS = {
  aracatuba: { lat: -21.2089, lng: -50.4328 },
  saoPaulo: { lat: -23.5505, lng: -46.6333 },
  beloHorizonte: { lat: -19.9167, lng: -43.9345 },
  rioDeJaneiro: { lat: -22.9068, lng: -43.1729 }
};

// Known static coordinates for quick immediate lookup
const KNOWN_STATIC_COORDINATES: Array<{ key: string; coords: { lat: number; lng: number } }> = [
  // São Paulo
  { key: "av. paulista, 1000", coords: { lat: -23.5652, lng: -46.6508 } },
  { key: "paulista", coords: { lat: -23.5652, lng: -46.6508 } },
  { key: "bela vista, são paulo", coords: { lat: -23.5600, lng: -46.6450 } },
  { key: "rua tabapuã, 450", coords: { lat: -23.5855, lng: -46.6785 } },
  { key: "tabapuã", coords: { lat: -23.5855, lng: -46.6785 } },
  { key: "itaim bibi", coords: { lat: -23.5855, lng: -46.6785 } },
  { key: "são paulo", coords: { lat: -23.5505, lng: -46.6333 } },

  // Belo Horizonte
  { key: "av. afonso pena, 2500", coords: { lat: -19.9328, lng: -43.9312 } },
  { key: "afonso pena, 2500", coords: { lat: -19.9328, lng: -43.9312 } },
  { key: "funcionários, belo horizonte", coords: { lat: -19.9328, lng: -43.9312 } },
  { key: "belo horizonte", coords: { lat: -19.9167, lng: -43.9345 } },

  // Araçatuba
  { key: "marcilio dias, 1500", coords: { lat: -21.2070, lng: -50.4360 } },
  { key: "marcilio dias", coords: { lat: -21.2070, lng: -50.4360 } },
  { key: "marcílio dias", coords: { lat: -21.2070, lng: -50.4360 } },
  { key: "prestes maia, 250", coords: { lat: -21.1980, lng: -50.4210 } },
  { key: "prestes maia", coords: { lat: -21.1980, lng: -50.4210 } },
  { key: "rua saudade, 890", coords: { lat: -21.2150, lng: -50.4380 } },
  { key: "saudade", coords: { lat: -21.2150, lng: -50.4380 } },
  { key: "centro, araçatuba", coords: { lat: -21.2089, lng: -50.4328 } },
  { key: "jardim nova yorque", coords: { lat: -21.2185, lng: -50.4210 } },
  { key: "nova yorque", coords: { lat: -21.2185, lng: -50.4210 } },
  { key: "vila bandeirantes", coords: { lat: -21.1980, lng: -50.4410 } },
  { key: "vila estádio", coords: { lat: -21.2120, lng: -50.4390 } },
  { key: "bairro das bandeiras", coords: { lat: -21.2020, lng: -50.4250 } },
  { key: "ipê", coords: { lat: -21.2250, lng: -50.4500 } },
  { key: "santana", coords: { lat: -21.1920, lng: -50.4300 } },
  { key: "brasília", coords: { lat: -21.2170, lng: -50.4230 } },
  { key: "pompeu de toledo", coords: { lat: -21.2150, lng: -50.4380 } },
  { key: "araçatuba", coords: { lat: -21.2089, lng: -50.4328 } }
];

// Helper to calculate distance in KM using Haversine formula
const getHaversineDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function ServiceOrdersMap({
  orders,
  clients,
  onSelectOrder,
  onNavigate
}: ServiceOrdersMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const userRadiusCircleRef = useRef<L.Circle | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Lazy loading state: defer heavy Leaflet initialization until after initial Dashboard render
  const [isMapLoaded, setIsMapLoaded] = useState<boolean>(false);

  // User Geolocation & 5km Radius Filter state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocationStatus, setUserLocationStatus] = useState<'idle' | 'detecting' | 'success' | 'denied' | 'error'>('idle');
  const [userLocationError, setUserLocationError] = useState<string>('');
  const [filterRadius5km, setFilterRadius5km] = useState<boolean>(false);

  const [statusFilter, setStatusFilter] = useState<'aberto_progresso' | 'aberto' | 'em_progresso' | 'aguardando' | 'todos'>('aberto_progresso');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedOrder, setSelectedOrderState] = useState<ServiceOrder | null>(null);

  // Dynamic geocoded coordinates cache (stored in state + localStorage)
  const [geocodedCache, setGeocodedCache] = useState<Record<string, { lat: number; lng: number; precise?: boolean }>>(() => {
    try {
      const saved = localStorage.getItem("service_mgt_geocode_cache_v1");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);

  // Lazy loading trigger: Delay map initialization until after initial Dashboard render pass
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMapLoaded(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Detect user geolocation
  const handleDetectUserLocation = () => {
    if (!navigator.geolocation) {
      setUserLocationStatus('error');
      setUserLocationError('Navegador não suporta geolocalização.');
      return;
    }

    setUserLocationStatus('detecting');
    setUserLocationError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(coords);
        setUserLocationStatus('success');
        setFilterRadius5km(true);

        // Fly map to user location with 5km circle
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([coords.lat, coords.lng], 13, { duration: 1.5 });
        }
      },
      (error) => {
        console.warn('Geolocation error:', error);
        setUserLocationStatus('denied');
        setUserLocationError('Permissão de localização negada ou indisponível.');
        // Fallback to Araçatuba central location if user denies location permission
        const fallback = REGIONAL_CENTERS.aracatuba;
        setUserLocation(fallback);
        setFilterRadius5km(true);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Helper to find client
  const getClientForOrder = (clientId: string) => {
    return clients.find(c => c.id === clientId);
  };

  // Resolve coordinate for any address string
  const resolveCoordinates = (
    address: string, 
    id: string, 
    directLat?: number, 
    directLng?: number
  ): { lat: number; lng: number; isPrecise: boolean } => {
    // Direct technical GPS coordinates registered during service take highest priority
    if (
      typeof directLat === 'number' &&
      typeof directLng === 'number' &&
      !isNaN(directLat) &&
      !isNaN(directLng) &&
      directLat !== 0 &&
      directLng !== 0
    ) {
      return { lat: directLat, lng: directLng, isPrecise: true };
    }

    if (!address) {
      return { ...REGIONAL_CENTERS.aracatuba, isPrecise: false };
    }

    const clean = address.trim().toLowerCase();

    // 1. Check dynamic geocoded cache
    if (geocodedCache[clean]) {
      return { 
        lat: geocodedCache[clean].lat, 
        lng: geocodedCache[clean].lng, 
        isPrecise: geocodedCache[clean].precise ?? true 
      };
    }

    // 2. Check static known addresses
    for (const item of KNOWN_STATIC_COORDINATES) {
      if (clean.includes(item.key)) {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
          hash = (hash << 5) - hash + id.charCodeAt(i);
          hash |= 0;
        }
        const jitterLat = ((hash % 50) / 20000);
        const jitterLng = (((hash >> 2) % 50) / 20000);
        return { 
          lat: item.coords.lat + jitterLat, 
          lng: item.coords.lng + jitterLng, 
          isPrecise: true 
        };
      }
    }

    // 3. Fallback city detection if address mentions major city
    let baseCenter = REGIONAL_CENTERS.aracatuba;
    if (clean.includes("são paulo") || clean.includes("sp") && !clean.includes("araçatuba")) {
      baseCenter = REGIONAL_CENTERS.saoPaulo;
    } else if (clean.includes("belo horizonte") || clean.includes("mg")) {
      baseCenter = REGIONAL_CENTERS.beloHorizonte;
    } else if (clean.includes("rio de janeiro") || clean.includes("rj")) {
      baseCenter = REGIONAL_CENTERS.rioDeJaneiro;
    }

    // Hash-based offset around the city center
    let hash = 0;
    const str = address + id;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const normLat = Math.sin(hash) * 0.012;
    const normLng = Math.cos(hash) * 0.015;

    return {
      lat: baseCenter.lat + normLat,
      lng: baseCenter.lng + normLng,
      isPrecise: false
    };
  };

  // Trigger OpenStreetMap Nominatim Geocoding in background for addresses not yet cached
  useEffect(() => {
    let isMounted = true;

    const addressesToGeocode: string[] = [];
    orders.forEach(o => {
      const client = getClientForOrder(o.clientId);
      const addr = (o.location || client?.address || "").trim();
      if (addr && !geocodedCache[addr.toLowerCase()]) {
        addressesToGeocode.push(addr);
      }
    });

    if (addressesToGeocode.length === 0) return;

    const fetchGeocodes = async () => {
      if (isMounted) setIsGeocoding(true);
      const newCache = { ...geocodedCache };
      let hasNew = false;

      // Limit concurrent geocode requests to respect Nominatim usage guidelines
      for (const rawAddr of addressesToGeocode.slice(0, 5)) {
        const key = rawAddr.toLowerCase();
        if (newCache[key]) continue;

        try {
          const searchAddr = rawAddr
            .replace(/-.*?,/, ",")
            .trim();

          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddr)}&countrycodes=br&limit=1`;
          const response = await fetch(url, {
            headers: { 'User-Agent': 'AracatubaServicosManagerApp/1.0' }
          });

          if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
              const lat = parseFloat(data[0].lat);
              const lng = parseFloat(data[0].lon);
              newCache[key] = { lat, lng, precise: true };
              hasNew = true;
            }
          }
        } catch (err) {
          console.warn("Geocoding failed for:", rawAddr, err);
        }

        await new Promise(res => setTimeout(res, 600));
      }

      if (isMounted) {
        setIsGeocoding(false);
        if (hasNew) {
          setGeocodedCache(newCache);
          try {
            localStorage.setItem("service_mgt_geocode_cache_v1", JSON.stringify(newCache));
          } catch (e) {
            console.error("Failed to save geocode cache", e);
          }
        }
      }
    };

    fetchGeocodes();

    return () => {
      isMounted = false;
    };
  }, [orders, clients]);

  // Filtered orders with Status + Category + Search + 5km Geolocation Radius Filter
  const filteredOrders = useMemo(() => {
    return orders.filter(os => {
      // Status filter
      if (statusFilter === 'aberto_progresso') {
        if (os.status !== 'aberto' && os.status !== 'em_progresso' && os.status !== 'aguardando') return false;
      } else if (statusFilter !== 'todos') {
        if (os.status !== statusFilter) return false;
      }

      // Category filter
      if (selectedCategory !== 'todos' && os.category !== selectedCategory) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const client = getClientForOrder(os.clientId);
        const searchLower = searchTerm.toLowerCase();
        const clientName = client?.name.toLowerCase() || '';
        const address = (os.location || client?.address || '').toLowerCase();
        const title = os.title.toLowerCase();
        const id = os.id.toLowerCase();

        if (!clientName.includes(searchLower) && !address.includes(searchLower) && !title.includes(searchLower) && !id.includes(searchLower)) {
          return false;
        }
      }

      // 5km Radius Filter from User Location
      if (filterRadius5km && userLocation) {
        const client = getClientForOrder(os.clientId);
        const address = os.location || client?.address || "Araçatuba - SP";
        const { lat, lng } = resolveCoordinates(address, os.id, os.lat ?? client?.lat, os.lng ?? client?.lng);
        const distKm = getHaversineDistanceKm(userLocation.lat, userLocation.lng, lat, lng);
        if (distKm > 5.0) {
          return false;
        }
      }

      return true;
    });
  }, [orders, clients, statusFilter, selectedCategory, searchTerm, filterRadius5km, userLocation, geocodedCache]);

  // Count of OS within 5km radius for button feedback
  const countWithin5km = useMemo(() => {
    if (!userLocation) return 0;
    return orders.filter(os => {
      const client = getClientForOrder(os.clientId);
      const address = os.location || client?.address || "Araçatuba - SP";
      const { lat, lng } = resolveCoordinates(address, os.id, os.lat ?? client?.lat, os.lng ?? client?.lng);
      return getHaversineDistanceKm(userLocation.lat, userLocation.lng, lat, lng) <= 5.0;
    }).length;
  }, [orders, clients, userLocation, geocodedCache]);

  // Unique categories for dropdown
  const categories = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.category) set.add(o.category);
    });
    return Array.from(set);
  }, [orders]);

  // Load Leaflet CSS
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

  // Initialize Map after lazy-loading trigger completes
  useEffect(() => {
    if (!isMapLoaded || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [REGIONAL_CENTERS.aracatuba.lat, REGIONAL_CENTERS.aracatuba.lng],
      zoom: 12,
      zoomControl: true,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    markersGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isMapLoaded]);

  // Render User Location 5km Radius Circle and User Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clean previous circle & marker
    if (userRadiusCircleRef.current) {
      userRadiusCircleRef.current.remove();
      userRadiusCircleRef.current = null;
    }
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    if (userLocation && filterRadius5km) {
      // 5km Translucent Circle
      const circle = L.circle([userLocation.lat, userLocation.lng], {
        radius: 5000, // 5km radius
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        weight: 2,
        dashArray: '6, 6'
      }).addTo(map);

      userRadiusCircleRef.current = circle;

      // Pulse User Marker Icon
      const userIcon = L.divIcon({
        className: 'user-location-pin-icon',
        html: `
          <div style="
            background-color: #2563eb;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.4), 0 4px 10px rgba(0,0,0,0.3);
            position: relative;
          ">
            <span style="
              position: absolute;
              top: -6px;
              left: -6px;
              width: 26px;
              height: 26px;
              border-radius: 50%;
              background: rgba(37, 99, 235, 0.2);
              animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></span>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .bindPopup(`
          <div style="font-family: system-ui, sans-serif; padding: 4px; text-align: center;">
            <strong style="color: #1e40af; font-size: 12px;">📍 Sua Localização Atual</strong>
            <p style="margin: 4px 0 0 0; font-size: 10px; color: #475569;">
              Raio de filtragem ativo: <strong>5.0 km</strong><br/>
              (${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)})
            </p>
          </div>
        `);

      userMarker.addTo(map);
      userMarkerRef.current = userMarker;
    }
  }, [userLocation, filterRadius5km, isMapLoaded]);

  // Render Pins for Service Orders
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup || !isMapLoaded) return;

    markersGroup.clearLayers();

    if (filteredOrders.length === 0) return;

    const bounds: L.LatLngBounds = L.latLngBounds([]);
    const inProgressBounds: L.LatLngBounds = L.latLngBounds([]);
    const inProgressOrders = filteredOrders.filter(o => o.status === 'em_progresso');

    filteredOrders.forEach(os => {
      const client = getClientForOrder(os.clientId);
      const address = os.location || client?.address || "Araçatuba - SP";
      const { lat, lng, isPrecise } = resolveCoordinates(address, os.id, os.lat ?? client?.lat, os.lng ?? client?.lng);

      bounds.extend([lat, lng]);
      if (os.status === 'em_progresso') {
        inProgressBounds.extend([lat, lng]);
      }

      // Calculate distance if user location is detected
      let distText = '';
      if (userLocation) {
        const d = getHaversineDistanceKm(userLocation.lat, userLocation.lng, lat, lng);
        distText = ` (${d.toFixed(1)} km de você)`;
      }

      // Determine pin color based on status
      let pinColor = "#f59e0b"; // amber for aberto
      let statusLabel = "Aberto";
      if (os.status === 'em_progresso') {
        pinColor = "#2563eb"; // blue
        statusLabel = "Em Progresso";
      } else if (os.status === 'aguardando') {
        pinColor = "#d97706"; // amber
        statusLabel = "Aguardando";
      } else if (os.status === 'concluido') {
        pinColor = "#10b981"; // green
        statusLabel = "Concluído";
      } else if (os.status === 'cancelado') {
        pinColor = "#ef4444"; // red
        statusLabel = "Cancelado";
      }

      let priorityBadge = "🟢 Baixa";
      if (os.priority === 'urgent') priorityBadge = "🔴 URGENTE";
      else if (os.priority === 'high') priorityBadge = "🟠 ALTA";
      else if (os.priority === 'medium') priorityBadge = "🟡 MÉDIA";

      // Custom HTML Marker Icon with special pulse for em_progresso
      const isEmProgresso = os.status === 'em_progresso';
      const customIcon = L.divIcon({
        className: 'custom-map-pin-icon',
        html: `
          <div style="
            background-color: ${pinColor};
            width: 34px;
            height: 34px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: ${isEmProgresso ? '0 0 0 4px rgba(37,99,235,0.35), 0 4px 12px rgba(0,0,0,0.3)' : '0 4px 10px rgba(0,0,0,0.3)'};
            cursor: pointer;
            transition: transform 0.2s ease;
            position: relative;
          ">
            ${isEmProgresso ? `
              <span style="
                position: absolute;
                top: -3px;
                right: -3px;
                width: 10px;
                height: 10px;
                background-color: #10b981;
                border: 2px solid white;
                border-radius: 50%;
              "></span>
            ` : ''}
            <div style="
              width: 10px;
              height: 10px;
              background-color: white;
              border-radius: 50%;
            "></div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -34]
      });

      const popupContent = `
        <div style="font-family: system-ui, sans-serif; padding: 4px; max-width: 280px; text-align: left;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; background: #e2e8f0; color: #1e293b; padding: 2px 6px; border-radius: 4px; font-family: monospace;">
              #${os.id.substring(0, 8)}
            </span>
            <span style="font-size: 10px; font-weight: 800; background: ${pinColor}; color: white; padding: 2px 8px; border-radius: 12px; text-transform: uppercase;">
              ${statusLabel}
            </span>
          </div>
          
          <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 800; color: #0f172a; line-height: 1.3;">
            ${os.title}
          </h4>

          <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">
            <strong style="color: #1e293b;">Requisitante:</strong> ${client?.name || 'Não informado'}
          </div>

          <div style="font-size: 11px; color: #1e293b; margin-bottom: 6px; line-height: 1.3; background: #f8fafc; padding: 6px 8px; border-radius: 8px; border: 1px solid #e2e8f0;">
            📍 <strong>Endereço:</strong> ${address}
            ${distText ? `<div style="color: #2563eb; font-weight: 700; margin-top: 2px;">📐 Distância: ${distText}</div>` : ''}
          </div>

          <div style="margin-bottom: 8px; font-size: 10px; font-weight: 700;">
            ${isPrecise 
              ? `<span style="color: #059669; background: #d1fae5; padding: 3px 8px; border-radius: 6px; display: inline-block;">✓ GPS Técnico Registrado (${lat.toFixed(4)}, ${lng.toFixed(4)})</span>`
              : `<span style="color: #d97706; background: #fef3c7; padding: 3px 8px; border-radius: 6px; display: inline-block;">⚡ Localização Aproximada</span>`
            }
          </div>

          <div style="display: flex; justify-space-between; align-items: center; font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 10px;">
            <span>Cat: ${os.category || 'Geral'}</span>
            <span>Prioridade: ${priorityBadge}</span>
          </div>

          <button 
            id="btn-open-os-${os.id}"
            style="
              width: 100%;
              background-color: #2563eb;
              color: white;
              border: none;
              padding: 7px 12px;
              border-radius: 8px;
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              cursor: pointer;
              box-shadow: 0 2px 4px rgba(37,99,235,0.3);
            "
          >
            🔎 Abrir Detalhes da OS
          </button>
        </div>
      `;

      const marker = L.marker([lat, lng], { icon: customIcon })
        .bindPopup(popupContent, { maxWidth: 290 });

      marker.on('popupopen', (e) => {
        setSelectedOrderState(os);
        setTimeout(() => {
          const popupEl = e.popup.getElement();
          const btn = popupEl?.querySelector(`#btn-open-os-${os.id}`) || document.getElementById(`btn-open-os-${os.id}`);
          if (btn) {
            (btn as HTMLElement).onclick = (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              if (onSelectOrder) {
                onSelectOrder(os);
              }
            };
          }
        }, 50);
      });

      markersGroup.addLayer(marker);
    });

    if (inProgressOrders.length > 0 && inProgressBounds.isValid() && !filterRadius5km) {
      map.flyToBounds(inProgressBounds, { padding: [60, 60], maxZoom: 15, duration: 1.2 });
    } else if (filteredOrders.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [filteredOrders, clients, geocodedCache, onSelectOrder, isMapLoaded, filterRadius5km, userLocation]);

  const focusInProgressMarkers = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const inProgressOrders = filteredOrders.filter(o => o.status === 'em_progresso');
    if (inProgressOrders.length === 0) {
      fitAllMarkers();
      return;
    }

    const bounds = L.latLngBounds([]);
    inProgressOrders.forEach(os => {
      const client = getClientForOrder(os.clientId);
      const address = os.location || client?.address || "Araçatuba - SP";
      const { lat, lng } = resolveCoordinates(address, os.id, os.lat ?? client?.lat, os.lng ?? client?.lng);
      bounds.extend([lat, lng]);
    });

    if (bounds.isValid()) {
      map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 15, duration: 1.2 });
    }
  };

  const fitAllMarkers = () => {
    const map = mapInstanceRef.current;
    if (!map || filteredOrders.length === 0) return;

    const bounds = L.latLngBounds([]);
    filteredOrders.forEach(os => {
      const client = getClientForOrder(os.clientId);
      const address = os.location || client?.address || "Araçatuba - SP";
      const { lat, lng } = resolveCoordinates(address, os.id, os.lat ?? client?.lat, os.lng ?? client?.lng);
      bounds.extend([lat, lng]);
    });

    if (userLocation && filterRadius5km) {
      bounds.extend([userLocation.lat, userLocation.lng]);
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  };

  const focusOnOrder = (os: ServiceOrder) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const client = getClientForOrder(os.clientId);
    const address = os.location || client?.address || "Araçatuba - SP";
    const { lat, lng } = resolveCoordinates(address, os.id, os.lat ?? client?.lat, os.lng ?? client?.lng);
    map.flyTo([lat, lng], 15, { duration: 1.2 });
    setSelectedOrderState(os);
  };

  const inProgressCount = orders.filter(o => o.status === 'em_progresso').length;
  const openCount = orders.filter(o => o.status === 'aberto' || o.status === 'em_progresso' || o.status === 'aguardando').length;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md p-5 space-y-4 text-left">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <MapPin className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Mapa Geográfico de Atendimentos de Campo
                </h3>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full font-mono">
                  {openCount} OS Abertas
                </span>
                {filterRadius5km && (
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <Target className="w-3 h-3 text-blue-600" />
                    Filtro 5km Ativo ({filteredOrders.length} OS)
                  </span>
                )}
                {isGeocoding && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Geocodificando Endereços...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Geolocalização precisa calculada a partir dos endereços reais do cadastros de requisitantes e chamados (OpenStreetMap / GPS).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Button: Detect User Location & Filter 5km */}
          <button
            type="button"
            onClick={() => {
              if (filterRadius5km) {
                setFilterRadius5km(false);
              } else if (userLocation) {
                setFilterRadius5km(true);
              } else {
                handleDetectUserLocation();
              }
            }}
            className={`text-xs font-extrabold py-2 px-3.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
              filterRadius5km
                ? 'bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-blue-500/30'
                : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
            }`}
            title="Exibir marcadores de OS dentro do raio de 5km da minha posição"
          >
            {userLocationStatus === 'detecting' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                Detectando Posição GPS...
              </>
            ) : filterRadius5km ? (
              <>
                <LocateFixed className="w-3.5 h-3.5 text-white" />
                Raio 5km (Ativo - {filteredOrders.length} OS)
              </>
            ) : (
              <>
                <Locate className="w-3.5 h-3.5 text-blue-600" />
                {userLocation ? 'Ativar Raio 5km' : 'Filtrar Raio 5km (GPS)'}
              </>
            )}
          </button>

          {inProgressCount > 0 && (
            <button
              type="button"
              onClick={focusInProgressMarkers}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold py-2 px-3.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs animate-pulse"
              title="Centralizar mapa nos atendimentos em andamento"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              OS Em Progresso ({inProgressCount})
            </button>
          )}

          <button
            type="button"
            onClick={fitAllMarkers}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold py-2 px-3.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Navigation className="w-3.5 h-3.5 text-indigo-600" />
            Centralizar Tudo
          </button>
          
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate("orders")}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Ver Tabela Completa
            </button>
          )}
        </div>
      </div>

      {/* Geolocation feedback banner if error or denied */}
      {userLocationStatus === 'denied' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2 rounded-xl text-xs font-medium flex items-center justify-between gap-2">
          <span>⚠️ Permissão de GPS negada. Utilizando centro de Araçatuba-SP como referência para o raio de 5km.</span>
          <button 
            type="button" 
            onClick={() => setUserLocationStatus('idle')} 
            className="text-amber-700 font-bold hover:underline"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
        {/* Status Filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Filtrar Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 cursor-pointer"
          >
            <option value="aberto_progresso">⚡ Apenas Abertas, Progresso e Espera</option>
            <option value="aberto">🟠 Apenas Abertas</option>
            <option value="em_progresso">🔵 Apenas Em Progresso</option>
            <option value="aguardando">🟡 Apenas Aguardando Material</option>
            <option value="concluido">🟢 Apenas Concluídas</option>
            <option value="todos">🌐 Todas as OS</option>
          </select>
        </div>

        {/* Category Filter */}
        <div className="space-y-1">
          <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1">
            <Layers className="w-3 h-3" />
            Categoria
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 cursor-pointer"
          >
            <option value="todos">Todas as Categorias</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="space-y-1">
          <label className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            Buscar no Mapa
          </label>
          <input
            type="text"
            placeholder="Endereço, cidade, requisitante ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs font-medium bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700"
          />
        </div>
      </div>

      {/* Main Container: Map + Sidebar List */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
        {/* Leaflet Map Canvas (#map-container with Lazy Loading Skeleton) */}
        <div className="lg:col-span-3 min-h-[380px] h-[420px] rounded-2xl border border-slate-200 overflow-hidden relative shadow-inner z-0 bg-slate-100">
          {!isMapLoaded ? (
            /* Skeleton / Lazy-loading placeholder */
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-50 to-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 animate-pulse border border-indigo-100 shadow-sm">
                <MapPin className="w-6 h-6 animate-bounce" />
              </div>
              <p className="text-xs font-extrabold text-slate-800 tracking-tight">
                Carregando Visualização Geográfica do Mapa...
              </p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-xs font-medium">
                Inicialização assíncrona inteligente pós-renderização inicial do Dashboard.
              </p>
              <div className="mt-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                <span className="text-[10px] font-extrabold uppercase text-indigo-700 tracking-widest">
                  Processando Geocodificação
                </span>
              </div>
            </div>
          ) : (
            <div id="map-container" ref={mapContainerRef} className="w-full h-full" />
          )}

          {/* Map Floating Legend */}
          {isMapLoaded && (
            <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md p-2.5 rounded-xl border border-slate-200 shadow-lg text-[10px] font-bold text-slate-700 space-y-1 z-[1000] pointer-events-auto">
              <div className="text-[9px] uppercase font-black text-slate-400 tracking-wider mb-1">Legenda dos Pinos</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block border border-white" /> Aberto</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block border border-white" /> Em Progresso</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block border border-white" /> Aguardando Material</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block border border-white" /> Concluído</div>
              {filterRadius5km && (
                <div className="pt-1 mt-1 border-t border-slate-200 flex items-center gap-1.5 text-blue-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block border border-white animate-pulse" /> Raio 5km Ativo
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar: Location List */}
        <div className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col h-[420px]">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
            <span className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-1">
              📍 Endereços Exibidos
            </span>
            <span className="text-[10px] font-extrabold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-mono">
              {filteredOrders.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-semibold space-y-2">
                <p>Nenhuma ordem de serviço encontrada para os filtros aplicados.</p>
                {filterRadius5km && (
                  <button
                    type="button"
                    onClick={() => setFilterRadius5km(false)}
                    className="text-blue-600 font-extrabold hover:underline text-[11px]"
                  >
                    Desativar filtro de raio 5km
                  </button>
                )}
              </div>
            ) : (
              filteredOrders.map(os => {
                const client = getClientForOrder(os.clientId);
                const address = os.location || client?.address || 'Sem endereço informado';
                const { lat, lng, isPrecise } = resolveCoordinates(address, os.id, os.lat ?? client?.lat, os.lng ?? client?.lng);
                const isSelected = selectedOrder?.id === os.id;
                
                let distText = '';
                if (userLocation) {
                  const d = getHaversineDistanceKm(userLocation.lat, userLocation.lng, lat, lng);
                  distText = `${d.toFixed(1)} km`;
                }

                let badgeClass = "bg-amber-100 text-amber-800 border-amber-300";
                if (os.status === "em_progresso") badgeClass = "bg-blue-100 text-blue-800 border-blue-300";
                else if (os.status === "concluido") badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300";

                return (
                  <div
                    key={os.id}
                    onClick={() => focusOnOrder(os)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-indigo-50 border-indigo-400 shadow-sm ring-2 ring-indigo-500/20' 
                        : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[9px] font-black font-mono uppercase bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                        #{os.id.substring(0, 8)}
                      </span>
                      <div className="flex items-center gap-1">
                        {distText && (
                          <span className="text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-md">
                            📐 {distText}
                          </span>
                        )}
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full border ${badgeClass}`}>
                          {os.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>

                    <h5 className="text-xs font-extrabold text-slate-900 line-clamp-1 leading-tight">
                      {os.title}
                    </h5>

                    <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5 flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400 shrink-0" />
                      {client?.name || 'Requisitante Desconhecido'}
                    </p>

                    <p className="text-[10px] text-slate-700 leading-tight mt-1 bg-slate-50 p-1.5 rounded border border-slate-100 line-clamp-2 font-medium">
                      📍 {address}
                    </p>

                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 font-semibold gap-1">
                      <span>Cat: {os.category || "Geral"}</span>
                      <div className="flex items-center gap-1.5">
                        {isPrecise ? (
                          <span className="text-emerald-600 font-extrabold flex items-center gap-0.5">
                            <CheckCheck className="w-3 h-3" /> GPS
                          </span>
                        ) : (
                          <span className="text-amber-600 font-bold">Aproximado</span>
                        )}
                        {onSelectOrder && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectOrder(os);
                            }}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[9px] px-2 py-1 rounded-md transition-all cursor-pointer uppercase tracking-wider"
                          >
                            Ver OS
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
