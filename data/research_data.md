# 📊 RESEARCH DATA — Shared Agent State
**Last Updated:** 2026-03-20
**Written by:** All agents
**Read by:** Architect (every session start)

> ⚠️ This is the SINGLE SOURCE OF TRUTH for agent coordination.
> All agents MUST check this file before starting work.
> All agents MUST update their status row after completing work.

---

## 🤖 Agent Status Board

| Agent | Status | Current Task | Last Updated | Notes |
|---|---|---|---|---|
| Architect | `IDLE` | — | 2026-03-20 | V4 Deep Scrape Audit |
| Prospector | `IDLE` | — | 2026-03-20 | Ready for clean V4 batch |
| Researcher | `IDLE` | — | 2026-03-20 | Full batch complete. |
| Learner | `IDLE` | — | 2026-03-20 | Resetting after V4 Nuke |
| Designer | `IDLE` | — | 2026-03-20 | Waiting for V4 audits |

**Status Values:** `IDLE` | `PENDING` | `IN_PROGRESS` | `DONE` | `BLOCKED`

---

## 🏢 Business Audit Queue

| # | Business Name | Website | District | Category | Source | Status |
|---|---|---|---|---|---|---|
| 001 | _(Prospector will populate this)_ | — | — | — | — | `AWAITING` |

| 002 | Oliver & Partners | http://oliverpartners.it/ | Prati | Studio Legale | Overpass/OSM | AUDITED |
| 003 | Studio Legale Martone & Martone | — | Prati | Studio Legale | Overpass/OSM | AUDITED |
| 004 | Studio Legale Avv. Mario Sabatino | https://www.sabatino.pro | Prati | Studio Legale | Overpass/OSM | AUDITED |
| 005 | ROMEXPRESS S.r.l. | https://www.romexpress.it/ | Prati | Studio Legale | Overpass/OSM | AUDITED |
**Status Values:** `PENDING` | `FIX_GENERATED` | `AUDITED` | `IN_PROGRESS` | `AUDITED` | `SKIPPED`

---

## 📋 Audit Reports

### Audit: Oliver & Partners — 2026-03-20
- **AI Accuracy Score:** 66/100
- **Hallucinations Found:** 1
- **Worst Offender:** Web Search / Aggregators
- **Category:** Studio Legale | **District:** Prati
- **Model Used:** gemma3:4b (local Ollama — $0)
- **Audit Duration:** 233.3s
- **Critical Issues:**
  - 1 hallucination(s) found in AI internal knowledge vs official site.
- **Recommended Fixes:**
  - Update Schema.org markup, ensure consistent NAP across aggregators.

#### Delta Table
| Field | Official (Website) | AI Internal Knowledge | Perplexity | Google AI | Hallucination? |
|---|---|---|---|---|---|
| Address | Piazza Capranica, Rome, Italy | Viale delle Milizie 96, Int. 11, 00192 Rome | Viale delle Milizie 96, Int. 11, 00192 Rome [✅] | — | — | ✅ |
| Hours | Not mentioned | Mo.-Fr. 08:00-17:00 [—] | — | — | — |
| Phone | + 39 (06) 69404910 | + 39 (06) 69 40 49 10 [✅] | — | — | ✅ |
| Services | Constitutional Court ruling on Italian Citizenship | Inheritance and the “Sistema Tavolare” in Northern Italy | Prenuptial agreements have long been a widely discussed topic in Italy and have traditionally not been considered enforceable in the courts. Likewise, spousal agreements that... | provides assistance legal complete to clients international in matter of law corporate and commercial in Italy. Their services include the advice to clients commercial italian and international, that go from workers autonomous to small and medium enterprises. [❌] | — | — | ❌ |


### Audit: Studio Legale Martone & Martone — 2026-03-20
- **AI Accuracy Score:** 50/100
- **Hallucinations Found:** 1
- **Worst Offender:** Web Search / Aggregators
- **Category:** Studio Legale | **District:** Prati
- **Model Used:** gemma3:4b (local Ollama — $0)
- **Audit Duration:** 68.4s
- **Critical Issues:**
  - 1 hallucination(s) found in AI internal knowledge vs official site.
- **Recommended Fixes:**
  - Update Schema.org markup, ensure consistent NAP across aggregators.

