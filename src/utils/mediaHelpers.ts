import type { UploadedAudioItem, UploadedImageItem } from '../types/design';

const MAX_IMAGE_DIM = 1400;
const JPEG_QUALITY = 0.85;

/**
 * Reads an image File/Blob, downscales overly huge photos to keep API payloads crisp & fast,
 * and returns an UploadedImageItem with base64 and preview data URL.
 */
export async function processImageFile(file: File): Promise<UploadedImageItem> {
  const originalDataUrl = await readAsDataUrl(file);
  const mimeType =
    file.type && file.type.startsWith('image/') ? file.type : 'image/png';

  try {
    const compressed = await resizeImageIfNeeded(originalDataUrl, mimeType);
    const [, base64 = ''] = compressed.dataUrl.split(',');
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name || `gambar-${Date.now()}.png`,
      mimeType: compressed.mimeType,
      base64,
      previewUrl: compressed.dataUrl,
      sizeBytes: file.size,
    };
  } catch {
    // Fallback to raw data URL if canvas resize fails (e.g., SVG or unsupported bitmap)
    const [, base64 = ''] = originalDataUrl.split(',');
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name || `gambar-${Date.now()}.png`,
      mimeType,
      base64,
      previewUrl: originalDataUrl,
      sizeBytes: file.size,
    };
  }
}

export async function processAudioFile(
  file: Blob,
  filename: string,
  source: 'recording' | 'file',
  durationSec?: number
): Promise<UploadedAudioItem> {
  const dataUrl = await readAsDataUrl(file);
  const [, base64 = ''] = dataUrl.split(',');
  const mimeType =
    file.type && file.type.startsWith('audio/')
      ? file.type.split(';')[0]
      : inferAudioMime(filename);

  return {
    name: filename,
    mimeType,
    base64,
    previewUrl: dataUrl,
    source,
    durationSec,
  };
}

function inferAudioMime(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.webm')) return 'audio/webm';
  return 'audio/mpeg';
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file media.'));
    reader.readAsDataURL(blob);
  });
}

function resizeImageIfNeeded(
  dataUrl: string,
  mimeType: string
): Promise<{ dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      if (w <= MAX_IMAGE_DIM && h <= MAX_IMAGE_DIM) {
        resolve({ dataUrl, mimeType });
        return;
      }

      const scale = Math.min(MAX_IMAGE_DIM / w, MAX_IMAGE_DIM / h);
      const targetW = Math.round(w * scale);
      const targetH = Math.round(h * scale);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataUrl, mimeType });
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);

      const outMime = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      const outUrl = canvas.toDataURL(outMime, JPEG_QUALITY);
      resolve({ dataUrl: outUrl, mimeType: outMime });
    };
    img.onerror = () => reject(new Error('Gagal memuat pratinjau gambar.'));
    img.src = dataUrl;
  });
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
