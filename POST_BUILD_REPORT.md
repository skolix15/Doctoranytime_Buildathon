# MedPlatform — POST BUILD REPORT
_Last updated: 2026-05-13 — Phase 3 UX & AI polish applied_

## What Was Built

### Backend (Node.js + Express + TypeScript)
- **Auth**: JWT login/register/refresh for patients and doctors
- **Patient API**: profile, dashboard, timeline, health metrics, AI insights
- **Doctor API**: profiles, availability slots, Q&A answers
- **Search**: keyword-based doctor + Q&A search with specialty matching and scoring
- **AI Assistant**: SSE-streaming RAG pipeline using Anthropic SDK (claude-sonnet-4-5), retrieves relevant Q&A from DB and streams answers with confidence scores and source attribution
- **Appointments**: CRUD with status management
- **Medications**: CRUD with reminder support
- **Test Results**: CRUD with structured values
- **Family**: family member management
- **Q&A**: corpus search

### Frontend (React 18 + TypeScript + Vite + TailwindCSS)
- **Login / Register** pages
- **Home Dashboard**: upcoming appointments, AI insights cards, medication reminders, blood pressure chart
- **Search Page**: doctor cards with match score, Q&A results, booking modal
- **AI Assistant**: full-screen streaming chat with confidence badges + source attribution
- **Appointments**: list view with tab filters (upcoming/past/all), cancel action
- **Doctor Profile**: full profile, availability slot picker, booking
- **Medications**: card grid with "why am I taking this" accordion, add modal
- **Test Results**: structured table view with AI explanations, AI summary
- **Family Hub**: family member cards with conditions/medications, add modal
- **Timeline**: vertical timeline of health events
- **Vault**: placeholder with upload zone UI
- **Settings**: profile edit form

### Database (MongoDB — BuildathonDB)
- **10 doctors** across all major specialties (Greek names, Athens/Thessaloniki locations)
- **50 Q&A entries** with 2 answers each, covering all specialties in Greek
- **2 patient accounts** with full profiles, family members, appointments, medications, test results

## Phase 2 — AI Patient Engagement Features (2026-05-13)

These six features were added to make patients prefer the app over generic tools like ChatGPT.
Each leverages the patient's personal health data — something no generic chatbot can match.

### 1. Persistent Health Memory (`aiContext.healthSummary`)
After every assistant session, a Claude Haiku call extracts new health facts the patient disclosed
and stores them as a rolling `healthSummary` on the patient document. This summary is injected into
every future session's system prompt so the AI remembers the patient across conversations.
- **Backend:** `assistant.routes.ts` — combined post-session Haiku call (JSON: `sessionSummary` + `healthFacts`)
- **Model:** `Patient.ts` — new `aiContext.healthSummary` field

### 2. Personal Health Context in Every AI Message (already existed; hardened)
The `buildSystemPrompt` function already injected appointments, medications, and test results.
Now also includes the health memory section and three new guidelines: drug interaction checking
against active medications, referencing health memory for continuity, and substance interaction awareness.

### 3. "Ask AI About This" Buttons
One-tap entry points that pre-compose a personalised question from the patient's actual data
and navigate to `/assistant?prefill=...`. The Assistant page auto-sends the prefill on mount.
- **Medications page:** 🧠 button per medication — asks about purpose, side effects, and interactions
- **Test Results page:** "🧠 Ρώτησε MedAssist" button — sends actual values and abnormal flags
- **Appointments page:** "🧠 Ετοίμασε Ερωτήσεις" button — asks AI to prepare questions for that appointment
- **Frontend:** `Assistant.tsx` — `?prefill=` URL param handling with `useSearchParams`

### 4. Pre-Appointment Briefing Card (Home Dashboard)
When any upcoming appointment is within 24 hours, an amber banner appears on the dashboard
with the doctor name, specialty, and a one-click "Ετοίμασε Ερωτήσεις" button that opens
the AI pre-composed with the appointment context and the patient's full health history.
- **Frontend:** `Home.tsx` — 24h time check against `upcomingAppts` query data

### 5. Proactive AI Dashboard Insights (Dynamic, Cached)
The `/insights` endpoint now calls Claude Haiku to generate 3 personalised insight cards based
on the patient's actual abnormal test values, upcoming appointments, medications, and conditions.
Results are cached in `patient.cachedInsights` for 6 hours to avoid repeated AI calls.
Falls back gracefully if no API key or if Claude is unavailable.
- **Backend:** `patient.routes.ts` — `GET /patient/insights` with 6h cache logic
- **Model:** `Patient.ts` — new `cachedInsights: { data, generatedAt }` field

