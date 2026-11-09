import { View } from 'react-native';
import { ToolPage, Label, Secondary, ui } from '../../src/components/ToolPage';
export default function Goals() {
  return <ToolPage title="GOALS"><View style={ui.card}><Label>COMING LATER</Label><Secondary>Your goals will live here.</Secondary></View></ToolPage>;
}
