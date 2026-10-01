# LessonReady integration guide (phase 1)

The app runs fully on mock sign-in and a mock pack API, so you can work on the UI with no Azure resources. This guide lists **every setting and code location you need to change** to connect it to External ID and your backend.

**Short version:**
1. Create the `.env.local` / production settings (section 1).
2. Configure External ID (section 2).
3. Make sure the API matches the contract, or edit `src/api/adapter.ts` (section 3).
4. Host with the SPA fallback (section 5).

---

## 1. Settings (`.env.*` files → `src/config.ts`)

Put real values in `.env.local`. With no env file, everything runs in mock mode. Don't add a `.env.development`: Vite ranks mode files above `.env.local`, so it would silently override your settings.

Vite bakes these in at **build time**. In CI, set them as build environment variables, not as App Service or Static Web Apps runtime settings.

| Variable | Mock dev value | Real value | Notes |
|---|---|---|---|
| `VITE_AUTH_MODE` | `mock` | `msal` | `mock` signs in as a fake teacher. |
| `VITE_AUTH_CLIENT_ID` | — | SPA app registration's client ID | External ID tenant, not your workforce tenant. |
| `VITE_AUTH_AUTHORITY` | — | `https://<subdomain>.ciamlogin.com/<tenant-id>/` | Subdomain host plus the **Directory (tenant) ID** path, with a trailing `/`. Without the tenant ID, MSAL's issuer check fails with `endpoints_resolution_error`. |
| `VITE_AUTH_KNOWN_AUTHORITY` | — | `<tenant-subdomain>.ciamlogin.com` | |
| `VITE_AUTH_REDIRECT_PATH` | `/redirect.html` | `/redirect.html` | Must be registered as a redirect URI (see 2.1). |
| `VITE_AUTH_GOOGLE_ENABLED` | — | `false` until Google is set up | Hides the Google button in `msal` mode. Set `true` after 2.4. |
| `VITE_AUTH_GOOGLE_DOMAIN_HINT` | — | blank, or `Google.com` | See 2.4 before setting. |
| `VITE_API_MODE` | `mock` | `http` | You can mix modes, e.g. real sign-in + mock API. |
| `VITE_API_BASE_URL` | — | `https://<api-host>/api` | No trailing slash. Paths are appended (`/packs`). |
| `VITE_API_SCOPES` | — | `api://<api-client-id>/Packs.ReadWrite` | Space-separated. Empty means no bearer token is sent. |
| `VITE_EXPECTED_MINUTES` | `3` | your real p50 time | Shown as "About N minutes". |
| `VITE_POLL_SECONDS` | `2` | `5` | Poll interval while a pack is being written. |

On start-up, `configProblems()` in `src/config.ts` logs anything that's missing to the browser console.

---

## 2. Microsoft Entra External ID

