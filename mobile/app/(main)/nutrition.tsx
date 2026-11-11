import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Disclosure } from '../../src/components/Disclosure';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorMessage, Label, Secondary, ToolPage, ui } from '../../src/components/ToolPage';
import { OutlineButton } from '../../src/components/OutlineButton';
import BarcodeScanner from '../../src/features/nutrition/BarcodeScanner';
import { NutritionRepository } from '../../src/features/nutrition/repository';
import { dailyTotals, emptyNutrition, normalizeBarcode, nutrientKeys, parseValue, portion, validDate } from '../../src/features/nutrition/model';
import type { FoodProduct, Nutrition as Nutrients, Nutrient } from '../../src/features/nutrition/model';
import { lookupOpenFoodFacts } from '../../src/features/nutrition/openFoodFacts';
const repository = new NutritionRepository(AsyncStorage);
const names: Record<Nutrient, string> = { calories: 'CALORIES', protein: 'PROTEIN', carbohydrates: 'CARBS', fat: 'FAT' };
const units: Record<Nutrient, string> = { calories: 'kcal', protein: 'g', carbohydrates: 'g', fat: 'g' };
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const makeToken = () => `food-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const display = (value: number | null, key: Nutrient) => value === null ? 'Unknown' : `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${units[key]}`;
function Values({ values, missing }: { values: Nutrients; missing?: Record<Nutrient, number> }) {
  return <View style={styles.values}>{nutrientKeys.map(key => <View key={key} style={styles.metric}><Label>{names[key]}</Label><Text style={styles.value}>{display(values[key], key)}</Text>{!!missing?.[key] && <Label>{missing[key]} UNKNOWN {missing[key] === 1 ? 'ENTRY' : 'ENTRIES'}</Label>}</View>)}</View>;
}
export default function NutritionScreen() {
  const params = useLocalSearchParams<{ day?: string; action?: string; view?: string }>(); const router = useRouter();
  const { data, status } = useSyncExternalStore(repository.subscribe, repository.getSnapshot, repository.getSnapshot);
  const [mode, setMode] = useState<'journal' | 'scan' | 'review' | 'edit' | 'library'>('journal');
  const [date, setDate] = useState(localDay); const [barcode, setBarcode] = useState(''); const [upce, setUpce] = useState(false);
  const [selected, setSelected] = useState<FoodProduct | null>(null); const [grams, setGrams] = useState('100');
  const [name, setName] = useState(''); const [brand, setBrand] = useState(''); const [labelChecked, setLabelChecked] = useState(false);
  const [fields, setFields] = useState<Record<Nutrient, string>>({ calories: '', protein: '', carbohydrates: '', fat: '' });
  const [search, setSearch] = useState(''); const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const lock = useRef(false); const generation = useRef(0); const abort = useRef<AbortController | null>(null);
  const token = useRef(makeToken()); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; void repository.load(); return () => { mounted.current = false; abort.current?.abort(); }; }, []);
  useEffect(() => { if (status !== 'ready' || (!params.day && !params.action && !params.view)) return; if (params.day && validDate(params.day)) setDate(params.day); setMode(params.action === 'scan' ? 'scan' : 'journal'); router.setParams({ day: undefined, action: undefined, view: undefined }); }, [params.day, params.action, params.view, status, router]);
  useFocusEffect(useCallback(() => () => { generation.current++; abort.current?.abort(); lock.current = false; setBusy(false); }, []));
  const entries = data.entries.filter(entry => entry.date === date); const totals = dailyTotals(entries);
  let calculated: Nutrients | null = null;
  if (selected && grams.trim()) { try { calculated = portion(selected.per100g, Number(grams.replace(',', '.'))); } catch { /* Show the amount hint below. */ } }
  const navigate = (next: typeof mode) => { if (lock.current) return; setError(null); setNotice(null); setMode(next); };
  function openProduct(product: FoodProduct) { token.current = makeToken(); setSelected(product); setGrams('100'); setError(null); setMode('review'); }
  function edit(product: FoodProduct) {
    setSelected(product); setName(product.name); setBrand(product.brand); setLabelChecked(product.labelChecked);
    setFields(Object.fromEntries(nutrientKeys.map(key => [key, product.per100g[key] === null ? '' : String(product.per100g[key])])) as Record<Nutrient, string>);
    setError(null); setMode('edit');
  }
  async function lookup(raw: string, format?: string) {
    if (lock.current || status !== 'ready') return;
    let code: string;
    try { code = normalizeBarcode(raw, format); } catch (e) { setError((e as Error).message); return; }
    lock.current = true; setBusy(true); setError(null); setBarcode(code); setUpce(false);
    const current = ++generation.current; abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    try {
      const local = repository.product(code);
      if (local) { openProduct(local); return; }
      const product = await lookupOpenFoodFacts(code, controller.signal);
      if (!mounted.current || current !== generation.current) return;
      if (!product) { setError('Product not found. Create it below using the nutrition label.'); return; }
      await repository.saveProduct(product);
      if (mounted.current && current === generation.current) openProduct(product);
    } catch (e) { if (mounted.current && current === generation.current) setError(e instanceof Error ? e.message : 'Product lookup failed. Try again or create it manually.'); }
    finally { if (mounted.current && current === generation.current) { lock.current = false; setBusy(false); } }
  }
  function manual() {
    try {
      const code = normalizeBarcode(barcode, upce ? 'UPC_E' : undefined); const existing = repository.product(code);
      token.current = makeToken(); edit(existing || { barcode: code, name: '', brand: '', per100g: emptyNutrition(), source: 'manual', labelChecked: false, updatedAt: Date.now() });
    } catch (e) { setError((e as Error).message); }
  }
  async function persist(action: () => Promise<void>, success: () => void) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await action(); if (mounted.current) success(); }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Could not save. Please try again.'); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  function saveProduct() {
    if (!selected) return;
    try {
      const product: FoodProduct = { barcode: selected.barcode, name, brand, per100g: Object.fromEntries(nutrientKeys.map(key => [key, parseValue(fields[key], key)])) as Nutrients, source: 'manual', labelChecked, updatedAt: Date.now() };
      void persist(() => repository.saveProduct(product), () => { setSelected(product); setMode('review'); });
    } catch (e) { setError((e as Error).message); }
  }
  function add() {
    if (!selected) return;
    const snapshot = selected; const amount = Number(grams.replace(',', '.')); const id = token.current;
    void persist(() => repository.log(snapshot, amount, date, id), () => { setSelected(null); setMode('journal'); setNotice(`Added ${snapshot.name} to ${date}.`); });
  }
  function moveDay(offset: number) { if (!validDate(date)) return; const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + offset); setDate(localDay(d)); setNotice(null); }
  const source = selected?.source === 'open-food-facts' ? 'Open Food Facts · community data, not independently verified' : 'Locally entered product';
  return <ToolPage title="NUTRITION">
    {status === 'loading' ? <Secondary>Opening your food journal.</Secondary> : status === 'error' ? <View style={ui.card}><ErrorMessage message="Your nutrition data could not be read. Nothing has been replaced." /><OutlineButton label="RETRY" onPress={() => { void repository.load(); }} /></View> : <>
      {mode !== 'journal' && <View style={ui.section}><OutlineButton label="BACK TO JOURNAL" disabled={busy} onPress={() => navigate('journal')} /></View>}
      {mode === 'journal' && <View style={ui.section}>
        <OutlineButton primary label="SCAN FOOD" disabled={!validDate(date)} onPress={() => { setBarcode(''); setUpce(false); navigate('scan'); }} />
        <Disclosure title={validDate(date) ? `Tag ändern · ${new Date(`${date}T12:00:00`).toLocaleDateString('de-CH')}` : 'Tag ändern'}><Label>DATUM</Label><TextInput accessibilityLabel="Food journal date" value={date} onChangeText={value => { setDate(value); setNotice(null); }} style={ui.input} autoCapitalize="none" autoCorrect={false} maxLength={10} /><View style={ui.row}><OutlineButton label="PREV DAY" disabled={!validDate(date)} onPress={() => moveDay(-1)} /><OutlineButton label="NEXT DAY" disabled={!validDate(date)} onPress={() => moveDay(1)} /></View>{!validDate(date) && <ErrorMessage message="Enter a valid date as YYYY-MM-DD." />}</Disclosure>
        <Values values={totals.totals} missing={totals.missing} />
        {entries.length === 0 ? <Secondary>No foods logged for this day. Scan a package or choose a saved product.</Secondary> : <Secondary>{entries.length} journal {entries.length === 1 ? 'entry' : 'entries'}. {nutrientKeys.some(key => totals.missing[key] > 0) ? 'Totals include known values only; unknown values are not counted as zero.' : 'Totals are based on the amounts you logged.'}</Secondary>}
        {notice && <Text accessibilityRole="alert" style={ui.secondary}>{notice}</Text>}
        <OutlineButton label="SAVED FOODS" disabled={!validDate(date)} onPress={() => navigate('library')} />
        {entries.map(entry => <View key={entry.id} style={ui.card}><Text style={ui.title}>{entry.product.name}</Text><Secondary>{entry.product.brand || 'Brand unknown'} · {entry.grams} g</Secondary><Values values={entry.nutrition} /><Label>{entry.product.labelChecked ? 'LABEL CHECKED BY YOU' : 'UNVERIFIED PRODUCT DATA'}</Label>{nutrientKeys.some(key => entry.nutrition[key] === null) && <Secondary>Some values are unknown. This entry is incomplete.</Secondary>}</View>)}
        <Disclosure title="Hinweise & Datenschutz"><Secondary>Your food journal and saved products stay on this device. No account or cloud sync.</Secondary></Disclosure>
      </View>}
      {mode === 'scan' && <View style={ui.section}><Label>SCAN FOOD · {date}</Label>{!busy && <BarcodeScanner onDetected={(value, format) => { void lookup(value, format); }} />}<View style={ui.card}><Label>OR ENTER THE PRINTED BARCODE</Label><TextInput accessibilityLabel="Food barcode" value={barcode} onChangeText={setBarcode} keyboardType="number-pad" style={ui.input} editable={!busy} autoCorrect={false} maxLength={30} /><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: upce, disabled: busy }} disabled={busy} onPress={() => setUpce(!upce)} style={ui.textButton}><Text style={ui.small}>{upce ? 'UPC-E SELECTED' : 'USE UPC-E FOR AN 8-DIGIT UPC'}</Text></Pressable><OutlineButton label={busy ? 'LOOKING UP FOOD' : 'FIND PRODUCT'} disabled={busy || !barcode.trim()} onPress={() => { void lookup(barcode, upce ? 'UPC_E' : undefined); }} /><OutlineButton label="CREATE MANUAL FOOD" disabled={busy || !barcode.trim()} onPress={manual} /><ErrorMessage message={error} /></View></View>}
      {mode === 'review' && selected && <View style={ui.section}><View style={ui.card}><Label>{selected.barcode}</Label><Text style={ui.heading}>{selected.name}</Text><Secondary>{selected.brand || 'Brand unknown'}</Secondary><Label>PER 100 GRAMS</Label><Values values={selected.per100g} /><Secondary>{source}. {selected.labelChecked ? 'You marked the label as checked.' : 'Check the package label before relying on these values.'}</Secondary>{selected.warning && <Secondary>{selected.warning}</Secondary>}<OutlineButton label="EDIT SAVED PRODUCT" disabled={busy} onPress={() => edit(selected)} /></View><View style={ui.card}><Label>CONSUMED AMOUNT · GRAMS</Label><TextInput accessibilityLabel="Consumed grams" value={grams} onChangeText={setGrams} style={ui.input} keyboardType="decimal-pad" editable={!busy} maxLength={12} /><Label>THIS PORTION · {date}</Label><Values values={calculated || emptyNutrition()} />{!calculated && <Secondary>Enter a valid amount greater than zero.</Secondary>}{nutrientKeys.some(key => selected.per100g[key] === null) && <Secondary>Unknown nutrients remain unknown in your journal. Edit the product to fill them in from the label.</Secondary>}<ErrorMessage message={error} /><OutlineButton label={busy ? 'SAVING' : 'ADD TO FOOD JOURNAL'} disabled={busy || !calculated || nutrientKeys.every(key => selected.per100g[key] === null)} onPress={add} /></View>{selected.source === 'open-food-facts' && <Text accessibilityRole="link" style={ui.secondary} onPress={() => { void Linking.openURL(`https://world.openfoodfacts.org/product/${selected.barcode}`); }}>Product data: Open Food Facts · ODbL. View source.</Text>}</View>}
      {mode === 'edit' && selected && <View style={[ui.section, ui.card]}><Label>LOCAL PRODUCT · {selected.barcode}</Label><Secondary>Enter values per 100 grams from the label. Leave unknown fields empty; use 0 only when the label says zero. Changes affect future logs, not existing journal entries.</Secondary><Label>PRODUCT NAME</Label><TextInput accessibilityLabel="Food name" style={ui.input} value={name} onChangeText={setName} editable={!busy} maxLength={160} /><Label>BRAND · OPTIONAL</Label><TextInput accessibilityLabel="Food brand" style={ui.input} value={brand} onChangeText={setBrand} editable={!busy} maxLength={120} />{nutrientKeys.map(key => <View key={key} style={styles.field}><Label>{names[key]} PER 100G · {units[key]}</Label><TextInput accessibilityLabel={`${names[key]} per 100g`} value={fields[key]} onChangeText={value => setFields(current => ({ ...current, [key]: value }))} placeholder="Unknown" placeholderTextColor="#8A8A8A" style={ui.input} keyboardType="decimal-pad" editable={!busy} maxLength={12} /></View>)}<Pressable accessibilityRole="checkbox" accessibilityState={{ checked: labelChecked, disabled: busy }} disabled={busy} style={ui.textButton} onPress={() => setLabelChecked(!labelChecked)}><Text style={ui.small}>{labelChecked ? 'LABEL CHECKED BY ME' : 'MARK LABEL AS CHECKED'}</Text></Pressable><ErrorMessage message={error} /><OutlineButton label="SAVE PRODUCT LOCALLY" disabled={busy || !name.trim()} onPress={saveProduct} /></View>}
      {mode === 'library' && <View style={ui.section}><Label>SAVED FOODS</Label><TextInput accessibilityLabel="Search saved foods" placeholder="Name, brand or barcode" placeholderTextColor="#8A8A8A" style={ui.input} value={search} onChangeText={setSearch} />{Object.values(data.products).filter(product => `${product.name} ${product.brand} ${product.barcode}`.toLowerCase().includes(search.toLowerCase())).map(product => <View key={product.barcode} style={ui.card}><Text style={ui.title}>{product.name}</Text><Secondary>{product.brand || 'Brand unknown'} · {product.barcode}</Secondary><Values values={product.per100g} /><OutlineButton label={`LOG ${product.name.slice(0, 30)}`} onPress={() => openProduct(product)} /><OutlineButton label="EDIT PRODUCT" onPress={() => { token.current = makeToken(); edit(product); }} /></View>)}{Object.keys(data.products).length === 0 && <Secondary>No saved products yet. Scan a food or create one manually.</Secondary>}</View>}
      <View style={ui.section}><Text accessibilityRole="link" style={ui.secondary} onPress={() => { void Linking.openURL('https://world.openfoodfacts.org'); }}>Food database: Open Food Facts · ODbL</Text></View>
    </>}
  </ToolPage>;
}
const styles = StyleSheet.create({ values: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, metric: { flexGrow: 1, flexBasis: '45%', backgroundColor: '#141414', borderWidth: 1, borderColor: '#292929', borderRadius: 18, padding: 14, gap: 8 }, value: { color: '#FFFFFF', fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] }, field: { gap: 8 } });
