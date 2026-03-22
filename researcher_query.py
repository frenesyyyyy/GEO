#!/usr/bin/env python3
"""
GEO Researcher — Ollama-powered hallucination audit tool ($0 budget)
Queries a local Ollama LLM about a business, compares to official site data,
and writes a structured report to data/research_data.md.

Usage:
  python researcher_query.py               # Audit next PENDING business
  python researcher_query.py --check       # Check Ollama is running
  python researcher_query.py --model mistral   # Use a specific Ollama model
  python researcher_query.py --dry-run --business "Name" --website "site.com"

Requirements (free, no API keys):
  pip install requests beautifulsoup4
  + Ollama installed & running: https://ollama.com/download
  + A model pulled: ollama pull llama3.2
"""

import os
import re
import sys
import time
import json
import argparse
import datetime
import requests
import traceback
from pathlib import Path

# Force UTF-8 output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# ── Paths & Config ─────────────────────────────────────────────────────────────
RESEARCH_DATA = Path(__file__).parent / "data" / "research_data.md"
BRAIN_FILE    = Path(__file__).parent / "brain" / "brain.md"
TODAY         = datetime.date.today().isoformat()

OLLAMA_BASE_URL = "http://localhost:11434"
DEFAULT_MODEL   = "gemma3:4b"  # Override with --model flag

# ── Italian nav/garbage word blacklist ────────────────────────────────────────
GARBAGE_WORDS = {
    "dormire", "mangiare", "bere", "fare", "spesa", "abitare",
    "arredare", "muoversi", "divertirsi", "lavorare", "studiare",
    "comprare", "vendere", "affittare", "curarsi", "risultati",
    "cerca", "ricerca", "pagine", "gialle", "annunci", "offerte",
    "scopri", "tutte", "tutte le categorie", "categorie", "home",
    "comprimi", "espandi", "riepilogo", "mostra", "altri", "filtri",
    "mappa", "satellite", "rilievo", "livelli", "condizioni", "privacy",
    "invia", "notifica", "condividi", "salva", "vicino", "percorso",
}

def is_valid_business_name(name: str) -> bool:
    """Return True only if the name looks like a real business."""
    if not name or len(name.strip()) < 4:
        return False
    stripped = name.strip()
    words = re.findall(r"[a-zA-ZÀ-ÿ]+", stripped.lower())
    if not words: return False
    garbage_hit = sum(1 for w in words if w in GARBAGE_WORDS)
    if garbage_hit >= len(words): return False
    if stripped.isupper() and len(words) == 1 and words[0] in GARBAGE_WORDS: return False
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Ollama helpers
# ─────────────────────────────────────────────────────────────────────────────

def check_ollama_running(model: str = DEFAULT_MODEL) -> bool:
    """Return True if Ollama is running and the model is available."""
    try:
        r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        if r.status_code != 200:
            return False
        models_full = [m["name"] for m in r.json().get("models", [])]
        models_base = [m["name"].split(":")[0] for m in r.json().get("models", [])]
        return model in models_full or model in models_base
    except requests.ConnectionError:
        return False