#### Delta Table
| Field | Official (Website) | AI Internal Knowledge | Perplexity | Google AI | Hallucination? |
|---|---|---|---|---|---|
| Address | Lungotevere Arnaldo da Brescia 11, 00196 - ROMA | Via della Conciliazione, 44, Roma [❌] | — | — | ❌ |
| Hours | Not mentioned | Not mentioned [—] | — | — | — |
| Phone | +39 06 6861671 | 06686... [✅] | — | — | ✅ |
| Services | Not mentioned | Legal services provided by Thomas Martone, experience from CONI, Federazione Italiana Pallavolo and Federazione Italiana Pallacanestro. [—] | — | — | — |


### Audit: Studio Legale Avv. Mario Sabatino — 2026-03-20
- **AI Accuracy Score:** 0/100
- **Hallucinations Found:** 0
- **Worst Offender:** NONE
- **Category:** Studio Legale | **District:** Prati
- **Model Used:** gemma3:4b (local Ollama — $0)
- **Audit Duration:** 71.2s
- **Critical Issues:**
  - None detected.
- **Recommended Fixes:**
  - Update Schema.org markup, ensure consistent NAP across aggregators.

#### Delta Table
| Field | Official (Website) | AI Internal Knowledge | Perplexity | Google AI | Hallucination? |
|---|---|---|---|---|---|
| Address | Not mentioned | Piazza del Risorgimento, 14, Roma [—] | — | — | — |
| Hours | Not mentioned | Not mentioned [—] | — | — | — |
| Phone | Not mentioned | Numero di Telefono [—] | — | — | — |
| Services | Not mentioned | Assistenza per lo più le persone e le piccole e medie imprese. Sono iscritto nell'elenco degli avvocati che forniscono assistenza con il patrocinio a spese dello Stato (gratuito patrocinio). [—] | — | — | — |


### Audit: ROMEXPRESS S.r.l. — 2026-03-20
- **AI Accuracy Score:** 0/100
- **Hallucinations Found:** 1
- **Worst Offender:** Web Search / Aggregators
- **Category:** Studio Legale | **District:** Prati
- **Model Used:** gemma3:4b (local Ollama — $0)
- **Audit Duration:** 110.3s
- **Critical Issues:**
  - 1 hallucination(s) found in AI internal knowledge vs official site.
- **Recommended Fixes:**
  - Update Schema.org markup, ensure consistent NAP across aggregators.

#### Delta Table
| Field | Official (Website) | AI Internal Knowledge | Perplexity | Google AI | Hallucination? |
|---|---|---|---|---|---|
| Address | Not mentioned | Via Paolo Mercuri, 8, Roma [—] | — | — | — |
| Hours | Not mentioned | Not mentioned [—] | — | — | — |
| Phone | Not mentioned | 06 3230345 [—] | — | — | — |
| Services | Ordine da inviare | Preventivo da inviare | Ufficio Immigrazione | Tribunale Civile e Penale | Conservatoria Registri Immobiliari | Camera di Commercio | Procura Repubblica | Archivio Notarile | Ufficio Notifiche | Poligrafico Stato | Registro Stampa Giornali Quotidiani e Periodici | SERVIZI CONSOLARI | SERVIZI DIGITALI | CROCIERE ALTRE COMPAGNIE | Pratiche Certificati e Visti Consolari, Agenzia Pratiche Amministrative Visti Consolari, Certificati e Pratiche - Agenzie Roma [❌] | — | — | ❌ |


### Report Template (copy for each audit)
```markdown
### Audit: [Business Name] — [DATE]
- **AI Accuracy Score:** [0-100]
- **Hallucinations Found:** [Count]
- **Worst Offender:** [Source Name]
- **Category:** [Category] | **District:** [District]
- **Model Used:** gemma3:4b (local Ollama — $0)
- **Audit Duration:** [Seconds]s
- **Critical Issues:**
  - [List of major hallucinations found]
- **Recommended Fixes:**
  - [Bullet points of actions needed]

#### Delta Table
| Field | Official (Website) | AI Internal Knowledge | Perplexity | Google AI | Hallucination? |
|---|---|---|---|---|---|
| Address | ... | ... | — | — | [✅/❌] |
| Hours | ... | ... | — | — | [✅/❌] |
| Phone | ... | ... | — | — | [✅/❌] |
| Services | ... | ... | — | — | [✅/❌] |
```
