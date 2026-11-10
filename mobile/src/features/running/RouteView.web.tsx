import { View } from 'react-native';
import { Label, Secondary } from '../../components/ToolPage';
import { routePaths } from './model';
import type { RunPoint } from './model';
export function RouteView({ points }: { points: RunPoint[] }) {
  const paths = routePaths(points);
  return <View style={{ gap: 12 }}><Label>GPS ROUTE</Label>{points.length < 2 ? <Secondary>{points.length ? 'GPS acquired. Move outdoors to trace your route.' : 'Your route will appear after the first GPS fixes.'}</Secondary> : <svg role="img" aria-label="Recorded GPS route. Separate lines indicate pauses or missing GPS." viewBox="0 0 320 220" style={{ display: 'block', width: '100%', height: 'auto', aspectRatio: '320 / 220', background: '#0B0B0B', borderRadius: 18, border: '1px solid #292929' }}>{paths.map((d, i) => <path key={i} d={d} fill="none" stroke="#FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}</svg>}<Secondary>Route outline, without a street map. Gaps are not connected.</Secondary></View>;
}
