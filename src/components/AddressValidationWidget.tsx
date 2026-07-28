import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { validateAddressWithGoogleMaps, AddressValidationResult } from '../services/addressValidation';
import { MapPin, CheckCircle2, AlertTriangle, XCircle, Search, Sparkles, Navigation, Globe, ExternalLink } from 'lucide-react';

interface AddressValidationWidgetProps {
  address: string;
  onAddressValidated?: (result: AddressValidationResult) => void;
  onApplyFormattedAddress?: (formattedAddress: string, lat?: number, lng?: number) => void;
}

export default function AddressValidationWidget({
  address,
  onAddressValidated,
  onApplyFormattedAddress
}: AddressValidationWidgetProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<AddressValidationResult | null>(null);
  const miniMapContainerRef = useRef<HTMLDivElement>(null);
  const miniMapInstanceRef = useRef<L.Map | null>(null);

  const handleValidate = async () => {
    if (!address.trim()) return;
    setIsValidating(true);

    try {
      const result = await validateAddressWithGoogleMaps(address);
      setValidationResult(result);
      if (onAddressValidated) {
        onAddressValidated(result);
      }
    } catch (e) {
      console.error("Error validating address:", e);
    } finally {
      setIsValidating(false);
    }
  };

  // Ensure Leaflet CSS is present
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

  // Initialize or update mini map when validation result has coordinates
  useEffect(() => {
    if (!validationResult || !validationResult.lat || !validationResult.lng || !miniMapContainerRef.current) {
      if (miniMapInstanceRef.current) {
        miniMapInstanceRef.current.remove();
        miniMapInstanceRef.current = null;
      }
      return;
    }

    const { lat, lng } = validationResult;

    if (miniMapInstanceRef.current) {
      miniMapInstanceRef.current.remove();
      miniMapInstanceRef.current = null;
    }

    const map = L.map(miniMapContainerRef.current, {
      center: [lat, lng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    const customIcon = L.divIcon({
      className: 'custom-widget-pin',
      html: `
        <div style="
          background-color: #ea4335;
          width: 28px;
          height: 28px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
          box-shadow: 0 3px 8px rgba(0,0,0,0.4);
        ">
          <div style="
            width: 8px;
            height: 8px;
            background-color: white;
            border-radius: 50%;
          "></div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    });

    L.marker([lat, lng], { icon: customIcon }).addTo(map);

    miniMapInstanceRef.current = map;

    return () => {
      if (miniMapInstanceRef.current) {
        miniMapInstanceRef.current.remove();
        miniMapInstanceRef.current = null;
      }
    };
  }, [validationResult]);

  return (
    <div className="mt-2 space-y-2 text-left">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleValidate}
          disabled={isValidating || !address.trim()}
          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-xs font-extrabold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          {isValidating ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
              Validando no Google Maps...
            </>
          ) : (
            <>
              <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              Validar Precisão Geográfica (Google Maps / GPS)
            </>
          )}
        </button>

        {validationResult && (
          <span className="text-[10px] font-extrabold font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            {validationResult.provider}
          </span>
        )}
      </div>

      {validationResult && (
        <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed transition-all shadow-xs space-y-3 ${
          validationResult.isPrecise 
            ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950' 
            : validationResult.isValid 
              ? 'bg-amber-50/90 border-amber-300 text-amber-950' 
              : 'bg-rose-50/90 border-rose-300 text-rose-950'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              {validationResult.isPrecise ? (
                <div className="p-1.5 bg-emerald-500 text-white rounded-lg shrink-0 mt-0.5 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              ) : validationResult.isValid ? (
                <div className="p-1.5 bg-amber-500 text-white rounded-lg shrink-0 mt-0.5 shadow-2xs">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              ) : (
                <div className="p-1.5 bg-rose-500 text-white rounded-lg shrink-0 mt-0.5 shadow-2xs">
                  <XCircle className="w-4 h-4" />
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    validationResult.isPrecise 
                      ? 'bg-emerald-200 text-emerald-900' 
                      : validationResult.isValid 
                        ? 'bg-amber-200 text-amber-900' 
                        : 'bg-rose-200 text-rose-900'
                  }`}>
                    {validationResult.isPrecise ? 'Geolocalização Precisa (100%)' : validationResult.isValid ? 'Localização Parcial / Aproximada' : 'Endereço Não Localizado'}
                  </span>

                  <span className="text-[10px] font-extrabold font-mono text-slate-500">
                    Confiança: {validationResult.confidenceScore}%
                  </span>
                </div>

                <p className="font-extrabold text-slate-900 text-xs">
                  {validationResult.validationMessage}
                </p>

                {validationResult.formattedAddress && (
                  <div className="mt-1 bg-white/80 p-2 rounded-xl border border-slate-200/80 font-mono text-[11px] text-slate-800">
                    📍 <strong>Padronizado:</strong> {validationResult.formattedAddress}
                  </div>
                )}

                {validationResult.lat && validationResult.lng && (
                  <div className="text-[10px] font-mono text-slate-600 flex items-center gap-2 pt-0.5">
                    <span>GPS: {validationResult.lat.toFixed(6)}, {validationResult.lng.toFixed(6)}</span>
                    {validationResult.locationType && (
                      <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                        {validationResult.locationType}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {onApplyFormattedAddress && validationResult.formattedAddress && validationResult.formattedAddress !== address && (
              <button
                type="button"
                onClick={() => onApplyFormattedAddress(validationResult.formattedAddress, validationResult.lat, validationResult.lng)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[11px] py-2 px-3 rounded-xl shrink-0 transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                Aplicar Padronizado
              </button>
            )}
          </div>

          {/* Mini Map Preview Container */}
          {validationResult.lat && validationResult.lng && (
            <div className="pt-2 border-t border-slate-200/60 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-700">
                <span className="flex items-center gap-1.5 text-slate-800">
                  <Globe className="w-3.5 h-3.5 text-indigo-600" />
                  Confirmação de Coordenada no Mapa (Google Maps / GPS)
                </span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${validationResult.lat},${validationResult.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-[10px] underline font-bold"
                >
                  Abrir no Google Maps <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>

              <div className="h-36 w-full rounded-xl overflow-hidden border border-slate-300 shadow-inner relative z-0">
                <div ref={miniMapContainerRef} className="w-full h-full" />
                <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-xs px-2 py-1 rounded-md text-[9px] font-mono font-black text-slate-800 border border-slate-200 shadow-xs z-[1000]">
                  📍 {validationResult.lat.toFixed(5)}, {validationResult.lng.toFixed(5)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
