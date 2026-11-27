<h1 align="center">GAINZONE.</h1>

<p align="center">
  <b>A local-first workout tracker for iPhone — routines, live logging with rest timer, PRs, history calendar, stats and a 3D muscle map.</b><br />
  Part of the *ZONE family (GrindZone · GainZone). Built with Expo SDK 58, React Native 0.88, TypeScript and Supabase.
</p>

---

## Features

| Area | What it does |
|---|---|
| **Train** | An activity calendar on top: this week at a glance (tap the month for the whole month), days shaded by volume, tap a day for its workouts, **+ LOG** on a past day to record a workout you forgot. Below it a recovery strip (days since chest / back / shoulders / arms / legs / core were trained). Routines as cards with exercise thumbnails; the one you haven't done for longest is marked **UP NEXT**. Starter routines included. |
| **Workout button** | The raised button in the middle of the tab bar: start an empty workout or any routine; while a workout runs it becomes **LIVE** and takes you back in. Starting a new one while another runs asks first. |
| **Live workout** | Its own full page, Hevy-style set table: SET · PREVIOUS · KG · REPS · ✓, prefilled with last time (tap PREVIOUS to copy). One-arm / one-leg exercises log **left and right reps**. Swipe a set left to delete it (with undo). Warm-up / drop / failure sets, **Add warm-up sets** (bar, ~50%, ~75%), **plate calculator** for barbell lifts, **supersets** (no rest between the paired exercises), a **"go up to X kg"** hint when you hit your reps on every set last time, notes, replace / reorder / remove. Saved on every keystroke. A 3h+ session warns you and lets you fix the duration. |
| **Rest timer** | Ticking a set starts the exercise's rest timer: a dock with a draining ring (+15 / skip), tap for full screen. Exact in the background; chime (even on silent), haptics, or a notification when the phone is locked. |
| **PRs** | Best estimated 1RM (Epley), heaviest weight and most reps are detected the moment you tick a set. |
| **Finish** | Unticked sets with numbers can be ticked for you instead of dropped. Summary with time, volume, sets, reps, PRs, change vs. last time, muscles worked; rate how you felt, energy, note, bodyweight, update the routine. |
| **History** | Full log grouped by month (TRAIN → RECENT → ALL). Any finished workout can be **edited afterwards** (fix numbers, add / delete sets), repeated, saved as a routine or deleted (with undo). |
| **Body (3D)** | A stylised low-poly muscle figure (built from BodyParts3D via open-anatomy-3d, three.js on expo-gl): drag to spin, FRONT / BACK / TURN, pinch to zoom, tap a muscle. Coloured by **hard sets per week** (7 / 30 / 90 days / all time). If 3D can't start on a device, a flat front/back map is shown instead. |
| **Library** | 174 exercises with Hevy-style illustrations (77 so far, the rest show a 3D muscle render), round thumbnails, search (also in Russian gym slang), **All Equipment / All Muscles** filter sheets, recently used on top and your last top set next to each exercise. Exercise page: illustration, 3D muscles, % share per muscle, records, progress chart, sessions; **add to the live workout** from there. Custom exercises too. |
| **You** | Profile, goal, workouts-per-week target, bodyweight log, lifetime stats, best lifts, full statistics, JSON backup, theme and accent. The build number is at the bottom (to check which update your phone runs). |

## Data safety

- **Local-first.** Every change is written to the phone first (AsyncStorage) and synced to Supabase in the background (push dirty rows, pull changes since a cursor, last-write-wins enforced on both sides). The app works fully offline.
- **Nothing is ever erased.** Deletes are soft (tombstones + undo). The tables have **no DELETE policy**, so the app physically cannot remove a row, and a trigger archives **every previous version** of every row in `gain_history`.
- Signing out with unsynced data keeps it on the phone; switching accounts parks the other account's unsynced rows instead of dropping them.
- One-tap JSON export from *Settings*.

## Backend

GainZone shares the *ZONE Supabase project with GrindZone (one account for both apps) and keeps its data in its own `gain_*` tables:

`gain_profile`, `gain_exercises` (custom), `gain_templates` (routines, exercises as jsonb), `gain_workouts` (sessions, exercises + sets as jsonb), `gain_metrics` (bodyweight etc.), `gain_history` (audit trail).

Schema, RLS and triggers: [`supabase/migrations/20261126150000_gainzone_core_schema.sql`](supabase/migrations/20261126150000_gainzone_core_schema.sql) — run it once in the Supabase SQL editor (it is idempotent). Until it is applied the app keeps everything on the phone and uploads it automatically afterwards.

## Open it on your iPhone

1. Install **Expo Go** (SDK 58) and sign in with the Expo account that owns the project (`azatkabulov`) — since May 2026 Expo Go only loads EAS updates for the project owner / organization members.
2. Scan with the iPhone camera → **Open in Expo Go**:

<p align="center"><img src="docs/expo-go-qr.png" width="220" alt="Expo Go QR code for GainZone" /></p>

Or open on the phone: `exp://u.expo.dev/10b59227-b7c4-433a-a8a9-95a95e3cc525?channel-name=main&runtime-version=exposdk:58.0.0`

It always loads the latest published version (EAS Update, channel `main`).

## Run locally

```bash
npm install
npx expo start            # scan the QR code with the iPhone camera → Expo Go
```

Publish an over-the-air update (Expo Go, channel `main`):

```bash
npm run publish
```

## Stack

Expo SDK 58 · React Native 0.88 · React 19 · Expo Router · Zustand (persisted) · Supabase (Postgres, Auth, RLS) · Reanimated 4 · react-native-svg · three.js + expo-gl · expo-audio · expo-notifications · expo-haptics · expo-image · Bebas Neue / Inter / JetBrains Mono.

Anatomy: BodyParts3D © The Database Center for Life Science (CC BY 4.0); adapted by [open-anatomy-3d](https://github.com/MervinR07/open-anatomy-3d) (CC BY 4.0); regions split, simplified and recoloured for GainZone by `scripts/body/build_anatomy.mjs`. Exercise thumbnails are rendered from the same model by `scripts/body/render_exercises.mjs`.

---

## По-русски: как запустить

1. **База (один раз).** Supabase → проект *ZONE (тот же, что у GrindZone) → SQL Editor → вставить содержимое `supabase/migrations/20261126150000_gainzone_core_schema.sql` → Run. Пока это не сделано, всё хранится на телефоне и само загрузится в облако после.
2. **Вход.** Тот же email и пароль, что и в GrindZone (или «Continue offline»).
3. **Открыть в Expo Go.** Войти в Expo Go под аккаунтом `azatkabulov`, отсканировать QR выше камерой iPhone или открыть ссылку `exp://u.expo.dev/10b59227-b7c4-433a-a8a9-95a95e3cc525?channel-name=main&runtime-version=exposdk:58.0.0`. Всегда открывается последняя опубликованная версия — компьютер не нужен.
