import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DailyRepository {
  readWakeDay(): Promise<string | null>;
  saveWakeDay(day: string): Promise<void>;
}

// Replace this adapter when authenticated, synchronized data is introduced.
export const dailyRepository: DailyRepository = {
  readWakeDay: () => AsyncStorage.getItem('better:v1:wake-day'),
  saveWakeDay: day => AsyncStorage.setItem('better:v1:wake-day', day),
};
