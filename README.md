# MedPlatform

A Greek-language AI-assisted medical platform connecting patients with doctors, built as a hackathon project. Patients manage their health records, book appointments, and get personalised AI health guidance — all grounded in their real medical history.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + TailwindCSS + Zustand + React Query |
| Backend | Node.js + Express + TypeScript |
| Database | MongoDB + Mongoose |
| AI | Anthropic SDK — claude-sonnet-4-5 (chat) + claude-haiku (summaries/insights) |
| Auth | JWT (access + refresh tokens) |
| Streaming | SSE (Server-Sent Events) for AI responses |

---

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB running on `localhost:27017` (credentials: `admin:vamos`)

### Setup

```bash
# 1. Install dependencies (root + server + client)
npm run install:all

# 2. Seed the database
npm run seed

# 3. Start server + client concurrently
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001/api/v1

### Test Credentials (password: `Test1234!`)

| Role | Email | Profile |
|------|-------|---------|
| Patient 1 | patient@test.com | Γιώργος — Hypertension / Prediabetes |
| Patient 2 | patient2@test.com | Ελένη — PCOS / Anxiety / Migraine |
| Patient 3 | patient3@test.com | Νίκος — T2DM / Hypertension / Knee OA |
| Doctor | doctor@test.com | Δρ. Παπαδόπουλος — Cardiology |

---

## Seeded Data

Running `npm run seed` populates BuildathonDB with:

| Collection | Count | Details |
|-----------|-------|---------|
| Doctors | 39 | All major specialties, Greek names, Athens/Thessaloniki locations |
| Q&A entries | 78 | 2 doctor answers each, all specialties, in Greek |
| Patients | 3 | Full profiles, 120 days of health metrics, family members |
| Appointments | 38 | Past + upcoming, 9 with doctor notes |
| Medications | 28 | Active/inactive, with prescribing doctor |
| Test Results | 14 | Structured values with AI explanations |
| Assistant Sessions | 6 | 2 sessions per patient with realistic Greek conversations |
| Reminders | 10 | Daily medication reminders + upcoming appointment alerts |
| Med Documents | 6 | Blood tests, MRIs, hormone panels with AI summaries |

---

## Feature Overview

### Home Dashboard (`/`)
- Upcoming appointment cards
- Pre-appointment briefing banner (amber card 24h before any confirmed appointment — one-tap to AI)
- **AI Health Suggestions card** — generates 3 personalised insight cards via Claude Haiku, cached 6 hours; previous suggestions persist in `localStorage` with timestamp
- Blood pressure chart (Recharts)
- Quick-action search bar + Medical Assistant shortcut

### Search & Doctor Discovery (`/search`)
- Keyword search across doctors and Q&A corpus
- Doctor cards with specialty match score
- Q&A results column alongside doctor results
- **Slide-in drawer** — clicking a doctor opens a full profile panel (availability, specialties, CV, stats) without leaving the page
- Slot pre-selection from drawer feeds directly into the booking modal
- Auto-search on `?q=` URL parameter (supports redirects from other parts of the app)

### Medical Assistant (`/assistant`)
- Full-screen SSE streaming chat grounded in the patient's actual health data
- **Sessions sidebar** — past conversations listed with their first message as title; click to reload; "Νέα Συνομιλία" creates a fresh session only if current has messages
- Source pills on AI messages — click to open a modal with the full Q&A thread (question + all doctor answers, best answer badge, votes)
- **Booking flow** — when AI recommends a specialist, a booking card appears with two options:
  - *Προηγούμενοι γιατροί* — expandable list merging saved doctors + past appointment doctors (deduplicated)
  - *Αναζήτηση γιατρού* — redirects to `/search?q=<specialty+service>` with results pre-loaded
- Confidence score badge per AI message (green ≥ 0.85, yellow ≥ 0.70, red below)
- Health memory: after each session, Claude Haiku extracts new health facts and updates `aiContext.healthSummary` for continuity across sessions

### Assistant Popup (all pages)
- Fixed bottom-right chat bubble (`AssistantPopup`) available from every page via `Layout`
- Independent message state from the full assistant page
- Auto-sends a pre-composed prefill when opened from a contextual button
- Header links to the full `/assistant` view; minimise toggle

### Health Records (`/health-records`)
Three-tab page — **💊 Φάρμακα · 🔬 Εξετάσεις · 📁 Έγγραφα**

- **Medications tab:** card grid, "why am I taking this" accordion (AI-powered), add/delete; "🧠 Medical Assistant" button per medication opens the popup with a pre-composed question about that drug
- **Test Results tab:** structured table with status badges, AI explanations, file attachments per result; "🧠 Medical Assistant" button sends actual values automatically
- **Documents tab:** medical document vault — upload zone UI, file list with AI summaries and sharing status

### Appointments / Health History (`/appointments`)
Four tabs: **Επερχόμενα · Προηγούμενα · Όλα · 📊 Γράφημα**

- Each appointment card shows: doctor, service, date, status, patient notes, doctor notes (if present), diagnosis, prescriptions
- Cancel upcoming appointments
- Graph tab: stacked bar chart of appointments by month + horizontal dot timeline
- Notes added at booking time are saved and displayed

### Family Hub (`/family`)
- Family member cards with conditions, medications, notes
- **Tabbed add/edit modal** — Profile tab (name, relation, DOB, gender, height, weight, blood type) + Clinical tab (conditions, allergies, medications, notes)
- No pre-selected conditions on creation
- Switching active family member scopes AI context to that member

### Metrics (`/metrics`)
- Historical health metric charts (blood pressure, glucose, weight, steps, heart rate, sleep)
- Manual metric entry

### Settings (`/settings`)
- Profile edit form, notification preferences, language, budget range

---

## AI Features in Depth

### 1. Persistent Health Memory
After every assistant session, a Claude Haiku call extracts new health facts from the conversation and stores them as a rolling `healthSummary` on the patient document. Injected into every future session's system prompt.

### 2. Proactive Dashboard Insights
`GET /patient/insights` calls Claude Haiku to generate 3 personalised insight cards (trend / alert / recommendation) based on abnormal test values, upcoming appointments, medications, and conditions. Results cached in `patient.cachedInsights` for 6 hours.

### 3. Streaming RAG Assistant
The assistant endpoint retrieves relevant Q&A documents from MongoDB text search, builds a context-rich system prompt (conditions, allergies, active medications, upcoming appointments, health summary), and streams the response via SSE. Source attribution included per message.

### 4. AI Summaries on Demand
- "Why am I taking this?" — medication explanation via `/medications/:id/explain`
- Test result AI explanation — per-value interpretation
- Pre-appointment question preparation — uses appointment service + patient history

---

## Project Structure

```
medplatform/
├── client/                   # React frontend (Vite)
│   └── src/
│       ├── pages/            # Route-level components
│       ├── components/       # Shared UI (AssistantPopup, BookAppointmentModal, …)
│       ├── store/            # Zustand stores (auth, assistant, suggestion, family)
│       └── api/              # React Query hooks + axios client
├── server/                   # Express backend
│   └── src/
│       ├── models/           # Mongoose models
│       ├── routes/           # Express route handlers
│       ├── middleware/        # Auth, error handling
│       └── scripts/
│           ├── seed.ts       # Database seed script
│           └── database/     # JSON seed data files
└── package.json              # Root scripts (dev, seed, install:all)
```

---

## API Reference

```
POST   /api/v1/auth/login
POST   /api/v1/auth/register
POST   /api/v1/auth/refresh

