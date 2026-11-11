import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ToolPage, Label, Secondary, ErrorMessage, ui } from '../../src/components/ToolPage';
import { OutlineButton } from '../../src/components/OutlineButton';
import { colors } from '../../src/theme/tokens';
import { TradingRepository } from '../../src/features/trading/repository';
import { isManualTrade, parseImport, pnl } from '../../src/features/trading/model';
import { TradingDashboard } from '../../src/features/trading/TradingDashboard';
import type { Currency, DailySummary, ManualTradeInput, Trade } from '../../src/features/trading/model';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Disclosure } from '../../src/components/Disclosure';

const repository = new TradingRepository(AsyncStorage);
function blank(): ManualTradeInput { const d = new Date(); return { symbol: '', result: 'PROFIT', amount: '', date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, note: '' }; }
const money = (n: number, currency: string) => `${n > 0 ? '+' : ''}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
export default function Trading() {
  const params = useLocalSearchParams<{ action?: string; tradeId?: string; summaryId?: string; view?: string }>(); const router = useRouter();
  const { trades, summaries, status } = useSyncExternalStore(repository.subscribe, repository.getSnapshot, repository.getSnapshot);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [preview, setPreview] = useState<DailySummary[] | null>(null);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [form, setForm] = useState<ManualTradeInput | null>(null);
  const [editingCurrency, setEditingCurrency] = useState<Currency>('USD');
  const [editing, setEditing] = useState<string | undefined>();
  const [selected, setSelected] = useState<Trade | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  useEffect(() => { void repository.load(); }, []);
  useEffect(() => {
    if (status !== 'ready' || (!params.action && !params.tradeId && !params.summaryId && !params.view)) return;
    close();
    if (params.action === 'new') setForm(blank());
    else if (params.tradeId) { const item = trades.find(t => t.id === params.tradeId); if (item) setSelected(item); else setError('Dieser Trade wurde nicht gefunden.'); }
    else if (params.summaryId) { const item = summaries.find(s => s.id === params.summaryId); if (item) setSummary(item); else setError('Dieser Tageswert wurde nicht gefunden.'); }
    router.setParams({ action: undefined, tradeId: undefined, summaryId: undefined, view: undefined });
  }, [params.action, params.tradeId, params.summaryId, params.view, status, trades, summaries, router]);
  const field = (key: keyof ManualTradeInput, value: string) => { setForm(f => f && ({ ...f, [key]: value })); setError(null); };
  const close = () => { setForm(null); setSelected(null); setEditing(undefined); setEditingCurrency('USD'); setConfirmDelete(false); setError(null); setImporting(false); setPreview(null); setSummary(null); };
  async function mutate(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    try { await action(); close(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Please try again.'); }
    finally { locked.current = false; setBusy(false); }
  }
  function edit(trade: Trade) {
    setEditing(trade.id); setSelected(null); setConfirmDelete(false); setError(null);
    setEditingCurrency(trade.currency);
    const result = pnl(trade);
    setForm({ symbol: trade.symbol === 'MANUAL TRADE' ? '' : trade.symbol, result: result < 0 ? 'LOSS' : 'PROFIT', amount: Math.abs(result).toFixed(2), date: trade.date, note: trade.note });
  }
  const original = selected ? isManualTrade(selected) ? selected.original : selected : undefined;
  const input = (key: keyof ManualTradeInput, label: string, numeric = false, multiline = false) => <View style={styles.field} key={key}><Label>{label}</Label><TextInput accessibilityLabel={label} value={form![key]} onChangeText={value => field(key, value)} style={[ui.input, multiline && styles.note]} keyboardType={numeric ? 'decimal-pad' : 'default'} inputMode={numeric ? 'decimal' : 'text'} autoCapitalize={key === 'symbol' ? 'characters' : 'none'} autoCorrect={false} multiline={multiline} editable={!busy} maxLength={key === 'note' ? 2000 : key === 'symbol' ? 30 : 20} placeholder={numeric ? '0.00' : undefined} placeholderTextColor={colors.muted} /></View>;
  return <ToolPage title="TRADING">
    {status === 'loading' ? <Secondary>Opening your journal.</Secondary> : status === 'error' ? <View style={[ui.section, ui.card]}><ErrorMessage message="Your journal could not be loaded. Existing data has not been overwritten." /><OutlineButton label="RETRY" onPress={() => { void repository.load(); }} /></View> : importing ? <View style={[ui.section, ui.card]}>
      <Label>IMPORT DAILY P&L</Label><Secondary>Paste your private import code. It stays on this device. Each row: date,currency,pnl,trades. No entry or exit prices will be invented.</Secondary>
      <TextInput accessibilityLabel="Daily P&L import code" multiline value={importText} onChangeText={value => { setImportText(value); setPreview(null); setError(null); }} editable={!busy} autoCapitalize="none" autoCorrect={false} style={[ui.input, styles.note]} />
      <ErrorMessage message={error} />
      {!preview ? <OutlineButton label="PREVIEW IMPORT" onPress={() => { try { setPreview(parseImport(importText)); setError(null); } catch (e) { setError(e instanceof Error ? e.message : 'Invalid import.'); } }} /> : <><Label>{preview.length} DAYS · {preview.reduce((sum, row) => sum + row.count, 0)} TRADES</Label>{(['USD', 'EUR', 'CHF'] as const).filter(currency => preview.some(s => s.currency === currency)).map(currency => <Text key={currency} style={ui.title}>{money(preview.filter(s => s.currency === currency).reduce((sum, s) => sum + s.total, 0), currency)}</Text>)}<Secondary>Existing identical days are skipped. Conflicting days stop the whole import. Existing trades, timers and notes are preserved.</Secondary>{preview.map(row => <View style={ui.row} key={row.id}><Label>{row.date} · {row.count} TRADES</Label><Text style={ui.numeric}>{money(row.total, row.currency)}</Text></View>)}<OutlineButton label="IMPORT TO THIS DEVICE" disabled={busy} onPress={() => { void mutate(() => repository.importDaily(importText)); }} /></>}
      <OutlineButton label="CANCEL" disabled={busy} onPress={close} />
    </View> : summary ? <View style={[ui.section, ui.card]}><Label>IMPORTED DAILY SUMMARY</Label><Text style={ui.title}>{summary.date}</Text><Text style={styles.amount}>{money(summary.total, summary.currency)}</Text><Label>{summary.count} TRADES</Label><Secondary>Imported from a daily total. Symbols, direction, entry/exit prices and individual wins are unavailable.</Secondary><ErrorMessage message={error} />{confirmDelete ? <><Secondary>Delete this imported day from this device? Its P&L and count will be removed.</Secondary><OutlineButton label="CONFIRM DELETE" disabled={busy} onPress={() => { void mutate(() => repository.deleteSummary(summary.id)); }} /><OutlineButton label="KEEP SUMMARY" disabled={busy} onPress={() => setConfirmDelete(false)} /></> : <><OutlineButton label="DELETE SUMMARY" onPress={() => setConfirmDelete(true)} /><OutlineButton label="BACK TO JOURNAL" onPress={close} /></>}</View> : form ? <View style={[ui.section, ui.card]}>
      <Label>{editing ? 'EDIT TRADE' : 'ADD TRADE'}</Label>
      <Secondary>One trade. One result.</Secondary>
      <View accessibilityRole="radiogroup" accessibilityLabel="Trade result" style={styles.choices}>{(['PROFIT', 'LOSS'] as const).map(result => <Pressable key={result} accessibilityRole="radio" aria-checked={form.result === result} accessibilityState={{ checked: form.result === result, disabled: busy }} disabled={busy} onPress={() => field('result', result)} style={[styles.choice, form.result === result && styles.chosen]}><Text style={[ui.small, form.result === result && styles.chosenText]}>{result}</Text></Pressable>)}</View>
      {input('amount', `AMOUNT (${editingCurrency})`, true)}
      <Secondary>Enter a positive amount after fees. {form.result === 'LOSS' ? 'LOSS saves it as negative P&L automatically.' : 'PROFIT saves it as positive P&L.'}</Secondary>
      {editingCurrency !== 'USD' && <Secondary>This historical trade stays in {editingCurrency}. No currency conversion is applied.</Secondary>}
      {input('date', 'TRADE DATE (YYYY-MM-DD)')}<Disclosure title="Markt & Notiz (optional)">{input('symbol', 'MARKET / LABEL (OPTIONAL)')}{input('note', 'NOTE / LESSON (OPTIONAL)', false, true)}</Disclosure>
      <ErrorMessage message={error} />
      <OutlineButton primary label={busy ? 'SAVING' : 'SAVE TRADE'} disabled={busy} onPress={() => { void mutate(() => repository.saveManual(form, editing)); }} />
      <OutlineButton label="CANCEL" disabled={busy} onPress={close} />
    </View> : selected ? <View style={[ui.section, ui.card]}>
      <Label>{selected.date} / {selected.direction}</Label><Text style={ui.heading}>{selected.symbol}</Text><Text style={styles.amount}>{money(pnl(selected), selected.currency)}</Text><Label>NET P&L</Label>
      {original && <><Label>{isManualTrade(selected) ? 'ORIGINAL PRICE-BASED RECORD' : 'PRICE-BASED RECORD'}</Label>{([['ENTRY', original.entry], ['EXIT', original.exit], ['UNITS', original.quantity], ['FEES', `${original.fees} ${original.currency}`]] as const).map(([label, value]) => <View key={label} style={ui.row}><Label>{label}</Label><Text style={ui.numeric}>{value}</Text></View>)}{isManualTrade(selected) && <Secondary>Original prices are retained for reference. The result above uses your entered P&L.</Secondary>}</>}
      <View style={ui.divider} /><Label>NOTE / LESSON</Label><Secondary>{selected.note || 'No note added.'}</Secondary>
      <ErrorMessage message={error} />
      {confirmDelete ? <><Secondary>Delete this trade permanently from this device? Its P&L will be removed from your totals.</Secondary><OutlineButton label="CONFIRM DELETE" disabled={busy} onPress={() => { void mutate(() => repository.delete(selected.id)); }} /><OutlineButton label="KEEP TRADE" disabled={busy} onPress={() => setConfirmDelete(false)} /></> : <><OutlineButton label="EDIT TRADE" onPress={() => edit(selected)} /><OutlineButton label="DELETE TRADE" onPress={() => setConfirmDelete(true)} /><OutlineButton label="BACK TO JOURNAL" onPress={close} /></>}
    </View> : <TradingDashboard trades={trades} summaries={summaries} onNew={() => { close(); setForm(blank()); }} onSelect={trade => { setSelected(trade); setError(null); }} onImport={() => { close(); setImportText(''); setImporting(true); }} onSummary={value => { close(); setSummary(value); }} />}
  </ToolPage>;
}
const styles = StyleSheet.create({
  field: { gap: 8 }, note: { minHeight: 120, textAlignVertical: 'top' }, choices: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, minHeight: 48, justifyContent: 'center', alignItems: 'center' }, chosen: { backgroundColor: colors.text, borderColor: colors.text }, chosenText: { color: colors.background },
  amount: { color: colors.text, fontSize: 32, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: -1 }, trade: { gap: 10, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: colors.line },
});
