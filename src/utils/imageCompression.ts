/**
 * Utilitário de compressão automática de fotos de evidência via Canvas.
 * Reduz dimensões mantendo a proporção (máx 1280px por padrão) e aplica qualidade JPEG (~0.75),
 * reduzindo drasticamente a carga de armazenamento no dispositivo do usuário (ex: de ~5MB para ~100KB-150KB).
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 a 1.0
  format?: 'image/jpeg' | 'image/webp';
}

export async function compressImageWithCanvas(
  fileOrDataUrl: File | string,
  options: CompressImageOptions = {}
): Promise<string> {
  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.75,
    format = 'image/jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const processCanvas = () => {
      try {
        let width = img.width;
        let height = img.height;

        if (width <= 0 || height <= 0) {
          if (typeof fileOrDataUrl === 'string') return resolve(fileOrDataUrl);
        }

        // Redimensiona proporcionalmente para não ultrapassar limites de altura e largura
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (typeof fileOrDataUrl === 'string') return resolve(fileOrDataUrl);
          return reject(new Error('Não foi possível inicializar o contexto 2D do Canvas para compressão.'));
        }

        // Suavização de imagem e interpolação de alta qualidade
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Fundo branco sólido em caso de transparências
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Desenha a imagem renderizada com as novas dimensões reduzidas
        ctx.drawImage(img, 0, 0, width, height);

        // Exporta o canvas comprimido como Data URL JPEG/WebP
        const compressedDataUrl = canvas.toDataURL(format, quality);

        console.log(
          `[Canvas Compression] Foto de evidência comprimida com sucesso. Dimensões: ${width}x${height}px. Qualidade: ${quality * 100}%.`
        );

        resolve(compressedDataUrl);
      } catch (err) {
        console.warn('[Canvas Compression] Falha na compressão via Canvas, utilizando fallback:', err);
        if (typeof fileOrDataUrl === 'string') resolve(fileOrDataUrl);
        else reject(err);
      }
    };

    img.onload = processCanvas;
    img.onerror = (err) => {
      console.warn('[Canvas Compression] Erro ao carregar elemento Image para o Canvas:', err);
      if (typeof fileOrDataUrl === 'string') resolve(fileOrDataUrl);
      else reject(err);
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === 'string') {
          img.src = e.target.result;
        } else {
          reject(new Error('Leitura do arquivo falhou.'));
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}

/**
 * Função utilitária para notificar o Service Worker sobre fotos de evidências comprimidas,
 * salvando-as de forma persistente no CacheStorage 'service-photos'.
 */
export function cacheEvidencePhotosInSW(photoUrls: string[], orderId?: string) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (!navigator.serviceWorker.controller) return;

  navigator.serviceWorker.controller.postMessage({
    type: 'CACHE_EVIDENCE_PHOTOS',
    urls: photoUrls,
    orderId: orderId || 'os_evidence'
  });
}
