import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../src/core/application/services/chunk-search-service';

describe('cosineSimilarity', () => {
  it('should return 1.0 for identical vectors', () => {
    const v = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('should return -1 for opposite vectors', () => {
    const a = [1, 0];
    const b = [-1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
  });

  it('should return 0 for mismatched dimensions', () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('should return 0 for zero vectors', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('should handle high-dimensional vectors', () => {
    const dim = 1536;
    const a = Array.from({ length: dim }, () => Math.random());
    const b = [...a]; // identical
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
  });
});
