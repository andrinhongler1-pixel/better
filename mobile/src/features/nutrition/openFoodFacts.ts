import { emptyNutrition, normalizeBarcode } from './model.ts';
import type { FoodProduct, Nutrient } from './model.ts';
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function parseOpenFoodFacts(data: unknown, barcode: string, now = Date.now()): FoodProduct | null {
  const response = data as { status?: number; product?: Record<string, unknown> } | null;
  if (!response || response.status !== 1 || !response.product) return null;
  const product = response.product;
  if (typeof product.code === 'string' && normalizeBarcode(product.code) !== normalizeBarcode(barcode)) throw new Error('The database returned a different barcode. Check the label or create the product manually.');
  const nutrients = (product.nutriments && typeof product.nutriments === 'object' ? product.nutriments : {}) as Record<string, unknown>;
  const per100g = emptyNutrition();
  const unit = text(product.product_quantity_unit, 12).toLowerCase();
  const liquid = ['ml', 'l', 'cl', 'dl'].includes(unit) || product.nutrition_data_per === '100ml';
  const noData = product.no_nutrition_data === 'on';
  function read(field: string, key: Nutrient, expectedUnit: string) {
    const value = nutrients[`${field}_100g`];
    const fieldUnit = nutrients[`${field}_unit`];
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= (key === 'calories' ? 1000 : 100) && (fieldUnit === undefined || fieldUnit === expectedUnit) ? value : null;
  }
  if (!liquid && !noData) {
    per100g.calories = read('energy-kcal', 'calories', 'kcal');
    const kj = nutrients['energy-kj_100g'] ?? (nutrients.energy_unit === 'kJ' ? nutrients.energy_100g : undefined);
    if (per100g.calories === null && (nutrients['energy-kj_unit'] === undefined || nutrients['energy-kj_unit'] === 'kJ') && typeof kj === 'number' && Number.isFinite(kj) && kj >= 0 && kj <= 4184) per100g.calories = kj / 4.184;
    per100g.protein = read('proteins', 'protein', 'g'); per100g.carbohydrates = read('carbohydrates', 'carbohydrates', 'g'); per100g.fat = read('fat', 'fat', 'g');
  }
  return { barcode: normalizeBarcode(barcode), name: text(product.product_name, 160) || text(product.product_name_en, 160) || 'Unnamed product — edit before logging', brand: text(product.brands, 120), per100g, source: 'open-food-facts', labelChecked: false, updatedAt: now,
    ...(liquid ? { warning: 'This product is measured in millilitres. Per-100ml values cannot be converted to grams without density. Enter verified per-100g label values to log it in grams.' } : noData ? { warning: 'The database marks nutrition data as unavailable. Enter the values from the label.' } : {}) };
}
export async function lookupOpenFoodFacts(barcode: string, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<FoodProduct | null> {
  const code = normalizeBarcode(barcode);
  const controller = new AbortController(); const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 12000);
  try {
    const fields = 'code,product_name,product_name_en,brands,nutriments,nutrition_data_per,product_quantity_unit,no_nutrition_data';
    const response = await fetcher(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}&app_name=better-web&app_version=0.1.0`, { signal: controller.signal, credentials: 'omit', headers: { Accept: 'application/json' } });
    if (response.status === 404) return null;
    if (response.status === 429) throw new Error('The food database is busy. Wait a minute, or create this product manually.');
    if (!response.ok) throw new Error('The food database is unavailable. Try again or enter the label manually.');
    return parseOpenFoodFacts(await response.json(), code);
  } catch (error) {
    if (signal?.aborted) throw new Error('Lookup cancelled.');
    if (controller.signal.aborted) throw new Error('Lookup timed out. Try again or enter the label manually.');
    if (error instanceof TypeError) throw new Error('No connection to the food database. Saved products still work; you can also enter this product manually.');
    throw error;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
