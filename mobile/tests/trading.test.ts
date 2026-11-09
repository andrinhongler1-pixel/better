import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createManualTrade, createTrade, isManualTrade, monthDays, parseTrades, pnl, statistics } from '../src/features/trading/model.ts';
import { TradingRepository } from '../src/features/trading/repository.ts';
const input = { symbol: ' aapl ', direction: 'LONG' as const, entry: '100', exit: '110', quantity: '2', fees: '3', date: '2026-11-01', note: ' patient entry ', currency: 'USD' as const };
const manual = { result: 'PROFIT' as const, amount: '25.50', date: '2026-11-07', symbol: '', note: '' };

test('manual profit and loss use one positive decimal amount and signed P&L', () => {
  const profit = createManualTrade(manual, 'profit');
  const loss = createManualTrade({ ...manual, result: 'LOSS', amount: '18,75' }, 'loss');
  assert.equal(pnl(profit), 25.5); assert.equal(pnl(loss), -18.75);
  assert.equal(pnl(createManualTrade({ ...manual, amount: '.50' }, 'half')), .5);
  assert.deepEqual(statistics([profit, loss]), { totals: { USD: 6.75 }, count: 2, wins: 1, winRate: 50 });
  assert.deepEqual(monthDays('2026-11', [profit, loss], 'USD').days[6], { date: manual.date, day: 7, count: 2, total: 6.75 });
  assert.deepEqual(parseTrades(JSON.stringify({ version: 1, trades: [profit, loss] })), [profit, loss]);
});

test('manual input rejects empty, negative, zero, malformed amounts and impossible dates', () => {
  for (const amount of ['', ' ', '-18.75', '-0', '0', 'NaN', 'Infinity', '1e2', '1.234', '12USD', '1,2,3']) assert.throws(() => createManualTrade({ ...manual, amount }, 'bad'));
  assert.throws(() => createManualTrade({ ...manual, date: '2026-02-30' }, 'bad'));
  assert.throws(() => parseTrades(JSON.stringify({ version: 1, trades: [{ ...createManualTrade(manual, 'bad'), original: createManualTrade(manual, 'bad') }] })));
});

test('manual save, edit, date change and delete update calendar and preserve imported counts and unrelated storage', async () => {
  const legacy = createTrade(input, 'legacy');
  const summary = { id: 'daily:2026-11-02:USD', date: '2026-11-02', currency: 'USD', total: 100, count: 12 };
  const untouched = new Map([['better:v1:quit', 'timers'], ['better:v1:nutrition', 'food'], ['better:v1:trading-goals', 'goals'], ['notes', 'notes']]);
  const values = new Map([...untouched, ['better:v1:trading', JSON.stringify({ version: 1, trades: [legacy], summaries: [summary] })]]);
  const storage = { async getItem(key: string) { return values.get(key) ?? null; }, async setItem(key: string, value: string) { values.set(key, value); } };
  const repo = new TradingRepository(storage); await repo.load();
  await repo.saveManual(manual); await repo.saveManual({ ...manual, result: 'LOSS', amount: '18.75' });
  const profit = repo.getSnapshot().trades[1]!; const loss = repo.getSnapshot().trades[2]!;
  assert.equal(monthDays('2026-11', repo.getSnapshot().trades, 'USD', repo.getSnapshot().summaries).days[6]!.total, 6.75);
  await repo.saveManual({ ...manual, result: 'LOSS', amount: '10', date: '2026-11-08' }, profit.id);
  const days = monthDays('2026-11', repo.getSnapshot().trades, 'USD', repo.getSnapshot().summaries).days;
  assert.equal(days[6]!.total, -18.75); assert.equal(days[7]!.total, -10);
  assert.equal(days.reduce((sum, day) => sum + day.total, 0), 88.25);
  assert.equal(days.reduce((sum, day) => sum + day.count, 0), 15);
  await assert.rejects(repo.saveManual({ ...manual, date: summary.date }), /double-count/);
  await assert.rejects(repo.saveManual({ ...manual, date: summary.date }, loss.id), /double-count/);
  await assert.rejects(repo.importDaily('2026-11-07,USD,-18.75,1'), /Individual trades/);
  await repo.importDaily('2026-11-02,USD,100,12');
  await repo.delete(loss.id);
  const reopened = new TradingRepository(storage); await reopened.load();
  assert.equal(reopened.getSnapshot().status, 'ready');
  assert.deepEqual(reopened.getSnapshot().summaries, [summary]);
  assert.deepEqual(reopened.getSnapshot().trades[0], legacy);
  assert.equal(reopened.getSnapshot().trades.length, 2);
  assert.equal(monthDays('2026-11', reopened.getSnapshot().trades, 'USD', reopened.getSnapshot().summaries).days[6]!.count, 0);
  for (const [key, value] of untouched) assert.equal(values.get(key), value);
});

