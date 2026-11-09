import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SleepRepository, SLEEP_KEY } from '../src/features/sleep/repository.ts';
import { durationBetween, durationLabel, emptySleep, parseSleep, parseTimestamp, sleepStats } from '../src/features/sleep/model.ts';
const stamp = (value: string) => Date.parse(value);
function fixture() {
  const other = new Map(['better:v1:trading', 'better:v1:quit', 'better:v1:nutrition', 'better:v1:trading-goals', 'notes', 'settings', 'progress'].map(key => [key, `unchanged:${key}`]));
  const values = new Map(other); let now = stamp('2026-11-08T23:15:00+01:00'); let fail = false; let ids = 0;
  const storage = { async getItem(key: string) { return values.get(key) ?? null; }, async setItem(key: string, value: string) { if (fail) throw new Error('full'); values.set(key, value); } };
  const create = () => new SleepRepository(storage, undefined, () => now, () => `sleep-${++ids}`);
  return { values, other, create, time: (value: string) => { now = stamp(value); }, fail: (value: boolean) => { fail = value; } };
}
test('sleep → close/reopen → wake persists exact timestamps across midnight and preserves every other key', async () => {
  const f = fixture(); let repo = f.create(); await repo.load();
  assert.deepEqual(repo.getSnapshot().data, emptySleep()); assert.equal(f.values.has(SLEEP_KEY), false);
  const active = await repo.start(0); assert.equal(repo.getSnapshot().data.sessions.length, 0);
  repo = f.create(); await repo.load(); assert.deepEqual(repo.getSnapshot().data.active, active);
  f.time('2026-11-09T07:39:00+01:00'); const completed = await repo.wake(active.id);
  assert.equal(completed.duration, (8 * 60 + 24) * 60000); assert.equal(durationLabel(completed.duration), '8H 24M');
  assert.equal(completed.createdAt, active.createdAt); assert.equal(completed.sleepStart, active.sleepStart);
  repo = f.create(); await repo.load(); assert.equal(repo.getSnapshot().data.active, null); assert.deepEqual(repo.getSnapshot().data.sessions, [completed]);
  for (const [key, value] of f.other) assert.equal(f.values.get(key), value);
});
test('load/dismiss and crossing day boundaries never start sleep or fabricate a record', async () => {
  const f = fixture(); const repo = f.create(); await repo.load(); f.time('2026-11-10T02:30:00+01:00'); await repo.load();
  assert.equal(f.values.has(SLEEP_KEY), false); assert.equal(repo.getSnapshot().data.active, null);
  const a = await repo.start(0); f.time('2026-11-10T10:45:00+01:00'); const s = await repo.wake(a.id);
  assert.equal(durationLabel(s.duration), '8H 15M');
});
test('parallel repositories and duplicate presses produce one active and one completed session, stale starts cannot restart it', async () => {
  const f = fixture(); const a = f.create(), b = f.create(); await Promise.all([a.load(), b.load()]);
  const [first, second] = await Promise.all([a.start(0), b.start(0)]); assert.equal(first.id, second.id);
  f.time('2026-11-09T07:39:00+01:00'); const [wake1, wake2] = await Promise.all([a.wake(first.id), b.wake(first.id)]);
  assert.deepEqual(wake1, wake2); assert.equal(parseSleep(f.values.get(SLEEP_KEY)!).sessions.length, 1);
  await assert.rejects(b.start(0), /changed/); assert.equal(parseSleep(f.values.get(SLEEP_KEY)!).active, null);
});
test('duration uses elapsed instants across spring/fall daylight saving changes and offset corrections', () => {
  assert.equal(durationBetween(stamp('2026-03-29T00:00:00+01:00'), stamp('2026-03-29T08:00:00+02:00')), 7 * 3600000);
  assert.equal(durationBetween(stamp('2026-10-25T00:00:00+02:00'), stamp('2026-10-25T08:00:00+01:00')), 9 * 3600000);
  assert.equal(parseTimestamp('2026-10-25T02:30:00', '+01:00') - parseTimestamp('2026-10-25T02:30:00', '+02:00'), 3600000);
  for (const time of ['2026-02-30T22:00:00', '2026-11-09T24:00:00', '', 'invalid']) assert.throws(() => parseTimestamp(time, '+01:00'));
  assert.throws(() => parseTimestamp('2026-11-09T22:00', '+14:30'));
});
test('correction, goal, delete and reopening update statistics without adding records; stale edits cannot overwrite', async () => {
  const f = fixture(); const repo = f.create(); await repo.load(); const a = await repo.start(0); f.time('2026-11-09T09:00:00+01:00'); await repo.wake(a.id);
  await repo.edit(a.id, stamp('2026-11-08T23:15:00+01:00'), stamp('2026-11-09T07:39:00+01:00'), repo.getSnapshot().data.revision);
  const d = repo.getSnapshot().data; assert.equal(d.sessions.length, 1); assert.equal(durationLabel(sleepStats(d.sessions, stamp('2026-11-09T12:00:00+01:00')).average!), '8H 24M');
  await repo.setGoal(510); await assert.rejects(repo.edit(a.id, a.sleepStart, stamp('2026-11-09T08:00:00+01:00'), d.revision), /changed/);
  await assert.rejects(repo.setGoal(0)); await assert.rejects(repo.setGoal(1441));
  const reopened = f.create(); await reopened.load(); assert.equal(reopened.getSnapshot().data.goalMinutes, 510);
  await reopened.delete(a.id, reopened.getSnapshot().data.revision); await repo.load();
  assert.equal(repo.getSnapshot().data.sessions.length, 0); assert.equal(sleepStats(repo.getSnapshot().data.sessions, stamp('2026-11-09T12:00:00Z')).average, null);
  for (const [key, value] of f.other) assert.equal(f.values.get(key), value);
});
test('accidental start can be corrected or cancelled without a completed record; clock rollback is blocked', async () => {
  const f = fixture(); const repo = f.create(); await repo.load(); const a = await repo.start(0);
  f.time('2026-11-08T22:00:00+01:00'); await assert.rejects(repo.wake(a.id), /Wake time/); assert.equal(repo.getSnapshot().data.active!.id, a.id);
  await repo.correctStart(a.id, stamp('2026-11-08T21:00:00+01:00'), repo.getSnapshot().data.revision);
  assert.equal(repo.getSnapshot().data.active!.sleepStart, stamp('2026-11-08T21:00:00+01:00'));
  await repo.cancel(a.id); assert.equal(repo.getSnapshot().data.active, null); assert.equal(repo.getSnapshot().data.sessions.length, 0);
  await assert.rejects(repo.wake(a.id), /already changed/);
});
test('failed persistence and corrupt/missing timestamps preserve data and never silently reset storage', async () => {
  const f = fixture(); const repo = f.create(); await repo.load(); f.fail(true); await assert.rejects(repo.start(0)); assert.equal(repo.getSnapshot().data.active, null);
  f.fail(false); const a = await repo.start(0); f.time('2026-11-09T08:00:00+01:00'); f.fail(true); await assert.rejects(repo.wake(a.id)); assert.equal(repo.getSnapshot().data.active!.id, a.id);
  f.fail(false); f.values.set(SLEEP_KEY, '{broken'); await repo.load(); assert.equal(repo.getSnapshot().status, 'error'); await assert.rejects(repo.start(0)); assert.equal(f.values.get(SLEEP_KEY), '{broken');
  assert.throws(() => parseSleep(JSON.stringify({ ...emptySleep(), active: { id: 'x', createdAt: 1, sleepStart: null } })));
  assert.throws(() => parseSleep(JSON.stringify({ ...emptySleep(), sessions: [{ id: 'x', createdAt: 1, sleepStart: 10, wakeAt: 20, duration: 100, updatedAt: 20 }] })));
});
test('last seven completed sessions and weekly totals count real records and reject overlapping corrections', async () => {
  const f = fixture(); const repo = f.create(); await repo.load();
  for (let i = 1; i <= 8; i++) { const day = String(i).padStart(2, '0'); f.time(`2026-11-${day}T00:00:00+01:00`); const a = await repo.start(repo.getSnapshot().data.revision); f.time(`2026-11-${day}T08:00:00+01:00`); await repo.wake(a.id); }
  const d = repo.getSnapshot().data; const stats = sleepStats(d.sessions, stamp('2026-11-08T12:00:00+01:00'));
  assert.equal(stats.recentCount, 7); assert.equal(stats.average, 8 * 3600000); assert.equal(stats.week.reduce((sum, day) => sum + day.count, 0), 7);
  await assert.rejects(repo.edit(d.sessions[1]!.id, d.sessions[0]!.sleepStart, d.sessions[1]!.wakeAt, d.revision), /overlap/);
  await assert.rejects(repo.edit(d.sessions[1]!.id, d.sessions[1]!.sleepStart, stamp('2026-12-01T00:00:00Z'), d.revision), /future/);
});
