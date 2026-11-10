export const LEASE_MS = 15000;
export const SIGNAL_MS = 30000;
export interface RunPoint { latitude: number; longitude: number; accuracy: number; timestamp: number; segment: number }
export interface RunRecord { id: string; startedAt: number; endedAt: number; durationMs: number; distanceM: number; points: RunPoint[] }
export interface RunDraft { id: string; startedAt: number; elapsedMs: number; distanceM: number; points: RunPoint[]; segment: number; phase: 'recording' | 'paused'; checkpoint: number; owner: string | null; leaseUntil: number; reason: string | null }
export interface RunData { version: 1; draft: RunDraft | null; runs: RunRecord[] }
export const emptyRuns = (): RunData => ({ version: 1, draft: null, runs: [] });
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const validTime = (v: unknown): v is number => finite(v) && Number.isSafeInteger(v) && v > 0 && v < 8640000000000000;
export function validPoint(p: RunPoint) { return !!p && finite(p.latitude) && Math.abs(p.latitude) <= 90 && finite(p.longitude) && Math.abs(p.longitude) <= 180 && finite(p.accuracy) && p.accuracy >= 0 && validTime(p.timestamp) && Number.isSafeInteger(p.segment) && p.segment >= 0; }
export function usableFix(point: RunPoint, now: number) { return validPoint(point) && point.accuracy <= 30 && now - point.timestamp <= 10000 && point.timestamp <= now + 2000; }
const rad = (n: number) => n * Math.PI / 180;
export function distance(a: RunPoint, b: RunPoint) { const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude); const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2; return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h))); }
export function appendFix(draft: RunDraft, raw: RunPoint): RunDraft {
  const point = { ...raw, segment: draft.segment };
  const previous = draft.points[draft.points.length - 1];
  if (previous && point.timestamp <= previous.timestamp) return draft;
  if (!previous || previous.segment !== point.segment) return { ...draft, points: [...draft.points, point] };
  const elapsed = (point.timestamp - previous.timestamp) / 1000;
  if (elapsed <= 0) return draft;
  if (elapsed > SIGNAL_MS / 1000) return { ...draft, segment: draft.segment + 1, points: [...draft.points, { ...point, segment: draft.segment + 1 }] };
  const meters = distance(previous, point);
  // Suppress small GPS drift and implausible running jumps. Never bridge pause gaps.
  if (meters < Math.max(3, Math.min(previous.accuracy, point.accuracy) * .35) || elapsed < 3 || meters / elapsed > 12) return draft;
  return { ...draft, distanceM: draft.distanceM + meters, points: [...draft.points, point] };
}
export function clock(ms: number) { const seconds = Math.floor(Math.max(0, ms) / 1000); return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
export function pace(durationMs: number, distanceM: number) { if (distanceM < 10 || durationMs <= 0) return '—'; const seconds = Math.round(durationMs / 1000 / (distanceM / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
export function routePaths(points: RunPoint[]): string[] {
  if (!points.length) return [];
  const origin = points[0]!; const cos = Math.max(.001, Math.cos(rad(origin.latitude)));
  const projected = points.map(p => { const lon = ((p.longitude - origin.longitude + 540) % 360) - 180; return { x: lon * cos, y: -p.latitude + origin.latitude, segment: p.segment }; });
  const xs = projected.map(p => p.x), ys = projected.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min(280 / Math.max(.0002, maxX - minX), 180 / Math.max(.0002, maxY - minY));
  const paths: string[] = []; let segment = -1; const stride = Math.max(1, Math.floor(points.length / 1500));
  projected.forEach((p, i) => { const first = p.segment !== segment; const last = projected[i + 1]?.segment !== p.segment; if (!first && !last && i % stride) return; const x = (160 + (p.x - (minX + maxX) / 2) * scale).toFixed(2), y = (110 + (p.y - (minY + maxY) / 2) * scale).toFixed(2); if (first) { paths.push(`M${x},${y}`); segment = p.segment; } else paths[paths.length - 1] += ` L${x},${y}`; });
  return paths;
}
export function parseRuns(raw: string | null): RunData {
  if (raw === null) return emptyRuns(); const d = JSON.parse(raw);
  if (!d || d.version !== 1 || !Array.isArray(d.runs)) throw new Error('Invalid running data.');
  const ids = new Set<string>();
  function common(r: { id: string; startedAt: number; distanceM: number; points: RunPoint[] }) { if (!r || typeof r.id !== 'string' || !r.id || ids.has(r.id) || !validTime(r.startedAt) || !finite(r.distanceM) || r.distanceM < 0 || !Array.isArray(r.points) || r.points.length > 12000 || r.points.some(p => !validPoint(p))) throw new Error('Invalid run.'); ids.add(r.id); for (let i = 0; i < r.points.length; i++) { const p = r.points[i]!; const prev = r.points[i - 1]; if (p.timestamp < r.startedAt || (prev && (p.timestamp <= prev.timestamp || p.segment < prev.segment))) throw new Error('Invalid route order.'); } }
  for (const r of d.runs) { common(r); if (!validTime(r.endedAt) || r.endedAt < r.startedAt || !finite(r.durationMs) || r.durationMs < 0 || r.durationMs > r.endedAt - r.startedAt || r.points.some((p: RunPoint) => p.timestamp > r.endedAt)) throw new Error('Invalid run duration.'); }
  if (d.draft !== null) { const r = d.draft; common(r); if (!['paused', 'recording'].includes(r.phase) || !validTime(r.checkpoint) || r.checkpoint < r.startedAt || !finite(r.elapsedMs) || r.elapsedMs < 0 || r.elapsedMs > r.checkpoint - r.startedAt || !Number.isSafeInteger(r.segment) || r.segment < 0 || !finite(r.leaseUntil) || (r.owner !== null && typeof r.owner !== 'string') || (r.reason !== null && typeof r.reason !== 'string') || (r.phase === 'recording' && !r.owner)) throw new Error('Invalid active run.'); }
  return d;
}
