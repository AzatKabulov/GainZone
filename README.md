<h1 align="center">GAINZONE.</h1>

<p align="center">
  <b>A local-first workout tracker for iPhone — routines, live logging with rest timer, PRs, history calendar, stats and a 3D muscle map.</b><br />
  Part of the *ZONE family (GrindZone · GainZone). Built with Expo SDK 58, React Native 0.88, TypeScript and Supabase.
</p>

---

## Features

| Area | What it does |
|---|---|
| **Train** | Your routines (Day 1, Day 2…) as cards with a mini muscle map, this week's progress bar and a Monday–Sunday strip. One tap starts a routine; starter routines are included (the first one mirrors the current *Chest + Back* day). |
| **Live workout** | Its own full page. Hevy-style set table: SET · PREVIOUS · KG · REPS · ✓ — fields are **prefilled with what you did last time**, tap PREVIOUS to copy it. One-arm / one-leg exercises log **left and right reps separately** (KG · L · R). Warm-up / drop / failure sets, a small Note button per exercise (today's note, pin to routine, last 3 notes), reorder / replace / remove. Saved on every keystroke, so a crash or a dead battery never loses a set. |
| **Rest timer** | Ticking a set starts the exercise's rest timer (per exercise, 0:30–5:00): a compact dock with a draining ring, tap it for a full-screen countdown with the next set. Exact in the background (absolute end time). When it ends: chime (even on silent mode), haptics and a toast — or a local notification if the phone is locked. |
| **PRs** | Best estimated 1RM (Epley), heaviest weight and most reps are detected the moment you tick a set: trophy on the set, toast, haptic drum-roll. |
| **Finish** | Summary with time, volume, sets, reps, PRs, change vs. the last time you did this routine, muscles worked (2D map), best set per exercise. Rate **how you felt** (5 levels), energy, write how it went, log today's bodyweight, optionally update the routine with today's sets. |
| **Log** | Month calendar (Monday-first) with every training day marked, month totals, weekly streak; tap a day to see its workouts. Full session view with repeat / save as routine / edit / delete (with undo). |
| **Body (3D)** | A real anatomical 3D muscle model (BodyParts3D via open-anatomy-3d, three.js on expo-gl): drag to rotate, pinch to zoom, front/back buttons, tap any muscle. Every muscle is coloured by **hard sets per week** in the chosen period (7 / 30 / 90 days / all time): grey = not trained, green = low (1–5), orange = moderate (6–9), red = well trained (10–20), deep red = 20+. Tapping opens a side panel: sets/week vs. its growth zone, direct vs. indirect sets, reps, volume, last trained, recovery status, top exercises and advice. A 2D front/back map is one tap away. |
| **Library** | 174 exercises in 10 categories, each with a 3D render of the working muscles. Search also understands Russian gym slang («молитва», «пекдек», «болгарка»). Exercise page: an interactive 3D model with the muscles lit, **% share of the work per muscle** (e.g. incline DB press: upper chest 45%, front delts 22%, mid chest 18%, triceps 15%), records, a 1RM / weight / volume / reps chart and recent sessions with notes. Custom exercises too. |
| **You** | Name, height, birth year, goal, workouts-per-week target; bodyweight log with chart and BMI; lifetime stats; best lifts; full statistics (12-week volume / workouts / sets / minutes, sets per muscle group, most trained exercises, how you felt over time, bodyweight). JSON backup export. Theme (system / dark / light) and the five *ZONE accents (VOLT by default). |

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
