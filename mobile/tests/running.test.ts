import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFix, clock, distance, emptyRuns, pace, parseRuns, routePaths, usableFix } from '../src/features/running/model.ts';
import type { RunDraft, RunPoint } from '../src/features/running/model.ts';
import { RunRepository, RUNNING_KEY } from '../src/features/running/repository.ts';
import { RunRecorder } from '../src/features/running/recorder.ts';
const BASE = Date.parse('2026-11-10T10:00:00Z');
const point = (timestamp = BASE, latitude = 0, longitude = 0, accuracy = 5): RunPoint => ({ timestamp, latitude, longitude, accuracy, segment: 0 });
function fixture() {
  let now = BASE, fail = false; let ids = 0;
  const other = new Map(['better:v1:trading', 'better:v1:quit', 'better:v1:nutrition', 'better:v1:sleep', 'better:v1:trading-goals', 'notes', 'settings'].map(key => [key, `untouched:${key}`]));
  const values = new Map(other);
  const storage = { async getItem(key: string) { return values.get(key) ?? null; }, async setItem(key: string, value: string) { if (fail) throw new Error('Storage is full.'); values.set(key, value); } };
  const create = () => new RunRepository(storage, undefined, () => now, () => `run-${++ids}`);
  return { values, other, create, now: () => now, advance: (ms: number) => { now += ms; }, fail: (value: boolean) => { fail = value; } };
}
test('GPS geometry, decimal pace, signal freshness and drift/jump rejection', () => {
  assert.ok(Math.abs(distance(point(), point(BASE, .001)) - 111.195) < .01);
  assert.equal(pace(300000, 1000), '5:00'); assert.equal(pace(0, 0), '—'); assert.equal(clock(3661000), '01:01:01');
  assert.equal(usableFix(point(BASE, 0, 0, 100), BASE), false); assert.equal(usableFix(point(BASE - 11000), BASE), false);
  const d: RunDraft = { id: 'x', startedAt: BASE, elapsedMs: 0, distanceM: 0, points: [point()], segment: 0, phase: 'recording', checkpoint: BASE, owner: 'one', leaseUntil: BASE + 15000, reason: null };
  assert.equal(appendFix(d, point(BASE + 5000, .000001)).points.length, 1);
  assert.equal(appendFix(d, point(BASE + 5000, 1)).distanceM, 0);
  const moved = appendFix(d, point(BASE + 10000, .0005)); assert.ok(moved.distanceM > 55 && moved.distanceM < 56);
  const gap = appendFix(d, point(BASE + 60000, .5)); assert.equal(gap.distanceM, 0); assert.equal(gap.segment, 1);
  assert.equal(routePaths(gap.points).length, 2);
});
test('pause/resume excludes paused time and never connects the missing route; finish is idempotent and persists', async () => {
  const f = fixture(); const repo = f.create(); await repo.load(); await repo.begin('one', point()); const id = repo.getSnapshot().data.draft!.id;
  f.advance(10000); await repo.checkpoint('one', id, point(f.now(), .0005));
  f.advance(5000); await repo.pause('one', id); f.advance(60000); await repo.begin('one', point(f.now(), 1), id);
  const previous = repo.getSnapshot().data.draft!.distanceM;
  assert.ok(previous > 55 && previous < 56); assert.equal(repo.getSnapshot().data.draft!.elapsedMs, 15000);
  f.advance(10000); await repo.checkpoint('one', id, point(f.now(), 1.0005));
  await Promise.all([repo.finish('one', id), repo.finish('one', id)]);
  const saved = repo.getSnapshot().data.runs[0]!; assert.equal(saved.durationMs, 25000); assert.ok(saved.distanceM > 111 && saved.distanceM < 112); assert.equal(repo.getSnapshot().data.runs.length, 1); assert.equal(routePaths(saved.points).length, 2);
  const reopened = f.create(); await reopened.load(); assert.deepEqual(reopened.getSnapshot().data.runs, [saved]); assert.equal(reopened.getSnapshot().data.draft, null);
  for (const [key, value] of f.other) assert.equal(f.values.get(key), value);
  await reopened.delete(id); assert.equal(reopened.getSnapshot().data.runs.length, 0);
});
test('closed/suspended page recovers only checkpoints; competing tabs cannot overwrite an active owner', async () => {
  const f = fixture(); const a = f.create(), b = f.create(); await Promise.all([a.load(), b.load()]);
  await a.begin('one', point()); const id = a.getSnapshot().data.draft!.id;
  await assert.rejects(b.begin('two', point(), id), /another window/); await assert.rejects(b.finish('two', id), /recording window/);
  f.advance(10000); await a.checkpoint('one', id, point(f.now(), .0005)); f.advance(120000);
  await b.begin('two', point(f.now(), .5), id); assert.equal(b.getSnapshot().data.draft!.elapsedMs, 10000);
  await assert.rejects(a.checkpoint('one', id), /another window/);
  f.advance(30000); await b.checkpoint('two', id); assert.equal(b.getSnapshot().data.draft!.phase, 'paused'); assert.equal(b.getSnapshot().data.draft!.elapsedMs, 10000);
});
test('corrupt data and failed writes never erase saved runs or other keys', async () => {
  const f = fixture(); const repo = f.create(); await repo.load(); f.fail(true); await assert.rejects(repo.begin('one', point())); assert.equal(repo.getSnapshot().data.draft, null);
  f.fail(false); await repo.begin('one', point()); const before = f.values.get(RUNNING_KEY)!; f.fail(true); await assert.rejects(repo.finish('one', repo.getSnapshot().data.draft!.id)); assert.equal(f.values.get(RUNNING_KEY), before);
  f.fail(false); f.values.set(RUNNING_KEY, '{bad'); await repo.load(); assert.equal(repo.getSnapshot().status, 'error'); await assert.rejects(repo.begin('one', point())); assert.equal(f.values.get(RUNNING_KEY), '{bad');
  assert.throws(() => parseRuns(JSON.stringify({ ...emptyRuns(), draft: { id: 'x' } })));
});
test('recorder requests GPS only on explicit start; inaccurate fixes do not start a run, failures stop GPS', async () => {
  const f = fixture(); const repo = f.create(); await repo.load();
  let onFix!: (p: RunPoint) => void, onError!: (message: string) => void; let watches = 0, stopped = 0;
  const recorder = new RunRecorder(repo, { watch(fix, error) { watches++; onFix = fix; onError = error; return () => { stopped++; }; } }, f.now, 'one');
  assert.equal(watches, 0); recorder.begin(); recorder.begin(); assert.equal(watches, 1);
  onFix(point(BASE, 0, 0, 100)); await recorder.settled(); assert.equal(repo.getSnapshot().data.draft, null);
  onFix(point()); await recorder.settled(); assert.equal(recorder.getSnapshot().mode, 'recording');
  f.advance(5000); onFix(point(f.now(), .00005)); await recorder.settled(); onError('Location permission denied.'); await recorder.settled(); await recorder.settled();
  assert.equal(stopped, 1); assert.equal(recorder.getSnapshot().mode, 'idle'); assert.equal(repo.getSnapshot().data.draft!.phase, 'paused');
});
test('leaving the screen during GPS acquisition cancels without a run; long signal loss stops recording', async () => {
  const f = fixture(); const repo = f.create(); await repo.load(); let onFix!: (p: RunPoint) => void; let stops = 0;
  const recorder = new RunRecorder(repo, { watch(fix) { onFix = fix; return () => { stops++; }; } }, f.now, 'one');
  recorder.begin(); await recorder.pause('Hidden'); onFix(point()); await recorder.settled(); assert.equal(repo.getSnapshot().data.draft, null);
  recorder.begin(); onFix(point()); await recorder.settled();
  f.advance(5000); await recorder.tick(); f.advance(30000); await recorder.tick(); await recorder.settled(); await recorder.settled();
  assert.equal(recorder.getSnapshot().mode, 'idle'); assert.equal(repo.getSnapshot().data.draft!.phase, 'paused'); assert.equal(repo.getSnapshot().data.draft!.elapsedMs, 5000); assert.equal(stops, 2);
});
