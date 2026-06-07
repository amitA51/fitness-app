// ============================================================================
// Image compression — client-side WebP downscale for progress photos
// ============================================================================
// Trainees upload progress photos straight from the camera; raw phone captures
// run 3–8 MB which both overruns the 5 MB storage cap and wastes the coach's
// bandwidth. We downscale to a sane max dimension and re-encode as WebP on the
// canvas — no new dependency. If the browser can't produce a WebP blob we fall
// back to the original file when it already fits the cap, otherwise we throw a
// coded error the caller can surface inline.

/** Storage bucket hard limit (matches the 'progress-photos' bucket policy). */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const DEFAULT_MAX_DIM = 1280;
const DEFAULT_QUALITY = 0.8;

/** Coded error so callers can map to Hebrew copy without string-matching. */
export class ImageCompressError extends Error {
  readonly code: 'too_large' | 'decode_failed' | 'encode_failed';
  constructor(code: 'too_large' | 'decode_failed' | 'encode_failed') {
    super(`image compression failed: ${code}`);
    this.name = 'ImageCompressError';
    this.code = code;
  }
}

/** Largest edge after scaling so the smaller edge keeps the aspect ratio. */
function scaledSize(
  width: number,
  height: number,
  maxDim: number
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDim) return { width, height };
  const ratio = maxDim / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * Compress an image File to a WebP Blob, scaled so its longest edge is at most
 * `maxDim`. Falls back to the original file when WebP encoding is unavailable
 * and the original already fits the cap; throws ImageCompressError otherwise.
 */
export async function compressImageToWebP(
  file: File,
  maxDim: number = DEFAULT_MAX_DIM,
  quality: number = DEFAULT_QUALITY
): Promise<Blob> {
  const fitsCap = file.size <= MAX_PHOTO_BYTES;

  // Decode honoring EXIF orientation (so portrait photos stay upright).
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Decode unavailable (e.g. unsupported in this engine) — keep the original
    // if it already fits, otherwise we genuinely cannot proceed.
    if (fitsCap) return file;
    throw new ImageCompressError('decode_failed');
  }

  try {
    const { width, height } = scaledSize(bitmap.width, bitmap.height, maxDim);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (fitsCap) return file;
      throw new ImageCompressError('encode_failed');
    }
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/webp', quality);
    });

    // toBlob yields null when WebP isn't supported by the encoder.
    if (!blob || blob.type !== 'image/webp') {
      if (fitsCap) return file;
      throw new ImageCompressError('encode_failed');
    }

    // Re-encoding occasionally grows tiny images; keep whichever is smaller.
    if (blob.size > file.size && fitsCap) return file;
    if (blob.size > MAX_PHOTO_BYTES) throw new ImageCompressError('too_large');
    return blob;
  } finally {
    bitmap.close();
  }
}
