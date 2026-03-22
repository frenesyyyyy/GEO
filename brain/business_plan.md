# 🇮🇹 GEO Consulting Roma — Business Plan
**Founder:** You (22, Rome) | **Budget:** €0 startup | **Date:** March 2026

---

## 🎯 The Opportunity

Every professional in Rome has a website. Almost none of them know they're being **misrepresented by AI**.

When somebody asks ChatGPT, Perplexity, or Google AI *"trova un buon avvocato a Parioli"*, the AI answers from its training data — which is often months or years out of date. It hallucinates wrong phone numbers, old addresses, services that don't exist.

**Businesses are losing clients they never even know about** because the AI is sending people to the wrong door.

You are the only person in Rome with a system to detect this, prove it, and fix it.

---

## 💼 What You Sell

### Tier 1 — GEO Audit Report (€150–€300)
- Full AI hallucination audit across Ollama (internal knowledge), Google search panel
- Delta table: Official vs AI
- AI Accuracy Score (0–100)
- PDF report with exact fixes recommended
- **Time to deliver:** ~1 hour (15 min scraping + 30 min report formatting + 15 min PDF)
- **Your cost:** €0 (Ollama is free, no API keys)

### Tier 2 — GEO Fix Package (€500–€1,200)
- Everything in Tier 1 PLUS:
- Schema.org markup implementation on their website
- NAP cleanup across Pagine Gialle, TripAdvisor, Yelp, Google Business Profile
- Google Business Profile optimisation
- Content recommendations (Italian + English bilingual for max AI coverage)
- **Delivery:** 3–5 business days

### Tier 3 — GEO Retainer (€300–€600/month)
- Monthly re-audit (AI models retrain → hallucinations return)
- Track score improvement over time
- Priority fix alerts
- **Sell to:** Tier 2 clients after first fix
- **Goal:** 5 retainer clients = €1,500–€3,000/month recurring

---

## 📊 Revenue Model (Conservative Projections)

| Month | Audits | Fix Packages | Retainers | Est. Revenue |
|---|---|---|---|---|
| Month 1 | 3 (at €200) | 0 | 0 | **€600** |
| Month 2 | 5 (at €200) | 1 (at €700) | 0 | **€1,700** |
| Month 3 | 5 (at €250) | 2 (at €800) | 2 (at €400) | **€3,425** |
| Month 6 | 8 (at €250) | 3 (at €900) | 5 (at €450) | **€7,450** |
| Month 12 | 10 (at €300) | 5 (at €1,000) | 12 (at €500) | **€15,000** |

> At Month 12 you are at **€15,000/month** with a good client base.
> This is **completely realistic** for a specialized niche service at this price point.

---

## 🚀 Go-to-Market Strategy (€0 Budget)

### Phase 1 — Proof of Concept (Month 1)
1. **Run 10 free audits** on well-known Parioli/Prati notai and avvocati
2. Screenshot the worst hallucinations — compile a 1-page PDF showing the problem
3. Email or call the business directly: *"Your AI accuracy score is 32/100. ChatGPT tells people your office closed. Can I show you what I found?"*
4. Offer the first **paid audit at €100** (below market — just to get the first testimonial)

### Phase 2 — Social Proof (Month 2–3)
- After 3 paid audits → post case studies on LinkedIn (before/after scores)
- Tag relevant local professionals and journalists
- **GEO is new enough** that being the first person posting case studies in Italy = massive organic reach
- Submit to Italian marketing newsletters (Content Marketing Italia, Search Marketing Connect)

### Phase 3 — Outreach at Scale (Month 3+)
- Use `prospector_scraper.py` to generate batches of 50–100 leads per zone
- Cold email with personalized audit preview: *"I noticed ChatGPT says your phone number is [wrong number]..."*
- That kind of personalization converts at 10–15% vs generic cold email at 1–2%

### Phase 4 — Referrals & Partners (Month 6+)
- Partner with web agencies: they do the website, you do the GEO layer
- Partner with a commercialista or accounting firm: they send you their entire client base
- One referral partner = 20+ warm leads

---

## 🏆 Competitive Advantage

| Factor | Traditional SEO Agency | You |
|---|---|---|
| Focuses on Google ranking | ✅ | ❌ (irrelevant for GEO) |
| Focuses on AI citations | ❌ | ✅ |
| Can prove the problem exists | ❌ (vague) | ✅ (hallucination score = hard data) |
| Price | €2,000–€5,000/month | €150–€1,200 (accessible) |
| Local Rome expertise | Generic | ✅ Hyper-local (you know the streets) |
| Automates the audit | ❌ Manual | ✅ `researcher_query.py` |
| Time to deliver | Weeks | Days |

**You are 2–3 years ahead of when traditional agencies will start offering GEO.**
The window to establish yourself as *"il GEO specialist di Roma"* is open right now.

---

## 🎓 Why Being 22 is an Advantage

1. **You understand AI natively** — your target clients (50+ year old notai, avvocati) don't
2. **Lower overheads** than an established agency — you can undercut on price while building reputation
3. **Energy to iterate fast** — the GEO landscape changes every 6 months; you can adapt faster
4. **Rome's professional community is old-school** — a sharp young consultant who shows up with hard data is rare and memorable
5. **The system does the heavy lifting** — your Ollama pipeline lets you audit 5 businesses in ~3 minutes, something a competitor would take days to do manually

---

## 💡 Innovation Score

This approach is genuinely innovative in the Italian market for 3 reasons:

1. **Data-driven proof** — instead of selling vague "SEO improvements", you hand the client a 0–100 score with a table showing exactly what ChatGPT gets wrong about them. This is a sales asset, not a pitch.
2. **Automated at $0** — most GEO tools cost $300–$500/month. Your stack costs nothing to run. Your margin is close to 100%.
3. **Self-improving** — the Learner agent updates your knowledge base every week. Your audit quality gets better every cycle without you doing any research manually.

---

## 📋 First 30 Days — Action Checklist

- [ ] Run `python researcher_query.py --check` → confirm Ollama works
- [ ] Add 10 businesses to `data/research_data.md` (run `prospector_scraper.py --zone Prati --count 10`)
- [ ] Run `python researcher_query.py` → generate first 5 audit reports
- [ ] Export 3 worst reports as PDF → use as cold outreach material
- [ ] Set up a simple Gmail business email (yourname.geo@gmail.com)
- [ ] Create a 1-page Notion or PDF explaining what GEO is and why it matters
- [ ] Make 10 cold outreach attempts via LinkedIn or email with personalized hallucination previews
- [ ] Aim for: 1 paid audit by end of Month 1

---

*"AI is eating the attention that used to go to Google. The businesses that don't exist in AI don't exist to an entire generation of customers. That's your pitch. It's true, it's urgent, and you have the tools to prove it."*
