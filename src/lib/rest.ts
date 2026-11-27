import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { useActive } from '@/store/active';
import { useSettings } from '@/store/settings';
import { haptic } from './haptics';

/**
 * Rest timer between sets.
 * Stores an absolute `endsAt`, so it stays exact when the app is in the background or the
 * phone is locked. A local notification (with sound) is scheduled for the end; while the
 * app is open the in-app engine plays a chime + haptics instead.
 */

let notifId: string | null = null;
let handlerReady = false;
let player: AudioPlayer | null = null;
let audioReady = false;

function setupHandler() {
  if (handlerReady || Platform.OS === 'web') return;
  handlerReady = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // in the foreground the app shows its own alert and plays its own chime
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  setupHandler();
  try {
    const cur = await Notifications.getPermissionsAsync();
    if (cur.granted) return true;
    if (!cur.canAskAgain) return false;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

async function cancelNotif() {
  if (Platform.OS === 'web') return;
  const id = notifId;
  notifId = null;
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

async function scheduleNotif(at: number, label: string) {
  if (Platform.OS === 'web') return;
  await cancelNotif();
  if (!(await ensureNotificationPermission())) return;
  if (at <= Date.now() + 1000) return;
  try {
    notifId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'REST OVER',
        body: `Next set — ${label}`,
        sound: useSettings.getState().sound ? 'default' : undefined,
        interruptionLevel: 'timeSensitive',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
    });
  } catch {
    // Notifications are a bonus; the in-app timer still works without them.
  }
}

export function startRest(seconds: number, weId: string, label: string) {
  if (!seconds || seconds <= 0) {
    skipRest();
    return;
  }
  const endsAt = Date.now() + seconds * 1000;
  useActive.setState({ rest: { id: Date.now(), endsAt, total: seconds, weId, label } });
  void scheduleNotif(endsAt, label);
}

export function adjustRest(delta: number) {
  const r = useActive.getState().rest;
  if (!r) return;
  const endsAt = Math.max(Date.now() + 1000, r.endsAt + delta * 1000);
  useActive.setState({ rest: { ...r, endsAt, total: Math.max(1, r.total + delta) } });
  void scheduleNotif(endsAt, r.label);
}

export function skipRest() {
  useActive.setState({ rest: null });
  void cancelNotif();
}

async function prepareAudio() {
  if (audioReady || Platform.OS === 'web') return;
  audioReady = true;
  try {
    // ring even with the iPhone on silent, and only dip (not stop) your music
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' });
    player = createAudioPlayer(require('../../assets/sounds/rest-done.wav'));
    player.volume = 1;
  } catch {
    player = null;
  }
}

export function warmUpAudio() {
  void prepareAudio();
}

/** Called by the engine when the countdown reaches zero while the app is open. */
export async function restFinishedInApp() {
  useActive.setState({ rest: null });
  void cancelNotif();
  haptic.success();
  setTimeout(() => haptic.heavy(), 220);
  setTimeout(() => haptic.heavy(), 440);
  if (!useSettings.getState().sound) return;
  await prepareAudio();
  try {
    if (player) {
      await player.seekTo(0).catch(() => {});
      player.play();
    }
  } catch {
    // ignore
  }
}

/** Rest ended while the app was in the background: the notification already rang. */
export function clearExpiredRest() {
  const r = useActive.getState().rest;
  if (r && r.endsAt <= Date.now()) {
    useActive.setState({ rest: null });
    notifId = null;
  }
}
