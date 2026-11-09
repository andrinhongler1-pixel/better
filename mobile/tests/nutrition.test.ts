import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyTotals, normalizeBarcode, parseData, parseValue, portion } from '../src/features/nutrition/model.ts';
import type { FoodProduct } from '../src/features/nutrition/model.ts';
import { NutritionRepository, NUTRITION_KEY } from '../src/features/nutrition/repository.ts';
import { lookupOpenFoodFacts, parseOpenFoodFacts } from '../src/features/nutrition/openFoodFacts.ts';
const food: FoodProduct = { barcode: '4006381333931', name: 'Test food', brand: 'Test brand', per100g: { calories: 200, protein: 10, carbohydrates: 25, fat: 6 }, source: 'manual', labelChecked: false, updatedAt: 1000 };
function fixture() {
  const records = new Map<string, string>([['better:v1:quit', 'existing timers'], ['better:v1:trading', 'existing trades'], ['better:v1:trading-goals', 'existing goals']]);
  let fail = false; const storage = { async getItem(key: string) { return records.get(key) ?? null; }, async setItem(key: string, value: string) { if (fail) throw new Error('Disk full'); records.set(key, value); } };
  return { records, make: () => new NutritionRepository(storage), fail: (value: boolean) => { fail = value; } };
}
test('valid EAN-13, EAN-8 and UPC normalize without losing leading zeros; unsupported formats and bad checksums fail', () => {
  assert.equal(normalizeBarcode('4006381333931', 'EAN_13'), '4006381333931');
  assert.equal(normalizeBarcode('96385074', 'EAN_8'), '96385074');
  assert.equal(normalizeBarcode('036000291452', 'UPC_A'), '0036000291452');
  assert.equal(normalizeBarcode('04210007', 'UPC_E'), '0042000001007');
  for (const value of ['123', '4006381333932', '00000000', 'abcdefgh']) assert.throws(() => normalizeBarcode(value));
  assert.throws(() => normalizeBarcode('4006381333931', 'QR_CODE'));
});
test('gram portions preserve real zeros and missing values without estimating calories', () => {
  assert.deepEqual(portion({ calories: null, protein: 10, carbohydrates: 0, fat: null }, 150), { calories: null, protein: 15, carbohydrates: 0, fat: null });
  assert.equal(parseValue('', 'protein'), null); assert.equal(parseValue('0', 'protein'), 0); assert.equal(parseValue('2,5', 'protein'), 2.5);
  for (const value of ['-1', 'NaN', '101']) assert.throws(() => parseValue(value, 'protein'));
  for (const grams of [0, -1, Infinity, NaN, 100001]) assert.throws(() => portion(food.per100g, grams));
});
test('OFF reads only real 100g values, converts declared kJ and does not guess missing macros', () => {
  const result = parseOpenFoodFacts({ status: 1, product: { product_name: 'Database food', brands: 'Brand', nutriments: { 'energy-kcal_100g': 220, proteins_100g: 4, carbohydrates_100g: 0 } } }, food.barcode)!;
  assert.deepEqual(result.per100g, { calories: 220, protein: 4, carbohydrates: 0, fat: null }); assert.equal(result.labelChecked, false);
  const kj = parseOpenFoodFacts({ status: 1, product: { nutriments: { 'energy-kj_100g': 418.4 } } }, food.barcode)!; assert.ok(Math.abs(kj.per100g.calories! - 100) < 0.001);
  const liquid = parseOpenFoodFacts({ status: 1, product: { product_quantity_unit: 'ml', nutriments: { 'energy-kcal_100g': 40 } } }, food.barcode)!;
  assert.equal(liquid.per100g.calories, null); assert.match(liquid.warning!, /millilitres/);
  assert.equal(parseOpenFoodFacts({ status: 0 }, food.barcode), null);
  assert.throws(() => parseOpenFoodFacts({ status: 1, product: { code: '96385074' } }, food.barcode), /different barcode/);
});
test('API handles absent products, rate limits and network errors without inventing food', async () => {
  const response = (status: number, data: unknown) => (async () => ({ status, ok: status >= 200 && status < 300, json: async () => data })) as unknown as typeof fetch;
  assert.equal(await lookupOpenFoodFacts(food.barcode, undefined, response(404, {})), null);
  await assert.rejects(lookupOpenFoodFacts(food.barcode, undefined, response(429, {})), /busy/);
  await assert.rejects(lookupOpenFoodFacts(food.barcode, undefined, (async () => { throw new TypeError('offline'); }) as typeof fetch), /No connection/);
});
test('products cache by canonical barcode, survive reopening and edits do not rewrite old journal entries', async () => {
  const f = fixture(); const repo = f.make(); await repo.load();
  await repo.saveProduct(food); assert.deepEqual(repo.product(food.barcode), food);
  await repo.log(food, 150, '2026-11-07', 'scan-one');
  await repo.saveProduct({ ...food, name: 'Edited food', per100g: { ...food.per100g, calories: 300 } });
  const reopened = f.make(); await reopened.load(); assert.equal(reopened.product(food.barcode)!.name, 'Edited food');
  assert.equal(reopened.getSnapshot().data.entries[0]!.product.name, 'Test food'); assert.equal(reopened.getSnapshot().data.entries[0]!.nutrition.calories, 300);
  assert.equal(f.records.get('better:v1:quit'), 'existing timers'); assert.equal(f.records.get('better:v1:trading'), 'existing trades'); assert.equal(f.records.get('better:v1:trading-goals'), 'existing goals');
});
test('duplicate scan/save tokens log once, separate deliberate scans can log again, unknown subtotals stay explicit', async () => {
  const f = fixture(); const repo = f.make(); await repo.load();
  const partial = { ...food, per100g: { ...food.per100g, fat: null } };
  await Promise.all([repo.log(partial, 50, '2026-11-06', 'one'), repo.log(partial, 50, '2026-11-06', 'one')]);
  assert.equal(repo.getSnapshot().data.entries.length, 1);
  await repo.log(partial, 25, '2026-11-06', 'two');
  const stats = dailyTotals(repo.getSnapshot().data.entries); assert.equal(stats.totals.calories, 150); assert.equal(stats.totals.fat, null); assert.equal(stats.missing.fat, 2);
  await assert.rejects(async () => repo.log(food, 100, '2026-02-30', 'three')); assert.equal(repo.getSnapshot().data.entries.length, 2);
});
test('failed writes and corrupted storage cannot overwrite previous data', async () => {
  const f = fixture(); const repo = f.make(); await repo.load(); await repo.saveProduct(food);
  f.fail(true); await assert.rejects(repo.log(food, 100, '2026-11-07', 'one')); assert.equal(repo.getSnapshot().data.entries.length, 0);
  f.fail(false); await repo.log(food, 100, '2026-11-07', 'one'); assert.equal(repo.getSnapshot().data.entries.length, 1);
  f.records.set(NUTRITION_KEY, '{corrupt'); const bad = f.make(); await bad.load(); assert.equal(bad.getSnapshot().status, 'error');
  await assert.rejects(bad.saveProduct(food)); assert.equal(f.records.get(NUTRITION_KEY), '{corrupt');
  assert.throws(() => parseData('{bad')); assert.throws(() => parseData(JSON.stringify({ version: 1, products: { [food.barcode]: { ...food, per100g: { ...food.per100g, protein: -1 } } }, entries: [] })));
});
