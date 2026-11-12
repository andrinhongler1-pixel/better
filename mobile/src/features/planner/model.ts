export interface PlanInput { title: string; date: string; time: string; duration: string; note: string }
export interface PlanTask { id: string; title: string; date: string; time: string | null; durationMinutes: number | null; note: string; done: boolean; completedAt: number | null; createdAt: number; updatedAt: number; revision: number }
export interface PlannerData { version: 1; tasks: PlanTask[] }
export const emptyPlan = (): PlannerData => ({ version: 1, tasks: [] });
export const localDate = (now = new Date()) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
export function validDate(date: string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false; const d = new Date(`${date}T12:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === date; }
export function shiftDate(date: string, days: number) { if (!validDate(date)) throw new Error('Bitte ein gültiges Datum wählen.'); const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); const result = d.toISOString().slice(0, 10); if (!validDate(result)) throw new Error('Datum außerhalb des unterstützten Bereichs.'); return result; }
export function weekDates(date: string) { if (!validDate(date)) throw new Error('Bitte ein gültiges Datum wählen.'); const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; const start = shiftDate(date, -weekday); return Array.from({ length: 7 }, (_, i) => shiftDate(start, i)); }
export const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export function validateInput(input: PlanInput) {
  const title = input.title.trim(), time = input.time.trim(), note = input.note.trim();
  if (!title || title.length > 160) throw new Error('Bitte einen Titel mit höchstens 160 Zeichen eingeben.');
  if (!validDate(input.date)) throw new Error('Bitte ein gültiges Datum wählen.');
  // Ensure all seven displayed dates can be represented before accepting the task.
  weekDates(input.date);
  if (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Uhrzeit bitte als HH:MM eingeben.');
  const duration = input.duration.trim();
  if (duration && (!/^\d{1,4}$/.test(duration) || Number(duration) < 1 || Number(duration) > 1440)) throw new Error('Dauer bitte als ganze Minuten von 1 bis 1440 eingeben.');
  if (duration && !time) throw new Error('Für eine Dauer bitte eine Startzeit wählen.');
  if (duration && minutesOf(time) + Number(duration) > 1440) throw new Error('Der Termin muss am gewählten Tag enden. Für den nächsten Tag einen eigenen Eintrag anlegen.');
  if (note.length > 2000) throw new Error('Notiz bitte auf 2000 Zeichen kürzen.');
  return { title, date: input.date, time: time || null, durationMinutes: duration ? Number(duration) : null, note };
}
export function taskTime(task: PlanTask) { if (!task.time) return 'Ohne Uhrzeit'; if (!task.durationMinutes) return task.time; const end = minutesOf(task.time) + task.durationMinutes; return `${task.time}–${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`; }
export function tasksForDay(tasks: PlanTask[], date: string) { return tasks.filter(task => task.date === date).sort((a, b) => Number(a.done) - Number(b.done) || (a.time || '99:99').localeCompare(b.time || '99:99') || a.createdAt - b.createdAt || a.id.localeCompare(b.id)); }
export function parsePlan(raw: string | null): PlannerData {
  if (raw === null) return emptyPlan(); const d = JSON.parse(raw);
  if (!d || d.version !== 1 || !Array.isArray(d.tasks)) throw new Error('Ungültige Planerdaten.');
  const ids = new Set<string>(); const stamp = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && v < 8640000000000000;
  for (const task of d.tasks) {
    if (!task || typeof task.id !== 'string' || !task.id || ids.has(task.id) || typeof task.title !== 'string' || typeof task.date !== 'string' || (task.time !== null && typeof task.time !== 'string') || (task.durationMinutes !== null && (!Number.isInteger(task.durationMinutes) || typeof task.durationMinutes !== 'number')) || typeof task.note !== 'string' || typeof task.done !== 'boolean' || !stamp(task.createdAt) || !stamp(task.updatedAt) || !Number.isSafeInteger(task.revision) || task.revision < 1 || (task.done ? !stamp(task.completedAt) : task.completedAt !== null)) throw new Error('Ungültiger Planeintrag.');
    ids.add(task.id); validateInput({ title: task.title, date: task.date, time: task.time ?? '', duration: task.durationMinutes === null ? '' : String(task.durationMinutes), note: task.note });
  }
  return d;
}
