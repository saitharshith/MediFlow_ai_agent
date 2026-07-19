# Product Requirement Document: MediFlow

**Version:** 2.0 (hackathon build scope)
**Date:** July 2026
**Constraint:** Built in the provided hackathon IDE using Claude Haiku 4.5 only.

---

## Product Name

MediFlow

## Summary

An AI-powered healthcare navigation and patient care coordination agent designed to eliminate fragmented care, organize patient journeys, and assist both patients and doctors while maintaining transparency and accountability.

MediFlow turns scattered prescriptions, diagnostic reports and discharge summaries into a single longitudinal timeline **and knowledge graph**. Every AI-extracted fact is traceable to the document line it came from, and every doctor's access to a record is consented via OTP and logged where the patient can see it.

## What Changed From v1

| Change | Reason |
| --- | --- |
| Knowledge-graph view added alongside the timeline | The living graph of visits → medicines → conditions → tests is the memorable differentiator; a timeline alone looks like every other submission |
| OTP consent + patient-visible access log added | The problem statement explicitly asks for "transparency and accountability"; v1 had roles but no consent flow |
| XAI Source Ledger promoted to a core capability | Every extracted fact stores its source snippet and is clickable back to the original document |
| Mini-evaluation set added as a deliverable | 10 hand-labelled prescriptions → a measured accuracy number; almost no hackathon team measures anything |
| Scheduling + notifications demoted to thin/mocked | Booking infrastructure is not judged; visible behaviour is |
| Agent = plain tool-calling loop (not a state-machine framework) | Smaller model, shorter build, same agentic story |

---

## Target Users

* **Patient:** Needs to manage medical documents, view their care timeline and graph, schedule appointments, receive simple multilingual explanations of their health data, and **see who accessed their records**.
* **Doctor:** Needs access to a rapid, highly accurate AI-generated summary of a patient's history before consultations, backed by verifiable source documents.
* **Hospital Administrator:** Needs aggregate, anonymised hospital-level analytics on operational efficiency and patient compliance.

---

## Core Capabilities (Scope)

Each capability lists its **priority**: `P0` = demo fails without it, `P1` = strongly expected by the rubric, `P2` = nice-to-have / mock acceptable.

### P0 — Must work end to end

1. **Document Ingestion** — Allow patients to upload prescriptions, diagnostic reports, discharge summaries, and medical history (image or PDF).
2. **AI Extraction & Timeline** — Extract structured information from medical documents using multimodal OCR/AI (one vision call returning a forced JSON tool schema) to build a longitudinal patient timeline showing consultations, medications, tests, and treatments.
3. **Knowledge Graph View** *(new)* — Render the patient's history as a navigable graph: visits, doctors, medications, conditions, and tests as nodes; prescriptions and follow-ups as edges. The graph is the primary visual artifact of the demo.
4. **Conflict & Gap Detection** — Detect duplicate medications (via RxNorm name normalisation, so brand and generic names collapse), conflicting prescriptions (via a locally loaded DDInter interaction table), and missed follow-up appointments (overdue dates with no subsequent visit).
5. **XAI Source Ledger** *(new, core)* — Every extracted fact is stored with `source_document_id` + the exact quoted snippet. In the doctor portal, clicking a fact opens the original document with that line highlighted. No unverifiable AI claims.
6. **Consent & Access Log** *(new)* — A doctor may open a patient record only after entering a 6-digit OTP issued by that patient. Sessions expire after 30 minutes. Every access is written to an audit log that the patient can view in their own portal.
7. **Doctor Clinical Summary** — Allow doctors to access an AI-generated ~10-line summary of patient history before consultations, with each claim linked through the Source Ledger.
8. **Patient Dashboard** — Generate a personalized treatment journey dashboard showing: completed consultations, pending appointments, active medications, upcoming follow-ups, and diagnostic history.

### P1 — Expected by the rubric

