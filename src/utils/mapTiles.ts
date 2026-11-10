import type L from 'leaflet';

export interface TileLayerConfig {
  name: string;
  url: string;
  options: L.TileLayerOptions;
}

/**
 * Provedores de tiles de mapas em conformidade com as políticas de uso do OpenStreetMap e Leaflet.
 * Substitui os servidores voluntários sobrecarregados de tile.openstreetmap.org (que bloqueiam
 * aplicações web com HTTP 403 e aviso http://osm.wiki/blocked) por servidores CDN de alta
 * performance, gratuitos e oficiais (CARTO Basemaps e Esri World Imagery).
 */
export const MAP_TILE_PROVIDERS = {
  voyager: {
    name: 'Mapa Urbano (CARTO Voyager)',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    options: {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>'
    }
  },
  satellite: {
    name: 'Satélite (Esri World Imagery)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 19,
      attribution:
        'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS User Community'
    }
  },
  positron: {
    name: 'Claro Minimalista (CARTO Positron)',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    options: {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>'
    }
  }
} as const;

export type MapTileProviderKey = keyof typeof MAP_TILE_PROVIDERS;

/**
 * Cria uma camada de tiles Leaflet padrão e segura contra bloqueios de 403.
 */
export function createDefaultTileLayer(
  leaflet: typeof L,
  providerKey: MapTileProviderKey = 'voyager'
): L.TileLayer {
  const provider = MAP_TILE_PROVIDERS[providerKey] || MAP_TILE_PROVIDERS.voyager;
  return leaflet.tileLayer(provider.url, provider.options);
}