test('explicitly editing a legacy individual retains original prices and currency without inventing records', async () => {
  const legacy = createTrade({ ...input, currency: 'CHF' }, 'legacy');
  let raw = JSON.stringify({ version: 1, trades: [legacy], summaries: [] });
  const repo = new TradingRepository({ async getItem() { return raw; }, async setItem(_key, value) { raw = value; } });
  await repo.load(); await repo.saveManual({ ...manual, amount: '20' }, legacy.id);
  const trade = repo.getSnapshot().trades[0]!;
  assert.ok(isManualTrade(trade)); assert.equal(trade.currency, 'CHF'); assert.deepEqual(trade.original, legacy);
  assert.equal(pnl(trade), 20); assert.equal(repo.getSnapshot().trades.length, 1);
  assert.deepEqual(parseTrades(raw), [trade]);
});
test('calendar starts on Monday, includes weekends and leap day, groups by close date and currency', () => {
  const result = monthDays('2026-11', [createTrade(input, 'a'), createTrade({ ...input, currency: 'CHF' }, 'b')], 'USD');
  assert.equal(result.offset, 6); assert.equal(result.days.length, 30);
  assert.deepEqual(result.days[0], { date: '2026-11-01', day: 1, count: 1, total: 17 });
  assert.equal(monthDays('2028-02', [], 'USD').days.length, 29);
  assert.equal(monthDays('2026-12', [], 'USD').days[0]!.count, 0);
});
test('long and short P&L subtract fees and support fractional units and comma input', () => {
  const long = createTrade(input, 'a');
  assert.equal(long.symbol, 'AAPL'); assert.equal(long.note, 'patient entry'); assert.equal(pnl(long), 17);
  assert.equal(pnl(createTrade({ ...input, direction: 'SHORT' }, 'b')), -23);
  assert.equal(pnl(createTrade({ ...input, direction: 'SHORT', entry: '110', exit: '100', quantity: '0,5', fees: '1' }, 'c')), 4);
});
test('rejects bad dates, nonpositive units, negative fees and invalid numbers', () => {
  for (const changes of [{ date: '2026-02-30' }, { quantity: '0' }, { fees: '-1' }, { entry: 'Infinity' }, { exit: '1.2.3' }, { symbol: '' }]) assert.throws(() => createTrade({ ...input, ...changes }, 'x'));
});
test('totals keep currencies separate; break-even is not a win; tiny prices round-trip', () => {
  const trades = [createTrade(input, 'a'), createTrade({ ...input, currency: 'CHF', exit: '100', fees: '0' }, 'b')];
  assert.deepEqual(statistics(trades), { totals: { USD: 17, CHF: 0 }, count: 2, wins: 1, winRate: 50 });
  const tiny = createTrade({ ...input, entry: '0.00000001' }, 'tiny');
  assert.deepEqual(parseTrades(JSON.stringify({ version: 1, trades: [tiny] })), [tiny]);
  assert.throws(() => parseTrades('{bad')); assert.throws(() => parseTrades(JSON.stringify({ version: 1, trades: [trades[0], trades[0]] })));
});
test('queued writes persist concurrent trades, edits and deletion, and preserve state on failure', async () => {
  let value: string | null = null; let fail = false;
  const storage = { async getItem() { return value; }, async setItem(_key: string, next: string) { if (fail) throw new Error('full'); value = next; } };
  const repo = new TradingRepository(storage); await repo.load();
  await Promise.all([repo.save(input), repo.save({ ...input, symbol: 'MSFT' })]);
  assert.equal(repo.getSnapshot().trades.length, 2);
  const id = repo.getSnapshot().trades[0]!.id;
  await repo.save({ ...input, exit: '120' }, id); assert.equal(pnl(repo.getSnapshot().trades[0]!), 37);
  fail = true; await assert.rejects(repo.delete(id)); assert.equal(repo.getSnapshot().trades.length, 2);
  fail = false; await repo.delete(id);
  const reopened = new TradingRepository(storage); await reopened.load(); assert.equal(reopened.getSnapshot().trades[0]!.symbol, 'MSFT');
  value = '{bad'; await reopened.load(); assert.equal(reopened.getSnapshot().status, 'error'); await assert.rejects(reopened.save(input)); assert.equal(value, '{bad');
});
