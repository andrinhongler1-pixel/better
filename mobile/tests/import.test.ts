import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthDays, parseImport } from '../src/features/trading/model.ts';
import { TradingRepository } from '../src/features/trading/repository.ts';
test('iPhone paste accepts code fences, quoted fields, invisible marks, unicode dashes and spaced headers', () => {
  const expected = parseImport('2026-01-02,USD,-5.25,3');
  assert.deepEqual(parseImport('\uFEFF```csv\r\n  Date, Currency, PnL, Trades\r\n“2026–01–02”,“u\u200bsd”,“−5.25”,“3”\r\n```'), expected);
  assert.deepEqual(parseImport('date,currency,pnl,trades\\n2026-01-02,USD,-5.25,3'), expected);
  assert.deepEqual(parseImport('date;currency;pnl;trades\n2026-01-02;USD;-5,25;3'), expected);
  assert.deepEqual(parseImport('2026-01-02\tUSD\t-5.25\t3'), expected);
  assert.throws(() => parseImport('Some explanation\n2026-01-02,USD,1,1'), /Row 1/);
  assert.throws(() => parseImport('date,currency,pnl,trades\n2026-01-02,USX,1,1'), /Row 2/);
});
test('daily imports validate dates, cents, counts, currencies and duplicate rows', () => {
  const rows = parseImport('date,currency,pnl,trades\n2026-01-02,USD,-5.25,3\n2026-01-03,CHF,0.00,1');
  assert.equal(rows[0]!.total, -5.25);
  assert.deepEqual(monthDays('2026-01', [], 'USD', rows).days[1], { date: '2026-01-02', day: 2, total: -5.25, count: 3 });
  for (const row of ['2026-02-30,USD,1,1', '2026-01-01,USD,1.333,1', '2026-01-01,ABC,1,1', '2026-01-01,USD,1,0', '2026-01-01,USD,NaN,1']) assert.throws(() => parseImport(row));
  assert.throws(() => parseImport('2026-01-01,USD,1,1\n2026-01-01,USD,1,1'));
});
test('import is atomic, idempotent, durable and never overwrites individual trades or other keys', async () => {
  const values = new Map<string, string>([['better:v1:quit', 'keep']]); let fail = false;
  const storage = { async getItem(key: string) { return values.get(key) ?? null; }, async setItem(key: string, value: string) { if (fail) throw new Error('disk'); values.set(key, value); } };
  const repo = new TradingRepository(storage); await repo.load();
  const csv = '2026-01-02,USD,5.25,3';
  await repo.importDaily(csv); await repo.importDaily(csv); assert.equal(repo.getSnapshot().summaries.length, 1);
  await assert.rejects(repo.importDaily('2026-01-02,USD,9,3\n2026-01-03,USD,1,1')); assert.equal(repo.getSnapshot().summaries.length, 1);
  fail = true; await assert.rejects(repo.importDaily('2026-01-03,USD,1,1')); assert.equal(repo.getSnapshot().summaries.length, 1); fail = false;
  const input = { symbol: 'TEST', direction: 'LONG' as const, entry: '1', exit: '2', quantity: '1', fees: '0', date: '2026-01-02', note: '', currency: 'USD' as const };
  await assert.rejects(repo.save(input));
  await repo.save({ ...input, date: '2026-01-05' });
  await assert.rejects(repo.importDaily('2026-01-05,USD,1,1'));
  const reopened = new TradingRepository(storage); await reopened.load(); assert.equal(reopened.getSnapshot().summaries[0]!.total, 5.25); assert.equal(reopened.getSnapshot().trades.length, 1);
  await reopened.deleteSummary(reopened.getSnapshot().summaries[0]!.id); assert.equal(reopened.getSnapshot().summaries.length, 0); assert.equal(reopened.getSnapshot().trades.length, 1);
  assert.equal(values.get('better:v1:quit'), 'keep');
});
