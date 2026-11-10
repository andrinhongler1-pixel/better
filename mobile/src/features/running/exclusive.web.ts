import type { Exclusive } from '../sleep/repository';
export const runExclusive: Exclusive = async operation => { if (!navigator.locks) throw new Error('Open the HTTPS app in an updated Safari to safely save runs.'); return await navigator.locks.request('better:v1:running:write', operation); };
