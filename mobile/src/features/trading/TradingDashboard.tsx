import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorMessage, Label, Secondary, ui } from '../../components/ToolPage';
import { OutlineButton } from '../../components/OutlineButton';
import { colors } from '../../theme/tokens';
import { monthDays, pnl, statistics } from './model';
import type { Currency, DailySummary, Trade } from './model';
const GOALS_KEY = 'better:v1:trading-goals';
export const money = (n: number, currency: string) => `${n > 0 ? '+' : ''}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
export function TradingDashboard({ trades, summaries, onNew, onSelect, onImport, onSummary }: { trades: Trade[]; summaries: DailySummary[]; onNew: () => void; onSelect: (trade: Trade) => void; onImport: () => void; onSummary: (summary: DailySummary) => void }) {
  const { width } = useWindowDimensions();
  const [month, setMonth] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [currency, setCurrency] = useState<Currency>('USD');
  const [day, setDay] = useState<string | null>(null);
  const [goals, setGoals] = useState<Record<string, number>>({});
  const [goalStatus, setGoalStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [goalError, setGoalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  async function loadGoals() {
    setGoalStatus('loading');
    try {
      const raw = await AsyncStorage.getItem(GOALS_KEY);
      const parsed = raw === null ? {} : JSON.parse(raw);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object' || Object.values(parsed).some(v => typeof v !== 'number' || !Number.isFinite(v) || v <= 0)) throw new Error();
      setGoals(parsed); setGoalStatus('ready');
    } catch { setGoalStatus('error'); }
  }
  useEffect(() => { void loadGoals(); }, []);
  const key = `${month}:${currency}`;
  const target = goals[key];
  const monthly = trades.filter(t => t.currency === currency && t.date.startsWith(`${month}-`));
  const monthlySummaries = summaries.filter(s => s.currency === currency && s.date.startsWith(`${month}-`));
  const monthTotal = monthly.reduce((sum, t) => sum + pnl(t), 0) + monthlySummaries.reduce((sum, s) => sum + s.total, 0);
  const allTotal = trades.filter(t => t.currency === currency).reduce((sum, t) => sum + pnl(t), 0) + summaries.filter(s => s.currency === currency).reduce((sum, s) => sum + s.total, 0);
  const stats = statistics(monthly);
  const calendar = monthDays(month, trades, currency, summaries);
  const cells = [...Array.from({ length: calendar.offset }, () => null), ...calendar.days];
  while (cells.length % 7) cells.push(null);
  const progress = target ? Math.min(100, Math.max(0, monthTotal / target * 100)) : 0;
  function changeMonth(delta: number) { const [y, m] = month.split('-').map(Number) as [number, number]; const d = new Date(Date.UTC(y, m - 1 + delta, 1)); setMonth(d.toISOString().slice(0, 7)); setDay(null); setEditingGoal(false); setGoalError(null); }
  async function saveGoal() {
    if (lock.current || goalStatus !== 'ready') return;
    const amount = Number(goalInput.trim().replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) { setGoalError('Enter a monthly goal greater than zero.'); return; }
    lock.current = true; setSaving(true); setGoalError(null);
    try { const next = { ...goals, [key]: amount }; await AsyncStorage.setItem(GOALS_KEY, JSON.stringify(next)); setGoals(next); setEditingGoal(false); }
    catch { setGoalError('Could not save your goal. Try again.'); }
    finally { lock.current = false; setSaving(false); }
  }
  return <View style={ui.section}>
    <View style={styles.currencies}>{(['USD', 'EUR', 'CHF'] as const).map(value => <Pressable accessibilityRole="button" accessibilityState={{ selected: value === currency }} key={value} onPress={() => { setCurrency(value); setDay(null); setEditingGoal(false); }} style={[styles.currency, value === currency && styles.currencySelected]}><Text style={[ui.small, value !== currency && { color: colors.muted }]}>{value}</Text></Pressable>)}</View>
    <View style={styles.summary}>
      <View style={styles.panel}><Label>TOTAL P&L</Label><Text adjustsFontSizeToFit numberOfLines={1} style={styles.total}>{money(allTotal, '')}</Text><Label>{currency} · ALL TIME</Label></View>
      <View style={styles.panel}><Label>MONTHLY GOAL</Label><Pressable accessibilityRole="button" accessibilityLabel="Edit monthly goal" disabled={goalStatus !== 'ready' || saving} onPress={() => { setGoalInput(target ? String(target) : ''); setEditingGoal(true); setGoalError(null); }} style={styles.goalAction}><Text style={ui.small}>{target ? `${target.toLocaleString('en-US')} ${currency}` : 'SET GOAL'}</Text></Pressable><View style={styles.track}><View style={[styles.bar, { width: `${progress}%` }]} /></View><Secondary>{target ? `${Math.round(progress)}%` : 'No goal set'}</Secondary></View>
    </View>
    {goalStatus === 'error' && <><ErrorMessage message="Your monthly goals could not be loaded." /><OutlineButton label="RETRY GOALS" onPress={() => { void loadGoals(); }} /></>}
    {editingGoal && <View style={ui.section}><Label>MONTHLY GOAL · {month} · {currency}</Label><TextInput accessibilityLabel="Monthly goal amount" value={goalInput} onChangeText={setGoalInput} keyboardType="decimal-pad" style={ui.input} editable={!saving} /><ErrorMessage message={goalError} /><OutlineButton label="SAVE GOAL" disabled={saving} onPress={() => { void saveGoal(); }} /><OutlineButton label="CANCEL GOAL" disabled={saving} onPress={() => setEditingGoal(false)} /></View>}
    <View style={styles.monthRow}><Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => changeMonth(-1)} style={styles.monthButton}><Text style={ui.small}>PREV</Text></Pressable><Text style={ui.title}>{new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).toUpperCase()}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => changeMonth(1)} style={styles.monthButton}><Text style={ui.small}>NEXT</Text></Pressable></View>
    <View style={styles.week}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => <Text key={i} style={styles.weekday}>{label}</Text>)}</View>
    <View style={styles.grid}>{cells.map((cell, i) => cell ? <View key={cell.date} style={styles.cellFrame}><Pressable accessibilityRole="button" accessibilityLabel={`${cell.date}, ${money(cell.total, currency)}, ${cell.count} trades`} accessibilityState={{ selected: day === cell.date }} onPress={() => setDay(day === cell.date ? null : cell.date)} style={[styles.cell, cell.count > 0 && styles.traded, cell.total > 0 && styles.win, cell.total < 0 && styles.loss, day === cell.date && styles.selected]}><Text style={styles.day}>{cell.day}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.daily, { fontSize: Math.min(10, Math.max(6, ((Math.min(width, 520) - 58) / 7 - 16) / ((cell.total.toFixed(2).length + (cell.total > 0 ? 1 : 0)) * 0.65))) }]}>{cell.count ? `${cell.total > 0 ? '+' : ''}${cell.total.toFixed(2)}` : '—'}</Text><Text style={styles.count}>{cell.count ? `${cell.count} ${cell.count === 1 ? 'trade' : 'trades'}` : ''}</Text></Pressable></View> : <View key={`empty-${i}`} style={styles.cellFrame} />)}</View>
    <View style={ui.row}><Secondary>{money(monthTotal, currency)} THIS MONTH</Secondary><Secondary>{stats.count ? `${stats.winRate.toFixed(0)}% WIN RATE` : 'WIN RATE —'}</Secondary></View>
    {monthlySummaries.length > 0 && <Secondary>Imported days include total P&L and trade counts. Win rate uses individual trades only; it cannot be calculated from daily totals.</Secondary>}
    <OutlineButton label="+ ADD TRADE" onPress={onNew} />
    <OutlineButton label="IMPORT DAILY P&L" onPress={onImport} />
    <View style={ui.divider} /><View style={ui.row}><Label>{day || 'MONTHLY LEDGER'}</Label>{day && <Pressable accessibilityRole="button" onPress={() => setDay(null)} style={styles.monthButton}><Text style={ui.small}>SHOW MONTH</Text></Pressable>}</View>
    {monthly.filter(t => !day || t.date === day).sort((a, b) => b.date.localeCompare(a.date)).map(trade => <Pressable key={trade.id} accessibilityRole="button" accessibilityLabel={`${trade.symbol}, ${trade.direction}, ${trade.date}, ${money(pnl(trade), trade.currency)}`} onPress={() => onSelect(trade)} style={styles.trade}><View style={ui.row}><Text style={ui.title}>{trade.symbol}</Text><Text style={ui.numeric}>{money(pnl(trade), trade.currency)}</Text></View><Label>{trade.date} / {trade.direction}</Label></Pressable>)}
    {monthlySummaries.filter(s => !day || s.date === day).sort((a, b) => b.date.localeCompare(a.date)).map(summary => <Pressable key={summary.id} accessibilityRole="button" accessibilityLabel={`Daily summary ${summary.date}`} onPress={() => onSummary(summary)} style={styles.trade}><View style={ui.row}><Text style={ui.title}>{summary.date}</Text><Text style={ui.numeric}>{money(summary.total, summary.currency)}</Text></View><Label>IMPORTED DAY · {summary.count} TRADES</Label></Pressable>)}
    {!monthly.some(t => !day || t.date === day) && !monthlySummaries.some(s => !day || s.date === day) && <Secondary>No trades {day ? 'on this day' : 'this month'} in {currency}. Add your first entry.</Secondary>}
    <Secondary>Net results after fees. Currencies stay separate. Stored on this device.</Secondary>
  </View>;
}
const styles = StyleSheet.create({
  currencies: { flexDirection: 'row', gap: 4, backgroundColor: colors.surface, borderRadius: 999, padding: 5, borderWidth: 1, borderColor: colors.line }, currency: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 999 }, currencySelected: { backgroundColor: colors.raised },
  summary: { flexDirection: 'row', gap: 12 }, panel: { flex: 1, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, padding: 18, gap: 12, minHeight: 160 }, total: { color: colors.text, fontWeight: '600', fontSize: 30, letterSpacing: -0.8, fontVariant: ['tabular-nums'] }, goalAction: { minHeight: 36, justifyContent: 'center', borderRadius: 14 }, track: { height: 5, borderRadius: 999, overflow: 'hidden', backgroundColor: colors.line }, bar: { height: 5, borderRadius: 999, backgroundColor: colors.text },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }, monthButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.surface }, week: { flexDirection: 'row', paddingHorizontal: 7 }, weekday: { width: '14.285714%', textAlign: 'center', color: colors.muted, fontSize: 10 }, grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.surface, borderRadius: 20, padding: 4, borderWidth: 1, borderColor: colors.line },
  cellFrame: { width: '14.285714%', padding: 3, minHeight: 82 }, cell: { flex: 1, minHeight: 76, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 2, backgroundColor: '#181818', borderWidth: 1, borderColor: '#242424', justifyContent: 'space-between' }, traded: { backgroundColor: colors.raised, borderColor: '#555555' }, win: { borderColor: '#3E9B70' }, loss: { backgroundColor: '#181818', borderColor: '#B85C5C' }, selected: { backgroundColor: '#363636' }, day: { color: colors.muted, fontSize: 10 }, daily: { color: colors.text, fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'] }, count: { color: colors.muted, fontSize: 7 }, trade: { gap: 12, padding: 20, backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.line },
});
