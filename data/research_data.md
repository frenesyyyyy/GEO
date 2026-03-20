# 📊 RESEARCH DATA — Shared Agent State
**Last Updated:** 2026-03-19 22:00
**Written by:** All agents
**Read by:** Architect (every session start)

> ⚠️ This is the SINGLE SOURCE OF TRUTH for agent coordination.
> All agents MUST check this file before starting work.
> All agents MUST update their status row after completing work.

---

## 🤖 Agent Status Board

| Agent | Status | Current Task | Last Updated | Notes |
|---|---|---|---|---|
| Architect | `IDLE` | — | 2026-03-19 | Awaiting first session |
| Prospector | `DONE` | — | 2026-03-19 | Ready for first batch of 5 |
| Researcher | `IN_PROGRESS` | — | 2026-03-20 | Auditing #002: Studio Notarile Bianca Dell'Onte |
| Learner | `IDLE` | — | 2026-03-19 | Next run: 2026-03-26 |
| Designer | `BLOCKED` | — | 2026-03-19 | Waiting for 3+ audits |

**Status Values:** `IDLE` | `PENDING` | `IN_PROGRESS` | `DONE` | `BLOCKED`

---

## 🏢 Business Audit Queue

| # | Business Name | Website | District | Category | Source | Status |
|---|---|---|---|---|---|---|
| 001 | _(Prospector will populate this)_ | — | — | — | — | `AWAITING` |
| 002 | Studio Notarile Bianca Dell'Onte | notaiodellonte.it | Prati | Notaio | Google Maps | PENDING |
| 003 | Studio Legale Parioli | studiolegaleparioli.com | Parioli | Avvocato | Google Maps | PENDING |
| 004 | Clinic Medical Beauty // Prati | clinicmedicalbeauty.it | Prati | Chirurgo Estetico | Google Maps | PENDING |
| 005 | Studio Legale Santiapichi | studiolegalesantiapichi.it | Parioli | Studio Legale | Google Maps | PENDING |
| 006 | Monti Parioli Medical | montipariolimedical.it | Parioli | Medico Estetico | Google Maps | PENDING |

**Status Values:** `PENDING` | `IN_PROGRESS` | `AUDITED` | `SKIPPED`

---

## 📋 Audit Reports


### Report Template (copy for each audit)
```markdown
### Audit: [Business Name] — [DATE]
- **AI Accuracy Score:** [0-100]
- **Hallucinations Found:** [COUNT]
- **Worst Offender:** [ChatGPT / Perplexity / Google AI]
- **Critical Issues:**
  - 
- **Recommended Fixes:**
  - 
  
#### Delta Table
| Field | Official | ChatGPT | Perplexity | Google AI | Hallucination? |
|---|---|---|---|---|---|
| Address | | | | | |
| Hours | | | | | |
| Phone | | | | | |
| Services | | | | | |
```

---

## 🏛️ Architect Log

| Date | Action | Agent Assigned | Task | Reason | Result |
|---|---|---|---|---|---|
| 2026-03-19 | Workspace initialized | — | Setup complete | Initial creation | ✅ |

---

## 🧭 Learner Log

| Date | Trigger | Track | New Factors | Patterns Updated | Status |
|---|---|---|---|---|---|
| 2026-03-19 | Initial seed | All tracks | 7 confirmed, 4 experimental | 4 patterns seeded | `DONE` |

---

## 🎨 Designer Log

| Date | Action | Pages Updated | Data Rows Available | Status |
|---|---|---|---|---|
| 2026-03-19 | Waiting for data | — | 0 | `BLOCKED` |

---

## 🕵️ Prospector Log

| Date | Batch # | Businesses Found | Districts | Sources Used | Status |
|---|---|---|---|---|---|
| 2026-03-19 | Batch #1 | 5/5 businesses found | Sources: Google Maps, Search | DONE |

---

## 📈 KPI Summary (Auto-updated by Architect each session)

| Metric | Value |
|---|---|
| Total Businesses Audited | 0 |
| Average AI Accuracy Score | — |
| Total Hallucinations Found | 0 |
| Most Common Hallucination Pattern | — |
| GEO Ranking Factors Catalogued | 11 |
| Brain Last Updated | 2026-03-19 |
