import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Switch, Text, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


import { exName, getExercise } from '@/lib/exercise';
import { exerciseSessions, finishedWorkouts, recentNotes } from '@/lib/stats';
import { setExerciseNote } from '@/lib/workout';
import { useActive } from '@/store/active';
import { useData } from '@/store/data';
import { fonts, useTheme } from '@/theme';
import { Backdrop, SHEET_IN } from './Backdrop';
import { Button, Txt } from './ui';

/** Small bottom sheet for an exercise note: today's note, pin to routine, last 3 notes. */
export function NoteSheet({ weId, onClose }: { weId: string | null; onClose: () => void }) {
  return (
    <Modal visible={!!weId} transparent animationType="none" onRequestClose={onClose}>
      {weId ? <Body weId={weId} onClose={onClose} /> : null}
    </Modal>
  );
}

function Body({ weId, onClose }: { weId: string; onClose: () => void }) {
  const { c, accent, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const w = useActive((s) => s.workout);
  const we = w?.exercises.find((e) => e.id === weId);
  const workouts = useData((s) => s.workouts);
  const tpl = useData((s) => (w?.template_id ? s.templates[w.template_id] : undefined));
  const tplEx = tpl?.exercises.find((e) => e.exercise_id === we?.exercise_id);
  const [text, setText] = useState(we?.note ?? '');
  const [pin, setPin] = useState(!!tplEx?.note && tplEx.note === we?.note);
  const notes = useMemo(
    () => (we ? recentNotes(exerciseSessions(finishedWorkouts(workouts), we.exercise_id, w?.id), 3) : []),
    [workouts, we, w?.id],
  );
  if (!we) return null;

  const save = () => {
    setExerciseNote(weId, text.trim());
    if (tpl && tplEx) {
      const next = pin ? text.trim() : tplEx.note === text.trim() ? '' : tplEx.note;
      if (next !== tplEx.note) {
        useData.getState().patch('templates', tpl.id, {
          exercises: tpl.exercises.map((e) => (e.id === tplEx.id ? { ...e, note: next } : e)),
        });
      }
    }
    onClose();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Backdrop onPress={save} />
      <Animated.View entering={SHEET_IN} style={{ backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: c.border, padding: 20, paddingBottom: insets.bottom + 16 }}>
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginTop: -8, marginBottom: 14 }} />
        <Txt variant="label" color={accent}>
          NOTE
        </Txt>
        <Txt variant="h2" numberOfLines={1} style={{ marginTop: 4 }}>
          {exName(getExercise(we.exercise_id)).toUpperCase()}
        </Txt>
        <TextInput
          value={text}
          onChangeText={setText}
          autoFocus
          multiline
          placeholder="Seat 3, grip, how it felt"
          placeholderTextColor={c.textFaint}
          selectionColor={accent}
          keyboardAppearance={isDark ? 'dark' : 'light'}
          style={{ marginTop: 14, minHeight: 64, maxHeight: 140, backgroundColor: c.surface2, borderRadius: 12, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 16, color: c.text }}
        />
        {tplEx ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
            <Ionicons name="pin" size={15} color={pin ? accent : c.textFaint} />
            <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: c.text }}>Pin to “{tpl?.name}”</Text>
            <Switch value={pin} onValueChange={setPin} trackColor={{ true: accent, false: c.surface3 }} thumbColor="#FFFFFF" />
          </View>
        ) : null}
        {notes.length ? (
          <View style={{ marginTop: 16, gap: 8 }}>
            <Txt variant="label">PREVIOUS</Txt>
            {notes.map((n, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
                <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: c.textFaint, width: 48, marginTop: 2 }}>
                  {new Date(n.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}
                </Text>
                <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 14, color: c.textDim }}>{n.text}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Button label="DONE" small onPress={save} style={{ marginTop: 18 }} />
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