GET    /api/v1/patient/me
GET    /api/v1/patient/dashboard
GET    /api/v1/patient/insights          # AI-generated, cached 6h
GET    /api/v1/patient/timeline
POST   /api/v1/patient/metrics
GET    /api/v1/patient/metrics/:type
GET    /api/v1/patient/saved-doctors

GET    /api/v1/family
POST   /api/v1/family
PUT    /api/v1/family/:id
DELETE /api/v1/family/:id

POST   /api/v1/assistant/message         # SSE stream
GET    /api/v1/assistant/sessions
GET    /api/v1/assistant/sessions/:id
POST   /api/v1/assistant/prefill

POST   /api/v1/search
GET    /api/v1/search/suggestions

GET    /api/v1/doctors/:id
GET    /api/v1/doctors/:id/availability
GET    /api/v1/doctors/:id/qna

GET    /api/v1/appointments?status=upcoming|past|all
POST   /api/v1/appointments
PATCH  /api/v1/appointments/:id/notes
PATCH  /api/v1/appointments/:id/doctor-notes
PUT    /api/v1/appointments/:id/cancel

GET    /api/v1/medications
POST   /api/v1/medications
DELETE /api/v1/medications/:id
GET    /api/v1/medications/:id/explain   # AI explanation

GET    /api/v1/results
GET    /api/v1/results/:id
POST   /api/v1/results/:id/files
DELETE /api/v1/results/:id/files/:fileIndex

GET    /api/v1/qna/search?q=
GET    /api/v1/qna/:id

GET    /api/v1/reminders
POST   /api/v1/reminders
PATCH  /api/v1/reminders/:id/acknowledge

GET    /api/v1/vault
POST   /api/v1/vault/upload
DELETE /api/v1/vault/:id
```

---

## Known Limitations / Out of Scope

| Feature | Status | Note |
|---------|--------|------|
| Vector embeddings (Voyage-3) | Skipped | MongoDB text search used |
| pgvector / Pinecone | Skipped | Not required for POC |
| Redis | Skipped | Not required for POC |
| File storage (S3/Multer) | UI only | Vault upload UI exists; no actual file storage |
| Google OAuth | Skipped | Standard JWT auth |
| SMS / Email delivery | Skipped | Reminder records stored; sending not wired |
| OCR for test results | Skipped | Manual entry only |
| Doctor-side portal | Skipped | Doctor accounts exist; dashboard not built |
| Payment flow | Placeholder | `/payments` page is a stub |
