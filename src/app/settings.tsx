import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState, type ReactNode } from 'react';
import { Alert, Platform, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fmtRest, REST_PRESETS } from '@/components/ExerciseBlock';
import { ANATOMY_CREDIT } from '@/components/Body3D';
import { FxHost } from '@/components/FxHost';
import { FieldLabel, SheetHeader } from '@/components/kit';
import { Button, Card, Chip, Input, Press, Section, Txt, type IconName } from '@/components/ui';
import { fmtClock, isoToKey, relativeLabel, todayKey } from '@/lib/date';
import { haptic } from '@/lib/haptics';
import { openMenu } from '@/lib/menu';
import { saveProfile, useProfile } from '@/lib/profile';
import { ensureNotificationPermission } from '@/lib/rest';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { useFx } from '@/store/fx';
import { useSettings } from '@/store/settings';
import { signOut, syncNow, useSync } from '@/store/sync';
import { ACCENT_KEYS, ACCENTS, alpha, fonts, useTheme, type ThemeMode } from '@/theme';

const GOALS = [
  { id: 'mass', label: 'BUILD MUSCLE' },
  { id: 'strength', label: 'STRENGTH' },
  { id: 'cut', label: 'CUT' },
  { id: 'fit', label: 'STAY FIT' },
] as const;

