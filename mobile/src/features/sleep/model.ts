export interface SleepSession { id: string; sleepStart: number; wakeAt: number; duration: number; createdAt: number; updatedAt: number }
export interface ActiveSleep { id: string; sleepStart: number; createdAt: number }
export interface SleepData { version: 1; revision: number; active: ActiveSleep | null; sessions: SleepSession[]; goalMinutes: number }
export const emptySleep = (): SleepData => ({ version: 1, revision: 0, active: null, sessions: [], goalMinutes: 480 });
export const validTimestamp = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 8640000000000000;
export function durationBetween(start: number, end: number) {
  if (!validTimestamp(start) || !validTimestamp(end) || end < start) throw new Error('Wake time must be on or after sleep start. Check the dates and device clock.');
  return end - start;
}
export function durationLabel(ms: number) { const minutes = Math.floor(Math.max(0, ms) / 60000); return `${Math.floor(minutes / 60)}H ${String(minutes % 60).padStart(2, '0')}M`; }
export function localDay(timestamp: number) { const d = new Date(timestamp); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export function clockLabel(timestamp: number) { return new Date(timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
export function dateLabel(timestamp: number) { return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
export function offsetLabel(timestamp: number) { const n = -new Date(timestamp).getTimezoneOffset(); return `${n >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(n) / 60)).padStart(2, '0')}:${String(Math.abs(n) % 60).padStart(2, '0')}`; }
export function timestampFields(timestamp: number) { const d = new Date(timestamp); return { time: `${localDay(timestamp)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`, offset: offsetLabel(timestamp) }; }
// Explicit offsets preserve the intended instant during repeated daylight-saving hours.
export function parseTimestamp(time: string, offset: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!match || !/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(offset) || (offset.slice(1, 3) === '14' && offset.slice(4) !== '00')) throw new Error('Enter a valid date, time and UTC offset, such as +01:00.');
  const [, y, m, day, h, min, sec = '00'] = match;
  const calendar = new Date(`${y}-${m}-${day}T${h}:${min}:${sec}Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 19) !== `${y}-${m}-${day}T${h}:${min}:${sec}`) throw new Error('This date or time is invalid.');
  const result = Date.parse(`${y}-${m}-${day}T${h}:${min}:${sec}${offset}`);
  if (!validTimestamp(result)) throw new Error('This timestamp is invalid.');
  return result;
}
export function assertNoOverlap(start: number, end: number, sessions: SleepSession[], except?: string) {
  if (sessions.some(s => s.id !== except && start < s.wakeAt && end > s.sleepStart)) throw new Error('These times overlap another sleep session. Check your history.');
}
export function parseSleep(raw: string | null): SleepData {
  if (raw === null) return emptySleep();
  const d = JSON.parse(raw);
  if (!d || d.version !== 1 || !Number.isSafeInteger(d.revision) || d.revision < 0 || !Array.isArray(d.sessions) || typeof d.goalMinutes !== 'number' || !Number.isInteger(d.goalMinutes) || d.goalMinutes < 1 || d.goalMinutes > 1440) throw new Error('Invalid sleep data.');
  const ids = new Set<string>();
  const identity = (s: ActiveSleep) => { if (!s || typeof s.id !== 'string' || !s.id || ids.has(s.id) || !validTimestamp(s.createdAt) || !validTimestamp(s.sleepStart)) throw new Error('Invalid sleep record.'); ids.add(s.id); };
  for (const s of d.sessions) { identity(s); if (!validTimestamp(s.updatedAt) || s.duration !== durationBetween(s.sleepStart, s.wakeAt)) throw new Error('Invalid sleep duration.'); }
  if (d.active !== null) identity(d.active);
  return d as SleepData;
}
export function sleepStats(sessions: SleepSession[], now: number) {
  const sorted = [...sessions].sort((a, b) => b.wakeAt - a.wakeAt);
  const recent = sorted.slice(0, 7);
  const date = new Date(now);
  const week = Array.from({ length: 7 }, (_, index) => { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate() - 6 + index, 12); const key = localDay(d.getTime()); const items = sessions.filter(s => localDay(s.wakeAt) === key); return { date: key, label: d.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 1), duration: items.reduce((sum, s) => sum + s.duration, 0), count: items.length }; });
  return { sorted, last: sorted[0] ?? null, average: recent.length ? recent.reduce((sum, s) => sum + s.duration, 0) / recent.length : null, recentCount: recent.length, week };
}
