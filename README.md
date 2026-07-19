# 🏥 MediFlow: Application Architecture & High-Level Design

## 1. Executive Summary
MediFlow is an AI-powered healthcare navigation and patient care coordination agent designed to eliminate fragmented care. By orchestrating complex, multi-modal medical data into a seamless longitudinal timeline, MediFlow assists patients in managing their health journey and empowers doctors with transparent, AI-summarized insights. 

## 2. Role-Based Access Control (RBAC) Architecture
The system is divided into three isolated portals to ensure data privacy, operational efficiency, and secure system design:

*   **Patient Portal (Consumer):** Allows patients to upload documents, track their health timeline, schedule appointments, and interact with a multilingual AI companion. *(Access is strictly isolated to the user's personal data).*
*   **Doctor Portal (Expert):** Provides clinical evaluators with rapid AI summaries of patient histories before consultations. Includes the XAI Source Ledger for verifying AI-extracted medical claims. *(Access is restricted to assigned patient records).*
*   **Hospital Admin Portal (Operator):** Displays macro-level dashboards tracking operational efficiency, appointment bottlenecks, and patient compliance. *(Access is restricted to anonymized, aggregate data only).*

## 3. High-Level System Architecture (Modular Monolith)

### A. Frontend Layer (Next.js + React + Tailwind CSS)
*   **Patient UI:** Document upload zones, interactive journey dashboards, and a conversational interface.
*   **Doctor UI:** Clinical summary views, historical timelines, and the XAI Source Ledger modal.
*   **Admin UI:** Analytics dashboards rendering hospital-wide operational metrics.

### B. API & Tooling Layer (FastAPI / Python)
*   **Document Router:** Handles secure intake of raw PDFs and images from the frontend.
*   **Analytics Aggregator:** Computes hospital-level metrics (e.g., missed follow-up rates).
*   **Agent Tools:** External capabilities exposed to the AI agent:
    *   `Scheduling API`: Fetches doctor availability and books slots.
    *   `Facility Locator`: Uses mapping tools to find nearby pharmacies or emergency rooms.
    *   `Notification Engine`: Triggers personalized alerts based on timeline logic.

### C. Cognitive Agent Layer (LangGraph State Machine)
*   **Ingestion Node:** Utilizes Multimodal LLMs for OCR and JSON data extraction from medical files.
*   **Semantic Reconciliation Node:** Cross-references data to detect drug-to-drug conflicts and duplicate prescriptions.
*   **Triage & Routing Node:** Analyzes symptoms to recommend specific specialists or departments.
*   **Care-Gap Tracker Node:** Monitors the longitudinal timeline for missed appointments and missing test results.
*   **Conversational Node:** Translates medical jargon into simple, preferred languages and manages context memory.

### D. Persistence Layer (SQLite / SQLAlchemy)
*   **PatientData:** Core user profiles, demographics, and language preferences.
*   **ClinicalData:** Uploaded documents, extracted medications, and diagnostic histories.
*   **OpsData:** Appointment records, doctor schedules, and facility locations.
*   **MetaData:** ExtractedFacts (for XAI tracking) and Hospital Metrics logs.

## 4. Core Features & Requirement Mapping
The architecture natively solves all core requirements via specialized agentic workflows:

1.  **Document Ingestion:** Patients upload prescriptions and discharge summaries via the Frontend Router.
2.  **AI Extraction & Timeline:** The Ingestion Node parses structured data from uploads to build the longitudinal timeline.
3.  **Conflict & Gap Detection:** 
    *   *Semantic Reconciliation Engine:* Analyzes embeddings to detect duplicate or conflicting prescriptions.
    *   *Proactive Care-Gap Tracker:* Identifies missed follow-up appointments and prompts rescheduling.
4.  **Triage & Routing:** The Triage Node recommends the appropriate specialist based on current symptoms and history.
5.  **Smart Scheduling:** The agent interacts with the Scheduling API to book appointments based on urgency and doctor availability.
6.  **Personalized Reminders:** The Notification Engine dispatches alerts for medications, vaccinations, diagnostic tests, and upcoming visits.
7.  **Multilingual Explanations:** The Conversational Node translates complex medical terminology into simple, preferred languages.
8.  **Facility Locator:** The agent triggers the Facility Locator Tool to map nearby diagnostic centers, pharmacies, and emergency rooms.
9.  **Patient Journey Dashboard:** The frontend visually renders completed consultations, pending appointments, active medications, upcoming follow-ups, and diagnostic history.
10. **Doctor Clinical Summary & Verification:** Doctors access an AI-generated history prior to consultations, fortified by the *XAI Source Ledger*, which links every extracted fact back to the original document snippet.
11. **Hospital Analytics:** The Admin portal visualizes missed follow-up rates, appointment bottlenecks, patient compliance, and average treatment timelines.

## 5. Technology Stack Summary
*   **Frontend Ecosystem:** Next.js (TypeScript), Tailwind CSS, Shadcn UI, Recharts
*   **Backend Framework:** FastAPI (Python)
*   **Database & ORM:** SQLite, SQLAlchemy
*   **AI Orchestration:** LangGraph, LangChain Core, Multimodal LLM APIs