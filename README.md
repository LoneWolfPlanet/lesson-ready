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
| 4 | Lesson pack (lesson / quiz / notes) | `/packs/:id` | `src/screens/PackScreen.tsx` |
| 5 | Quiz mode | `/packs/:id/quiz` | `src/screens/QuizModeScreen.tsx` |
| 6 | Teacher notes checklist | `/packs/:id?tab=notes` | `src/screens/PackScreen.tsx` |
| 7 | Check before use (review banner) | `/packs/:id` | `src/screens/PackScreen.tsx` |
| 8 | My packs | `/packs` | `src/screens/MyPacksScreen.tsx` |

## Project layout

```
src/
  config.ts            all env settings
  auth/                External ID (MSAL v5 redirect + bridge) and mock sign-in
  api/                 types, adapter (schema mapping), http client, mock server, offline cache
  i18n/                English / Filipino strings, language + text-size context
  screens/             the eight screens
  components/          icons, status pill, nav, friendly errors
  styles/app.css       design tokens and all styles (incl. print)
redirect.html          MSAL redirect bridge page
public/                icons, staticwebapp.config.json
```