9. **Multilingual Translation** — Provide multilingual explanations of prescriptions and medical terminology in simple language (Bhashini API for 22 Indian languages, with the LLM itself as a zero-integration fallback).
10. **Triage & Routing** — Recommend the appropriate specialist or department based on symptoms and medical history. Output is a *department suggestion with reasoning*, never a diagnosis, and carries a visible disclaimer.
11. **Hospital Analytics** — Generate hospital-level analytics showing: missed follow-up rates, appointment bottlenecks, patient compliance, and average treatment timelines. Seeded with synthetic patients (Synthea) so the dashboard is populated, and computed over anonymised aggregates only.
12. **Facility Locator** — Help patients locate nearby diagnostic centers, pharmacies, and emergency facilities (Overpass/OpenStreetMap query + Leaflet map).

### P2 — Thin or mocked is acceptable

13. **Smart Scheduling** — Help patients schedule appointments based on doctor availability and urgency. A slots table in SQLite is sufficient; a real booking backend is out of scope.
14. **Notification Engine** — Send personalized reminders for medications, vaccinations, diagnostic tests, and follow-up visits. The reminder *logic* (what is due, when) is real and derived from the timeline; delivery is demonstrated with one live push (ntfy.sh) rather than production SMS/email infrastructure.

---

## Functional Requirements by Role

### Patient Portal

* Upload documents; see extraction results before they are committed.
* View timeline and knowledge graph of their full history.
* See red flags: duplicate medicines, drug conflicts, overdue follow-ups.
* Tap any medical term or prescription for a plain-language explanation in their chosen language.
* Generate a 6-digit OTP to grant a doctor time-limited access.
* View the access log: who viewed the record, when, and for how long.
* Find nearby pharmacies, labs, and emergency facilities.

### Doctor Portal

* Enter patient ID + OTP to open a 30-minute session.
* Read the AI pre-consultation summary; click any fact to see its source snippet.
* Browse the full timeline and graph.
* Cannot access any record without an active consented session.

### Hospital Admin Portal

* Missed follow-up rate, appointment bottlenecks, patient compliance, average treatment timelines.
* Aggregate and anonymised only — no individual patient record is reachable from this portal.

---

## Data Requirements

| Store | Holds |
| --- | --- |
| `patients` | Profile, language preference |
| `documents` | Uploaded file, type, upload date |
| `extracted_facts` | Field, value, `source_document_id`, quoted snippet (powers the Source Ledger) |
| `medications` | Drug, normalised RxCUI, dose, prescriber, start/end dates |
| `appointments` | Scheduled, completed, missed; follow-up due dates |
| `flags` | Duplicate / conflict / care-gap, with the facts that triggered them |
| `access_log` | Doctor, patient, timestamp, session duration |
| `interactions` | DDInter pairs loaded once, queried locally (works offline) |

---

## Success Criteria (Mini-Evaluation)

Measured against a hand-labelled golden set of 10 test prescriptions.

| Metric | Target |
| --- | --- |
| Field extraction accuracy (drug, dose, date, doctor) | ≥ 90% |
| Known drug-conflict pairs detected | 5 / 5 |
| False-positive flags on clean records | 0 |
| Every displayed AI fact traceable to a source snippet | 100% |
| Doctor summary rated useful by a practising doctor | Yes (ask one) |

---

## Non-Goals

* MediFlow is **NOT a diagnostic engine.** It does not independently diagnose diseases or prescribe new medications without doctor intervention.
* It does not replace ABDM/ABHA national infrastructure — it is designed to sit compatibly alongside it.
* It does not provide production-grade notification delivery, payment, or insurance claim processing.
* It does not surface individual patient data through the analytics portal under any circumstance.

---

## Constraints & Assumptions

* Built with Claude Haiku 4.5 in the provided hackathon IDE; scope is deliberately trimmed so the build finishes.
* Single FastAPI application serving the frontend; SQLite for persistence.
* All external APIs used are free or open source (RxNorm, DDInter, openFDA, Bhashini, Overpass, ntfy.sh, Synthea).
* Demo data is synthetic. No real patient data is used at any point.
