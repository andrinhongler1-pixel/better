export const mainSections = [{ route: 'today', label: 'HEUTE' }, { route: 'areas', label: 'BEREICHE' }, { route: 'history', label: 'VERLAUF' }] as const;
export function sectionForRoute(route: string) { return route === 'today' || route === 'history' ? route : 'areas'; }
export const areaLinks = [
  { route: '/planner', title: 'Planer', description: 'Deine Woche und dein Tag', number: '01' },
  { route: '/running', title: 'Laufen', description: 'GPS, Zeit und Strecke', number: '02' },
  { route: '/nutrition', title: 'Ernährung', description: 'Essen scannen und erfassen', number: '03' },
  { route: '/sleep', title: 'Schlaf', description: 'Schlafzeiten und Erholung', number: '04' },
  { route: '/quit', title: 'Quit', description: 'Deine laufenden Timer', number: '05' },
  { route: '/trading', title: 'Trading', description: 'Trades und P&L-Kalender', number: '06' },
] as const;