def query_ollama(business_name: str, site_text: str, web_text: str, model: str = DEFAULT_MODEL) -> dict:
    """
    Ask the local Ollama model to perform a hallucination delta audit by comparing
    Official Website Data against Web Search / AI Engine snippets.
    """
    prompt = (
        f"You are a GEO (Generative Engine Optimization) hallucination auditor.\n"
        f"Your task: compare the OFFICIAL website content vs what the WEB SEARCH ENGINES say about '{business_name}'.\n\n"
        f"=== OFFICIAL WEBSITE CONTENT ===\n{site_text[:2000]}\n=== END OF OFFICIAL ===\n\n"
        f"=== WEB SEARCH ENGINE RESULTS (AI DATA) ===\n{web_text[:2000]}\n=== END OF AI DATA ===\n\n"
        f"Respond with ONLY a valid JSON object using this exact structure:\n"
        f"{{\n"
        f'  "ai_knowledge": {{"address": "...", "phone": "...", "hours": "...", "services": "..."}},\n'
        f'  "official": {{"address": "...", "phone": "...", "hours": "...", "services": "..."}}\n'
        f"}}\n\n"
        f"Rules:\n"
        f"- ai_knowledge: What the 'WEB SEARCH ENGINE RESULTS' say about this business. If they hallucinate or give wrong info, capture exactly what they say.\n"
        f"- official: what you extract from the 'OFFICIAL WEBSITE CONTENT' above.\n"
        f"- Look specifically for markers like 'Solo su appuntamento' or 'By appointment only' and include this in the hours or services.\n"
        f"- If a field is not mentioned in a source, use the strictly string 'Not mentioned'. Do not invent or guess.\n"
        f"- Output ONLY the JSON. No explanation, no markdown, no extra text.\n"
    )

    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1,   # Low temp = more factual, less hallucination
            "num_predict": 400,
        },
    }

    for attempt in range(3):
        try:
            print(f"   [Ollama] Querying {model} (attempt {attempt + 1})...", flush=True)
            r = requests.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json=payload,
                timeout=120,   # Local LLM can take up to 2 min on slow CPU
            )
            r.raise_for_status()
            raw = r.json().get("response", "").strip()

            # Parse JSON from response (handle markdown code fences if model adds them)
            json_text = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
            return json.loads(json_text)

        except json.JSONDecodeError:
            print(f"   [!] JSON parse error on attempt {attempt + 1}. Raw: {raw[:200]}", flush=True)
            if attempt < 2:
                time.sleep(2)
        except requests.RequestException as e:
            print(f"   [!] Ollama request error: {e}", flush=True)
            if attempt < 2:
                time.sleep(3)

    # Fallback: return structured empty result
    return {
        "ai_knowledge": {"address": "ERROR", "phone": "ERROR", "hours": "ERROR", "services": "ERROR"},
        "official":     {"address": "ERROR", "phone": "ERROR", "hours": "ERROR", "services": "ERROR"},
    }


# ─────────────────────────────────────────────────────────────────────────────
# Ground Truth — scrape the official website (free, local, no API)
# ─────────────────────────────────────────────────────────────────────────────

def fetch_site_summary(url: str) -> str:
    """Fetch the official website and extract meaningful text as ground truth."""
    if not url or url in ("—", "-", ""):
        return "No website provided."
    if not url.startswith("http"):
        url = "https://" + url

    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    ]
    import random
    headers = {"User-Agent": random.choice(user_agents)}

    def get_clean_text(html_text):
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_text, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        # Keep nav/footer text for internal scraping but don't over-include in summary
        blocks = []
        for tag in soup.find_all(["p", "h1", "h2", "h3", "li", "address", "span"], limit=50):
            t = tag.get_text(separator=" ", strip=True)
            if len(t) > 15: blocks.append(t)
        return " | ".join(blocks)[:1500]

    try:
        # Step A: Fetch Homepage
        r = requests.get(url, headers=headers, timeout=12)
        r.raise_for_status()
        homepage_html = r.text
        homepage_summary = get_clean_text(homepage_html)

        # Step B: Find Contact Link (Deep Scrape V4)
        from bs4 import BeautifulSoup
        from urllib.parse import urljoin
        soup = BeautifulSoup(homepage_html, "html.parser")
        contact_keywords = ["contatt", "dove", "uffic", "sed", "info", "about", "reach"]
        contact_url = None

        for a in soup.find_all("a", href=True):
            text = a.get_text().lower()
            href = a["href"].lower()
            if any(k in text or k in href for k in contact_keywords):
                contact_url = urljoin(url, a["href"])
                if contact_url != url: break # Found a deeper page

        contact_summary = ""
        if contact_url:
            print(f"   [V4] Deep Scrape: Following contact link -> {contact_url}", flush=True)
            try:
                rc = requests.get(contact_url, headers=headers, timeout=10)
                if rc.status_code == 200:
                    contact_summary = "\n[CONTACT PAGE]: " + get_clean_text(rc.text)
            except Exception: pass

        return f"HOME: {homepage_summary} {contact_summary}"

    except Exception as e:
        return f"SCRAPE_ERROR: {e}"


