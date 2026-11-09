import { createTimer, emptyData, parseData, resetTimer } from './model.ts';
import type { QuitData, ResetReason } from './model.ts';

export const QUIT_STORAGE_KEY = 'better:v1:quit';
export interface StoragePort { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export interface QuitSnapshot { data: QuitData; status: 'loading' | 'ready' | 'error' }
let sequence = 0;
const makeId = () => `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

/** Serial writes commit to the UI only after durable storage succeeds. */
export class QuitRepository {
  private snapshot: QuitSnapshot = { data: emptyData(), status: 'loading' };
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private storage: StoragePort;
  private now: () => number;
  private id: () => string;
  constructor(storage: StoragePort, now: () => number = Date.now, id: () => string = makeId) {
    this.storage = storage; this.now = now; this.id = id;
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(snapshot: QuitSnapshot) { this.snapshot = snapshot; this.listeners.forEach(listener => listener()); }
  async load() {
    this.publish({ ...this.snapshot, status: 'loading' });
    try { this.publish({ data: parseData(await this.storage.getItem(QUIT_STORAGE_KEY)), status: 'ready' }); }
    catch { this.publish({ ...this.snapshot, status: 'error' }); }
  }
  private transact<T>(change: (data: QuitData) => { data: QuitData; result: T }): Promise<T> {
    const operation = this.queue.then(async () => {
      if (this.snapshot.status !== 'ready') throw new Error('Load your timer data before making changes.');
      const next = change(this.snapshot.data);
      await this.storage.setItem(QUIT_STORAGE_KEY, JSON.stringify(next.data));
      this.publish({ data: next.data, status: 'ready' });
      return next.result;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  create(title: string) {
    return this.transact(data => {
      const timer = createTimer(title, this.now(), this.id());
      return { data: { ...data, timers: [...data.timers, timer] }, result: timer.id };
    });
  }
  restore(title: string, startedAt: number) {
    return this.transact(data => {
      if (!Number.isSafeInteger(startedAt) || startedAt < 0 || startedAt > this.now()) throw new Error('Choose a valid start time in the past.');
      const existing = data.timers.find(timer => timer.title.trim().toLowerCase() === title.trim().toLowerCase());
      if (existing) throw new Error('A timer with this title already exists. It has not been changed.');
      const timer = createTimer(title, startedAt, this.id());
      return { data: { ...data, timers: [...data.timers, timer] }, result: timer.id };
    });
  }
  reset(timerId: string, expectedStartAt: number, reason?: ResetReason, note?: string) {
    return this.transact(data => {
      const timer = data.timers.find(t => t.id === timerId);
      if (!timer) throw new Error('This timer no longer exists.');
      if (timer.currentStartAt !== expectedStartAt) throw new Error('This timer has already changed. Reopen it before resetting.');
      const next = resetTimer(timer, this.now(), this.id(), reason, note);
      return { data: { ...data, timers: data.timers.map(t => t.id === timerId ? next : t) }, result: undefined };
    });
  }
  delete(timerId: string) {
    return this.transact(data => ({ data: { ...data, timers: data.timers.filter(t => t.id !== timerId) }, result: undefined }));
  }
}
