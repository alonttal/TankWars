import { describe, it, expect } from 'vitest';
import { compactArray } from './compactArray.ts';

describe('compactArray', () => {
  it('handles empty array', () => {
    const arr: number[] = [];
    compactArray(arr, () => true);
    expect(arr).toEqual([]);
  });

  it('keeps all elements when predicate always returns true', () => {
    const arr = [1, 2, 3, 4, 5];
    compactArray(arr, () => true);
    expect(arr).toEqual([1, 2, 3, 4, 5]);
  });

  it('removes all elements when predicate always returns false', () => {
    const arr = [1, 2, 3, 4, 5];
    compactArray(arr, () => false);
    expect(arr).toEqual([]);
    expect(arr.length).toBe(0);
  });

  it('keeps only matching elements in order', () => {
    const arr = [1, 2, 3, 4, 5, 6];
    compactArray(arr, x => x % 2 === 0);
    expect(arr).toEqual([2, 4, 6]);
  });

  it('works with object predicates (typical particle life > 0 pattern)', () => {
    const particles = [
      { life: 0.5 },
      { life: 0 },
      { life: -0.1 },
      { life: 1.0 },
      { life: 0.01 },
    ];
    compactArray(particles, p => p.life > 0);
    expect(particles).toEqual([
      { life: 0.5 },
      { life: 1.0 },
      { life: 0.01 },
    ]);
  });

  it('preserves relative order', () => {
    const arr = [5, 3, 1, 4, 2];
    compactArray(arr, x => x > 2);
    expect(arr).toEqual([5, 3, 4]);
  });

  it('mutates the original array (no new allocation)', () => {
    const arr = [1, 2, 3];
    const ref = arr;
    compactArray(arr, x => x > 1);
    expect(arr).toBe(ref);
    expect(arr).toEqual([2, 3]);
  });
});
