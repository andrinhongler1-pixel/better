import { assertNoOverlap, durationBetween, emptySleep, parseSleep, validTimestamp } from './model.ts';
import type { SleepData, SleepSession } from './model.ts';
interface Storage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export type Exclusive = <T>(operation: () => Promise<T>) => Promise<T>;
export const SLEEP_KEY = 'better:v1:sleep';
let nativeQueue: Promise<unknown> = Promise.resolve();
export const serialExclusive: Exclusive = operation => { const result = nativeQueue.then(operation); nativeQueue = result.catch(() => {}); return result; };
export class SleepRepository {
  private snapshot: { data: SleepData; status: 'loading' | 'ready' | 'error' } = { data: emptySleep(), status: 'loading' };
  private listeners = new Set<() => void>();
  private storage: Storage; private exclusive: Exclusive; private now: () => number; private id: () => string;
  constructor(storage: Storage, exclusive: Exclusive = serialExclusive, now: () => number = Date.now, id: () => string = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`) { this.storage = storage; this.exclusive = exclusive; this.now = now; this.id = id; }
  getSnapshot = () => this.snapshot;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private publish(data: SleepData, status: typeof this.snapshot.status = 'ready') { this.snapshot = { data, status }; this.listeners.forEach(fn => fn()); }
  async load() { try { await this.exclusive(async () => { this.publish(parseSleep(await this.storage.getItem(SLEEP_KEY))); }); } catch { this.publish(this.snapshot.data, 'error'); } }
  private change<T>(update: (data: SleepData, now: number) => { data: SleepData; result: T }) {
    const pressedAt = this.now();
    return this.exclusive(async () => {
      let current: SleepData;
      try { current = parseSleep(await this.storage.getItem(SLEEP_KEY)); } catch { this.publish(this.snapshot.data, 'error'); throw new Error('Sleep data could not be read. Existing data has not been overwritten.'); }
      // Always reread under the shared lock: another tab may have changed state.
      this.publish(current);
      const now = pressedAt; if (!validTimestamp(now)) throw new Error('Check your device clock.');
      const { data, result } = update(current, now);
      if (data !== current) { const next = { ...data, revision: current.revision + 1 }; await this.storage.setItem(SLEEP_KEY, JSON.stringify(next)); this.publish(next); }
      return result;
    });
  }
  start(expectedRevision: number) { return this.change((d, now) => {
    if (d.active) return { data: d, result: d.active };
    if (d.revision !== expectedRevision) throw new Error('Sleep data changed in another tab. Review it and try again.');
    if (d.sessions.some(s => s.wakeAt > now)) throw new Error('A saved wake time is ahead of the device clock. Correct it before starting.');
    const active = { id: this.id(), sleepStart: now, createdAt: now };
    if (d.sessions.some(s => s.id === active.id)) throw new Error('Could not create a unique session. Please try again.');
    return { data: { ...d, active }, result: active };
  }); }
  wake(id: string) { return this.change((d, now) => {
    const completed = d.sessions.find(s => s.id === id);
    if (completed) return { data: d, result: completed };
    if (!d.active || d.active.id !== id) throw new Error('This sleep session already changed. Review the current state.');
    const session: SleepSession = { ...d.active, wakeAt: now, duration: durationBetween(d.active.sleepStart, now), updatedAt: now };
    assertNoOverlap(session.sleepStart, now, d.sessions);
    return { data: { ...d, active: null, sessions: [...d.sessions, session] }, result: session };
  }); }
  cancel(id: string) { return this.change((d) => { if (!d.active || d.active.id !== id) throw new Error('This sleep session already changed.'); return { data: { ...d, active: null }, result: undefined }; }); }
  correctStart(id: string, start: number, expectedRevision: number) { return this.change((d, now) => {
    if (d.revision !== expectedRevision || !d.active || d.active.id !== id) throw new Error('Sleep data changed. Reopen the editor.');
    durationBetween(start, now); assertNoOverlap(start, now, d.sessions);
    return { data: { ...d, active: { ...d.active, sleepStart: start } }, result: undefined };
  }); }
  edit(id: string, start: number, wake: number, expectedRevision: number) { return this.change((d, now) => {
    if (d.revision !== expectedRevision) throw new Error('Sleep data changed. Reopen the editor.');
    const existing = d.sessions.find(s => s.id === id); if (!existing) throw new Error('This sleep session no longer exists.');
    const duration = durationBetween(start, wake); if (wake > now) throw new Error('Wake time cannot be in the future.');
    assertNoOverlap(start, wake, d.sessions, id);
    if (d.active && wake > d.active.sleepStart) throw new Error('These times overlap your current sleep session.');
    return { data: { ...d, sessions: d.sessions.map(s => s.id === id ? { ...s, sleepStart: start, wakeAt: wake, duration, updatedAt: now } : s) }, result: undefined };
  }); }
  delete(id: string, expectedRevision: number) { return this.change(d => {
    if (d.revision !== expectedRevision) throw new Error('Sleep data changed. Reopen this session.');
    if (!d.sessions.some(s => s.id === id)) throw new Error('This sleep session no longer exists.');
    return { data: { ...d, sessions: d.sessions.filter(s => s.id !== id) }, result: undefined };
  }); }
  setGoal(minutes: number) { return this.change(d => { if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new Error('Choose a goal from 1 minute to 24 hours.'); return { data: { ...d, goalMinutes: minutes }, result: undefined }; }); }
}
