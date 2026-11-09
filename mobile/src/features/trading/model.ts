export type Direction = 'LONG' | 'SHORT';
export type Currency = 'USD' | 'EUR' | 'CHF';
export interface DailySummary { id: string; date: string; currency: Currency; total: number; count: number }
export function parseImport(text: string): DailySummary[] {
  const clean = text.normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\\r\\n|\\n|\\r/g, '\n');
  const cell = (value: string) => value.trim().replace(/^["'“”‘’]|["'“”‘’]$/g, '').trim();
  const rows = clean.split(/\r\n|[\n\r\u2028\u2029]/).map((line, index) => ({ line: line.trim(), sourceRow: index + 1 }))
    .filter(({ line }) => line && !/^`{3,}(?:csv|text)?\s*$/i.test(line) && !/^csv$/i.test(line))
    .map(({ line, sourceRow }) => {
      const delimiter = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
      return { parts: line.split(delimiter).map(cell), sourceRow, decimalComma: delimiter !== ',' };
    }).filter(({ parts }) => parts.map(p => p.toLowerCase()).join(',') !== 'date,currency,pnl,trades');
  const lines = rows;
  if (!lines.length || lines.length > 1000) throw new Error('Paste 1–1,000 daily rows: date,currency,pnl,trades.');
  const seen = new Set<string>();
  return lines.map(({ parts, sourceRow, decimalComma }) => {
    const [date, rawCurrency, rawAmount, countText] = parts;
    const currency = rawCurrency?.toUpperCase();
    const amount = decimalComma ? rawAmount?.replace(',', '.') : rawAmount;
    const index = sourceRow - 1;
    if (parts.length !== 4 || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !['USD', 'EUR', 'CHF'].includes(currency || '')) throw new Error(`Row ${sourceRow}: expected date,currency,pnl,trades. Found ${parts.length} fields; date: "${(date || '').slice(0, 24)}", currency: "${(rawCurrency || '').slice(0, 12)}". Example: 2026-09-01,USD,9.62,1`);
    const d = new Date(`${date}T12:00:00Z`);
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== date) throw new Error(`Invalid date in row ${index + 1}.`);
    if (!/^[+-]?\d+(\.\d{1,2})?$/.test(amount || '') || !/^\d+$/.test(countText || '')) throw new Error(`Invalid P&L or count in row ${index + 1}.`);
    const total = Number(amount); const count = Number(countText);
    if (!Number.isFinite(total) || Math.abs(total) > 1e12 || !Number.isSafeInteger(count) || count < 1 || count > 1000000) throw new Error(`Invalid values in row ${index + 1}.`);
    const id = `daily:${date}:${currency}`;
    if (seen.has(id)) throw new Error(`Duplicate day in row ${index + 1}.`);
    seen.add(id);
    return { id, date, currency: currency as Currency, total, count };
  });
}
export function parseSummaries(raw: string | null): DailySummary[] {
  if (raw === null) return [];
  const data = JSON.parse(raw);
  if (data.summaries === undefined) return [];
  if (!Array.isArray(data.summaries)) throw new Error('Invalid daily summaries.');
  if (!data.summaries.length) return [];
  return parseImport(data.summaries.map((s: DailySummary) => `${s.date},${s.currency},${s.total},${s.count}`).join('\n'));
}
export interface TradeInput { symbol: string; direction: Direction; entry: string; exit: string; quantity: string; fees: string; date: string; note: string; currency: Currency }
export interface LegacyTrade { id: string; symbol: string; direction: Direction; entry: number; exit: number; quantity: number; fees: number; date: string; note: string; currency: Currency }
export type TradeResult = 'PROFIT' | 'LOSS';
export interface ManualTradeInput { result: TradeResult; amount: string; date: string; symbol: string; note: string }
export interface ManualTrade { kind: 'manual-pnl'; id: string; symbol: string; direction: TradeResult; amount: number; currency: Currency; date: string; note: string; original?: LegacyTrade }
export type Trade = LegacyTrade | ManualTrade;
export function isManualTrade(trade: Trade): trade is ManualTrade { return 'kind' in trade && trade.kind === 'manual-pnl'; }
export function createManualTrade(input: ManualTradeInput, id: string, currency: Currency = 'USD', original?: LegacyTrade): ManualTrade {
  if (!['PROFIT', 'LOSS'].includes(input.result)) throw new Error('Choose PROFIT or LOSS.');
  const normalized = input.amount.trim().replace(',', '.');
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(normalized)) throw new Error('Enter a positive amount with up to two decimal places. Do not enter a minus sign.');
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) throw new Error('Amount must be greater than zero and no more than 1,000,000,000,000.');
  const date = new Date(`${input.date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.date) throw new Error('Enter a valid date as YYYY-MM-DD.');
  if (!['USD', 'EUR', 'CHF'].includes(currency)) throw new Error('Invalid trade currency.');
  if (input.symbol.trim().length > 30) throw new Error('Keep the optional market or label under 30 characters.');
  if (input.note.length > 2000) throw new Error('Keep your note under 2,000 characters.');
  return { kind: 'manual-pnl', id, symbol: input.symbol.trim().toUpperCase() || 'MANUAL TRADE', direction: input.result, amount: Math.round(amount * 100) / 100, currency, date: input.date, note: input.note.trim(), ...(original ? { original } : {}) };
}
function number(value: string, label: string, zero = false) {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?(e[+-]?\d+)?$/i.test(normalized)) throw new Error(`Enter a valid ${label}.`);
  const result = Number(normalized);
  if (!Number.isFinite(result) || (zero ? result < 0 : result <= 0)) throw new Error(`${label} must be ${zero ? 'zero or greater' : 'greater than zero'}.`);
  return result;
}
export function createTrade(input: TradeInput, id: string): LegacyTrade {
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol || symbol.length > 30) throw new Error('Enter a symbol (up to 30 characters).');
  if (!['LONG', 'SHORT'].includes(input.direction) || !['USD', 'EUR', 'CHF'].includes(input.currency)) throw new Error('Choose a direction and currency.');
  const date = new Date(`${input.date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.date) throw new Error('Enter a valid date as YYYY-MM-DD.');
  if (input.note.length > 2000) throw new Error('Keep your note under 2,000 characters.');
  const trade: LegacyTrade = { id, symbol, direction: input.direction, entry: number(input.entry, 'entry price'), exit: number(input.exit, 'exit price'), quantity: number(input.quantity, 'quantity'), fees: number(input.fees || '0', 'fees', true), date: input.date, note: input.note.trim(), currency: input.currency };
  if (!Number.isFinite(pnl(trade))) throw new Error('These values are too large.');
  return trade;
}
export function pnl(trade: Trade) { return isManualTrade(trade) ? trade.amount * (trade.direction === 'PROFIT' ? 1 : -1) : (trade.exit - trade.entry) * trade.quantity * (trade.direction === 'LONG' ? 1 : -1) - trade.fees; }
export function statistics(trades: Trade[]) {
  const totals = trades.reduce<Partial<Record<Currency, number>>>((out, trade) => { out[trade.currency] = (out[trade.currency] || 0) + pnl(trade); return out; }, {});
  return { totals, count: trades.length, wins: trades.filter(t => pnl(t) > 0).length, winRate: trades.length ? trades.filter(t => pnl(t) > 0).length / trades.length * 100 : 0 };
}
export function monthDays(month: string, trades: Trade[], currency: Currency, summaries: DailySummary[] = []) {
  const [year, number] = month.split('-').map(Number) as [number, number];
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
  return { offset, days: Array.from({ length: count }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, '0')}`;
    const daily = trades.filter(t => t.date === date && t.currency === currency);
    const imported = summaries.filter(s => s.date === date && s.currency === currency);
    return { date, day: i + 1, count: daily.length + imported.reduce((sum, s) => sum + s.count, 0), total: daily.reduce((sum, t) => sum + pnl(t), 0) + imported.reduce((sum, s) => sum + s.total, 0) };
  }) };
}
export function parseTrades(raw: string | null): Trade[] {
  if (raw === null) return [];
  const data = JSON.parse(raw);
  if (data.version !== 1 || !Array.isArray(data.trades)) throw new Error('Invalid trading data.');
  const ids = new Set<string>();
  return data.trades.map((t: Trade) => {
    if (!t || typeof t.id !== 'string' || !t.id || ids.has(t.id) || typeof t.note !== 'string') throw new Error('Invalid trade.');
    ids.add(t.id);
    if (isManualTrade(t)) {
      if (typeof t.amount !== 'number' || !Number.isFinite(t.amount) || Math.abs(t.amount * 100 - Math.round(t.amount * 100)) > 0.001) throw new Error('Invalid manual trade amount.');
      if (t.original && (typeof t.original !== 'object' || 'kind' in t.original)) throw new Error('Invalid original trade.');
      const original = t.original ? parseTrades(JSON.stringify({ version: 1, trades: [t.original] }))[0] : undefined;
      if (original && (isManualTrade(original) || original.id !== t.id)) throw new Error('Invalid original trade.');
      return createManualTrade({ result: t.direction, amount: t.amount.toFixed(2), date: t.date, symbol: t.symbol, note: t.note }, t.id, t.currency, original as LegacyTrade | undefined);
    }
    if ('kind' in t && t.kind !== undefined) throw new Error('Unsupported trade type.');
    for (const key of ['entry', 'exit', 'quantity', 'fees'] as const) if (typeof t[key] !== 'number' || !Number.isFinite(t[key])) throw new Error('Invalid trade values.');
    return createTrade({ ...t, entry: String(t.entry), exit: String(t.exit), quantity: String(t.quantity), fees: String(t.fees) }, t.id);
  });
}
