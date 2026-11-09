import { emptyData, normalizeBarcode, nutrientKeys, parseData, portion, validDate, validateProduct } from './model.ts';
import type { FoodProduct, NutritionData } from './model.ts';
interface Storage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
// New feature only. No existing better. keys are read or modified.
export const NUTRITION_KEY = 'better:v1:nutrition';
export class NutritionRepository {
  private storage: Storage;
  private snapshot: { data: NutritionData; status: 'loading' | 'ready' | 'error' } = { data: emptyData(), status: 'loading' };
  private listeners = new Set<() => void>(); private queue: Promise<unknown> = Promise.resolve();
  constructor(storage: Storage) { this.storage = storage; }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(data: NutritionData, status: typeof this.snapshot.status) { this.snapshot = { data, status }; this.listeners.forEach(fn => fn()); }
  async load() { try { this.publish(parseData(await this.storage.getItem(NUTRITION_KEY)), 'ready'); } catch { this.publish(this.snapshot.data, 'error'); } }
  private change(change: (data: NutritionData) => NutritionData) {
    const operation = this.queue.then(async () => {
      if (this.snapshot.status !== 'ready') throw new Error('Load your nutrition data before making changes.');
      const next = change(this.snapshot.data);
      await this.storage.setItem(NUTRITION_KEY, JSON.stringify(next)); this.publish(next, 'ready');
    });
    this.queue = operation.catch(() => {}); return operation;
  }
  product(barcode: string) { return this.snapshot.data.products[normalizeBarcode(barcode)] ?? null; }
  saveProduct(product: FoodProduct) {
    const valid = validateProduct(product);
    return this.change(data => ({ ...data, products: { ...data.products, [valid.barcode]: valid } }));
  }
  log(product: FoodProduct, grams: number, date: string, token: string) {
    const valid = validateProduct(product); const nutrition = portion(valid.per100g, grams);
    if (!validDate(date)) throw new Error('Choose a valid journal date.');
    if (!token || token.length > 160) throw new Error('Reopen the product before logging.');
    if (nutrientKeys.every(key => nutrition[key] === null)) throw new Error('Enter at least one known nutrition value from the label before logging.');
    return this.change(data => data.entries.some(entry => entry.id === token) ? data : ({ ...data,
      products: { ...data.products, [valid.barcode]: valid }, entries: [...data.entries, { id: token, date, product: valid, grams, nutrition, createdAt: Date.now() }],
    }));
  }
}
