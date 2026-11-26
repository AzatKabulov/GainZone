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
| **Live workout** | Hevy-style set table: SET · PREVIOUS · KG · REPS · ✓. Fields are **prefilled with what you did last time**, the PREVIOUS column shows every set from the last session, and a hint tells you what to beat (`LAST 100 × 5 → BEAT IT: 100 × 6`). Warm-up / drop / failure sets, per-exercise notes, **the last 3 notes for that exercise**, pinned routine notes, reorder / replace / remove. The workout is saved on every keystroke, so a crash or a dead battery never loses a set. |
| **Rest timer** | Ticking a set starts the exercise's rest timer (per exercise, 0:30–5:00). It uses an absolute end time, so it is exact in the background. When it ends: chime (even on silent mode), haptics and a toast — or a local notification if the phone is locked. −15 / +15 / skip. |
| **PRs** | Best estimated 1RM (Epley), heaviest weight and most reps are detected the moment you tick a set: trophy on the set, toast, haptic drum-roll. |
| **Finish** | Summary with time, volume, sets, reps, PRs, change vs. the last time you did this routine, muscles worked (2D map), best set per exercise. Rate **how you felt** (5 levels), energy, write how it went, log today's bodyweight, optionally update the routine with today's sets. |
| **Log** | Month calendar (Monday-first) with every training day marked, month totals, weekly streak; tap a day to see its workouts. Full session view with repeat / save as routine / edit / delete (with undo). |
| **Body (3D)** | A procedural 3D anatomy figure (three.js on expo-gl, no model files): drag to rotate, front/back buttons, tap any muscle. Every muscle is coloured by **hard sets per week** in the chosen period (7 / 30 / 90 days / all time): grey = not trained, green = low (1–5), orange = moderate (6–9), red = well trained (10–20), deep red = 20+. Tapping opens a side panel: sets/week vs. its growth zone, direct vs. indirect sets, reps, volume, last trained, recovery status, top exercises and advice. A 2D front/back map is one tap away. |
| **Library** | 174 exercises in 10 categories with search in English **and Russian** (aliases: «молитва», «пекдек», «болгарка»…), black-and-white demo photos (start/end), a muscle map, **% share of the work per muscle** (e.g. incline DB press: upper chest 45%, front delts 22%, mid chest 18%, triceps 15%), technique tips, and your history: records, a 1RM / weight / volume / reps chart, recent sessions and all your notes. Custom exercises too. |
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

## Run

```bash
npm install
npx expo start            # scan the QR code with the iPhone camera → Expo Go
```

Publish an over-the-air update (Expo Go, channel `main`):

```bash
npx eas-cli@latest update --branch main --platform ios --message "GainZone"
```

## Stack

Expo SDK 58 · React Native 0.88 · React 19 · Expo Router · Zustand (persisted) · Supabase (Postgres, Auth, RLS) · Reanimated 4 · react-native-svg · three.js + expo-gl · expo-audio · expo-notifications · expo-haptics · expo-image · Bebas Neue / Inter / JetBrains Mono.

Demo photos: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain, Unlicense), converted to monochrome by `scripts/fetch_images.py`.

---

## По-русски: как запустить

1. **База (один раз).** Supabase → проект *ZONE (тот же, что у GrindZone) → SQL Editor → вставить содержимое `supabase/migrations/20261126150000_gainzone_core_schema.sql` → Run. Пока это не сделано, всё хранится на телефоне и само загрузится в облако после.
2. **Вход.** Тот же email и пароль, что и в GrindZone (или «Continue offline»).
3. **Открыть в Expo Go.** Ссылка/QR опубликованного обновления (канал `main`) или `npx expo start` с компьютера.
