export const nutrientKeys = ['calories', 'protein', 'carbohydrates', 'fat'] as const;
export type Nutrient = typeof nutrientKeys[number];
export type Nutrition = Record<Nutrient, number | null>;
export interface FoodProduct {
  barcode: string; name: string; brand: string; per100g: Nutrition;
  source: 'manual' | 'open-food-facts'; labelChecked: boolean; updatedAt: number; warning?: string;
}
export interface FoodEntry { id: string; date: string; product: FoodProduct; grams: number; nutrition: Nutrition; createdAt: number }
export interface NutritionData { version: 1; products: Record<string, FoodProduct>; entries: FoodEntry[] }
export const emptyNutrition = (): Nutrition => ({ calories: null, protein: null, carbohydrates: null, fat: null });
export const emptyData = (): NutritionData => ({ version: 1, products: {}, entries: [] });
export function normalizeBarcode(input: string, format?: string): string {
  let code = input.trim().replace(/[\s-]/g, '');
  if (format && !['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E'].includes(format)) throw new Error('Unsupported format. Use an EAN-13, EAN-8 or UPC food barcode.');
  if (format === 'UPC_E') {
    if (!/^[01]\d{7}$/.test(code)) throw new Error('Invalid UPC-E barcode.');
    const d = code.slice(1, 7); const last = d[5]!;
    let expanded: string;
    if ('012'.includes(last)) expanded = d.slice(0, 2) + last + '0000' + d.slice(2, 5);
    else if (last === '3') expanded = d.slice(0, 3) + '00000' + d.slice(3, 5);
    else if (last === '4') expanded = d.slice(0, 4) + '00000' + d[4];
    else expanded = d.slice(0, 5) + '0000' + last;
    code = code[0] + expanded + code[7];
  }
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) throw new Error('Enter 8 (EAN-8), 12 (UPC-A) or 13 (EAN-13) digits.');
  if (/^0+$/.test(code)) throw new Error('This barcode is not valid.');
  const body = code.slice(0, -1);
  const sum = [...body].reverse().reduce((total, digit, i) => total + Number(digit) * (i % 2 === 0 ? 3 : 1), 0);
  if ((10 - sum % 10) % 10 !== Number(code.at(-1))) throw new Error('Barcode check digit is invalid. Check the printed digits and try again.');
  return code.length === 12 ? `0${code}` : code;
}
export function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const value = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === date;
}
export function parseValue(value: string, key: Nutrient): number | null {
  const text = value.trim().replace(',', '.');
  if (!text) return null;
  if (!/^\d+(\.\d+)?$/.test(text)) throw new Error(`Enter a valid ${key} value, or leave it empty if unknown.`);
  const number = Number(text); const maximum = key === 'calories' ? 1000 : 100;
  if (!Number.isFinite(number) || number > maximum) throw new Error(`${key} per 100g must be between 0 and ${maximum}.`);
  return number;
}
export function validateProduct(product: FoodProduct): FoodProduct {
  const barcode = normalizeBarcode(product.barcode);
  if (typeof product.name !== 'string' || !product.name.trim() || product.name.length > 160) throw new Error('Enter a food name (up to 160 characters).');
  if (typeof product.brand !== 'string' || product.brand.length > 120 || !['manual', 'open-food-facts'].includes(product.source) || typeof product.labelChecked !== 'boolean' || !Number.isSafeInteger(product.updatedAt) || product.updatedAt < 0) throw new Error('Invalid product information.');
  for (const key of nutrientKeys) {
    const value = product.per100g?.[key];
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > (key === 'calories' ? 1000 : 100))) throw new Error(`Invalid ${key} value.`);
  }
  if (product.warning !== undefined && (typeof product.warning !== 'string' || product.warning.length > 600)) throw new Error('Invalid product note.');
  return { ...product, barcode, name: product.name.trim(), brand: product.brand.trim(), per100g: { ...product.per100g } };
}
export function portion(nutrition: Nutrition, grams: number): Nutrition {
  if (!Number.isFinite(grams) || grams <= 0 || grams > 100000) throw new Error('Enter an amount greater than 0 and no more than 100,000 grams.');
  return Object.fromEntries(nutrientKeys.map(key => [key, nutrition[key] === null ? null : nutrition[key]! * grams / 100])) as Nutrition;
}
export function dailyTotals(entries: FoodEntry[]): { totals: Nutrition; missing: Record<Nutrient, number> } {
  const totals = emptyNutrition(); const missing = { calories: 0, protein: 0, carbohydrates: 0, fat: 0 };
  for (const entry of entries) for (const key of nutrientKeys) {
    const value = entry.nutrition[key];
    if (value === null) missing[key]++; else totals[key] = (totals[key] ?? 0) + value;
  }
  return { totals, missing };
}
export function parseData(raw: string | null): NutritionData {
  if (raw === null) return emptyData();
  const data = JSON.parse(raw);
  if (!data || data.version !== 1 || !data.products || typeof data.products !== 'object' || Array.isArray(data.products) || !Array.isArray(data.entries)) throw new Error('Nutrition data could not be read.');
  for (const [code, value] of Object.entries(data.products)) if (validateProduct(value as FoodProduct).barcode !== code) throw new Error('Product barcode mismatch.');
  const ids = new Set<string>();
  for (const entry of data.entries as FoodEntry[]) {
    if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) || !validDate(entry.date) || !Number.isSafeInteger(entry.createdAt) || entry.createdAt < 0) throw new Error('Invalid food journal entry.');
    ids.add(entry.id); validateProduct(entry.product);
    const calculated = portion(entry.product.per100g, entry.grams);
    if (!entry.nutrition || nutrientKeys.some(key => calculated[key] !== entry.nutrition[key])) throw new Error('Invalid food journal totals.');
  }
  return data;
}
