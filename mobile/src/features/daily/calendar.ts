/** Local calendar days intentionally follow the device timezone, rather than UTC. */
export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function hasWokenToday(savedDay: string | null, now: Date): boolean {
  return savedDay === localDay(now);
}