def fetch_web_knowledge(business_name: str, district: str) -> str:
    """Scrape DuckDuckGo HTML version to collect real search engine consensus."""
    url = "https://html.duckduckgo.com/html/"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    data = {"q": f"{business_name} {district} Roma indirizzo telefono recensioni"}
    
    try:
        r = requests.post(url, headers=headers, data=data, timeout=10)
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(r.text, "html.parser")
        
        snippets = []
        for a in soup.find_all("a", class_="result__snippet"):
            snippets.append(a.text.strip())
            
        if not snippets:
            return "No search results found. The AI engines have 0 data on this business."
            
        return "\n---\n".join(snippets[:7])
    except Exception as e:
        return f"WEB_SEARCH_ERROR: {e}"



# ─────────────────────────────────────────────────────────────────────────────
# Field extraction & scoring
# ─────────────────────────────────────────────────────────────────────────────

def extract_field(data: dict | str, field: str, source: str = "ai_knowledge") -> str:
    """Extract a field from Ollama JSON output (or fallback to regex on raw text)."""
    if isinstance(data, str) and data.startswith("ERROR"):
        return data
    if isinstance(data, str):
        # Try parsing as JSON first
        try:
            data = json.loads(data)
        except Exception:
            pass

    if isinstance(data, dict):
        section = data.get(source, {})
        val = section.get(field, "Not mentioned")
        return str(val) if val else "Not mentioned"

    # Free-text fallback (regex)
    text = str(data)
    lines = text.splitlines()
    if field == "address":
        for line in lines:
            if re.search(r"\b(via|viale|piazza|corso|largo)\b", line, re.I):
                return line.strip()[:80]
    elif field == "phone":
        phones = re.findall(r"[\+0][\d\s\-\.]{7,15}", text)
        return phones[0].strip() if phones else "Not mentioned"
    elif field == "hours":
        for line in lines:
            if re.search(r"\b(lun|mar|mer|gio|ven|9[:\.]|10[:\.]|chiuso|aperto|open)\b", line, re.I):
                return line.strip()[:100]
    elif field == "services":
        for line in lines:
            if re.search(r"\b(notari|avvoc|chiru|medic|legal|studio|service)\b", line, re.I):
                return line.strip()[:120]
    return "Not mentioned"


def score_field(official: str, ai_val: str) -> str:
    """Simple accuracy check: ✅ correct, ⚠️ partial, ❌ wrong, — unknown."""
    skip = {"Not mentioned", "ERROR", "MISSING_API_KEY", "NO_KEY", "SCRAPE_ERROR"}
    if ai_val in skip or not ai_val or ai_val.lower().startswith("error"):
        return "—"
    if official in skip or not official or official.lower().startswith("error"):
        return "—"

    oc = re.sub(r"[\s\-\./,]", "", official.lower())
    ac = re.sub(r"[\s\-\./,]", "", ai_val.lower())

    if not oc or oc == "notmentioned":
        return "—"
    if oc in ac or ac in oc:
        return "✅"
    # Partial match: any word > 3 chars from official appears in ai
    words = [w for w in oc.split() if len(w) > 3]
    if words and any(w in ac for w in words):
        return "⚠️"
    return "❌"


# ─────────────────────────────────────────────────────────────────────────────
# research_data.md I/O
# ─────────────────────────────────────────────────────────────────────────────

def get_pending_business() -> dict | None:
    """Find the first PENDING business in the audit queue."""
    text = RESEARCH_DATA.read_text(encoding="utf-8")
    pattern = re.compile(
        r"\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*PENDING\s*\|"
    )
    match = pattern.search(text)
    if not match:
        return None
    return {
        "id":       match.group(1).strip(),
        "name":     match.group(2).strip(),
        "website":  match.group(3).strip(),
        "district": match.group(4).strip(),
        "category": match.group(5).strip(),
        "source":   match.group(6).strip(),
    }


