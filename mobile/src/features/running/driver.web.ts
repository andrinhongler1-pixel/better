import type { GPSDriver } from './recorder';
export const gpsDriver: GPSDriver = {
  watch(fix, error) {
    if (!window.isSecureContext || !navigator.geolocation) throw new Error('GPS needs HTTPS and location support. Open the published app in Safari.');
    const id = navigator.geolocation.watchPosition(position => fix({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: Math.round(position.timestamp), segment: 0 }), failure => error(failure.code === 1 ? 'Location permission was denied. Allow location for this site in Safari settings, then retry.' : failure.code === 3 ? 'GPS timed out. Move outdoors and retry; the run is paused.' : 'GPS is unavailable. Check location services and retry; the run is paused.'), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    return () => navigator.geolocation.clearWatch(id);
  },
  async keepAwake(onRelease) { if (!navigator.wakeLock) throw new Error('Screen wake lock unavailable.'); const lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', onRelease, { once: true }); return () => { void lock.release().catch(() => {}); }; },
};
