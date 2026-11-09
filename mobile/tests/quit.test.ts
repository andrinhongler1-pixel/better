import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTimer, durationParts, elapsed, parseData, resetTimer, statistics } from '../src/features/quit/model.ts';
import { QuitRepository } from '../src/features/quit/repository.ts';
const DAY = 86400000;
test('restoring an earlier timer preserves elapsed time, existing timers and persisted data', async () => {
  let raw: string | null = null; let id = 0;
  const now = Date.parse('2026-11-01T12:00:00+01:00');
  const start = Date.parse('2026-11-01T00:00:00+01:00');
  const storage = { async getItem() { return raw; }, async setItem(_key: string, value: string) { raw = value; } };
  const repo = new QuitRepository(storage, () => now, () => String(++id)); await repo.load();
  await repo.create('Existing timer'); await repo.restore('Recovered timer', start);
  const reopened = new QuitRepository(storage, () => now); await reopened.load();
  assert.equal(reopened.getSnapshot().data.timers.length, 2);
  assert.equal(statistics(reopened.getSnapshot().data.timers[1]!, now).current, 12 * 3600000);
  await assert.rejects(reopened.restore(' recovered TIMER ', start));
  await assert.rejects(reopened.restore('Future', now + 1000));
  assert.equal(reopened.getSnapshot().data.timers.length, 2);
});
function fixture() {
  let value: string | null = null;
  let failWrites = false;
  let time = Date.UTC(2026, 9, 25, 23, 59, 50);
  let sequence = 0;
  const storage = {
    async getItem() { return value; },
    async setItem(_key: string, next: string) { if (failWrites) throw new Error('Disk full'); value = next; },
  };
  const makeRepository = () => new QuitRepository(storage, () => time, () => `id-${++sequence}`);
  return { makeRepository, advance: (ms: number) => { time += ms; }, fail: () => { failWrites = true; }, recover: () => { failWrites = false; }, corrupt: () => { value = '{bad'; } };
}

test('timestamp duration survives midnight, multiple days, and a very long streak', () => {
  const start = Date.UTC(2026, 9, 25, 23, 59, 50);
  assert.equal(elapsed(start, start + 10 * DAY + 23000), 10 * DAY + 23000);
  assert.deepEqual(durationParts(123456 * DAY + 3661000), { days: 123456, hours: 1, minutes: 1, seconds: 1 });
  assert.equal(elapsed(start, start - DAY), 0);
});
test('first attempt has no history; best and total include live current duration', () => {
  const timer = createTimer('  No nicotine  ', 1000, 'one');
  assert.equal(timer.title, 'No nicotine');
  assert.deepEqual(statistics(timer, 61000), { current: 60000, best: 60000, attempts: 1, previousTotal: 0, total: 60000, clockBehind: false });
  assert.throws(() => createTimer(' ', 0, 'bad'));
});
test('reset keeps exact history, optional reason/note, best and previous total', () => {
  const timer = createTimer('No scrolling', 0, 'one');
  const next = resetTimer(timer, 12 * DAY + 8 * 3600000, 'a', 'SOCIAL MEDIA', '  Late feed  ');
  const third = resetTimer(next, next.currentStartAt + DAY, 'b');
  const stats = statistics(third, third.currentStartAt + 60000);
  assert.equal(timer.history.length, 0);
  assert.equal(stats.attempts, 3);
  assert.equal(stats.best, 12 * DAY + 8 * 3600000);
  assert.equal(stats.previousTotal, 13 * DAY + 8 * 3600000);
  assert.equal(third.history[0]?.reason, 'SOCIAL MEDIA');
  assert.equal(third.history[0]?.note, 'Late feed');
  assert.equal(third.history[1]?.reason, undefined);
  assert.deepEqual(parseData(JSON.stringify({ version: 1, timers: [third] })).timers[0], third);
});
test('clock rollback never creates negative duration and preserves actual reset date', () => {
  const timer = createTimer('No scrolling', DAY, 'one');
  assert.equal(statistics(timer, 0).clockBehind, true);
  const next = resetTimer(timer, 0, 'a');
  assert.equal(next.history[0]?.duration, 0);
  assert.equal(next.history[0]?.endedAt, 0);
  assert.equal(next.history[0]?.clockAdjusted, true);
  assert.equal(next.currentStartAt, 0);
});
test('multiple timers persist and accrue elapsed time with no running JS counter', async () => {
  const f = fixture(); const repo = f.makeRepository(); await repo.load();
  await Promise.all([repo.create('No nicotine'), repo.create('No doomscrolling')]);
  assert.equal(repo.getSnapshot().data.timers.length, 2);
  f.advance(5 * DAY);
  const reopened = f.makeRepository(); await reopened.load();
  assert.equal(reopened.getSnapshot().status, 'ready');
  const timers = reopened.getSnapshot().data.timers;
  assert.equal(timers.length, 2);
  for (const timer of timers) assert.equal(statistics(timer, timer.currentStartAt + 5 * DAY).current, 5 * DAY);
});
test('reset, history and delete survive reload; another timer stays intact', async () => {
  const f = fixture(); const repo = f.makeRepository(); await repo.load();
  const id = await repo.create('No nicotine'); const other = await repo.create('Read less news');
  const original = repo.getSnapshot().data.timers.find(t => t.id === id)!;
  f.advance(3 * DAY);
  await repo.reset(id, original.currentStartAt, 'STRESS', 'Private note');
  const reopened = f.makeRepository(); await reopened.load();
  const timer = reopened.getSnapshot().data.timers.find(t => t.id === id)!;
  assert.equal(timer.history.length, 1); assert.equal(timer.history[0]?.duration, 3 * DAY);
  assert.equal(timer.history[0]?.note, 'Private note');
  await reopened.delete(id);
  const afterDelete = f.makeRepository(); await afterDelete.load();
  assert.deepEqual(afterDelete.getSnapshot().data.timers.map(t => t.id), [other]);
});
test('failed writes preserve previous state and queue remains usable', async () => {
  const f = fixture(); const repo = f.makeRepository(); await repo.load();
  const id = await repo.create('No nicotine'); const before = repo.getSnapshot();
  f.fail();
  await assert.rejects(repo.create('Another'));
  await assert.rejects(repo.reset(id, before.data.timers[0]!.currentStartAt));
  await assert.rejects(repo.delete(id));
  assert.equal(repo.getSnapshot(), before);
  f.recover(); await repo.create('Another');
  assert.equal(repo.getSnapshot().data.timers.length, 2);
});
test('unreadable data is not replaced and cannot be mutated', async () => {
  const f = fixture(); f.corrupt(); const repo = f.makeRepository(); await repo.load();
  assert.equal(repo.getSnapshot().status, 'error');
  await assert.rejects(repo.create('No nicotine'));
  assert.throws(() => parseData('{"version":2,"timers":[]}'));
  assert.throws(() => parseData('{"version":1,"timers":[{"id":"x"}]}'));
});
test('stale reset cannot erase a newer attempt', async () => {
  const f = fixture(); const repo = f.makeRepository(); await repo.load();
  const id = await repo.create('No nicotine'); const start = repo.getSnapshot().data.timers[0]!.currentStartAt;
  f.advance(DAY); await repo.reset(id, start);
  await assert.rejects(repo.reset(id, start));
  assert.equal(repo.getSnapshot().data.timers[0]?.history.length, 1);
});