def mark_business_skipped(business_id: str):
    """Change a business row status to SKIPPED."""
    text = RESEARCH_DATA.read_text(encoding="utf-8")
    pattern = re.compile(
        rf"(\|\s*{re.escape(business_id)}\s*\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|)\s*PENDING\s*(\|)"
    )
    updated = pattern.sub(r"\1 SKIPPED \2", text)
    RESEARCH_DATA.write_text(updated, encoding="utf-8")

def mark_business_audited(business_id: str):
    """Change a business row from PENDING to AUDITED."""
    text = RESEARCH_DATA.read_text(encoding="utf-8")
    pattern = re.compile(
        rf"(\|\s*{re.escape(business_id)}\s*\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|)\s*PENDING\s*(\|)"
    )
    updated = pattern.sub(r"\1 AUDITED \2", text)
    RESEARCH_DATA.write_text(updated, encoding="utf-8")


def update_researcher_status(status: str, note: str = ""):
    """Update Researcher row in Agent Status Board."""
    text = RESEARCH_DATA.read_text(encoding="utf-8")
    pattern = re.compile(r"(\| Researcher \|)[^|]+(\|)[^|]+(\|)[^|]+(\|)[^\n]+")
    replacement = f"| Researcher | `{status}` | — | {TODAY} | {note} |"
    updated = pattern.sub(replacement, text)
    RESEARCH_DATA.write_text(updated, encoding="utf-8")


def clear_previous_audit(business_name: str):
    """Remove any previous (incomplete) audit report for this business."""
    text = RESEARCH_DATA.read_text(encoding="utf-8")
    escaped = re.escape(business_name)
    pattern = re.compile(
        rf"### Audit: {escaped}.*?(?=### Audit:|### Report Template:)", re.DOTALL
    )
    updated = pattern.sub("", text)
    RESEARCH_DATA.write_text(updated, encoding="utf-8")


def append_audit_report(report: str):
    """Insert a new audit report before the Report Template block."""
    text = RESEARCH_DATA.read_text(encoding="utf-8")
    anchor = "### Report Template (copy for each audit)"
    if anchor in text:
        updated = text.replace(anchor, report + "\n" + anchor)
    else:
        updated = text + "\n" + report
    RESEARCH_DATA.write_text(updated, encoding="utf-8")


def flag_brain_needs_review(business_name: str, count: int):
    """Set NEEDS_REVIEW flag in brain.md so the Learner picks it up."""
    text = BRAIN_FILE.read_text(encoding="utf-8")
    flag_pattern = re.compile(r"<!-- NEEDS_REVIEW: \[.*?\] -->")
    new_flag = f"<!-- NEEDS_REVIEW: [{business_name} — {count} hallucinations] -->"
    if flag_pattern.search(text):
        updated = flag_pattern.sub(new_flag, text)
    else:
        updated = text.replace("## Status Flags", f"## Status Flags\n{new_flag}")
    BRAIN_FILE.write_text(updated, encoding="utf-8")


