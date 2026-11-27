import { router } from 'expo-router';

/** Back if there is somewhere to go back to, otherwise home (after a reload or a deep link). */
export function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
