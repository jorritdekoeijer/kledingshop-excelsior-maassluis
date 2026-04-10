export class Fifo<T> {
  private items: T[] = [];

  push(item: T) {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.shift();
  }

  get size() {
    return this.items.length;
  }
}

export type StockBatch = {
  id: string;
  quantityRemaining: number;
};

export type StockConsumeResult = {
  batchId: string;
  quantity: number;
};

// Pure FIFO algorithm: consumes from oldest batches first.
export function consumeFifo(batches: readonly StockBatch[], quantity: number): StockConsumeResult[] {
  if (quantity <= 0) return [];
  let remaining = quantity;
  const result: StockConsumeResult[] = [];

  for (const b of batches) {
    if (remaining <= 0) break;
    if (b.quantityRemaining <= 0) continue;
    const take = Math.min(remaining, b.quantityRemaining);
    result.push({ batchId: b.id, quantity: take });
    remaining -= take;
  }

  if (remaining > 0) throw new Error("insufficient stock");
  return result;
}

