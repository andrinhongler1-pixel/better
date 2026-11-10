import type { GPSDriver } from './recorder';
export const gpsDriver: GPSDriver = { watch() { throw new Error('This first version records in iPhone Safari or the Home Screen web app. Native background GPS is not enabled.'); } };