### 6. Inline Doctor Booking from AI Chat (Suggested Doctors)
When the AI triggers the `suggest_appointment` tool, the backend now also searches the Doctor
collection for specialists matching the recommended specialty and emits a `suggested_doctors`
SSE event. The frontend renders these as bookable cards directly inside the chat bubble —
patients go from AI recommendation to booked appointment in two taps.
- **Backend:** `assistant.routes.ts` — Doctor search after booking_intent, `suggested_doctors` SSE event
- **Frontend:** `assistantStore.ts` — `suggestedDoctors` on Message type; `Assistant.tsx` — `DoctorSuggestionRow` component

### 7. JWT Token Expiry from Environment Variables
`JWT_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN` in `server/.env` were previously ignored —
`signTokens()` had the values hardcoded as string literals `'15m'` / `'7d'`.
Now reads from `process.env` with the hardcoded values as fallback.
- **File:** `server/src/routes/auth.routes.ts` — `signTokens()` function

---

## Phase 3 — UX & AI Polish (2026-05-13)

These improvements refine the patient-facing UX, tighten AI behavior, and add persistence for dashboard AI suggestions.

### 1. Health Records Reorganisation
Merged the previously scattered Medications, Test Results, Vault, and Examination Files pages into a single unified `/health-records` page with three tabs: **💊 Φάρμακα · 🔬 Εξετάσεις · 📁 Έγγραφα**. Examination file attachments moved directly into each test result entry (no longer a separate Documents sub-category). Old routes (`/medications`, `/results`, `/vault`) now redirect via `<Navigate replace>` to the appropriate tab.
- **Frontend:** `HealthRecords.tsx` — unified three-tab page, file attach/delete per result entry
- **Backend:** `results.routes.ts` — `POST /:id/files` and `DELETE /:id/files/:fileIndex` with multer; `TestResult.ts` — `attachedFiles` array field

### 2. Timeline + Appointments → "Ιστορικό Υγείας"
Merged the duplicate Timeline and Appointments pages into a single **Ιστορικό Υγείας** page (`/appointments`) with four tabs: Επερχόμενα · Προηγούμενα · Όλα · 📊 Γράφημα. The graph tab renders a recharts stacked BarChart of appointments by month plus a horizontal dot timeline. `/timeline` now redirects to `/appointments`.
- **Frontend:** `Appointments.tsx` — full rewrite with `GraphView` component; `Sidebar.tsx` — single nav entry; `App.tsx` — redirect

### 3. AI Assistant — Decisive Booking & No Source Cards
Tightened the AI assistant's behaviour in two ways:
- **No Q&A source cards in chat:** `SourceCard` component removed; sources no longer emitted when the interaction is informational (only booking intent triggers `suggested_doctors`).
- **No spurious booking suggestions for info queries:** System prompt now has an explicit "MEDICATION & HEALTH RECORD QUESTIONS" section that prohibits calling `suggest_appointment` when the user asks about a medication or test result; the AI answers with 3–5 bullet points instead.
- **Backend:** `assistant.routes.ts` — updated system prompt with today's date injection, explicit booking vs info rules, updated tool description
- **Frontend:** `Assistant.tsx` — `SourceCard` removed, `DoctorSuggestionRow` accepts `bookingIntent` prop

### 4. "Medical Assistant" Button Auto-Send Prefill
Every **Medical Assistant** button in the app now composes a context-aware message and auto-sends it (600 ms delay after navigation) rather than only populating the input field. The message names the specific medication or test result and whether it belongs to a family member, so the AI has full context without the patient having to type anything.
- **Frontend:** `HealthRecords.tsx` — medication and test result prefill messages; `Assistant.tsx` — `sendMessage(prefillText)` via `useEffect` on mount

### 5. AI Dashboard Suggestions — Persistence & "Last Suggestions" Panel
After every AI suggestions stream completes, the full suggestion text and timestamp are saved to `localStorage`. A **Τελευταίες Προτάσεις** button appears on the dashboard hero (only when saved suggestions exist). Clicking it opens a read-only modal with the previous suggestions, the date/time they were generated, and a **Ανανέωση** button that triggers a fresh stream.
- **Frontend:** `suggestionStore.ts` — `lastSuggestions`, `lastSuggestionsDate`, `showLastPanel`, `saveLastSuggestions`, `openLastPanel`, `closeLastPanel`; `SuggestionsModal.tsx` — saves completed stream text; `Home.tsx` — new button + panel with ReactMarkdown rendering

