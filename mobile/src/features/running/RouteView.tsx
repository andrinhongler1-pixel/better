import { View } from 'react-native';
import { Secondary } from '../../components/ToolPage';
import type { RunPoint } from './model';
export function RouteView({ points }: { points: RunPoint[] }) { return <View><Secondary>{points.length ? `${points.length} saved GPS points. Open the web app to view the route.` : 'Your route appears after GPS acquisition.'}</Secondary></View>; }
