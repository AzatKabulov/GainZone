import { ActionSheetIOS, Alert, Platform } from 'react-native';

export interface MenuAction {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

/** Native action sheet (iOS) / alert list elsewhere. */
export function openMenu(title: string | undefined, actions: MenuAction[]) {
  if (Platform.OS === 'ios') {
    const opts = [...actions.map((a) => a.label), 'Cancel'];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: opts,
        cancelButtonIndex: opts.length - 1,
        destructiveButtonIndex: actions.map((a, i) => (a.destructive ? i : -1)).filter((i) => i >= 0),
        userInterfaceStyle: 'dark',
      },
      (i) => {
        if (i < actions.length) actions[i].onPress();
      },
    );
    return;
  }
  if (Platform.OS === 'web') {
    // simple fallback for the browser preview
    const pick = window.prompt(`${title ?? ''}\n${actions.map((a, i) => `${i + 1}. ${a.label}`).join('\n')}`);
    const i = Number(pick) - 1;
    if (actions[i]) actions[i].onPress();
    return;
  }
  Alert.alert(title ?? '', undefined, [
    ...actions.map((a) => ({ text: a.label, onPress: a.onPress, style: a.destructive ? ('destructive' as const) : ('default' as const) })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

/** Yes / no question. */
export function confirm(title: string, message: string, yes: string, onYes: () => void, destructive = true) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: yes, style: destructive ? 'destructive' : 'default', onPress: onYes },
  ]);
}
