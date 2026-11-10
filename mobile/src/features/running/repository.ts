import { appendFix, emptyRuns, LEASE_MS, parseRuns, usableFix, validTime } from './model.ts';
import type { RunData, RunDraft, RunPoint } from './model.ts';
import { serialExclusive } from '../sleep/repository.ts';
import type { Exclusive } from '../sleep/repository.ts';
export const RUNNING_KEY = 'better:v1:running';
interface Storage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export class RunRepository {
  private storage: Storage; private exclusive: Exclusive; private now: () => number; private id: () => string;
  private snapshot: { data: RunData; status: 'loading' | 'ready' | 'error' } = { data: emptyRuns(), status: 'loading' };
  private listeners = new Set<() => void>();
  constructor(storage: Storage, exclusive: Exclusive = serialExclusive, now: () => number = Date.now, id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`) { this.storage = storage; this.exclusive = exclusive; this.now = now; this.id = id; }
  getSnapshot = () => this.snapshot;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private publish(data: RunData, status: typeof this.snapshot.status = 'ready') { this.snapshot = { data, status }; this.listeners.forEach(fn => fn()); }
  async load() { try { await this.exclusive(async () => this.publish(parseRuns(await this.storage.getItem(RUNNING_KEY)))); } catch { this.publish(this.snapshot.data, 'error'); } }
  private change(update: (data: RunData, now: number) => RunData) { const now = this.now(); return this.exclusive(async () => {
    let d: RunData; try { d = parseRuns(await this.storage.getItem(RUNNING_KEY)); } catch { this.publish(this.snapshot.data, 'error'); throw new Error('Running data could not be read. Existing records have not been overwritten.'); }
    this.publish(d); if (!validTime(now)) throw new Error('Check your device clock.'); const next = update(d, now);
    if (next !== d) { await this.storage.setItem(RUNNING_KEY, JSON.stringify(next)); this.publish(next); } return next;
  }); }
  begin(owner: string, point: RunPoint, resumeId?: string) { return this.change((d, now) => {
    if (!owner || !usableFix(point, now)) throw new Error('Waiting for a fresh GPS fix with accuracy within 30m.');
    if (d.draft && (!resumeId || d.draft.id !== resumeId)) throw new Error('An unfinished run already exists. Resume or finish it first.');
    let draft = d.draft;
    if (draft) { if (draft.owner && draft.owner !== owner && draft.leaseUntil > now) throw new Error('This run is recording in another window. Pause it there or wait 15 seconds after closing it.'); if (draft.phase === 'recording' && draft.owner === owner) return d;
      if (draft.points.length >= 12000) throw new Error('Route storage limit reached. Finish and save this run.');
      if (now < draft.checkpoint) throw new Error('The device clock moved backwards. Correct it before resuming.');
      draft = { ...draft, phase: 'recording', segment: draft.segment + 1, owner, leaseUntil: now + LEASE_MS, checkpoint: now, reason: null };
    } else { const id = this.id(); if (d.runs.some(r => r.id === id)) throw new Error('Please retry starting this run.'); draft = { id, startedAt: Math.min(now, point.timestamp), elapsedMs: 0, distanceM: 0, points: [], segment: 0, phase: 'recording', checkpoint: now, owner, leaseUntil: now + LEASE_MS, reason: null }; }
    return { ...d, draft: appendFix(draft, point) };
  }); }
  checkpoint(owner: string, id: string, point?: RunPoint) { return this.change((d, now) => {
    const r = this.owned(d, owner, id); if (r.phase !== 'recording') return d;
    if (now < r.checkpoint || now - r.checkpoint > LEASE_MS) return { ...d, draft: this.stopped(r, r.checkpoint, 'Tracking was interrupted. Resume explicitly; the gap was not recorded.') };
    let next = { ...r, elapsedMs: r.elapsedMs + now - r.checkpoint, checkpoint: now, leaseUntil: now + LEASE_MS };
    if (point && usableFix(point, now)) { if (next.points.length >= 12000) return { ...d, draft: this.stopped(next, now, 'Route storage limit reached. Finish and save this run.') }; next = appendFix(next, point); }
    return { ...d, draft: next };
  }); }
  private owned(d: RunData, owner: string, id: string) { if (!d.draft || d.draft.id !== id || (d.draft.owner && d.draft.owner !== owner)) throw new Error('The recording changed in another window. Reopen RUNNING.'); return d.draft; }
  private stopped(r: RunDraft, now: number, reason: string): RunDraft { const cutoff = Math.max(r.checkpoint, Math.min(now, r.checkpoint + LEASE_MS)); return { ...r, elapsedMs: r.elapsedMs + (r.phase === 'recording' ? cutoff - r.checkpoint : 0), checkpoint: cutoff, phase: 'paused', owner: null, leaseUntil: 0, reason }; }
  pause(owner: string, id: string, reason = 'Paused by you.') { return this.change((d, now) => { if (!d.draft || d.draft.id !== id) return d; const r = this.owned(d, owner, id); if (r.phase === 'paused') return d; return { ...d, draft: this.stopped(r, now - r.checkpoint > LEASE_MS ? r.checkpoint : now, reason) }; }); }
  finish(owner: string, id: string) { return this.change((d, now) => {
    if (d.runs.some(r => r.id === id)) return d;
    if (!d.draft || d.draft.id !== id) throw new Error('This run no longer exists.');
    const r = d.draft;
    if (r.owner && r.owner !== owner && r.leaseUntil > now) throw new Error('Pause this run in the recording window first.');
    if (now < r.checkpoint) throw new Error('Check your device clock before saving.');
    const stopped = this.stopped(r, r.owner === owner && now - r.checkpoint <= LEASE_MS ? now : r.checkpoint, r.reason || 'Finished');
    const endedAt = Math.max(stopped.checkpoint, ...r.points.map(p => p.timestamp));
    return { ...d, draft: null, runs: [...d.runs, { id: r.id, startedAt: r.startedAt, endedAt, durationMs: stopped.elapsedMs, distanceM: r.distanceM, points: r.points }] };
  }); }
  delete(id: string) { return this.change(d => ({ ...d, runs: d.runs.filter(r => r.id !== id) })); }
}