### 6. Bug Fixes
- **Search input icon overlap:** `input-field` CSS class applies `px-4` which overwrote `pl-10` (same specificity, stylesheet order wins). Fixed with inline `style={{ paddingLeft: '2.5rem' }}`.
- **Header z-index over modals:** Navbar was `z-50` (same as modals). Lowered to `z-30` so modals always render above the header.

---

## Deviations from Spec

| Feature | Status | Note |
|---------|--------|------|
| Voyage-3 embeddings | Skipped | API key not configured; text-based search used instead |
| pgvector / Pinecone | Skipped | Fallback to MongoDB text search |
| Redis | Skipped | Not required for POC |
| File upload (S3/Multer) | Skipped | Vault page has UI placeholder |
| Google OAuth | Skipped | Standard JWT auth implemented |
| Socket.io real-time | Skipped | SSE streaming used for assistant |
| SMS/Email notifications | Skipped | Reminder data stored, sending not wired |
| Document vault full impl | Partial | UI placeholder, routes exist |
| OCR test result parsing | Partial | Manual upload route without OCR |

## How to Run

### Prerequisites
- Node.js 18+
- MongoDB running on `localhost:27017` with user `admin:vamos`

### Setup
```bash
cd /Users/skolix15/Documents/C/dat_projects/buildathon/medplatform

# 1. Install all dependencies (root + server + client)
npm run install:all

# 2. Seed the database (creates doctors, Q&A, test patients)
npm run seed

# 3. Start both server + client
npm run dev
```

> `server/.env` already contains valid JWT secrets and the Anthropic API key.
> No extra configuration needed for local development.

### Access
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api/v1

## Test Credentials
| Role | Email | Password |
|------|-------|----------|
| Patient | patient@test.com | Test1234! |
| Patient 2 | patient2@test.com | Test1234! |
| Doctor | doctor@test.com | Test1234! |

## Key Features to Demo

### 1. AI Assistant (`/assistant`)
- Login → navigate to AI Βοηθός
- Type: *"Έχω υψηλή αρτηριακή πίεση 160/100, τι να κάνω;"*
- See: streaming response, confidence badge (green/yellow), source doctor cards
- Type: *"Πότε πρέπει να πάω σε καρδιολόγο;"* → AI recommends specialty → bookable doctor cards appear inline
- Health memory: start a new session, the AI references facts from previous conversations

### 2. Ask AI Buttons (Phase 2)
- Go to `/medications` → click 🧠 on any medication → assistant opens with a pre-composed question about that drug
- Go to `/results` → select a test → click "🧠 Ρώτησε MedAssist" → actual values sent automatically
- Go to `/appointments` → upcoming appointment → click "🧠 Ετοίμασε Ερωτήσεις" → AI prepares appointment questions

### 3. Pre-Appointment Briefing (`/`)
- If a confirmed appointment is within 24 hours, an amber briefing card appears on the dashboard
- Click "Ετοίμασε Ερωτήσεις" → one-tap to AI with full context

### 4. Search (`/search`)
- Click quick tag "Υπέρταση" or type a symptom
- See: doctor cards with match scores, Q&A results column
- Click "Κλείστε Ραντεβού" to book

### 5. Dashboard (`/`)
- Upcoming appointment cards
- AI health insights (now dynamically generated from real patient data, cached 6h)
- Blood pressure chart

### 6. Test Results (`/results`)
- Click on blood test → see structured values with status badges + AI explanations

## API Endpoints

```
POST   /api/v1/auth/login
POST   /api/v1/auth/register
POST   /api/v1/auth/refresh

GET    /api/v1/patient/me
GET    /api/v1/patient/dashboard
GET    /api/v1/patient/insights
GET    /api/v1/patient/timeline
POST   /api/v1/patient/metrics
GET    /api/v1/patient/metrics/:type

GET    /api/v1/family
POST   /api/v1/family
DELETE /api/v1/family/:id

POST   /api/v1/assistant/message    (SSE stream)
GET    /api/v1/assistant/sessions
POST   /api/v1/assistant/prefill

POST   /api/v1/search
GET    /api/v1/search/suggestions

GET    /api/v1/doctors/:id
GET    /api/v1/doctors/:id/availability
GET    /api/v1/doctors/:id/qna

GET    /api/v1/appointments?status=upcoming|past|all
POST   /api/v1/appointments
PUT    /api/v1/appointments/:id/cancel

GET    /api/v1/medications
POST   /api/v1/medications
DELETE /api/v1/medications/:id

GET    /api/v1/results
GET    /api/v1/results/:id

GET    /api/v1/qna/search?q=
GET    /api/v1/qna/:id
```
