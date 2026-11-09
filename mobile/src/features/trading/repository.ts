import { createManualTrade, createTrade, isManualTrade, parseImport, parseSummaries, parseTrades } from './model.ts';
import type { DailySummary, ManualTradeInput, Trade, TradeInput } from './model.ts';
interface Storage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export const TRADING_KEY = 'better:v1:trading';
export class TradingRepository {
  private snapshot: { trades: Trade[]; summaries: DailySummary[]; status: 'loading' | 'ready' | 'error' } = { trades: [], summaries: [], status: 'loading' };
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private storage: Storage;
  constructor(storage: Storage) { this.storage = storage; }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(snapshot: typeof this.snapshot) { this.snapshot = snapshot; this.listeners.forEach(fn => fn()); }
  async load() {
    try { const raw = await this.storage.getItem(TRADING_KEY); this.publish({ trades: parseTrades(raw), summaries: parseSummaries(raw), status: 'ready' }); }
    catch { this.publish({ ...this.snapshot, status: 'error' }); }
  }
  private change(fn: (trades: Trade[], summaries: DailySummary[]) => { trades: Trade[]; summaries: DailySummary[] }) {
    const operation = this.queue.then(async () => {
      if (this.snapshot.status !== 'ready') throw new Error('Your journal could not be loaded. Retry before making changes.');
      const next = fn(this.snapshot.trades, this.snapshot.summaries);
      await this.storage.setItem(TRADING_KEY, JSON.stringify({ version: 1, ...next }));
      this.publish({ ...next, status: 'ready' });
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  save(input: TradeInput, id?: string) {
    const trade = createTrade(input, id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
    return this.change((trades, summaries) => {
      if (id && !trades.some(t => t.id === id)) throw new Error('This trade no longer exists.');
      if (summaries.some(s => s.date === trade.date && s.currency === trade.currency)) throw new Error('This day already has an imported summary. Remove the summary before entering individual trades for this day.');
      return { trades: id ? trades.map(t => t.id === id ? trade : t) : [...trades, trade], summaries };
    });
  }
  delete(id: string) { return this.change((trades, summaries) => ({ trades: trades.filter(t => t.id !== id), summaries })); }
  saveManual(input: ManualTradeInput, id?: string) {
    const tradeId = id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return this.change((trades, summaries) => {
      const existing = id ? trades.find(trade => trade.id === id) : undefined;
      if (id && !existing) throw new Error('This trade no longer exists.');
      const original = existing ? isManualTrade(existing) ? existing.original : existing : undefined;
      // A historical non-USD trade keeps its currency; no implicit FX conversion.
      const trade = createManualTrade(input, tradeId, existing?.currency || 'USD', original);
      if (summaries.some(summary => summary.date === trade.date && summary.currency === trade.currency)) throw new Error('This day already has an imported daily total. A manual trade cannot be added to it because that would double-count the day. Choose another date or review the imported summary.');
      return { trades: id ? trades.map(current => current.id === id ? trade : current) : [...trades, trade], summaries };
    });
  }
  importDaily(text: string) {
    const imported = parseImport(text);
    return this.change((trades, summaries) => {
      for (const row of imported) {
        if (trades.some(t => t.date === row.date && t.currency === row.currency)) throw new Error(`Individual trades already exist on ${row.date}. Nothing was imported.`);
        const existing = summaries.find(s => s.id === row.id);
        if (existing && (existing.total !== row.total || existing.count !== row.count)) throw new Error(`A different summary exists on ${row.date}. Nothing was imported.`);
      }
      return { trades, summaries: [...summaries, ...imported.filter(row => !summaries.some(s => s.id === row.id))] };
    });
  }
  deleteSummary(id: string) { return this.change((trades, summaries) => ({ trades, summaries: summaries.filter(s => s.id !== id) })); }
}
