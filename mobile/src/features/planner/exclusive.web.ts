import type { Exclusive } from '../sleep/repository';
export const plannerExclusive: Exclusive = async operation => { if (!navigator.locks) throw new Error('Bitte die HTTPS-App in einer aktuellen Safari-Version öffnen.'); return await navigator.locks.request('better:v1:planner:write', operation); };
