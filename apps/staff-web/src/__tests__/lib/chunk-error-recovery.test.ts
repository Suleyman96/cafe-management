import { describe, expect, it } from 'vitest';
import { isChunkLoadError } from '@/components/pwa/chunk-error-recovery';

describe('isChunkLoadError', () => {
  it('matches Error objects with name=ChunkLoadError', () => {
    const err = new Error('Loading chunk 42 failed.');
    err.name = 'ChunkLoadError';
    expect(isChunkLoadError(err)).toBe(true);
  });

  it('matches webpack JS chunk message strings', () => {
    expect(isChunkLoadError('Loading chunk 42 failed.')).toBe(true);
    expect(isChunkLoadError('Loading chunk app-pages-internals failed.')).toBe(true);
  });

  it('matches webpack CSS chunk message strings', () => {
    expect(isChunkLoadError('Loading CSS chunk 3 failed.')).toBe(true);
  });

  it('matches dynamic ESM import failures', () => {
    expect(isChunkLoadError('Failed to fetch dynamically imported module: /chunks/x.js')).toBe(
      true,
    );
    expect(isChunkLoadError('error loading dynamically imported module')).toBe(true);
  });

  it('matches event-like objects with a message property', () => {
    expect(isChunkLoadError({ message: 'ChunkLoadError: Loading chunk 7 failed' })).toBe(true);
  });

  it('does not match unrelated errors', () => {
    expect(isChunkLoadError(new TypeError('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError('Network request failed')).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
    expect(isChunkLoadError({})).toBe(false);
  });

  it('treats an empty message as non-matching', () => {
    expect(isChunkLoadError('')).toBe(false);
    expect(isChunkLoadError(new Error(''))).toBe(false);
  });
});
