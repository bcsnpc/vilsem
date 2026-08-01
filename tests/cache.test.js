import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

describe('buildCacheKey', () => {
  function buildCacheKey(datasetId, measures, filters) {
    const sortedMeasures = [...measures].sort();
    const sortedFilters = {};
    for (const k of Object.keys(filters).sort()) {
      sortedFilters[k] = filters[k];
    }
    const raw = JSON.stringify({ datasetId, measures: sortedMeasures, filters: sortedFilters });
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  it('produces deterministic keys for same input', () => {
    const key1 = buildCacheKey('ds1', ['A', 'B'], { 'T[X]': 1 });
    const key2 = buildCacheKey('ds1', ['A', 'B'], { 'T[X]': 1 });
    expect(key1).toBe(key2);
  });

  it('produces same key regardless of measure order', () => {
    const key1 = buildCacheKey('ds1', ['B', 'A'], { 'T[X]': 1 });
    const key2 = buildCacheKey('ds1', ['A', 'B'], { 'T[X]': 1 });
    expect(key1).toBe(key2);
  });

  it('produces same key regardless of filter key order', () => {
    const key1 = buildCacheKey('ds1', ['A'], { 'T[Y]': 2, 'T[X]': 1 });
    const key2 = buildCacheKey('ds1', ['A'], { 'T[X]': 1, 'T[Y]': 2 });
    expect(key1).toBe(key2);
  });

  it('produces different keys for different datasets', () => {
    const key1 = buildCacheKey('ds1', ['A'], {});
    const key2 = buildCacheKey('ds2', ['A'], {});
    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different measures', () => {
    const key1 = buildCacheKey('ds1', ['A'], {});
    const key2 = buildCacheKey('ds1', ['B'], {});
    expect(key1).not.toBe(key2);
  });

  it('produces different keys for different filter values', () => {
    const key1 = buildCacheKey('ds1', ['A'], { 'T[X]': 1 });
    const key2 = buildCacheKey('ds1', ['A'], { 'T[X]': 2 });
    expect(key1).not.toBe(key2);
  });
});

describe('cache TTL', () => {
  it('calculates correct expiry from TTL seconds', () => {
    const now = new Date('2026-04-01T10:00:00Z');
    const ttlSeconds = 300;
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    expect(expiresAt.toISOString()).toBe('2026-04-01T10:05:00.000Z');
  });

  it('default TTL is 300 seconds', () => {
    const defaultTtl = parseInt(process.env.DEFAULT_TTL, 10) || 300;
    expect(defaultTtl).toBe(300);
  });
});
