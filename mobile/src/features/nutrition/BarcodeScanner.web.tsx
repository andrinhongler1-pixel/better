import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import type { IScannerControls } from '@zxing/browser';
import { OutlineButton } from '../../components/OutlineButton';
import { ErrorMessage, Secondary, ui } from '../../components/ToolPage';
interface ScannerProps { onDetected: (barcode: string, format?: string) => void }
function cameraError(error: unknown): string {
  const name = (error as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'Camera access was denied. Allow Camera for this site in Safari settings, then try again. You can also enter the barcode below.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'No camera was found. Use a barcode photo or type the printed digits below.';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'The camera is busy or unavailable. Close other camera apps and try again.';
  if (name === 'OverconstrainedError') return 'The requested camera is unavailable. Try a barcode photo or enter the printed digits.';
  return 'The camera could not start. Use HTTPS in Safari, retry, or enter the printed barcode below.';
}
async function makeReader() {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  const formats = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E];
  const reader = new BrowserMultiFormatReader(new Map([[DecodeHintType.POSSIBLE_FORMATS, formats]]), { delayBetweenScanAttempts: 140, delayBetweenScanSuccess: 1000 });
  return { reader, BarcodeFormat };
}
export default function BarcodeScanner({ onDetected }: ScannerProps) {
  const [active, setActive] = useState(false); const [photoBusy, setPhotoBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement | null>(null); const controls = useRef<IScannerControls | null>(null);
  const accepted = useRef(false); const mounted = useRef(true); const callback = useRef(onDetected); callback.current = onDetected;
  const photoGeneration = useRef(0);
  function stopTracks() {
    controls.current?.stop(); controls.current = null;
    const stream = video.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(track => track.stop());
    if (video.current) video.current.srcObject = null;
  }
  useFocusEffect(useCallback(() => () => { photoGeneration.current++; stopTracks(); setActive(false); setPhotoBusy(false); }, []));
  useEffect(() => {
    mounted.current = true;
    const stopWhenHidden = () => { if (document.visibilityState === 'hidden') { photoGeneration.current++; stopTracks(); setActive(false); setPhotoBusy(false); } };
    const stopOnPageHide = () => { photoGeneration.current++; stopTracks(); setActive(false); setPhotoBusy(false); };
    document.addEventListener('visibilitychange', stopWhenHidden); window.addEventListener('pagehide', stopOnPageHide);
    return () => { mounted.current = false; photoGeneration.current++; stopTracks(); document.removeEventListener('visibilitychange', stopWhenHidden); window.removeEventListener('pagehide', stopOnPageHide); };
  }, []);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      try {
        const { reader, BarcodeFormat } = await makeReader();
        if (cancelled || !video.current) return;
        const scan = await reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } }, video.current, (result, _error, scanControls) => {
          if (cancelled || !result || accepted.current) return;
          accepted.current = true; scanControls.stop(); stopTracks(); setActive(false);
          callback.current(result.getText(), BarcodeFormat[result.getBarcodeFormat()]);
        });
        if (cancelled || accepted.current) scan.stop(); else controls.current = scan;
      } catch (e) { if (!cancelled) { stopTracks(); setActive(false); setError(cameraError(e)); } }
    })();
    return () => { cancelled = true; stopTracks(); };
  }, [active]);
  function start() {
    setError(null);
    if (!window.isSecureContext) { setError('Camera scanning needs HTTPS. Open the published better. link in Safari.'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setError('Live camera scanning is unavailable in this browser. Try a photo or type the barcode.'); return; }
    accepted.current = false; setActive(true);
  }
  async function scanPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 20000000) { setError('Choose a barcode image under 20 MB.'); return; }
    stopTracks(); setActive(false); accepted.current = false; setPhotoBusy(true); setError(null);
    const generation = ++photoGeneration.current; const url = URL.createObjectURL(file);
    try {
      const { reader, BarcodeFormat } = await makeReader(); const result = await reader.decodeFromImageUrl(url);
      if (!mounted.current || generation !== photoGeneration.current || accepted.current) return;
      accepted.current = true; callback.current(result.getText(), BarcodeFormat[result.getBarcodeFormat()]);
    } catch { if (mounted.current && generation === photoGeneration.current) setError('No supported barcode was readable. Use EAN-13, EAN-8 or UPC, improve lighting, or type the printed digits.'); }
    finally { URL.revokeObjectURL(url); if (mounted.current && generation === photoGeneration.current) setPhotoBusy(false); }
  }
  return <View style={ui.section}>
    {active && createElement('video', { ref: video, autoPlay: true, muted: true, playsInline: true, 'aria-label': 'Food barcode camera preview', style: { display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', background: '#000', border: '1px solid #292929', borderRadius: 20 } })}
    {active ? <><Secondary>Hold the EAN or UPC barcode steady, with all bars visible. Scanning stops after one product.</Secondary><OutlineButton label="STOP CAMERA" onPress={() => setActive(false)} /></> : <OutlineButton label="START CAMERA" disabled={photoBusy} onPress={start} />}
    {createElement('label', { style: { border: '1px solid #353535', borderRadius: 18, minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 18px', color: '#fff', background: '#141414', font: '600 11px -apple-system, BlinkMacSystemFont, sans-serif', letterSpacing: '1.4px', cursor: photoBusy ? 'default' : 'pointer', position: 'relative', overflow: 'hidden', opacity: photoBusy ? 0.5 : 1 } }, photoBusy ? 'READING PHOTO' : 'SCAN BARCODE PHOTO', createElement('input', { type: 'file', accept: 'image/*', capture: 'environment', 'aria-label': 'Scan barcode photo', disabled: photoBusy || active, onChange: scanPhoto, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' } }))}
    <ErrorMessage message={error} /><Secondary>EAN-13, EAN-8 and UPC. Camera frames and photos stay on this device; only the barcode is sent for product lookup.</Secondary>
  </View>;
}
