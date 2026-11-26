import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AccentKey, ThemeMode } from '@/theme/tokens';

interface SettingsState {
  mode: ThemeMode;
  accent: AccentKey;
  haptics: boolean;
  /** Display name. */
  name: string;
  /** User chose to use the app without an account (local only). */
  guest: boolean;
  /** Beep when the rest timer ends. */
  sound: boolean;
  /** Keep the screen on during a workout. */
  keepAwake: boolean;
  /** Fill set inputs with what you did last time. */
  prefill: boolean;
  /** Language of exercise names. */
  exLang: 'en' | 'ru';
  /** Default rest between sets, seconds. */
  defaultRest: number;
  /** Period of the muscle map, days (0 = all time). */
  bodyPeriod: number;
  hydrated: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set' | 'hydrated'>>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      mode: 'dark',
      accent: 'volt',
      haptics: true,
      name: '',
      guest: false,
      sound: true,
      keepAwake: true,
      prefill: true,
      exLang: 'en',
      defaultRest: 120,
      bodyPeriod: 7,
      hydrated: false,
      set: (patch) => set(patch),
    }),
    {
      name: 'gain-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated, set, ...rest }) => rest,
      onRehydrateStorage: () => () => {
        useSettings.setState({ hydrated: true });
      },
    },
  ),
);
