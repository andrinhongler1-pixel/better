import { emptyPlan, parsePlan, validateInput } from './model.ts';
import type { PlanInput, PlannerData } from './model.ts';
import { serialExclusive } from '../sleep/repository.ts';
import type { Exclusive } from '../sleep/repository.ts';
export const PLANNER_KEY = 'better:v1:planner';
interface Storage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export class PlannerRepository {
  private storage: Storage; private exclusive: Exclusive; private now: () => number;
  private snapshot: { data: PlannerData; status: 'loading' | 'ready' | 'error' } = { data: emptyPlan(), status: 'loading' };
  private listeners = new Set<() => void>();
  constructor(storage: Storage, exclusive: Exclusive = serialExclusive, now: () => number = Date.now) { this.storage = storage; this.exclusive = exclusive; this.now = now; }
  getSnapshot = () => this.snapshot;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private publish(data: PlannerData, status: typeof this.snapshot.status = 'ready') { this.snapshot = { data, status }; this.listeners.forEach(fn => fn()); }
  async load() { try { await this.exclusive(async () => this.publish(parsePlan(await this.storage.getItem(PLANNER_KEY)))); } catch { this.publish(this.snapshot.data, 'error'); } }
  private change(fn: (data: PlannerData, now: number) => PlannerData) { const now = this.now(); return this.exclusive(async () => {
    let current: PlannerData; try { current = parsePlan(await this.storage.getItem(PLANNER_KEY)); } catch { this.publish(this.snapshot.data, 'error'); throw new Error('Planerdaten konnten nicht gelesen werden. Vorhandene Einträge wurden nicht überschrieben.'); }
    this.publish(current); if (!Number.isSafeInteger(now) || now <= 0) throw new Error('Bitte die Gerätezeit prüfen.');
    const next = fn(current, now); if (next !== current) { await this.storage.setItem(PLANNER_KEY, JSON.stringify(next)); this.publish(next); } return next;
  }); }
  add(input: PlanInput, id: string) { const fields = validateInput(input); if (!id || id.length > 180) return Promise.reject(new Error('Bitte den Eintrag erneut öffnen.')); return this.change((d, now) => d.tasks.some(t => t.id === id) ? d : { ...d, tasks: [...d.tasks, { ...fields, id, done: false, completedAt: null, createdAt: now, updatedAt: now, revision: 1 }] }); }
  edit(id: string, revision: number, input: PlanInput) { const fields = validateInput(input); return this.change((d, now) => { const task = this.current(d, id, revision); return { ...d, tasks: d.tasks.map(t => t.id === id ? { ...task, ...fields, revision: task.revision + 1, updatedAt: now } : t) }; }); }
  setDone(id: string, revision: number, done: boolean) { if (typeof done !== 'boolean') return Promise.reject(new Error('Ungültiger Aufgabenstatus.')); return this.change((d, now) => { const existing = d.tasks.find(t => t.id === id); if (existing?.done === done) return d; const task = this.current(d, id, revision); return { ...d, tasks: d.tasks.map(t => t.id === id ? { ...task, done, completedAt: done ? now : null, updatedAt: now, revision: task.revision + 1 } : t) }; }); }
  delete(id: string, revision: number) { return this.change(d => { this.current(d, id, revision); return { ...d, tasks: d.tasks.filter(t => t.id !== id) }; }); }
  private current(d: PlannerData, id: string, revision: number) { const task = d.tasks.find(t => t.id === id); if (!task) throw new Error('Dieser Eintrag existiert nicht mehr.'); if (task.revision !== revision) throw new Error('Dieser Eintrag wurde in einem anderen Fenster geändert. Bitte neu öffnen.'); return task; }
}
