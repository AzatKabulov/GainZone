import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { WorkoutExercise } from './data';

/**
 * The workout in progress. Persisted on every change in its own small store,
 * so closing the app, a crash or a dead battery never loses a set.
 */
export interface ActiveWorkout {
  id: string;
  template_id: string | null;
  name: string;
  started_at: string;
  exercises: WorkoutExercise[];
  note: string;
}

export interface RestState {
  endsAt: number;
  total: number;
  weId: string;
  label: string;
}

interface ActiveState {
  workout: ActiveWorkout | null;
  rest: RestState | null;
  hydrated: boolean;
}

export const useActive = create<ActiveState>()(
  persist((): ActiveState => ({ workout: null, rest: null, hydrated: false }), {
    name: 'gain-active',
    version: 1,
    storage: createJSONStorage(() => AsyncStorage),
    partialize: ({ workout, rest }) => ({ workout, rest }),
    onRehydrateStorage: () => () => {
      useActive.setState({ hydrated: true });
    },
  }),
);

export function patchWorkout(fn: (w: ActiveWorkout) => ActiveWorkout) {
  const w = useActive.getState().workout;
  if (!w) return;
  useActive.setState({ workout: fn(w) });
}
