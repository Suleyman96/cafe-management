import { describe, expect, it } from 'vitest';
import { detectImageMime, validateImageFile } from '@/lib/uploads/validate-image';

const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG_HEADER = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBP_HEADER = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const GIF_HEADER = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
const SVG_HEADER = new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0, 0, 0, 0, 0, 0, 0, 0]);

function makeFile(bytes: Uint8Array, type: string, sizeBytes?: number): File {
  const padding =
    sizeBytes && sizeBytes > bytes.length
      ? new Uint8Array(sizeBytes - bytes.length)
      : new Uint8Array(0);
  return new File([bytes as BlobPart, padding as BlobPart], 'test', { type });
}

describe('detectImageMime', () => {
  it('detects JPEG by FF D8 FF', () => {
    expect(detectImageMime(JPEG_HEADER)).toBe('image/jpeg');
  });

  it('detects PNG by 89 50 4E 47 0D 0A 1A 0A', () => {
    expect(detectImageMime(PNG_HEADER)).toBe('image/png');
  });

  it('detects WebP by RIFF...WEBP', () => {
    expect(detectImageMime(WEBP_HEADER)).toBe('image/webp');
  });

  it('returns null for GIF (not allowed)', () => {
    expect(detectImageMime(GIF_HEADER)).toBeNull();
  });

  it('returns null for SVG (not allowed)', () => {
    expect(detectImageMime(SVG_HEADER)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(detectImageMime(new Uint8Array(0))).toBeNull();
  });

  it('returns null for too-short input', () => {
    expect(detectImageMime(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe('validateImageFile', () => {
  it('accepts a valid JPEG within size', async () => {
    const file = makeFile(JPEG_HEADER, 'image/jpeg');
    const result = await validateImageFile(file, { maxSizeMB: 5 });
    expect(result).toEqual({ ok: true, mime: 'image/jpeg' });
  });

  it('accepts a valid PNG within size', async () => {
    const file = makeFile(PNG_HEADER, 'image/png');
    const result = await validateImageFile(file, { maxSizeMB: 5 });
    expect(result).toEqual({ ok: true, mime: 'image/png' });
  });

  it('accepts a valid WebP within size', async () => {
    const file = makeFile(WEBP_HEADER, 'image/webp');
    const result = await validateImageFile(file, { maxSizeMB: 5 });
    expect(result).toEqual({ ok: true, mime: 'image/webp' });
  });

  it('rejects oversized file', async () => {
    const oversized = makeFile(JPEG_HEADER, 'image/jpeg', 6 * 1024 * 1024);
    const result = await validateImageFile(oversized, { maxSizeMB: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ kind: 'too_large', maxSizeMB: 5 });
    }
  });

  it('rejects SVG by MIME (no magic-byte check needed)', async () => {
    const file = makeFile(SVG_HEADER, 'image/svg+xml');
    const result = await validateImageFile(file, { maxSizeMB: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('bad_mime');
    }
  });

  it('rejects GIF by MIME', async () => {
    const file = makeFile(GIF_HEADER, 'image/gif');
    const result = await validateImageFile(file, { maxSizeMB: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('bad_mime');
    }
  });

  it('rejects .txt renamed to .png (matches MIME but bytes are wrong)', async () => {
    const fakePng = makeFile(
      new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0, 0, 0, 0, 0, 0, 0]),
      'image/png',
    );
    const result = await validateImageFile(fakePng, { maxSizeMB: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('magic_bytes_mismatch');
    }
  });

  it('rejects PNG-bytes claimed as JPEG (mismatch in either direction)', async () => {
    const file = makeFile(PNG_HEADER, 'image/jpeg');
    const result = await validateImageFile(file, { maxSizeMB: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('magic_bytes_mismatch');
    }
  });
});
