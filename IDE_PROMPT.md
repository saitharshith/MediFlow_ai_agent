# MediFlow — Master Build Prompt (for the IDE agent)

Copy everything below this line into the IDE agent.

---

You are building **MediFlow**, an AI healthcare navigation and care-coordination app, for a hackathon. Read this ENTIRE prompt before writing any code. Follow the milestones strictly in order — never skip ahead, never build two milestones at once.

## Mission

Patients upload prescriptions/reports → AI extracts structured facts → the app builds a longitudinal timeline AND a knowledge graph, detects duplicate/conflicting medications and missed follow-ups, and gives doctors an OTP-consented, source-verified summary. Three portals: Patient, Doctor, Hospital Admin. The app **never diagnoses**.

## Hard rules (apply to every milestone)

1. **One milestone at a time.** Finish, run, verify the acceptance check, THEN move on. Never leave the app unbootable at the end of a milestone.
2. **First action of the project:** create `SPEC.md` (database schema, API routes, extraction JSON schema) and the `vault/` folder (see rule 8). Re-read `SPEC.md` at the start of every session. Any schema change must be recorded in `SPEC.md` and noted in the vault.
3. **Use the stack already configured in this project** (Next.js + TypeScript + Tailwind, the provided PostgreSQL database via Prisma). Do NOT add LangGraph, LangChain, or any new framework. New dependencies only if listed in this prompt.
4. **All AI calls return strict JSON.** Define the JSON schema in the prompt, validate the response, retry once on parse failure. Extraction uses the provided multimodal LLM integration (image → JSON in one call).
5. **Free APIs only.** Use: RxNorm REST API (drug-name normalization), a local DDInter CSV loaded into an `interactions` table (drug-conflict lookup — offline, instant), Overpass API + Leaflet (facility locator), the LLM itself for translation/simple-language explanations (Bhashini optional), ntfy.sh (one real push notification). **Mock:** SMS/email (do NOT wire Twilio/SendGrid), Google Maps (use Leaflet + OpenStreetMap instead), payments. The app must run with zero paid API keys beyond the provided LLM.
6. **Traceability:** every AI-extracted fact is stored with `source_document_id` + the exact quoted snippet it came from. This powers the Source Ledger.
7. **Safety:** triage/specialist suggestions always carry a visible "This is guidance, not a diagnosis" disclaimer.
8. **Documentation ritual — MANDATORY after EVERY milestone:** update the Obsidian vault in `vault/`:
   - One markdown note per feature/decision (`vault/<feature-name>.md`) — what it does, why, key files. Link related notes with `[[wikilinks]]` (e.g. `[[extraction]]`, `[[rules-engine]]`). Link densely; keep note names stable — a graph tool (Graphify) renders this vault, so the links ARE the documentation.
   - Update `vault/INDEX.md` (one line per note) and `vault/BUILDLOG.md` (date, what was built, what works, what is mocked, shortcuts taken).
   - Never finish a milestone without the vault update.

## Data model (Prisma schema)

`patients` (profile, language_pref) · `documents` (file, type, uploaded_at) · `extracted_facts` (field, value, source_document_id, quote) · `medications` (name, rxcui, dose, prescriber, start_date, end_date) · `appointments` (date, status, follow_up_due) · `flags` (type: duplicate | conflict | care_gap, linked fact ids, severity) · `access_log` (doctor_id, patient_id, timestamp) · `otp_sessions` (code, patient_id, expires_at) · `interactions` (drug_a, drug_b, severity) — seeded from DDInter.

## Milestones

**M0 — Foundation.** `SPEC.md`, `vault/` with INDEX + BUILDLOG, Prisma schema migrated, seed script: 3 demo patients with history, 1 doctor, 1 admin, and ≥200 DDInter interaction pairs (MUST include warfarin+aspirin). ✅ Check: app boots, DB seeded.

**M1 — Vertical slice (the spine).** Patient uploads a prescription image/PDF → LLM vision call extracts strict JSON (medications, diagnosis, dates, doctor, tests — each field with its source quote) → facts saved → timeline page renders the history. ✅ Check: upload 2 sample prescription images; extracted facts and timeline are correct.

**M2 — Rules engine.** On every new document: (a) duplicate meds — normalize names via RxNorm API, fallback to lowercase string match if API fails; (b) conflicts — query the local `interactions` table; (c) care gaps — `follow_up_due` in the past with no later appointment. Write `flags`; show red alert banners on the patient dashboard. ✅ Check: the seeded warfarin+aspirin patient shows a conflict flag with both source prescriptions.

**M3 — Doctor portal + consent.** Patient generates a 6-digit OTP (valid 30 min). Doctor enters patient ID + OTP → sees a 10-line AI summary of the history. Every claim in the summary is clickable → **Source Ledger** modal: the original document with the quoted line highlighted. Every access is written to `access_log` and visible on the patient's dashboard ("Dr. X viewed your record at HH:MM"). No OTP → no access, ever. ✅ Check: full OTP flow works; ledger opens the right document; access appears on patient screen.

**M4 — Patient extras.** (a) Knowledge-graph view: visits, doctors, medications, conditions, tests as nodes, prescriptions/follow-ups as edges — use react-force-graph or cytoscape.js (this is the demo centerpiece, make it look alive); (b) "Explain in my language" button on any prescription — simple-language explanation, language dropdown incl. Hindi and Telugu (LLM call); (c) facility locator — Leaflet map + Overpass query for `amenity=pharmacy|hospital|clinic` near the user; (d) reminders panel computed from the timeline + one "Send test reminder" button that fires a real ntfy.sh push. ✅ Check: graph renders and is clickable; explanation comes back in the chosen language; map shows real nearby results.

**M5 — Admin analytics.** Aggregate-only dashboard: missed follow-up rate, appointment bottlenecks (appointments per doctor per week), patient compliance %, average treatment timeline. Use the chart library already in the stack. No route from this portal can reach an individual patient record. ✅ Check: numbers reconcile with the seed data.

**M6 — Polish + evaluation.** Landing page routing to the 3 portals; "MediFlow assists navigation — it does not diagnose" disclaimer in the footer of every page; graceful error states (failed extraction, expired OTP). Create `eval/golden_set/` with 10 test prescriptions + expected JSON, and `eval/run_eval` script that prints an accuracy table (field extraction %, conflicts caught, false positives). Record results in `vault/BUILDLOG.md`. ✅ Check: eval script runs and prints the table.

## If stuck

Same error twice → stop, simplify the approach (smaller scope, plainer code), note the shortcut in `vault/BUILDLOG.md`, move on. A working simple feature always beats a broken fancy one.
