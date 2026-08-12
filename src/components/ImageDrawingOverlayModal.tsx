import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Pencil, 
  Highlighter, 
  Circle, 
  Square, 
  ArrowUpRight, 
  Tag, 
  Type, 
  Undo2, 
  Redo2, 
  RotateCcw, 
  Check, 
  X, 
  Sparkles, 
  AlertTriangle, 
  Flame, 
  Zap, 
  Droplets, 
  Wrench, 
  CheckCircle2, 
  HelpCircle,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

export type DrawTool = 'pen' | 'highlighter' | 'circle' | 'rectangle' | 'arrow' | 'stamp' | 'text';

export interface ImageDrawingOverlayModalProps {
  isOpen: boolean;
  imageUrl: string;
  imageTitle?: string;
  onClose: () => void;
  onSave: (annotatedDataUrl: string) => void;
}

// Preset Damage Stamps / Tags
const DAMAGE_STAMPS = [
  { id: 'damage', label: '⚠️ Dano Detectado', color: '#ef4444', icon: AlertTriangle },
  { id: 'heat', label: '🔥 Aquecimento', color: '#f97316', icon: Flame },
  { id: 'electric', label: '⚡ Risco Elétrico', color: '#eab308', icon: Zap },
  { id: 'leak', label: '💧 Vazamento', color: '#06b6d4', icon: Droplets },
  { id: 'break', label: '🔨 Fissura/Quebra', color: '#a855f7', icon: Wrench },
  { id: 'repaired', label: '✅ Reparado/OK', color: '#10b981', icon: CheckCircle2 },
];

const COLOR_PALETTE = [
  { name: 'Vermelho Alerta', hex: '#ef4444' },
  { name: 'Laranja Aquecimento', hex: '#f97316' },
  { name: 'Amarelo Risco', hex: '#eab308' },
  { name: 'Verde Reparo/OK', hex: '#10b981' },
  { name: 'Azul Inspeção', hex: '#0284c7' },
  { name: 'Roxo Estrutural', hex: '#8b5cf6' },
  { name: 'Branco Contraste', hex: '#ffffff' },
  { name: 'Preto Sombra', hex: '#000000' },
];

const STROKE_SIZES = [
  { label: 'Fina', value: 2 },
  { label: 'Média', value: 4 },
  { label: 'Grossa', value: 8 },
  { label: 'Extra', value: 14 },
];

