/**
 * In-place array compaction. Retains elements where `predicate` returns true,
 * removes the rest by swap-and-truncate. Zero allocations per call.
 *
 * Preserves relative order of kept elements.
 */
export function compactArray<T>(arr: T[], predicate: (item: T) => boolean): void {
  let write = 0;
  for (let read = 0; read < arr.length; read++) {
    if (predicate(arr[read])) {
      if (write !== read) {
        arr[write] = arr[read];
      }
      write++;
    }
  }
  arr.length = write;
}
