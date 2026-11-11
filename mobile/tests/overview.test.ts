import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOverview } from '../src/features/overview/model.ts';
import { mainSections, areaLinks, sectionForRoute } from '../src/features/overview/navigation.ts';
import { createManualTrade } from '../src/features/trading/model.ts';
import { createTimer, resetTimer } from '../src/features/quit/model.ts';
const now = new Date(2026, 10, 11, 12).getTime();
test('three navigation sections retain every working area and legacy routes stay classified', () => {
  assert.deepEqual(mainSections.map(s => s.route), ['today', 'areas', 'history']);
  assert.deepEqual(areaLinks.map(s => s.route).sort(), ['/nutrition', '/quit', '/running', '/sleep', '/trading']);
  for (const route of ['running', 'nutrition', 'quit', 'sleep', 'trading', 'goals', 'progress']) assert.equal(sectionForRoute(route), 'areas');
  assert.equal(sectionForRoute('today'), 'today'); assert.equal(sectionForRoute('history'), 'history');
});
test('history keeps imported daily counts intact without inventing individual trades or changing raw data', () => {
  const raw = { trading: JSON.stringify({ version: 1, trades: [createManualTrade({ result: 'LOSS', amount: '18.75', date: '2026-11-11', symbol: 'QA', note: 'retained' }, 'individual', 'CHF')], summaries: [{ id: 'daily:2026-11-11:USD', date: '2026-11-11', currency: 'USD', total: 100, count: 12 }] }) };
  const before = JSON.stringify(raw); const result = buildOverview(raw, now);
  assert.equal(result.items.length, 2); assert.equal(result.tradeCount, 13);
  const summary = result.items.find(i => i.id.startsWith('summary:'))!;
  assert.equal(summary.detail, '12 Trades · Tageszusammenfassung'); assert.match(summary.value, /100.*USD/);
  assert.match(summary.href, /summaryId=/); assert.match(result.items.find(i => i.id.startsWith('trade:'))!.href, /tradeId=individual/);
  assert.equal(JSON.stringify(raw), before);
});
test('history combines completed sleep, runs and attempts, but never fabricates records from active timers', () => {
  const sleepStart = now - 9 * 3600000, wakeAt = now - 3600000;
  const timer = resetTimer(createTimer('QA TIMER', now - 10000, 'timer'), now, 'attempt');
  const result = buildOverview({ sleep: JSON.stringify({ version: 1, revision: 1, active: { id: 'active', createdAt: now, sleepStart: now }, sessions: [{ id: 'sleep', sleepStart, wakeAt, duration: wakeAt - sleepStart, createdAt: sleepStart, updatedAt: wakeAt }], goalMinutes: 480 }), running: JSON.stringify({ version: 1, draft: null, runs: [{ id: 'run', startedAt: now - 10000, endedAt: now, durationMs: 10000, distanceM: 100, points: [] }] }), quit: JSON.stringify({ version: 1, timers: [timer, createTimer('STILL ACTIVE', now, 'active-timer')] }) }, now);
  assert.equal(result.items.length, 3); assert.equal(result.lastSleep, '8H 00M');
  assert.ok(result.items.some(i => i.href.includes('sessionId=sleep'))); assert.ok(result.items.some(i => i.href.includes('runId=run'))); assert.ok(result.items.some(i => i.href === '/quit/timer/attempt/attempt'));
  assert.deepEqual(result.errors, []);
});
test('unreadable feature data is isolated; empty state does not pretend activities or nutrition are zero', () => {
  const result = buildOverview({ sleep: '{bad', trading: JSON.stringify({ version: 1, trades: [], summaries: [{ id: 'daily:2026-11-11:USD', date: '2026-11-11', currency: 'USD', total: -12, count: 3 }] }) }, now);
  assert.deepEqual(result.errors, ['sleep']); assert.equal(result.items.length, 1); assert.equal(result.lastSleep, null);
  assert.deepEqual(buildOverview({}, now).items, []);
});