export default function ImageDrawingOverlayModal({
  isOpen,
  imageUrl,
  imageTitle = "Foto do Chamado Técnico",
  onClose,
  onSave
}: ImageDrawingOverlayModalProps) {
  const [activeTool, setActiveTool] = useState<DrawTool>('pen');
  const [selectedColor, setSelectedColor] = useState<string>('#ef4444');
  const [strokeWidth, setStrokeWidth] = useState<number>(4);
  const [selectedStamp, setSelectedStamp] = useState<string>('damage');
  const [customText, setCustomText] = useState<string>('Dano Localizado');

  // Canvas Refs & State
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  // Undo/Redo History Stacks (StoringImageData / Canvas snapshots)
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const [isImageLoaded, setIsImageLoaded] = useState<boolean>(false);
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // Load Image onto Canvas
  useEffect(() => {
    if (!isOpen || !imageUrl) return;

    setIsImageLoaded(false);
    setImageError(null);
    setHistory([]);
    setHistoryIndex(-1);

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      setBaseImage(img);
      setIsImageLoaded(true);
    };

    img.onerror = (err) => {
      console.warn("Direct CORS image load warning, trying fallback reload:", err);
      // Fallback load without crossOrigin if CORS is strict
      const fallbackImg = new Image();
      fallbackImg.onload = () => {
        setBaseImage(fallbackImg);
        setIsImageLoaded(true);
      };
      fallbackImg.onerror = () => {
        setImageError("Não foi possível carregar a imagem para edição. Verifique o acesso.");
      };
      fallbackImg.src = imageUrl;
    };

    img.src = imageUrl;
  }, [isOpen, imageUrl]);

  // Render Image and Reset Canvas when Base Image is Ready
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set internal canvas resolution to native image size for crisp export
    canvas.width = baseImage.naturalWidth || baseImage.width || 1200;
    canvas.height = baseImage.naturalHeight || baseImage.height || 800;

    // Draw background image
    ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

    // Save initial state snapshot to history
    const initialSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([initialSnapshot]);
    setHistoryIndex(0);
  }, [baseImage]);

  useEffect(() => {
    if (isImageLoaded && baseImage) {
      initCanvas();
    }
  }, [isImageLoaded, baseImage, initCanvas]);

  // Helper: Get Canvas Scale Coordinates
  const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Push Canvas State to History Stack
  const saveSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(snapshot);

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Undo Function
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.putImageData(history[prevIndex], 0, 0);
      setHistoryIndex(prevIndex);
    }
  };

  // Redo Function
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.putImageData(history[nextIndex], 0, 0);
      setHistoryIndex(nextIndex);
    }
  };

  // Clear All Overlays
  const handleReset = () => {
    if (history.length > 0) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.putImageData(history[0], 0, 0);

      // Keep snapshot history
      const resetHistory = [history[0]];
      setHistory(resetHistory);
      setHistoryIndex(0);
    }
  };

  // Start Drawing / Action
  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const pos = getCanvasCoordinates(e.nativeEvent);
    setIsDrawing(true);
    setStartPos(pos);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (activeTool === 'highlighter') {
        ctx.strokeStyle = hexToRgba(selectedColor, 0.45);
        ctx.lineWidth = strokeWidth * 3;
      }
    } else if (activeTool === 'stamp') {
      const stampObj = DAMAGE_STAMPS.find(s => s.id === selectedStamp) || DAMAGE_STAMPS[0];
      drawBadgeStamp(ctx, pos.x, pos.y, stampObj.label, stampObj.color);
      saveSnapshot();
      setIsDrawing(false);
    } else if (activeTool === 'text') {
      if (customText.trim()) {
        drawTextTag(ctx, pos.x, pos.y, customText.trim(), selectedColor);
        saveSnapshot();
      }
      setIsDrawing(false);
    }
  };

  // Move Drawing
  const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentPos = getCanvasCoordinates(e.nativeEvent);

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      ctx.lineTo(currentPos.x, currentPos.y);
      ctx.stroke();
    } else if (['circle', 'rectangle', 'arrow'].includes(activeTool)) {
      // Restore last snapshot to preview live shape dragging
      if (historyIndex >= 0 && history[historyIndex]) {
        ctx.putImageData(history[historyIndex], 0, 0);
      }

      ctx.strokeStyle = selectedColor;
      ctx.fillStyle = hexToRgba(selectedColor, 0.15);
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';

      if (activeTool === 'circle') {
        const radiusX = Math.abs(currentPos.x - startPos.x) / 2;
        const radiusY = Math.abs(currentPos.y - startPos.y) / 2;
        const centerX = Math.min(startPos.x, currentPos.x) + radiusX;
        const centerY = Math.min(startPos.y, currentPos.y) + radiusY;

        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      } else if (activeTool === 'rectangle') {
        const width = currentPos.x - startPos.x;
        const height = currentPos.y - startPos.y;

        ctx.beginPath();
        ctx.rect(startPos.x, startPos.y, width, height);
        ctx.fill();
        ctx.stroke();
      } else if (activeTool === 'arrow') {
        drawArrow(ctx, startPos.x, startPos.y, currentPos.x, currentPos.y, strokeWidth, selectedColor);
      }
    }
  };

  // End Drawing
  const handleEnd = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);

    if (['pen', 'highlighter', 'circle', 'rectangle', 'arrow'].includes(activeTool)) {
      saveSnapshot();
    }
    setStartPos(null);
  };

  // Helper Drawing Functions
  const drawBadgeStamp = (ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string) => {
    const fontSize = Math.max(16, Math.round(ctx.canvas.width * 0.022));
    ctx.font = `bold ${fontSize}px sans-serif`;
    
    const textMetrics = ctx.measureText(text);
    const paddingX = fontSize * 0.8;
    const paddingY = fontSize * 0.5;
    const badgeWidth = textMetrics.width + paddingX * 2;
    const badgeHeight = fontSize + paddingY * 2;

    const startX = x - badgeWidth / 2;
    const startY = y - badgeHeight / 2;

    // Badge Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 4;

    // Badge Background Box
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(startX, startY, badgeWidth, badgeHeight, 10);
    ctx.fill();

    // Border
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Text Inside Badge
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
  };

  const drawTextTag = (ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string) => {
    const fontSize = Math.max(18, Math.round(ctx.canvas.width * 0.025));
    ctx.font = `900 ${fontSize}px sans-serif`;

    const textMetrics = ctx.measureText(text);
    const paddingX = fontSize * 0.7;
    const paddingY = fontSize * 0.4;
    const badgeWidth = textMetrics.width + paddingX * 2;
    const badgeHeight = fontSize + paddingY * 2;

    const startX = x - badgeWidth / 2;
    const startY = y - badgeHeight / 2;

    // Background pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(startX, startY, badgeWidth, badgeHeight, 8);
    ctx.fill();

    // Border with selected color
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Text
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
  };

  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    width: number,
    color: string
  ) => {
    const headLength = Math.max(16, width * 4);
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width * 1.5;

    // Arrow Shaft
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Arrow Head
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLength * Math.cos(angle - Math.PI / 6),
      toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      toX - headLength * Math.cos(angle + Math.PI / 6),
      toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  };

  const hexToRgba = (hex: string, alpha: number) => {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
    const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
    const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Handle Save
  const handleSaveAnnotatedImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      // Export as high-quality JPEG
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      onSave(dataUrl);
    } catch (err) {
      console.error("Erro ao salvar imagem anotada via Canvas:", err);
      // Fallback
      const pngUrl = canvas.toDataURL('image/png');
      onSave(pngUrl);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* Header Bar */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-950/80 border border-indigo-800/60 text-indigo-400">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-100 flex items-center gap-2">
                <span>Marcação & Anotação de Danos na Foto</span>
                <span className="text-[10px] bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Técnico
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Desenhe linhas, círculos ou adicione selos de defeitos sobre a imagem antes de enviar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Fechar editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          
          {/* Main Canvas Canvas Stage Viewport */}
          <div 
            ref={containerRef}
            className="flex-1 bg-slate-950/90 flex items-center justify-center p-3 relative overflow-auto touch-none"
          >
            {imageError ? (
              <div className="p-6 text-center max-w-md bg-rose-950/40 border border-rose-800/60 rounded-2xl text-rose-200">
                <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto mb-2" />
                <h4 className="font-bold text-sm mb-1">{imageError}</h4>
                <p className="text-xs text-rose-300">Tente carregar uma foto diretamente do seu dispositivo.</p>
              </div>
            ) : !isImageLoaded ? (
              <div className="flex flex-col items-center gap-2 text-indigo-400 font-bold text-xs p-8">
                <RotateCcw className="w-8 h-8 animate-spin" />
                <span>Carregando imagem em alta resolução...</span>
              </div>
            ) : (
              <div className="relative max-w-full max-h-full flex items-center justify-center shadow-2xl rounded-xl overflow-hidden border border-slate-800">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleStart}
                  onMouseMove={handleMove}
                  onMouseUp={handleEnd}
                  onMouseLeave={handleEnd}
                  onTouchStart={handleStart}
                  onTouchMove={handleMove}
                  onTouchEnd={handleEnd}
                  className="max-w-full max-h-[68vh] md:max-h-[72vh] object-contain cursor-crosshair touch-none rounded-lg"
                  style={{ touchAction: 'none' }}
                />

                {/* Floating Canvas Quick Tip */}
                <div className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800/80 text-[10px] text-slate-300 font-medium pointer-events-none flex items-center gap-1.5 shadow-lg">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  <span>Toque/Arraste para desenhar sobre a área afetada</span>
                </div>
              </div>
            )}
          </div>

          {/* Side Toolbar Panel */}
          <div className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-3.5 flex flex-col gap-3 shrink-0 overflow-y-auto">
            
            {/* Tool Selection Section */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                1. Ferramenta de Anotação
              </span>
              
              <div className="grid grid-cols-4 md:grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTool('pen')}
                  className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                    activeTool === 'pen'
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md font-extrabold'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                  }`}
                >
                  <Pencil className="w-4 h-4 text-indigo-300 shrink-0" />
                  <span className="truncate">Livre</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('highlighter')}
                  className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                    activeTool === 'highlighter'
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md font-extrabold'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                  }`}
                >
                  <Highlighter className="w-4 h-4 text-amber-300 shrink-0" />
                  <span className="truncate">Destaque</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('circle')}
                  className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                    activeTool === 'circle'
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md font-extrabold'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                  }`}
                >
                  <Circle className="w-4 h-4 text-rose-300 shrink-0" />
                  <span className="truncate">Círculo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('rectangle')}
                  className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                    activeTool === 'rectangle'
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md font-extrabold'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                  }`}
                >
                  <Square className="w-4 h-4 text-sky-300 shrink-0" />
                  <span className="truncate">Retângulo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('arrow')}
                  className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                    activeTool === 'arrow'
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md font-extrabold'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                  }`}
                >
                  <ArrowUpRight className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span className="truncate">Seta</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('stamp')}
                  className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                    activeTool === 'stamp'
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md font-extrabold'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                  }`}
                >
                  <Tag className="w-4 h-4 text-purple-300 shrink-0" />
                  <span className="truncate">Selo Danos</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTool('text')}
                  className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border col-span-2 md:col-span-2 cursor-pointer ${
                    activeTool === 'text'
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md font-extrabold'
                      : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                  }`}
                >
                  <Type className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">Etiqueta de Texto</span>
                </button>
              </div>
            </div>

            {/* Stamp Specific Sub-Selection */}
            {activeTool === 'stamp' && (
              <div className="space-y-1.5 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 animate-fade-in">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Escolha o Selo Rápido de Danos:
                </span>
                <div className="grid grid-cols-1 gap-1 max-h-36 overflow-y-auto pr-1">
                  {DAMAGE_STAMPS.map((s) => {
                    const IconComp = s.icon;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedStamp(s.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer text-left ${
                          selectedStamp === s.id
                            ? 'bg-slate-800 text-white border border-indigo-500 shadow-xs'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                        }`}
                      >
                        <IconComp className="w-3.5 h-3.5" style={{ color: s.color }} />
                        <span>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Text Tag Input */}
            {activeTool === 'text' && (
              <div className="space-y-1.5 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 animate-fade-in">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Texto da Etiqueta:
                </span>
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Ex: Fissura no motor, Curto-circuito"
                  className="w-full text-xs font-bold border border-slate-700 rounded-lg px-2.5 py-1.5 bg-slate-900 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Color Palette Section */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                2. Cor do Traço / Alerta
              </span>
              
              <div className="flex items-center gap-1.5 flex-wrap">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setSelectedColor(c.hex)}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer border-2 flex items-center justify-center ${
                      selectedColor === c.hex ? 'scale-110 border-white ring-2 ring-indigo-500 shadow-md' : 'border-slate-800 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  >
                    {selectedColor === c.hex && (
                      <span className={`w-2 h-2 rounded-full ${['#ffffff', '#eab308'].includes(c.hex) ? 'bg-black' : 'bg-white'}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Stroke Thickness Section */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                3. Espessura do Desenho
              </span>

              <div className="grid grid-cols-4 gap-1.5">
                {STROKE_SIZES.map((sz) => (
                  <button
                    key={sz.value}
                    type="button"
                    onClick={() => setStrokeWidth(sz.value)}
                    className={`py-1.5 rounded-lg text-[11px] font-extrabold transition-all border cursor-pointer ${
                      strokeWidth === sz.value
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700/60'
                    }`}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Editing History Controls */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all"
                title="Desfazer última alteração"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Desfazer</span>
              </button>

              <button
                type="button"
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all"
                title="Refazer alteração"
              >
                <Redo2 className="w-3.5 h-3.5" />
                <span>Refazer</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={historyIndex <= 0}
                className="py-1.5 px-2 bg-slate-800 hover:bg-rose-950/60 disabled:opacity-40 disabled:cursor-not-allowed text-rose-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-all"
                title="Limpar todas as anotações"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpar</span>
              </button>
            </div>

            {/* Save Action Footer Button */}
            <div className="pt-2 mt-auto">
              <button
                type="button"
                onClick={handleSaveAnnotatedImage}
                disabled={!isImageLoaded}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all cursor-pointer active:scale-98"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Foto Marcada</span>
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
