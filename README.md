# LessonReady — teacher web app (phase 1)

React + TypeScript + Vite PWA. Teachers ask for a lesson by topic and grade, wait for it to be written, then teach from it: lesson sections, an activity, key words, a quiz with a projector mode, and teaching tips. Sign-in uses Microsoft Entra External ID (email one-time passcode; Google optional).

## Run it now (no Azure needed)

```bash
npm install
npm run dev        # http://localhost:5173 — fake sign-in and a fake pack generator (no .env file needed)
```

The mock generator takes about 20 seconds per pack. Two demo packs are already there: one ready, one flagged. A topic containing "fail" shows the failure screen.

## Connect the real services

See **[INTEGRATION.md](./INTEGRATION.md)** for every setting, the External ID setup, the API contract, and which files to edit if your API's schema differs.

```bash
cp .env.example .env.local   # fill in, then
npm run dev
npm run build                # production build in dist/
```

## Screens (from the UX board)

| # | Screen | Route | File |
|---|---|---|---|
| 1 | Welcome and sign in | `/welcome` | `src/screens/WelcomeScreen.tsx` |
| 2 | Ask for a lesson | `/new` | `src/screens/NewPackScreen.tsx` |
| 3 | Writing your lesson | `/packs/:id/working` | `src/screens/WorkingScreen.tsx` |
| 4 | Lesson pack (lesson / quiz / notes) | `/packs/:id` | `src/screens/pack/PackScreen.tsx` (tabs: `LessonTab`, `QuizTab`, `NotesTab`) |
| 5 | Quiz mode | `/packs/:id/quiz` | `src/screens/QuizModeScreen.tsx` |
| 6 | Teacher notes checklist | `/packs/:id?tab=notes` | `src/screens/pack/NotesTab.tsx` |
| 7 | Check before use (review banner) and Mark as reviewed | `/packs/:id` | `src/screens/pack/PackScreen.tsx`, `ReviewControl.tsx` |
| 8 | My packs (filters, remove) | `/packs` | `src/screens/MyPacksScreen.tsx` |
| P2 | My materials | `/materials` | `src/materials/MaterialsScreen.tsx` |
| – | Settings | `/settings` | `src/screens/SettingsScreen.tsx` |

## Project layout

```
src/
  config.ts            all env settings
  auth/                External ID (MSAL v5 redirect + bridge) and mock sign-in
  storage.ts           localStorage helpers that never throw
  api/                 types, adapter (schema mapping), http client, mock server, offline cache
  i18n/                English / Filipino strings, language + text-size context
  screens/             Welcome, New, My packs, Working, Quiz mode, Settings
  screens/pack/        the pack screen: tabs, editors (quiz/lesson/notes), review control, print view
  materials/           My materials: upload to Blob, list, remove
  components/          icons, status pill, nav, friendly errors
  styles/app.css       design tokens and all styles (incl. print)
redirect.html          MSAL redirect bridge page
public/                icons, staticwebapp.config.json
```

## Bundle

Welcome, New and My packs load with the app; the pack screen, Working, Quiz mode, Settings
and My materials load on first visit (`React.lazy` in `src/App.tsx`). React and React Router are
split into their own files so they stay cached across deploys. The mock API (`api/mockServer.ts`)
is only downloaded in mock mode and is left out of the offline precache. The service worker
precaches every other chunk, so all screens still open offline.
