import { Secondary } from '../../components/ToolPage';
export interface ScannerProps { onDetected: (barcode: string, format?: string) => void }
export default function BarcodeScanner(_props: ScannerProps) {
  return <Secondary>Open the better. web app in Safari to use the barcode camera. You can enter the printed barcode below.</Secondary>;
}