def update_last_updated():
    text = RESEARCH_DATA.read_text(encoding="utf-8")
    updated = re.sub(
        r"\*\*Last Updated:\*\*.*",
        f"**Last Updated:** {TODAY}",
        text, count=1
    )
    RESEARCH_DATA.write_text(updated, encoding="utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# Main audit flow
# ─────────────────────────────────────────────────────────────────────────────

def run_audit(business: dict, model: str = DEFAULT_MODEL, dry_run: bool = False) -> tuple:
    name     = business["name"]
    website  = business["website"]
    district = business["district"]
    category = business["category"]

    print(f"\n{'='*60}")
    print(f"  AUDITING: {name}")
    print(f"  District: {district} | Category: {category}")
    print(f"  Website:  {website}")
    print(f"  Model:    {model}")
    print(f"{'='*60}\n")

    # Step 1 — Scrape official website (free, local)
    print("[SCRAPE] Fetching official website ground truth...", flush=True)
    site_text = fetch_site_summary(website)
    if site_text.startswith("SCRAPE_ERROR"):
        print(f"   [!] Scrape failed: {site_text}")
    else:
        print(f"   [OK] Extracted {len(site_text)} chars from site.")

    # Step 1.5 — Scrape web search consensus (new V2 anti-hallucination layer)
    print("[SCRAPE] Fetching web search consensus (AI Engine Grounding)...", flush=True)
    web_text = fetch_web_knowledge(name, district)
    if "WEB_SEARCH_ERROR" in web_text:
        print(f"   [!] Web search failed: {web_text}")
    else:
        print(f"   [OK] Extracted {len(web_text)} chars from search engine snippets.")

    # Step 2 — Query Ollama (free, local, no rate limits)
    print(f"[OLLAMA] Running hallucination delta analysis...", flush=True)
    t0 = time.time()
    ollama_result = query_ollama(name, site_text, web_text, model=model)
    elapsed = time.time() - t0
    print(f"   [OK] Ollama responded in {elapsed:.1f}s", flush=True)

    # Step 3 — Extract fields
    fields = ["address", "phone", "hours", "services"]
    official      = {f: extract_field(ollama_result, f, source="official")     for f in fields}
    ai_knowledge  = {f: extract_field(ollama_result, f, source="ai_knowledge") for f in fields}

    # Step 4 — Score & build table rows
    def make_row(field: str) -> str:
        o  = official[field]
        ai = ai_knowledge[field]
        ai_icon = score_field(o, ai)
        # For this $0 version we only have one AI source (Ollama internal knowledge)
        # Google scrape is also local (kept from original)
        hallucination = ai_icon
        return f"| {field.capitalize()} | {o} | {ai} [{ai_icon}] | — | — | {hallucination} |"

    # Step 5 — Calculate score
    all_icons = [score_field(official[f], ai_knowledge[f]) for f in fields]
    active    = [i for i in all_icons if i in ("✅", "❌", "⚠️")]
    total     = len(active) or 1
    accuracy_score    = int((active.count("✅") / total) * 100)
    hallucination_count = active.count("❌")
    worst_offender = "Web Search / Aggregators" if hallucination_count > 0 else "NONE"

    # Step 6 — Build report
    report = f"""### Audit: {name} — {TODAY}
- **AI Accuracy Score:** {accuracy_score}/100
- **Hallucinations Found:** {hallucination_count}
- **Worst Offender:** {worst_offender}
- **Category:** {category} | **District:** {district}
- **Model Used:** {model} (local Ollama — $0)
- **Audit Duration:** {elapsed:.1f}s
- **Critical Issues:**
  - {"None detected." if hallucination_count == 0 else f"{hallucination_count} hallucination(s) found in AI internal knowledge vs official site."}
- **Recommended Fixes:**
  - {"No immediate action needed." if accuracy_score >= 80 else "Update Schema.org markup, ensure consistent NAP across aggregators."}

#### Delta Table
| Field | Official (Website) | AI Internal Knowledge | Perplexity | Google AI | Hallucination? |
|---|---|---|---|---|---|
{make_row("address")}
{make_row("hours")}
{make_row("phone")}
{make_row("services")}

"""
    return report, accuracy_score, hallucination_count, worst_offender


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="GEO Researcher — Ollama hallucination auditor ($0)")
    parser.add_argument("--model",    default=DEFAULT_MODEL, help="Ollama model to use (default: llama3.2)")
    parser.add_argument("--check",   action="store_true",   help="Check if Ollama is running and exit")
    parser.add_argument("--dry-run", action="store_true",   help="Run audit but do NOT write to research_data.md")
    parser.add_argument("--business", default=None,         help="Business name for --dry-run")
    parser.add_argument("--website",  default=None,         help="Website URL for --dry-run")
    args = parser.parse_args()

    print("=" * 60)
    print(" GEO RESEARCHER — Ollama Edition ($0 Budget)")
    print(f" Model: {args.model} | Date: {TODAY}")
    print("=" * 60)

    # ── Check mode ──────────────────────────────────────────────────────────
    if args.check:
        running = check_ollama_running(args.model)
        if running:
            print(f"\n✅ Ollama is running. Model '{args.model}' is available.")
        else:
            print(f"\n❌ Ollama is NOT running or model '{args.model}' not found.")
            print("   → Install Ollama: https://ollama.com/download")
            print(f"   → Pull model:    ollama pull {args.model}")
            sys.exit(1)
        return

    # ── Verify Ollama is up ──────────────────────────────────────────────────
    if not check_ollama_running(args.model):
        print(f"\n❌ Ollama is not running or model '{args.model}' not pulled.")
        print("   → Start Ollama, then run: ollama pull " + args.model)
        print("   → Then re-run this script.")
        sys.exit(1)
    print(f"\n✅ Ollama ready. Model: {args.model}\n")

    # ── Dry-run mode ─────────────────────────────────────────────────────────
    if args.dry_run:
        if not args.business:
            print("❌ --dry-run requires --business and --website flags.")
            sys.exit(1)
        biz = {
            "id": "DRY",
            "name": args.business,
            "website": args.website or "—",
            "district": "Unknown",
            "category": "Unknown",
            "source": "manual",
        }
        report, score, hallucinations, worst = run_audit(biz, model=args.model, dry_run=True)
        print("\n" + "─" * 60)
        print("DRY RUN REPORT (not saved):")
        print("─" * 60)
        print(report)
        print(f"Score: {score}/100 | Hallucinations: {hallucinations} | Worst: {worst}")
        return

    # ── Normal batch mode ────────────────────────────────────────────────────
    while True:
        business = get_pending_business()
        if not business:
            print("✅ No more PENDING businesses in queue.")
            update_researcher_status("IDLE", "All pending audits complete.")
            break

        print(f"📋 Auditing #{business['id']} — {business['name']}...")
        
        # Security Gate: Valid name check
        if not is_valid_business_name(business['name']):
            print(f"   [SKIP] '{business['name']}' rejected as non-business name. Marking SKIPPED.")
            mark_business_skipped(business['id'])
            continue

        update_researcher_status("IN_PROGRESS", f"Auditing #{business['id']}: {business['name']}")
        clear_previous_audit(business["name"])

        try:
            report, score, hallucinations, worst = run_audit(business, model=args.model)
            append_audit_report(report)
            mark_business_audited(business["id"])
            update_last_updated()

            # Flag brain for Learner if hallucinations found
            if hallucinations > 0:
                flag_brain_needs_review(business["name"], hallucinations)
                print(f"   [Brain] NEEDS_REVIEW flag set — Learner will process next cycle.")

            print(f"   ✅ Done. Score: {score}/100 | Hallucinations: {hallucinations}")

        except Exception as e:
            print(f"   [!] Error auditing {business['name']}: {e}")
            traceback.print_exc()
            update_researcher_status("BLOCKED", f"Error on #{business['id']}: {str(e)[:60]}")
            break

        # Check for more — no sleep needed (no rate limits with Ollama!)
        next_biz = get_pending_business()
        if next_biz:
            print(f"\n   → Next up: {next_biz['name']} | Starting immediately (no rate limit delay)...")
        else:
            print("✅ Queue finished.")
            update_researcher_status("IDLE", "Full batch complete.")
            break

    print(f"\nBatch audit complete. Check data/research_data.md for full results.")

    # Step 7 — Auto-run Translator after each batch (V4 Upgrade)
    print("\n" + "="*60)
    print(" [V4] Auto-running Human Report Translator...")
    print("="*60)
    try:
        import subprocess
        subprocess.run(["python", "report_translator.py"], check=False)
        print(" [V4] Agency reports updated in data/client_fixes/")
    except Exception as e:
        print(f" [!] Error running translator: {e}")


if __name__ == "__main__":
    main()
