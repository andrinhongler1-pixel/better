import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDate, parsePlan, shiftDate, tasksForDay, taskTime, validateInput, weekDates } from '../src/features/planner/model.ts';
import { PlannerRepository, PLANNER_KEY } from '../src/features/planner/repository.ts';
import { buildOverview } from '../src/features/overview/model.ts';
const input = { title: ' Training ', date: '2026-11-12', time: '09:00', duration: '60', note: ' ruhig starten ' };
function fixture() {
  const other = new Map(['better:v1:trading', 'better:v1:quit', 'better:v1:nutrition', 'better:v1:sleep', 'better:v1:running', 'better:v1:trading-goals', 'notes', 'settings'].map(key => [key, `unchanged:${key}`]));
  const values = new Map(other); let now = Date.parse('2026-11-12T12:00:00Z'), fail = false;
  const storage = { async getItem(key: string) { return values.get(key) ?? null; }, async setItem(key: string, value: string) { if (fail) throw new Error('full'); values.set(key, value); } };
  return { values, other, create: () => new PlannerRepository(storage, undefined, () => now), advance: () => { now += 1000; }, fail: (next: boolean) => { fail = next; }, now: () => now };
}
test('Monday-first week and calendar date arithmetic survive DST, leap days, month and year boundaries', () => {
  assert.deepEqual(weekDates('2026-11-12'), ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  assert.deepEqual(weekDates('2026-12-31'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  assert.equal(shiftDate('2028-02-28', 1), '2028-02-29'); assert.equal(shiftDate('2028-02-29', 1), '2028-03-01');
  assert.equal(weekDates('2026-03-29')[0], '2026-03-23'); assert.equal(weekDates('2026-10-25')[6], '2026-10-25');
  assert.equal(localDate(new Date(2026, 10, 12, 23, 59)), '2026-11-12');
});
test('task validation supports timed and untimed planning and rejects invalid dates, times and durations', () => {
  assert.deepEqual(validateInput(input), { title: 'Training', date: input.date, time: '09:00', durationMinutes: 60, note: 'ruhig starten' });
  assert.equal(validateInput({ ...input, time: '', duration: '' }).time, null);
  for (const change of [{ title: '' }, { date: '2026-02-30' }, { time: '24:00' }, { time: '9:00' }, { duration: '-1' }, { duration: '1.5' }, { time: '', duration: '60' }, { time: '23:30', duration: '60' }, { note: 'x'.repeat(2001) }]) assert.throws(() => validateInput({ ...input, ...change }));
});
test('load creates no automatic tasks; add is durable/idempotent, edit moves a task without losing its identity or notes', async () => {
  const f = fixture(); const repo = f.create(); await repo.load(); assert.equal(f.values.has(PLANNER_KEY), false);
  await Promise.all([repo.add(input, 'a'), repo.add(input, 'a')]); assert.equal(repo.getSnapshot().data.tasks.length, 1);
  const before = repo.getSnapshot().data.tasks[0]!; assert.equal(taskTime(before), '09:00–10:00'); f.advance();
  await repo.edit('a', before.revision, { ...input, date: '2026-11-19', time: '10:30' });
  const edited = repo.getSnapshot().data.tasks[0]!; assert.equal(edited.id, before.id); assert.equal(edited.createdAt, before.createdAt); assert.equal(edited.note, before.note); assert.equal(edited.revision, 2);
  assert.equal(tasksForDay(repo.getSnapshot().data.tasks, input.date).length, 0); assert.equal(tasksForDay(repo.getSnapshot().data.tasks, '2026-11-19').length, 1);
  const reopened = f.create(); await reopened.load(); assert.deepEqual(reopened.getSnapshot().data.tasks, [edited]);
  for (const [key, value] of f.other) assert.equal(f.values.get(key), value);
});
test('completion is explicit and idempotent, appears in history once and undo removes its completion', async () => {
  const f = fixture(); const repo = f.create(); await repo.load(); await repo.add(input, 'a');
  assert.equal(buildOverview({ planner: f.values.get(PLANNER_KEY)! }, f.now()).items.length, 0);
  f.advance(); await Promise.all([repo.setDone('a', 1, true), repo.setDone('a', 1, true)]);
  const task = repo.getSnapshot().data.tasks[0]!; assert.equal(task.revision, 2); assert.equal(task.completedAt, f.now());
  const history = buildOverview({ planner: f.values.get(PLANNER_KEY)! }, f.now()); assert.equal(history.items.length, 1); assert.equal(history.items[0]!.kind, 'planner'); assert.match(history.items[0]!.href, /itemId=a/);
  await repo.setDone('a', task.revision, false); assert.equal(repo.getSnapshot().data.tasks[0]!.completedAt, null);
  assert.equal(buildOverview({ planner: f.values.get(PLANNER_KEY)! }, f.now()).items.length, 0);
});
test('parallel tabs preserve different tasks and reject stale edits/deletions instead of overwriting changes', async () => {
  const f = fixture(); const a = f.create(), b = f.create(); await Promise.all([a.load(), b.load()]);
  await Promise.all([a.add(input, 'a'), b.add({ ...input, title: 'Lesen', time: '', duration: '' }, 'b')]);
  await b.edit('a', 1, { ...input, title: 'Aktueller Titel' });
  await assert.rejects(a.edit('a', 1, input), /anderen Fenster/); await assert.rejects(a.delete('a', 1), /anderen Fenster/);
  await a.load(); assert.equal(a.getSnapshot().data.tasks.length, 2); assert.equal(a.getSnapshot().data.tasks[0]!.title, 'Aktueller Titel');
  await a.delete('b', 1); const reopened = f.create(); await reopened.load(); assert.equal(reopened.getSnapshot().data.tasks.length, 1); assert.equal(reopened.getSnapshot().data.tasks[0]!.id, 'a');
  for (const [key, value] of f.other) assert.equal(f.values.get(key), value);
});
test('day agenda orders open timed tasks, then untimed tasks, then completed tasks without mutating storage order', async () => {
  const f = fixture(); const repo = f.create(); await repo.load();
  await repo.add({ ...input, title: 'Ohne Uhrzeit', time: '', duration: '' }, 'untimed'); await repo.add({ ...input, time: '11:00' }, 'late'); await repo.add(input, 'early'); await repo.setDone('early', 1, true);
  const before = JSON.stringify(repo.getSnapshot().data); assert.deepEqual(tasksForDay(repo.getSnapshot().data.tasks, input.date).map(t => t.id), ['late', 'untimed', 'early']); assert.equal(JSON.stringify(repo.getSnapshot().data), before);
});
test('failed writes and corrupted storage preserve all previous data; malformed completed records are rejected', async () => {
  const f = fixture(); const repo = f.create(); await repo.load(); await repo.add(input, 'a'); const before = f.values.get(PLANNER_KEY)!;
  f.fail(true); await assert.rejects(repo.setDone('a', 1, true)); assert.equal(f.values.get(PLANNER_KEY), before); assert.equal(repo.getSnapshot().data.tasks[0]!.done, false);
  f.fail(false); await repo.setDone('a', 1, true); const task = repo.getSnapshot().data.tasks[0]!;
  assert.throws(() => parsePlan(JSON.stringify({ version: 1, tasks: [{ ...task, completedAt: null }] }))); assert.throws(() => parsePlan(JSON.stringify({ version: 1, tasks: [task, task] })));
  f.values.set(PLANNER_KEY, '{bad'); await repo.load(); assert.equal(repo.getSnapshot().status, 'error'); await assert.rejects(repo.add(input, 'b')); assert.equal(f.values.get(PLANNER_KEY), '{bad');
});
