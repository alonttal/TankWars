import { describe, it, expect } from 'vitest';
import { CircularBuffer } from './CircularBuffer.ts';

describe('CircularBuffer', () => {
  it('starts empty', () => {
    const buf = new CircularBuffer<number>(5);
    expect(buf.length).toBe(0);
    expect(buf.capacity).toBe(5);
  });

  it('push increases length up to capacity', () => {
    const buf = new CircularBuffer<number>(3);
    buf.push(1);
    expect(buf.length).toBe(1);
    buf.push(2);
    buf.push(3);
    expect(buf.length).toBe(3);
    buf.push(4); // overflow
    expect(buf.length).toBe(3); // still 3
  });

  it('overwrites oldest when full', () => {
    const buf = new CircularBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4); // overwrites 1

    const items: number[] = [];
    buf.forEach(item => items.push(item));
    expect(items).toEqual([2, 3, 4]);
  });

  it('iterates in insertion order (oldest first)', () => {
    const buf = new CircularBuffer<string>(4);
    buf.push('a');
    buf.push('b');
    buf.push('c');

    const items: string[] = [];
    buf.forEach(item => items.push(item));
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('iterates correctly after wrap-around', () => {
    const buf = new CircularBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4);
    buf.push(5);

    const items: number[] = [];
    buf.forEach(item => items.push(item));
    expect(items).toEqual([3, 4, 5]);
  });

  it('get returns correct element by logical index', () => {
    const buf = new CircularBuffer<number>(3);
    buf.push(10);
    buf.push(20);
    buf.push(30);
    buf.push(40); // overwrites 10

    expect(buf.get(0)).toBe(20); // oldest
    expect(buf.get(1)).toBe(30);
    expect(buf.get(2)).toBe(40); // newest
    expect(buf.get(3)).toBeUndefined();
    expect(buf.get(-1)).toBeUndefined();
  });

  it('clear resets the buffer', () => {
    const buf = new CircularBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.clear();
    expect(buf.length).toBe(0);

    const items: number[] = [];
    buf.forEach(item => items.push(item));
    expect(items).toEqual([]);
  });

  it('works with object types', () => {
    const buf = new CircularBuffer<{ x: number; y: number }>(2);
    buf.push({ x: 1, y: 2 });
    buf.push({ x: 3, y: 4 });
    buf.push({ x: 5, y: 6 }); // overwrites first

    const items: { x: number; y: number }[] = [];
    buf.forEach(item => items.push(item));
    expect(items).toEqual([{ x: 3, y: 4 }, { x: 5, y: 6 }]);
  });

  it('forEach provides correct index', () => {
    const buf = new CircularBuffer<string>(3);
    buf.push('a');
    buf.push('b');
    buf.push('c');
    buf.push('d'); // wrap around

    const indices: number[] = [];
    buf.forEach((_item, index) => indices.push(index));
    expect(indices).toEqual([0, 1, 2]);
  });
});