export default function SettingsScreen() {
  const { c, accent, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const session = useAuth((s) => s.session);
  const sync = useSync();
  const dirtyCount = useData((s) => Object.keys(s.dirty).length);
  const profile = useProfile();
  const [name, setName] = useState(profile?.name || settings.name);
  const [height, setHeight] = useState(profile?.height_cm ? String(profile.height_cm) : '');
  const [birth, setBirth] = useState(profile?.birth_year ? String(profile.birth_year) : '');

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const saveBasics = () => {
    const h = Number(height.replace(',', '.'));
    const by = Number(birth);
    saveProfile({ name: name.trim(), height_cm: h > 0 ? h : null, birth_year: by > 1900 ? by : null });
    settings.set({ name: name.trim() });
  };

  const exportData = async () => {
    const d = useData.getState();
    const payload = {
      app: 'GainZone',
      exported_at: new Date().toISOString(),
      version: 1,
      profile: d.profile,
      exercises: d.exercises,
      templates: d.templates,
      workouts: d.workouts,
      metrics: d.metrics,
    };
    const json = JSON.stringify(payload, null, 1);
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `gainzone-backup-${todayKey()}.json`;
        a.click();
        return;
      }
      const f = new File(Paths.cache, `gainzone-backup-${todayKey()}.json`);
      f.create({ overwrite: true });
      f.write(json);
      await Sharing.shareAsync(f.uri, { mimeType: 'application/json', dialogTitle: 'GainZone backup' });
      haptic.success();
    } catch (e) {
      useFx.getState().info('EXPORT FAILED', e instanceof Error ? e.message : String(e));
    }
  };

  const doSignOut = () => {
    const run = async () => {
      haptic.warning();
      await signOut();
    };
    if (Platform.OS === 'web') return void run();
    Alert.alert(
      session ? 'Sign out?' : 'Leave offline mode?',
      session
        ? 'Your data is backed up to your account. Anything not synced yet stays on this phone until you sign back in.'
        : 'You will go back to the sign-in screen. Data stored on this device stays here.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: session ? 'Sign out' : 'Continue', style: 'destructive', onPress: () => void run() },
      ],
    );
  };

  const lastSync = sync.lastSyncedAt
    ? `${isoToKey(sync.lastSyncedAt) === todayKey() ? 'today' : relativeLabel(isoToKey(sync.lastSyncedAt)!).toLowerCase()} ${fmtClock(sync.lastSyncedAt)}`
    : 'never';

  return (
    <View style={{ flex: 1, backgroundColor: c.bgElevated }}>
      <SheetHeader kicker="SETTINGS" title="PROFILE" onClose={close} />
      <ScrollView automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: insets.bottom + 40, gap: 26 }}>
        <View>
          <Section label="ABOUT YOU" style={{ marginBottom: 12 }} />
          <FieldLabel>NAME</FieldLabel>
          <Input value={name} onChangeText={setName} onBlur={saveBasics} placeholder="Your name" autoCapitalize="words" />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              <FieldLabel>HEIGHT, CM</FieldLabel>
              <Input value={height} onChangeText={setHeight} onBlur={saveBasics} placeholder="180" keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel>BIRTH YEAR</FieldLabel>
              <Input value={birth} onChangeText={setBirth} onBlur={saveBasics} placeholder="1998" keyboardType="number-pad" />
            </View>
          </View>
          <FieldLabel style={{ marginTop: 14 }}>GOAL</FieldLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {GOALS.map((g) => (
              <Chip key={g.id} label={g.label} active={profile?.goal === g.id} onPress={() => saveProfile({ goal: profile?.goal === g.id ? null : g.id })} />
            ))}
          </View>
          <FieldLabel style={{ marginTop: 14 }}>WORKOUTS PER WEEK</FieldLabel>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[2, 3, 4, 5, 6].map((n) => (
              <Chip key={n} label={String(n)} active={(profile?.weekly_goal ?? 4) === n} onPress={() => saveProfile({ weekly_goal: n })} style={{ flex: 1, justifyContent: 'center' }} />
            ))}
          </View>
        </View>

        <View>
          <Section label="TRAINING" style={{ marginBottom: 12 }} />
          <View style={{ gap: 8 }}>
            <Row icon="timer-outline" title="Default rest" sub="For new exercises without their own timer">
              <Press
                tapHaptic
                onPress={() => openMenu('Default rest', REST_PRESETS.filter(Boolean).map((s) => ({ label: fmtRest(s), onPress: () => settings.set({ defaultRest: s }) })))}
                style={{ height: 34, paddingHorizontal: 12, borderRadius: 9, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: c.text }}>{fmtRest(settings.defaultRest)}</Text>
              </Press>
            </Row>
            <Row icon="volume-high-outline" title="Rest timer sound" sub="Chime when rest is over — even on silent">
              <Toggle value={settings.sound} onChange={(v) => settings.set({ sound: v })} />
            </Row>
            <Row icon="notifications-outline" title="Notifications" sub="Rest alerts while the phone is locked">
              <Press
                tapHaptic
                onPress={async () => {
                  const ok = await ensureNotificationPermission();
                  useFx.getState().info(ok ? 'NOTIFICATIONS ON' : 'NOTIFICATIONS OFF', ok ? 'You will hear when rest is over.' : 'Allow them in iOS Settings → Expo Go → Notifications.');
                }}
                style={{ height: 34, paddingHorizontal: 12, borderRadius: 9, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border, justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, color: c.text }}>CHECK</Text>
              </Press>
            </Row>
            <Row icon="copy-outline" title="Prefill last values" sub="Fields start with what you did last time">
              <Toggle value={settings.prefill} onChange={(v) => settings.set({ prefill: v })} />
            </Row>
            <Row icon="sunny-outline" title="Keep screen on" sub="During a workout">
              <Toggle value={settings.keepAwake} onChange={(v) => settings.set({ keepAwake: v })} />
            </Row>
            <Row icon="pulse" title="Vibration" sub="Buzz on sets, PRs and timers">
              <Toggle
                value={settings.haptics}
                onChange={(v) => {
                  settings.set({ haptics: v });
                  if (v) haptic.success();
                }}
              />
            </Row>
          </View>
        </View>

        <View>
          <Section label="APPEARANCE" style={{ marginBottom: 12 }} />
          <View style={{ flexDirection: 'row', backgroundColor: c.surface2, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: c.border }}>
            {(['system', 'dark', 'light'] as ThemeMode[]).map((m) => {
              const on = settings.mode === m;
              return (
                <Press
                  key={m}
                  tapHaptic
                  scaleTo={0.96}
                  onPress={() => settings.set({ mode: m })}
                  style={{ flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: on ? c.surface : 'transparent', borderWidth: on ? 1 : 0, borderColor: c.borderStrong }}
                >
                  <Ionicons name={m === 'system' ? 'phone-portrait-outline' : m === 'dark' ? 'moon' : 'sunny'} size={14} color={on ? accent : c.textDim} />
                  <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: on ? c.text : c.textDim }}>{m.toUpperCase()}</Text>
                </Press>
              );
            })}
          </View>
          <Txt variant="label" style={{ marginTop: 18, marginBottom: 10 }}>
            ACCENT
          </Txt>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {ACCENT_KEYS.map((k) => {
              const col = isDark ? ACCENTS[k].dark : ACCENTS[k].light;
              const on = settings.accent === k;
              return (
                <Press key={k} tapHaptic scaleTo={0.9} onPress={() => settings.set({ accent: k })} style={{ flex: 1, alignItems: 'center', gap: 8 }}>
                  <View style={{ width: '100%', aspectRatio: 1, borderRadius: 14, backgroundColor: col, borderWidth: on ? 3 : 0, borderColor: c.text, alignItems: 'center', justifyContent: 'center' }}>
                    {on ? <Ionicons name="checkmark-sharp" size={20} color={isDark ? ACCENTS[k].onDark : ACCENTS[k].onLight} /> : null}
                  </View>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1, color: on ? c.text : c.textFaint }}>{ACCENTS[k].name}</Text>
                </Press>
              );
            })}
          </View>
        </View>

        <View>
          <Section label="ACCOUNT & DATA" style={{ marginBottom: 12 }} />
          {session ? (
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: sync.status === 'error' || sync.status === 'setup' ? c.danger : sync.status === 'syncing' ? accent : sync.status === 'offline' ? c.textDim : c.success,
                  }}
                />
                <Txt variant="title" style={{ flex: 1 }}>
                  {sync.status === 'syncing'
                    ? 'Syncing…'
                    : sync.status === 'setup'
                      ? 'Cloud tables not created yet'
                      : sync.status === 'error'
                        ? 'Sync problem'
                        : sync.status === 'offline'
                          ? 'Offline — will sync later'
                          : 'Backed up to the cloud'}
                </Txt>
              </View>
              <Txt variant="small" color={c.textDim}>
                {session.user.email} · last synced {lastSync}
                {dirtyCount ? ` · ${dirtyCount} waiting` : ''}
              </Txt>
              {sync.status === 'setup' ? (
                <Txt variant="small" color={c.textDim}>
                  Everything is safe on this phone and uploads automatically once the database is set up (supabase/migrations in the repo).
                </Txt>
              ) : null}
              {sync.status === 'error' && sync.error ? (
                <Txt variant="small" color={c.danger}>
                  {sync.error}
                </Txt>
              ) : null}
              <Button label="SYNC NOW" icon="sync" variant="outline" small onPress={() => void syncNow()} />
            </Card>
          ) : (
            <Card style={{ gap: 12, borderColor: alpha(accent, 0.4) }}>
              <Txt variant="title">{"You're in offline mode"}</Txt>
              <Txt variant="small" color={c.textDim}>
                Data lives only on this phone. Sign in (same account as GrindZone) to back everything up — your current data comes with you.
              </Txt>
              <Button label="BACK UP MY DATA" icon="cloud-upload-outline" small onPress={() => settings.set({ guest: false })} />
            </Card>
          )}
          <Button label="EXPORT BACKUP (JSON)" icon="download-outline" variant="outline" small onPress={exportData} style={{ marginTop: 12 }} />
        </View>

        <Button label={session ? 'SIGN OUT' : 'EXIT OFFLINE MODE'} icon="log-out-outline" variant="danger" onPress={doSignOut} />
        <Txt variant="label" color={c.textFaint} style={{ textAlign: 'center' }}>
          GAINZONE v{Constants.expoConfig?.version ?? '1.0.0'}{'\n'}{ANATOMY_CREDIT.toUpperCase()}
        </Txt>
      </ScrollView>
      <FxHost inSheet />
    </View>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { c, accent } = useTheme();
  return <Switch value={value} onValueChange={onChange} trackColor={{ true: accent, false: c.surface3 }} thumbColor="#FFFFFF" />;
}

function Row({ icon, title, sub, children }: { icon: IconName; title: string; sub?: string; children?: ReactNode }) {
  const { c, accent } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: alpha(accent, 0.12), alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="title">{title}</Txt>
        {sub ? (
          <Txt variant="small" color={c.textDim}>
            {sub}
          </Txt>
        ) : null}
      </View>
      {children}
    </View>
  );
}
