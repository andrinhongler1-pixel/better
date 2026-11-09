import { View } from 'react-native';
import { ToolPage, Label, Secondary, ui } from '../../src/components/ToolPage';
export default function Progress() {
  return <ToolPage title="PROGRESS"><View style={ui.card}><Label>COMING LATER</Label><Secondary>Your broader progress will live here. Streaks and attempt history are available inside each QUIT timer.</Secondary></View></ToolPage>;
}
