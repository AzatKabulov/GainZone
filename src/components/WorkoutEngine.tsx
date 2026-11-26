import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { clearExpiredRest, restFinishedInApp } from '@/lib/rest';
import { useActive } from '@/store/active';
import { useFx } from '@/store/fx';
import { useSettings } from '@/store/settings';

/**
 * Invisible: drives the rest timer while the app is open (chime + haptics + toast when it ends)
 * and keeps the screen on during a workout.
 */
export function WorkoutEngine() {
  const rest = useActive((s) => s.rest);
  const live = useActive((s) => !!s.workout);
  const keepAwake = useSettings((s) => s.keepAwake);

  useEffect(() => {
    if (!rest) return;
    const tick = () => {
      if (AppState.currentState !== 'active' && Platform.OS !== 'web') return;
      if (Date.now() >= rest.endsAt) {
        clearInterval(t);
        void restFinishedInApp();
        useFx.getState().info('REST OVER', `Next set — ${rest.label}`, { icon: 'timer', ms: 3200 });
      }
    };
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [rest]);

  useEffect(() => {
    clearExpiredRest();
    const sub = AppState.addEventListener('change', (s) => {
      // ended while in the background: the notification already rang
      if (s === 'active') clearExpiredRest();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (live && keepAwake) {
      activateKeepAwakeAsync('workout').catch(() => {});
      return () => {
        deactivateKeepAwake('workout').catch(() => {});
      };
    }
  }, [live, keepAwake]);

  return null;
}
