/**
 * Fixed-capacity circular buffer with O(1) push that overwrites the oldest
 * element when full. Supports ordered iteration via forEach().
 */
export class CircularBuffer<T> {
  private buffer: T[];
  private head: number = 0; // next write position
  private count: number = 0;
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array<T>(capacity);
  }

  /** Number of elements currently stored. */
  get length(): number {
    return this.count;
  }

  /** Add an element. If full, the oldest element is overwritten. */
  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  /** Iterate elements in insertion order (oldest first). */
  forEach(callback: (item: T, index: number) => void): void {
    if (this.count === 0) return;
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      const idx = (start + i) % this.capacity;
      callback(this.buffer[idx], i);
    }
  }

  /** Get element by logical index (0 = oldest). */
  get(index: number): T | undefined {
    if (index < 0 || index >= this.count) return undefined;
    const start = this.count < this.capacity ? 0 : this.head;
    const idx = (start + index) % this.capacity;
    return this.buffer[idx];
  }

  /** Remove all elements. */
  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}
