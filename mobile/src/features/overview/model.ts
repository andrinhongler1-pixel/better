import { parseTrades, parseSummaries, pnl } from '../trading/model.ts';
import { parseSleep, durationLabel, localDay } from '../sleep/model.ts';
import { parseRuns, clock } from '../running/model.ts';
import { parseData as parseFood } from '../nutrition/model.ts';
import { parseData as parseQuit } from '../quit/model.ts';
import { parsePlan, taskTime } from '../planner/model.ts';
export const overviewKeys = { trading: 'better:v1:trading', sleep: 'better:v1:sleep', running: 'better:v1:running', nutrition: 'better:v1:nutrition', quit: 'better:v1:quit', planner: 'better:v1:planner' } as const;
export type HistoryKind = keyof typeof overviewKeys;
export const kindNames: Record<HistoryKind, string> = { trading: 'Trading', sleep: 'Schlaf', running: 'Laufen', nutrition: 'Ernährung', quit: 'Quit', planner: 'Planer' };
export interface HistoryItem { id: string; kind: HistoryKind; date: string; order: number; title: string; detail: string; value: string; href: string }
export interface Overview { items: HistoryItem[]; errors: HistoryKind[]; foodCount: number; tradeCount: number; lastSleep: string | null }
const link = (route: string, params: Record<string, string>) => `${route}?${Object.entries({ ...params, from: 'history' }).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`;
const amount = (n: number, currency: string) => `${n > 0 ? '+' : ''}${n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
// Read-only projection: existing repositories own all writes and existing records stay intact.
export function buildOverview(raw: Partial<Record<HistoryKind, string | null>>, now: number): Overview {
  const out: Overview = { items: [], errors: [], foodCount: 0, tradeCount: 0, lastSleep: null }; const today = localDay(now);
  const read = (kind: HistoryKind, fn: () => void) => { try { fn(); } catch { out.errors.push(kind); } };
  read('trading', () => {
    const trades = parseTrades(raw.trading ?? null), summaries = parseSummaries(raw.trading ?? null);
    out.tradeCount = trades.filter(t => t.date === today).length + summaries.filter(s => s.date === today).reduce((n, s) => n + s.count, 0);
    out.items.push(...trades.map(t => ({ id: `trade:${t.id}`, kind: 'trading' as const, date: t.date, order: 0, title: t.symbol === 'MANUAL TRADE' ? 'Trade' : t.symbol, detail: 'Einzelner Trade', value: amount(pnl(t), t.currency), href: link('/trading', { tradeId: t.id }) })));
    out.items.push(...summaries.map(s => ({ id: `summary:${s.id}`, kind: 'trading' as const, date: s.date, order: 0, title: 'Importierter Tageswert', detail: `${s.count} Trades · Tageszusammenfassung`, value: amount(s.total, s.currency), href: link('/trading', { summaryId: s.id }) })));
  });
  read('sleep', () => { const data = parseSleep(raw.sleep ?? null); const sorted = [...data.sessions].sort((a, b) => b.wakeAt - a.wakeAt); out.lastSleep = sorted[0] ? durationLabel(sorted[0].duration) : null;
    out.items.push(...sorted.map(s => ({ id: `sleep:${s.id}`, kind: 'sleep' as const, date: localDay(s.wakeAt), order: s.wakeAt, title: 'Schlaf', detail: 'Abgeschlossene Schlafzeit', value: durationLabel(s.duration), href: link('/sleep', { sessionId: s.id }) })));
  });
  read('running', () => { out.items.push(...parseRuns(raw.running ?? null).runs.map(r => ({ id: `run:${r.id}`, kind: 'running' as const, date: localDay(r.startedAt), order: r.startedAt, title: 'Lauf', detail: clock(r.durationMs), value: `${(r.distanceM / 1000).toFixed(2)} km`, href: link('/running', { runId: r.id }) }))); });
  read('nutrition', () => { const entries = parseFood(raw.nutrition ?? null).entries; out.foodCount = entries.filter(e => e.date === today).length;
    out.items.push(...entries.map(e => ({ id: `food:${e.id}`, kind: 'nutrition' as const, date: e.date, order: e.createdAt, title: e.product.name, detail: `${e.grams} g · Ernährung`, value: e.nutrition.calories === null ? 'kcal unbekannt' : `${Math.round(e.nutrition.calories)} kcal`, href: link('/nutrition', { day: e.date }) })));
  });
  read('quit', () => { for (const timer of parseQuit(raw.quit ?? null).timers) out.items.push(...timer.history.map(a => ({ id: `quit:${timer.id}:${a.id}`, kind: 'quit' as const, date: localDay(a.endedAt), order: a.endedAt, title: timer.title, detail: 'Abgeschlossener Versuch', value: durationLabel(a.duration), href: `/quit/${encodeURIComponent(timer.id)}/attempt/${encodeURIComponent(a.id)}` }))); });
  read('planner', () => { out.items.push(...parsePlan(raw.planner ?? null).tasks.filter(t => t.done).map(t => ({ id: `plan:${t.id}`, kind: 'planner' as const, date: localDay(t.completedAt!), order: t.completedAt!, title: t.title, detail: `Geplant: ${t.date} · ${taskTime(t)}`, value: 'Erledigt', href: link('/planner', { date: t.date, mode: 'day', itemId: t.id }) }))); });
  out.items.sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order || a.id.localeCompare(b.id)); return out;
}
