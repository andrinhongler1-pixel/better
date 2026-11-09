export const RESET_REASONS = ['BOREDOM', 'STRESS', 'SOCIAL MEDIA', 'LATE AT NIGHT', 'OTHER'] as const;
export type ResetReason = typeof RESET_REASONS[number];
export interface QuitAttempt {
  id: string;
  startedAt: number;
  endedAt: number;
  duration: number;
  reason?: ResetReason;
  note?: string;
  clockAdjusted?: boolean;
}
export interface QuittingTimer {
  id: string;
  title: string;
  createdAt: number;
  currentStartAt: number;
  history: QuitAttempt[];
}
export interface QuitData { version: 1; timers: QuittingTimer[] }
export const emptyData = (): QuitData => ({ version: 1, timers: [] });
export const elapsed = (startedAt: number, now: number) => Math.max(0, now - startedAt);
export function statistics(timer: QuittingTimer, now: number) {
  const current = elapsed(timer.currentStartAt, now);
  const previousTotal = timer.history.reduce((sum, attempt) => sum + attempt.duration, 0);
  return {
    current,
    best: timer.history.reduce((best, attempt) => Math.max(best, attempt.duration), current),
    attempts: timer.history.length + 1,
    previousTotal,
    total: previousTotal + current,
    clockBehind: now < timer.currentStartAt,
  };
}
export function durationParts(milliseconds: number) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
  };
}
export const pad = (value: number) => String(value).padStart(2, '0');
export function clockText(duration: number) {
  const p = durationParts(duration);
  return `${pad(p.hours)} : ${pad(p.minutes)} : ${pad(p.seconds)}`;
}
export function dayText(duration: number) {
  const days = durationParts(duration).days;
  return `${pad(days)} ${days === 1 ? 'DAY' : 'DAYS'}`;
}
export function exactDuration(duration: number) {
  const p = durationParts(duration);
  return `${p.days} DAYS ${pad(p.hours)} HOURS ${pad(p.minutes)} MIN ${pad(p.seconds)} SEC`;
}
export function dateText(timestamp: number) {
  const d = new Date(timestamp);
  return `${pad(d.getDate())} ${d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()} ${d.getFullYear()} — ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function createTimer(title: string, now: number, id: string): QuittingTimer {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 80) throw new Error('Enter a title between 1 and 80 characters.');
  return { id, title: trimmed, createdAt: now, currentStartAt: now, history: [] };
}
export function resetTimer(timer: QuittingTimer, now: number, attemptId: string, reason?: ResetReason, note?: string): QuittingTimer {
  if (note && note.trim().length > 500) throw new Error('Keep your note within 500 characters.');
  // A clock moved backwards cannot produce a negative completed attempt.
  const endedAt = now;
  const attempt: QuitAttempt = {
    id: attemptId, startedAt: timer.currentStartAt, endedAt,
    duration: elapsed(timer.currentStartAt, endedAt),
    ...(endedAt < timer.currentStartAt ? { clockAdjusted: true } : {}),
    ...(reason ? { reason } : {}), ...(note?.trim() ? { note: note.trim() } : {}),
  };
  return { ...timer, currentStartAt: now, history: [...timer.history, attempt] };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStamp = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
const isId = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
function isAttempt(value: unknown): value is QuitAttempt {
  if (!isRecord(value)) return false;
  return isId(value.id) && isStamp(value.startedAt) && isStamp(value.endedAt) &&
    value.duration === elapsed(value.startedAt, value.endedAt) &&
    (value.endedAt >= value.startedAt || value.clockAdjusted === true) &&
    (value.clockAdjusted === undefined || typeof value.clockAdjusted === 'boolean') &&
    (value.reason === undefined || RESET_REASONS.includes(value.reason as ResetReason)) &&
    (value.note === undefined || (typeof value.note === 'string' && value.note.length <= 500));
}
export function parseData(raw: string | null): QuitData {
  if (raw === null) return emptyData();
  const value: unknown = JSON.parse(raw);
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.timers)) throw new Error('Unsupported timer data.');
  const timerIds = new Set<string>();
  for (const timer of value.timers) {
    if (!isRecord(timer) || !isId(timer.id) || timerIds.has(timer.id) ||
      typeof timer.title !== 'string' || !timer.title.trim() || timer.title.length > 80 ||
      !isStamp(timer.createdAt) || !isStamp(timer.currentStartAt) || !Array.isArray(timer.history) || !timer.history.every(isAttempt)) {
      throw new Error('Invalid timer data.');
    }
    if (new Set(timer.history.map(a => a.id)).size !== timer.history.length) throw new Error('Duplicate attempt data.');
    timerIds.add(timer.id);
  }
  return value as unknown as QuitData;
}
