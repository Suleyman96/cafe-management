export type AllowedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export const ALLOWED_IMAGE_MIMES: ReadonlySet<AllowedImageMime> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export type ValidateImageError =
  | { kind: 'too_large'; maxSizeMB: number }
  | { kind: 'bad_mime'; mime: string }
  | { kind: 'magic_bytes_mismatch'; declared: string };

export interface ValidateImageOptions {
  maxSizeMB: number;
}

export type ValidateImageResult =
  | { ok: true; mime: AllowedImageMime }
  | { ok: false; error: ValidateImageError };

// Detect the actual format from the first ~12 bytes. Returns null for unknown.
// Only the three allowed formats are recognised; anything else is rejected.
export function detectImageMime(bytes: Uint8Array): AllowedImageMime | null {
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export async function validateImageFile(
  file: File,
  options: ValidateImageOptions,
): Promise<ValidateImageResult> {
  const maxBytes = options.maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return { ok: false, error: { kind: 'too_large', maxSizeMB: options.maxSizeMB } };
  }

  if (!ALLOWED_IMAGE_MIMES.has(file.type as AllowedImageMime)) {
    return { ok: false, error: { kind: 'bad_mime', mime: file.type } };
  }

  const head = await file.slice(0, 12).arrayBuffer();
  const detected = detectImageMime(new Uint8Array(head));

  if (detected === null || detected !== file.type) {
    return { ok: false, error: { kind: 'magic_bytes_mismatch', declared: file.type } };
  }

  return { ok: true, mime: detected };
}
