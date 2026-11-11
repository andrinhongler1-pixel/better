export const mainSections = [{ route: 'today', label: 'HEUTE' }, { route: 'areas', label: 'BEREICHE' }, { route: 'history', label: 'VERLAUF' }] as const;
export function sectionForRoute(route: string) { return route === 'today' || route === 'history' ? route : 'areas'; }
export const areaLinks = [
  { route: '/running', title: 'Laufen', description: 'GPS, Zeit und Strecke', number: '01' },
  { route: '/nutrition', title: 'Ernährung', description: 'Essen scannen und erfassen', number: '02' },
  { route: '/sleep', title: 'Schlaf', description: 'Schlafzeiten und Erholung', number: '03' },
  { route: '/quit', title: 'Quit', description: 'Deine laufenden Timer', number: '04' },
  { route: '/trading', title: 'Trading', description: 'Trades und P&L-Kalender', number: '05' },
] as const;
