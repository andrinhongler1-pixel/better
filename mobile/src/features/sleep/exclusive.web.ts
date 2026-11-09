import type { Exclusive } from './repository';
// Safari/iOS 15.4+, installed PWAs and other modern browsers share this origin lock.
export const sleepExclusive: Exclusive = async operation => {
  if (!navigator.locks) return Promise.reject(new Error('Sleep tracking needs a newer browser with secure storage coordination. Open the HTTPS app in an updated Safari.'));
  return await navigator.locks.request('better:v1:sleep:write', operation);
};
