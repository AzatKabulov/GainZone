import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import { currentUserId, useAuth } from './auth';
import { REMOTE, TABLES, useData, type TableName } from './data';
import { useSettings } from './settings';

/**
 * Sync engine: push dirty local rows (upsert), then pull rows changed on the server
 * since the last cursor. Conflicts resolve by last-write-wins on `updated_at`,
 * enforced both here and by a trigger in the database.
 * If the network or the cloud tables are unavailable, nothing is lost: rows stay
 * "dirty" on the phone and go up on the next successful sync.
 */

type Status = 'idle' | 'syncing' | 'error' | 'offline' | 'setup';

export const useSync = create<{ status: Status; lastSyncedAt: string | null; error: string | null }>(
  () => ({ status: 'idle', lastSyncedAt: null, error: null }),
);

const PAGE = 1000;
let running = false;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;

export function scheduleSync(delay = 1200) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

export async function syncNow(): Promise<void> {
  const userId = currentUserId();
  if (!userId || useData.getState().ownerId !== userId) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  useSync.setState({ status: 'syncing', error: null });
  try {
    await push(userId);
    await pull();
    useSync.setState({ status: 'idle', lastSyncedAt: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const offline = /network|fetch|timed? ?out|offline/i.test(msg);
    const setup = /could not find the table|relation .* does not exist|PGRST205|42P01/i.test(msg);
    useSync.setState({ status: setup ? 'setup' : offline ? 'offline' : 'error', error: msg });
  } finally {
    running = false;
    if (again) {
      again = false;
      scheduleSync(300);
    }
  }
}

async function push(userId: string) {
  const byTable: Partial<Record<TableName, string[]>> = {};
  for (const key of Object.keys(useData.getState().dirty)) {
    const [table, id] = key.split(':') as [TableName, string];
    (byTable[table] ??= []).push(id);
  }
  for (const table of TABLES) {
    const ids = byTable[table];
    if (!ids?.length) continue;
    const s = useData.getState();
    const rows = ids
      .map((id) => s[table][id])
      .filter(Boolean)
      .map((r) => ({ ...r, user_id: userId }));
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await supabase.from(REMOTE[table]).upsert(chunk, { onConflict: 'id' });
      if (error) throw new Error(`${error.code ?? ''} ${error.message}`);
      useData.getState().markClean(
        table,
        chunk.map((r) => ({ id: r.id, updated_at: r.updated_at })),
      );
    }
  }
}

async function pull() {
  for (const table of TABLES) {
    for (let page = 0; page < 200; page++) {
      const cursor = useData.getState().cursors[table];
      let q = supabase
        .from(REMOTE[table])
        .select('*')
        .order('server_updated_at', { ascending: true })
        .limit(PAGE);
      if (cursor) q = q.gt('server_updated_at', cursor);
      const { data, error } = await q;
      if (error) throw new Error(`${error.code ?? ''} ${error.message}`);
      if (!data?.length) break;
      useData.getState().mergeRemote(table, data);
      useData.getState().setCursor(table, String(data[data.length - 1].server_updated_at));
      if (data.length < PAGE) break;
    }
  }
}

/** Attach local data to the signed-in account (adopt guest data or reset for a different user). */
async function bindOwner() {
  const userId = currentUserId();
  const d = useData.getState();
  if (!userId || !d.hydrated) return;
  if (d.ownerId !== userId) {
    if (d.ownerId === null) d.adopt(userId);
    else {
      if (Object.keys(d.dirty).length) {
        // Another account's rows that never reached the cloud: park them, never drop them.
        const { profile, exercises, templates, workouts, metrics } = d;
        await AsyncStorage.setItem(
          `gain-parked-${d.ownerId}`,
          JSON.stringify({ profile, exercises, templates, workouts, metrics }),
        ).catch(() => {});
      }
      useData.getState().resetFor(userId);
    }
    // Parked rows of this account (from an earlier sign-out with unsynced data) come back.
    const parked = await AsyncStorage.getItem(`gain-parked-${userId}`).catch(() => null);
    if (parked) {
      try {
        useData.getState().importAll(JSON.parse(parked));
        await AsyncStorage.removeItem(`gain-parked-${userId}`);
      } catch {
        // keep it for next time
      }
    }
  }
  scheduleSync(0);
}

let started = false;

/** Call once, after the data store has hydrated and auth is ready. */
export function startSync() {
  if (started) return;
  started = true;
  useAuth.subscribe((s, prev) => {
    if (s.session?.user.id !== prev.session?.user.id) void bindOwner();
  });
  useData.subscribe((s, prev) => {
    if (s.dirty !== prev.dirty && Object.keys(s.dirty).length) scheduleSync();
  });
  AppState.addEventListener('change', (state) => {
    if (state === 'active') scheduleSync(150);
  });
  setInterval(() => {
    if (AppState.currentState === 'active') scheduleSync(0);
  }, 3 * 60 * 1000);
  void bindOwner();
}

export async function signOut() {
  await syncNow().catch(() => {});
  const pending = Object.keys(useData.getState().dirty).length;
  await supabase.auth.signOut().catch(() => {});
  // Keep unsynced data on the phone; it will upload after signing back in.
  if (!pending) useData.getState().resetFor(null);
  useSettings.getState().set({ guest: false });
}