Do all of this at [entra.microsoft.com](https://entra.microsoft.com) in your **external** tenant. To get there, use the **Settings (gear) icon → Directories**. The tenant's home page should say *Microsoft Entra External ID*. Your Default Directory is a workforce tenant and won't work.

Work through the sections **in this order**. The API has to expose its scope before the frontend can request it.

### 2.1 API app registration (the backend)

1. **App registrations → New registration**
   - Name: `LessonReady API`
   - Supported account types: **Single tenant only**
   - No redirect URI
   - Click **Register**.
2. **Expose an API**
   - **Application ID URI → Add**: keep `api://<api-client-id>` and save.
   - **Add a scope**:

     | Field | Value |
     |---|---|
     | Scope name | `Packs.ReadWrite` |
     | Who can consent | **Admins only** |
     | Admin consent display name | `Read and write lesson packs` |
     | Admin consent description | `Allows LessonReady to create and read the signed-in teacher's lesson packs.` |
     | State | **Enabled** |

   - Put the full scope string, `api://<api-client-id>/Packs.ReadWrite`, in `VITE_API_SCOPES`.
3. **Manifest:** make sure `requestedAccessTokenVersion` (shown as `accessTokenAcceptedVersion` in some views) is `2`.
4. **Record for the backend:**
   - the **Application (client) ID**, which is the token audience (`aud`)
   - the **Directory (tenant) ID**, for the issuer `https://<tenant-id>.ciamlogin.com/<tenant-id>/v2.0`
5. **Leave everything else empty:** no redirect URIs, secrets, app roles or extra API permissions.

### 2.2 SPA app registration (the frontend)

1. **App registrations → New registration**
   - Name: `LessonReady Web`
   - Supported account types: **Single tenant only**
   - Leave the redirect URI empty here
   - Click **Register**.
   - Copy the **Application (client) ID** into `VITE_AUTH_CLIENT_ID`.
2. **Authentication (Preview) → Add Redirect URI**, choosing **Single-page application** each time. Don't use *Web*, or the auth-code + PKCE flow fails with CORS errors.
   - `http://localhost:5173/redirect.html`
   - `https://<your-domain>/redirect.html` (add once deployed)
   - `https://<your-domain>/welcome` (after sign-out; MSAL's `postLogoutRedirectUri`; add once deployed)

   Each entry should then show the type **SPA**. If the panel doesn't ask for a platform, use *"switch to the old experience"* in the banner and use **Add a platform → Single-page application**.
3. **Settings tab:** leave implicit grant (access tokens and ID tokens) **unticked**.
4. **API permissions**
   - **Add a permission → APIs my organization uses → LessonReady API → Delegated → `Packs.ReadWrite` → Add permissions.**
   - Then click **Grant admin consent for <tenant>**. The status should read *Granted*.
   - The default Graph `User.Read` permission is harmless. Keep or remove it.
5. **Token configuration** (optional): **Add optional claim → ID → `given_name`**. The greeting uses `given_name` when present, otherwise the first word of `name`.

### 2.3 User flow

1. **External Identities → User flows → New user flow**, named e.g. `SignUpSignIn`.
2. **Identity providers:** **Email one-time passcode** (or Email with password). Leave Google for later (2.4).
3. **User attributes:** tick **Given name** and **Display name**.
4. Click **Create**.
5. Open the flow and go to **Applications → Add application → LessonReady Web**. **Sign-in fails without this step.**

You can now test real sign-in on `localhost:5173`:
- `VITE_AUTH_MODE=msal`
- `VITE_AUTH_AUTHORITY=https://<subdomain>.ciamlogin.com/<tenant-id>/`
- `VITE_AUTH_KNOWN_AUTHORITY=<subdomain>.ciamlogin.com`
- `VITE_API_MODE=mock` (keep this until the backend is ready)

### 2.4 Google (later; optional for phase 1)

The Google button stays hidden until `VITE_AUTH_GOOGLE_ENABLED=true`. To turn it on:

1. **Google OAuth client:** create one in Google Cloud and register the External ID redirect URIs listed in Microsoft's guide: [Add Google as an identity provider](https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-google-federation-customers). There are seven URIs, using your tenant ID and subdomain.
2. **External ID:** add Google under **External Identities → All identity providers**, then tick it in the user flow's **Identity providers**.
3. Set `VITE_AUTH_GOOGLE_ENABLED=true` and rebuild.

What the "Continue with Google" button does:
- With `VITE_AUTH_GOOGLE_DOMAIN_HINT` **blank**, it opens the External ID sign-in page, and the teacher taps Google there. This always works and is the safe default.
- With it set to `Google.com`, it adds `domain_hint=Google.com` to skip that page.

**Test before shipping the domain hint.** There are open Microsoft Q&A reports of it failing on desktop browsers ([AADSTS90023](https://learn.microsoft.com/en-gb/answers/questions/5916011/domain-hint-google-fails-with-aadsts90023-in-deskt), [AADSTS165000 with login_hint](https://learn.microsoft.com/en-us/answers/questions/5649443/issue-aadsts165000-when-using-domain-hint-google-a)).

### 2.5 How sign-in works in the code (MSAL Browser v5)

- **Starting sign-in:** `src/auth/msalAuth.ts` → `loginRedirect` (redirects, not pop-ups, because pop-ups are unreliable on phones).
- **Coming back:**
  1. External ID returns to `/redirect.html`.
  2. That page runs `broadcastResponseToMainFrame()` from `@azure/msal-browser/redirect-bridge` (`src/auth/redirectBridge.ts`).
  3. The bridge returns to `/new` (`redirectStartPage`).
  4. `handleRedirectPromise()` finishes sign-in.
- **The bridge must stay outside the SPA fallback.** If the host or service worker rewrites `/redirect.html` to `index.html`, sign-in loops. Both `vite.config.ts` and `public/staticwebapp.config.json` already exclude it.
- **Tokens:**
  - Stored in `localStorage`, so teachers stay signed in.
  - For shared school computers, change `cacheLocation` to `"sessionStorage"` in `msalAuth.ts`.
- **Expired sessions:** `getAccessToken` calls `acquireTokenRedirect` automatically.

**Verified here:** with test values, the app builds in MSAL mode and the Google button produces this authorize request:
- `redirect_uri=…/redirect.html`
- `scope=openid profile offline_access api://…/Packs.ReadWrite`
- `domain_hint=Google.com`

The full round trip needs your real tenant. Test email sign-in after 2.1–2.3, and Google after 2.4.

---

## 3. Backend API contract

### Live API: Lesson Pack API (FastAPI on Container Apps)

The app is wired to the deployed API's OpenAPI:

| Call | API | Notes |
|---|---|---|
| Start a pack | `POST /lesson-packs` `{topic, grade}` → `202 {job_id, …}` | No retry on failure (the API has no idempotency key). `language` is **not sent** until the API accepts it (`toCreateBody` in `adapter.ts`). |
| Read a pack | `GET /lesson-packs/{job_id}` | Polled while unfinished. Topic, grade and date are filled from the original request if the response omits them. |
| My packs | *(no list endpoint)* | Built from the jobs requested **on this device** (`packIndex` in `offlineCache.ts`). Add `GET /lesson-packs` (scoped to the teacher) to show packs across devices. |

**How the real response maps to the screens** (`src/api/adapter.ts`; a real response is kept in `src/api/fixtures/photosynthesis.json` and used by mock mode):

| Screen | From |
|---|---|
| Status pill | `status`: `running` → being written, `ready` → Ready to use, `ready_with_notes` → Check before use, `unavailable` (topic not in the curriculum library; `teacher.teacherOverview` is shown) → "This topic isn't in our library yet" with **Try another topic**, `failed` → couldn't finish. Unknown values are classified by pattern (e.g. `*fail*` → failed, `ready*` → ready, anything with a `result` → finished) and logged as a console warning so you can add them to `STATUS_MAP`. Polling also stops after `max(20, 10 × VITE_EXPECTED_MINUTES)` minutes, with a "Check again" button. A `ready` pack becomes **Check before use** if `result.teacher.packStatus` or `result.review.verdict` says so, or if there are any issues. |
| "Reviewed ✓" | `result.review.verdict == "approved"` with no issues |
| Lesson tab | `result.teacher.teacherOverview`, `result.lesson.learningObjectives`, `sections[{title, body}]`, `activity{title, materials, steps}`, `vocabulary[{term, definition}]` |
| Quiz tab / Quiz mode | `result.quiz.questions[{id, question, options, correctIndex, explanation}]` |
| Notes tab (checklist) | `result.teacher.teachingTips` |
| Review banner | `result.review.issues` (linked to a question by `questionId` such as `q4`), `questionChecks` where `answerIsCorrect` is false, and `result.teacher.teacherWarnings` |
| "Writing your lesson" steps | Estimated from time since `createdAt` and `VITE_EXPECTED_MINUTES`, because the API only says `running` |

- **Failed packs:** `error` text is logged to the console, not shown. Teachers see the friendly default unless the API sends `error.userMessage`.
- **Grades:** the API accepts 1–12; the app offers 1–6.
- **Topic chips** (`src/data/suggestions.ts`) must list only topics in the curriculum library (`lessons` container); any other topic comes back `unavailable`. A `GET /topics?grade=N` endpoint built from the library would keep them in sync automatically.
- **Not yet confirmed:** the shape of `review.issues`, since your sample had none. The adapter reads `message`, `description` or `summary`, plus `questionId`. Check the first flagged pack.

The generic contract below is the original assumption, kept for reference. Where it differs, the table above wins.


The UI never reads the API JSON directly. `src/api/adapter.ts` converts it, so **if your schema differs, edit the adapter, not the screens.** The adapter already accepts common alternative field names, listed in brackets below.

### Endpoints (paths are in `src/api/client.ts`)

#### `POST /packs`
- **Headers:** `Authorization: Bearer <token>`, `Idempotency-Key: <uuid>`
- **Request body:**
  ```json
  { "topic": "Photosynthesis", "grade": 4, "language": "en" }
  ```
- **Response (`202` or `201`):**
  ```json
  { "id": "…" }
  ```
  The id may also be named `packId` or `jobId`.

#### `GET /packs/{id}`
Returns the pack, including progress while it is being written:

```json
{
  "id": "…", "topic": "Photosynthesis", "grade": 4, "createdAt": "2026-10-01T02:00:00Z",
  "status": "Generating",
  "content": {
    "lessonPlan": {
      "objective": "…", "totalMinutes": 45,
      "phases": [ { "title": "Warm-up", "durationMinutes": 5, "summary": "…", "steps": ["…"] } ]
    },
    "quiz": { "questions": [ { "question": "…", "choices": ["…"], "correctIndex": 0, "explanation": "…" } ] },
    "teacherNotes": ["…"]
  },
  "review": { "passed": false, "issues": [ { "section": "quiz", "questionIndex": 3, "message": "May be too hard for Grade 2." } ] },
  "error": { "userMessage": "We couldn't write this lesson. Try a shorter topic." }
}
```

Alternative names the adapter accepts:

| Field | Also accepted |
|---|---|
| `content` | `result` |
| `lessonPlan` | `lesson` |
| `phases` | `sections`, `steps` |
| `title` | `name` |
| `durationMinutes` | `minutes` |
| `choices` | `options` |
| `correctIndex` | `answerIndex`, or the answer text in `answer` |
| `teacherNotes` | `notes` |
| `issues` | `findings` |

#### `GET /packs`
Returns the teacher's packs, newest first:

```json
{ "items": [ { "id", "topic", "grade", "status", "createdAt" } ] }
```

A bare array, `value` or `packs` also works.

### Statuses (`STATUS_MAP` in `adapter.ts`)

Backend values are lower-cased and mapped. Internal state names never reach the screen.

| Backend status | Teacher sees | Progress step |
|---|---|---|
| `Queued`, `Pending`, `Planning` | Being written | Planning the lesson |
| `Running`, `Generating`, `Writing` | Being written | Writing the quiz and notes |
| `Reviewing`, `Checking` | Being written | Checking it fits Grade N |
| `Completed`, `Succeeded`, `Ready`, `Approved` | **Ready to use** | — |
| `NeedsReview`, `Flagged` | **Check before use** | — |
| `Failed`, `Error`, `Cancelled` | Couldn't finish (`error.userMessage` is shown) | — |

- Add your own state names to `STATUS_MAP`.
- A `Completed` pack that still has `review.issues` is shown as **Check before use**, to be safe.
- `issues[].message` is shown to teachers word for word. Write it in plain language, e.g. "May be too hard for Grade 2", never an internal code.

### What the API must do

- **CORS:**
  - Allow your SPA origin(s) and `http://localhost:5173`.
  - Allow the headers `Authorization`, `Content-Type` and `Idempotency-Key`.
  - Allow the methods `GET` and `POST`.
- **Validate tokens:**
  - `aud` = your API client ID (or `api://…`)
  - issuer `https://<tenant-id>.ciamlogin.com/<tenant-id>/v2.0`
  - required scope `Packs.ReadWrite`
- **Scope data to the teacher:** use the `oid` (or `sub`) claim. `GET /packs` returns only that teacher's packs.
- **Idempotency:** the client retries `POST /packs` on network errors and 5xx. Honour `Idempotency-Key` so a retry doesn't create a duplicate pack. If you can't, set `RETRIES = 0` for POSTs in `src/api/http.ts`.
- **Status codes:**
  - `401` / `403`: the app shows "Please sign in again." (an expired session is renewed by MSAL before this happens).
  - `404`: "We couldn't find this pack."
  - `429`: friendly "busy" message, then retry.
  - `5xx`: retried with backoff, then a friendly error.

---

## 4. Other places you may want to change

| What | Where |
|---|---|
| Endpoint paths | `src/api/client.ts` (top comment and the three calls) |
| JSON field names, statuses | `src/api/adapter.ts` (`toPack`, `STATUS_MAP`, `toCreateBody`, `toCreatedId`) |
| Retries / backoff | `src/api/http.ts` (`RETRIES`, delay formula) |
| Lesson language | `NewPackScreen.tsx` sends the **UI language** (`en`/`fil`) as the lesson language. If teachers should choose separately, add a control there. |
| Grade range (currently 1–6) | `GRADES` in `src/api/types.ts` and `SUGGESTIONS` in `src/data/suggestions.ts` |
| Topic suggestions | `src/data/suggestions.ts` (static; swap for an API call if you like) |
| Interface text, Filipino copy | `src/i18n/strings.ts`. **Have a native-speaking teacher review the Filipino strings** before release. |
| Offline copies (how many, where) | `src/api/offlineCache.ts` (`MAX_PACKS`, localStorage) |
| Shared-device sign-in | `cacheLocation` in `src/auth/msalAuth.ts` |
| Colours, sizes, fonts | `:root` tokens at the top of `src/styles/app.css` |
| App name / icons | `vite.config.ts` manifest, `public/icon*.png`, `index.html` |

---

## 5. Hosting (Azure Static Web Apps)

- **Build:** `npm ci && npm run build`. Output is in `dist/`.
- **SPA fallback:** `public/staticwebapp.config.json` is copied into `dist/`. It rewrites deep links such as `/packs/123` to `index.html` but **excludes `/redirect.html`**. On another host, configure the same rule.
- **Service worker:** `sw.js` and `index.html` are served `no-cache`, so updates reach teachers. New versions install silently and apply on the next visit.
- **HTTPS:** required for sign-in, the service worker, the share sheet and the clipboard. `localhost` is exempt.

---

## 6. Test checklist after wiring

- [ ] Sign in with email OTP on Android Chrome and desktop, and land on **New**.
- [ ] Sign in with Google, with and without `VITE_AUTH_GOOGLE_DOMAIN_HINT`.
- [ ] Refresh `/packs/<id>` directly: it loads (fallback works) and you stay signed in.
- [ ] Make a pack. The progress steps advance, you can leave and come back, and the pack ends on **Ready to use** or **Check before use**.
- [ ] Open a pack, then go offline (airplane mode): **My packs** and that pack still open.
- [ ] A flagged pack shows the banner, and tapping the issue jumps to the question.
- [ ] Quiz mode works with arrow keys or a presenter clicker. Share opens the phone's share sheet. Print / Save as PDF produces one clean page set.
- [ ] Sign out returns to **Welcome**.
- [ ] Expire the token (or revoke the session): the next API call sends you through sign-in, not an error.

## 7. Known limits / phase 2

- **School Microsoft accounts:** the button is a "coming soon" line on Welcome. Phase 2 adds a workforce-tenant authority or B2B.
- **Notifications:** there is no "your pack is ready" notification yet. The pack list refreshes on its own while something is being written.
- **Bundle size:** the JS bundle is about 147 KB gzipped, mostly MSAL. If first-load size on 3G matters, lazy-load `msalAuth.ts`.
