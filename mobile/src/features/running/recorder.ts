import { SIGNAL_MS, usableFix } from './model.ts';
import type { RunPoint } from './model.ts';
import { RunRepository } from './repository.ts';
export interface GPSDriver { watch(fix: (point: RunPoint) => void, error: (message: string) => void): () => void; keepAwake?: (onRelease: () => void) => Promise<() => void> }
export class RunRecorder {
  private repository: RunRepository; private driver: GPSDriver; private now: () => number;
  readonly owner: string;
  private snapshot: { mode: 'idle' | 'locating' | 'recording'; message: string | null; awake: boolean } = { mode: 'idle', message: null, awake: false };
  private listeners = new Set<() => void>(); private stopGPS: (() => void) | null = null; private releaseScreen: (() => void) | null = null;
  private generation = 0; private runningId: string | null = null; private lastSignal = 0; private queue: Promise<unknown> = Promise.resolve();
  constructor(repository: RunRepository, driver: GPSDriver, now: () => number = Date.now, owner = `window-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`) { this.repository = repository; this.driver = driver; this.now = now; this.owner = owner; }
  getSnapshot = () => this.snapshot;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private publish(mode: typeof this.snapshot.mode, message: string | null, awake = this.snapshot.awake) { this.snapshot = { mode, message, awake }; this.listeners.forEach(fn => fn()); }
  private enqueue(action: () => Promise<void>) { const result = this.queue.then(action); this.queue = result.catch(() => {}); return result; }
  settled = () => this.queue;
  private stop() { ++this.generation; this.stopGPS?.(); this.stopGPS = null; this.releaseScreen?.(); this.releaseScreen = null; }
  private fail(message: string) { const id = this.runningId; this.stop(); this.runningId = null; this.publish('idle', message, false); if (id) void this.enqueue(async () => { try { await this.repository.pause(this.owner, id, message); } catch { /* Last persisted checkpoint remains recoverable. */ } }); }
  begin(resumeId?: string) {
    if (this.snapshot.mode !== 'idle') return;
    if (this.repository.getSnapshot().status !== 'ready') { this.publish('idle', 'Load your running journal before recording.'); return; }
    this.publish('locating', 'Waiting for GPS within 30m accuracy. The timer starts after the first usable fix.', false);
    const generation = ++this.generation;
    this.lastSignal = this.now();
    try {
      this.stopGPS = this.driver.watch(point => { void this.enqueue(async () => {
        if (generation !== this.generation) return;
        if (!usableFix(point, this.now())) { this.publish(this.snapshot.mode, 'GPS is old or inaccurate. Move outdoors and keep this screen open.'); return; }
        this.lastSignal = this.now();
        try {
          if (!this.runningId) { const d = await this.repository.begin(this.owner, point, resumeId); this.runningId = d.draft!.id; }
          else { if (this.now() - this.repository.getSnapshot().data.draft!.checkpoint < 3000) return; await this.repository.checkpoint(this.owner, this.runningId, point); }
          if (generation !== this.generation) return;
          if (this.repository.getSnapshot().data.draft?.phase !== 'recording') { this.fail('Recording was interrupted. Resume explicitly.'); return; }
          this.publish('recording', null);
        } catch (e) { this.fail(e instanceof Error ? e.message : 'Could not save GPS. Recording stopped; your last saved checkpoint is retained.'); }
      }); }, message => this.fail(message));
      if (this.driver.keepAwake) void this.driver.keepAwake(() => { if (generation === this.generation) this.publish(this.snapshot.mode, this.snapshot.message, false); }).then(release => { if (generation !== this.generation) release(); else { this.releaseScreen = release; this.publish(this.snapshot.mode, this.snapshot.message, true); } }).catch(() => { /* Foreground GPS still works without a screen wake lock. */ });
    } catch (e) { this.fail(e instanceof Error ? e.message : 'Location is unavailable.'); }
  }
  async tick() {
    if (this.snapshot.mode === 'idle') return;
    if (this.now() - this.lastSignal > SIGNAL_MS) { this.fail('No usable GPS for 30 seconds. Recording paused. Check location access, then resume.'); return; }
    const generation = this.generation;
    return this.enqueue(async () => {
      if (generation !== this.generation || !this.runningId) return;
      try { await this.repository.checkpoint(this.owner, this.runningId); const draft = this.repository.getSnapshot().data.draft; if (draft?.phase !== 'recording') this.fail(draft?.reason || 'Recording interrupted. Resume explicitly.'); }
      catch (e) { this.fail(e instanceof Error ? e.message : 'Could not save. Recording stopped.'); }
    });
  }
  pause(reason = 'Paused by you.') {
    if (this.snapshot.mode === 'idle' && !this.runningId) return Promise.resolve();
    this.stop(); this.publish('idle', reason, false);
    return this.enqueue(async () => { const id = this.runningId; this.runningId = null; if (id) { try { await this.repository.pause(this.owner, id, reason); } catch (e) { this.publish('idle', e instanceof Error ? e.message : 'Could not save the pause. Last saved checkpoint retained.', false); } } });
  }
  async finish(id: string) { await this.pause('Finished by you.'); return this.repository.finish(this.owner, id); }
}
