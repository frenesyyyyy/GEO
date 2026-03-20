#!/usr/bin/env python3
"""
GEO Researcher -- API-based audit tool
Queries ChatGPT (OpenAI) and Perplexity AI about a business,
compares results to official site data, and outputs a structured report.

Usage:
  python researcher_query.py

It reads the Business Audit Queue from data/research_data.md,
audits the first PENDING business, and writes the report back.
"""

import os
import re
import sys
import time
import json
import datetime
import requests
import traceback
from pathlib import Path

# Force UTF-8 output on Windows
if sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# ── Load .env manually (no dotenv dependency) ─────────────────────────────────
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

OPENAI_KEY      = os.environ.get("OPENAI_API_KEY", "")
PERPLEXITY_KEY  = os.environ.get("PERPLEXITY_API_KEY", "")

RESEARCH_DATA   = Path(__file__).parent / "data" / "research_data.md"
TODAY           = datetime.date.today().isoformat()

# ─────────────────────────────────────────────────────────────────────────────
# AI Query Functions
# ─────────────────────────────────────────────────────────────────────────────

def query_openai(business_name: str, website: str, city: str = "Rome") -> str:
    """Query ChatGPT with a combined prompt about a business (site info + general knowledge)."""
    if not OPENAI_KEY:
        return "MISSING_API_KEY"

    # Modified prompt for GEO Hallucination Audit
    prompt = (
        f"I am auditing the AI perception of '{business_name}' in Rome. I need to identify 'Hallucination Deltas'.\n\n"
        f"PART 1: INTERNAL KNOWLEDGE\n"
        f"Based ONLY on your internal training data (do not attempt to browse), what is the official address, phone, and hours for this business?\n\n"
        f"PART 2: DOCUMENT EXTRACTION\n"
        f"I am providing the current website content for this business below:\n"
        f"--- WEBSITE CONTENT START ---\n{website}\n--- WEBSITE CONTENT END ---\n\n"
        f"Extract the address, phone, hours, and services from the text above.\n\n"
        f"RESPONSE FORMAT:\n"
        f"Format as a JSON object with keys 'ai_knowledge' (from Part 1) and 'official' (from Part 2). "
        f"Both must have keys: 'address', 'phone', 'hours', 'services'."
    )

    for attempt in range(4):
        try:
            print(f"   [API] OpenAI request (attempt {attempt+1})...", flush=True)
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 800,
                    "temperature": 0.1,
                    "response_format": {"type": "json_object"}
                },
                timeout=45,
            )
            if response.status_code == 429:
                wait = 70 * (attempt + 1)
                print(f"   [Rate limit] Waiting {wait}s before retry...", flush=True)
                time.sleep(wait)
                continue
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"].strip()
        except requests.RequestException as e:
            print(f"   [!] OpenAI Request Error: {e}", flush=True)
            if attempt < 3:
                time.sleep(20)
            else:
                return f"ERROR: {e}"
    return "ERROR: max retries exceeded"


def query_perplexity(business_name: str, city: str = "Rome") -> str:
    """Query Perplexity about a business and return raw text."""
    if not PERPLEXITY_KEY:
        return "NO_PERPLEXITY_KEY"

    prompt = (
        f"Tell me about '{business_name}' in {city}, Italy. "
        "Provide: address, phone, opening hours, services, and founding year."
    )

    try:
        response = requests.post(
            "https://api.perplexity.ai/chat/completions",
            headers={
                "Authorization": f"Bearer {PERPLEXITY_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "sonar-pro",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 500,
            },
            timeout=30,
        )
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()
    except requests.RequestException as e:
        return f"ERROR: {e}"


def fetch_site_summary(url: str) -> str:
    """Fetch website content locally to use as Ground Truth."""
    if not url or url == "—":
        return "No website provided."
    if not url.startswith("http"):
        url = "https://" + url
    
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0"}
        r = requests.get(url, headers=headers, timeout=15)
        r.raise_for_status()
        
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(r.text, "html.parser")
        
        # Extract meaningful snippets
        title = soup.title.string if soup.title else "No title"
        meta = [m.get("content") for m in soup.find_all("meta") if m.get("name") in ("description", "keywords")]
        text = " ".join([p.get_text() for p in soup.find_all(["p", "h1", "h2", "li"])[:20]])
        
        summary = f"Title: {title}\nMeta: {' '.join(filter(None, meta))}\nContent: {text[:1000]}"
        return summary
    except Exception as e:
        return f"SCRAPE_ERROR: {e}"


def query_google_knowledge(business_name: str) -> str:
    """Scrape Google search snippet for a business knowledge panel."""
    try:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            )
        }
        # Ensure name is safely encoded
        safe_name = requests.utils.quote(business_name + " Rome")
        url = f"https://www.google.com/search?q={safe_name}&hl=en"
        r = requests.get(url, headers=headers, timeout=15)
        r.raise_for_status()
        # Extract visible text snippets (basic extraction)
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(r.text, "html.parser")
        # Grab all text from result containers
        texts = []
        for tag in soup.find_all(["span", "div"], limit=200):
            t = tag.get_text(strip=True)
            if len(t) > 30 and len(t) < 300:
                texts.append(t)
        deduplicated = list(dict.fromkeys(texts))[:20]
        return "\n".join(deduplicated)
    except Exception as e:
        return f"ERROR: {e}"


# ─────────────────────────────────────────────────────────────────────────────
# Extract structured fields from JSON or free text
# ─────────────────────────────────────────────────────────────────────────────

def extract_field(input_data: str | dict, field: str, source: str = "ai_knowledge") -> str:
    """Extract a field from either a JSON string (OpenAI) or free text (Perplexity/Google)."""
    if isinstance(input_data, str) and input_data.startswith("ERROR"):
        return input_data
    if input_data in ("MISSING_API_KEY", "NO_PERPLEXITY_KEY", "BLOCKED", "Not mentioned"):
        return str(input_data)

    # If it's the JSON output from OpenAI
    if isinstance(input_data, str) and input_data.strip().startswith("{"):
        try:
            data = json.loads(input_data)
            section = data.get(source, {})
            val = section.get(field, "Not mentioned")
            return str(val) if val else "Not mentioned"
        except json.JSONDecodeError:
            pass # Fall back to regex if JSON fails

    # If it's free text (Perplexity/Google/Broken JSON)
    text = str(input_data)
    lines = text.splitlines()

    if field == "address":
        for line in lines:
            if re.search(r"\b(via|viale|piazza|corso|largo)\b", line, re.I):
                return line.strip()[:80]
        return "Not mentioned"

    elif field == "phone":
        phones = re.findall(r"[\+0][\d\s\-\.]{7,15}", text)
        return phones[0].strip() if phones else "Not mentioned"

    elif field == "hours":
        for line in lines:
            if re.search(r"\b(monday|tuesday|lun|mar|mer|gio|ven|open|9[:\.]|10[:\.]|closed)\b", line, re.I):
                return line.strip()[:100]
        return "Not mentioned"

    elif field == "services":
        for line in lines:
            if re.search(r"\b(service|notari|avvoc|chirurg|medic|legal|immob|societ|success)\b", line, re.I):
                return line.strip()[:120]
        return "Not mentioned"

    return "Not mentioned"


def score_field(official: str, ai_val: str) -> str:
    """Simple accuracy check: ✅ correct, ⚠️ partial, ❌ wrong, — unknown."""
    if ai_val in ("Not mentioned", "ERROR", "MISSING_API_KEY", "NO_PERPLEXITY_KEY"):
        return "—"
    if ai_val.lower().startswith("error"):
        return "—"

    official_clean = re.sub(r"[\s\-\./]", "", official.lower())
    ai_clean       = re.sub(r"[\s\-\./]", "", ai_val.lower())

    if not official_clean or official_clean == "notmentioned":
        return "—"

    if official_clean in ai_clean:
        return "✅"
    if ai_clean and any(word in ai_clean for word in official_clean.split() if len(word) > 3):
        return "⚠️"
    return "❌"


# ─────────────────────────────────────────────────────────────────────────────
# Read / Write research_data.md
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


def mark_business_audited(business_id: str, business_name: str):
    """Change a business row from PENDING to AUDITED in the queue."""
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


def clear_blocked_audit(business_name: str):
    """Remove previous audit reports for a business."""
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


def update_last_updated():
    text = RESEARCH_DATA.read_text(encoding="utf-8")
    updated = re.sub(
        r"\*\*Last Updated:\*\*.*",
        f"**Last Updated:** {TODAY} 23:00",
        text,
        count=1
    )
    RESEARCH_DATA.write_text(updated, encoding="utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# Main audit flow
# ─────────────────────────────────────────────────────────────────────────────

def run_audit(business: dict):
    name     = business["name"]
    website  = business["website"]
    district = business["district"]
    category = business["category"]

    print(f"\n{'='*60}")
    print(f"  AUDITING: {name}")
    print(f"  District: {district} | Category: {category}")
    print(f"  Website:  {website}")
    print(f"{'='*60}\n")

    # -- Step 0: Fetch Ground Truth Locally (Free & Reliable)
    print("[SCRAPE] Fetching website Ground Truth...")
    site_text = fetch_site_summary(website)
    
    # -- Step 1: Combined OpenAI Call (Detecting Hallucination Delta)
    print("[API] Querying OpenAI (Internal vs extracted)...")
    combined_json = query_openai(name, site_text)
    
    # Check if we got an error string instead of JSON
    if combined_json.startswith("ERROR"):
        print(f"   [!] OpenAI Error: {combined_json}")
        chatgpt_raw = combined_json
        site_raw    = combined_json
    else:
        chatgpt_raw = combined_json
        site_raw    = combined_json

    # -- Step 2: Perplexity
    if PERPLEXITY_KEY:
        print("[API] Querying Perplexity...")
        perplexity_raw = query_perplexity(name)
    else:
        print("[!]  No Perplexity API key -- skipping.")
        perplexity_raw = "NO_PERPLEXITY_KEY"

    # -- Step 3: Google scrape
    print("[WEB] Scraping Google knowledge panel...")
    google_raw = query_google_knowledge(name)

    # ── Step 4: Extract fields ────────────────────────────────────────────────
    fields = ["address", "phone", "hours", "services"]
    
    # Extract "Official" from site side of combined JSON
    official = {f: extract_field(site_raw, f, source="official") for f in fields}
    
    # Extract AI citations
    chatgpt_data    = {f: extract_field(chatgpt_raw, f, source="ai_knowledge") for f in fields}
    perplexity_data = {f: extract_field(perplexity_raw, f) for f in fields}
    google_data     = {f: extract_field(google_raw, f) for f in fields}

    # ── Step 5: Scoring ───────────────────────────────────────────────────────
    def row(field):
        o  = official[field]
        cg = chatgpt_data[field]
        pp = perplexity_data[field]
        gg = google_data[field]
        cg_icon = score_field(o, cg)
        pp_icon = score_field(o, pp)
        gg_icon = score_field(o, gg)
        
        icons = [cg_icon, pp_icon, gg_icon]
        active_icons = [i for i in icons if i in ("✅", "❌", "⚠️")]
        
        hallucination = "✅" if all(x == "✅" for x in active_icons) and active_icons else \
                        "❌" if "❌" in active_icons else \
                        "⚠️" if "⚠️" in active_icons else "—"
                        
        return (
            f"| {field.capitalize()} | {o} | "
            f"{cg} [{cg_icon}] | {pp} [{pp_icon}] | {gg} [{gg_icon}] | {hallucination} |"
        )

    # Calculate score
    all_icons = []
    for f in fields:
        all_icons.extend([score_field(official[f], chatgpt_data[f]), 
                         score_field(official[f], perplexity_data[f]), 
                         score_field(official[f], google_data[f])])
    
    active = [i for i in all_icons if i in ("✅", "❌", "⚠️")]
    total = len(active) or 1
    accuracy_score = int((active.count("✅") / total) * 100)
    hallucination_count = active.count("❌")

    # Worst Offender
    worst_map = {"ChatGPT": 0, "Perplexity": 0, "Google AI": 0}
    for f in fields:
        if score_field(official[f], chatgpt_data[f]) == "❌": worst_map["ChatGPT"] += 1
        if score_field(official[f], perplexity_data[f]) == "❌": worst_map["Perplexity"] += 1
        if score_field(official[f], google_data[f]) == "❌": worst_map["Google AI"] += 1
    
    worst_offender = max(worst_map, key=worst_map.get) if any(worst_map.values()) else "NONE"

    # ── Step 6: Build Report ──────────────────────────────────────────────────
    report = f"""### Audit: {name} — {TODAY}
- **AI Accuracy Score:** {accuracy_score}
- **Hallucinations Found:** {hallucination_count}
- **Worst Offender:** {worst_offender}
- **Category:** {category} | **District:** {district}
- **Critical Issues:**
  - {"None detected." if hallucination_count == 0 else f"{hallucination_count} hallucination(s) detected across AI platforms."}
- **Recommended Fixes:**
  - {"No immediate action needed." if accuracy_score >= 80 else "Coordinate schema update and citation cleanup."}
  
#### Delta Table
| Field | Official | ChatGPT | Perplexity | Google AI | Hallucination? |
|---|---|---|---|---|---|
{row("address")}
{row("hours")}
{row("phone")}
{row("services")}

"""
    return report, accuracy_score, hallucination_count, worst_offender


def main():
    print("GEO Researcher -- API audit tool (1-Call Fix)")
    print(f"   OpenAI key loaded: {'OK' if OPENAI_KEY else 'MISSING'}")
    print()

    while True:
        business = get_pending_business()
        if not business:
            print("✅ No more PENDING businesses in queue.")
            update_researcher_status("IDLE", "All pending audits complete.")
            break

        print(f"📋 Auditing #{business['id']} -- {business['name']}...")
        update_researcher_status("IN_PROGRESS", f"Auditing #{business['id']}: {business['name']}")

        clear_blocked_audit(business["name"])
        
        try:
            report, score, hallucinations, worst = run_audit(business)
            append_audit_report(report)
            mark_business_audited(business["id"], business["name"])
            print(f"   [DONE] Score: {score}/100 | Hallucinations: {hallucinations}")
        except Exception as e:
            print(f"   [!] Error auditing {business['name']}: {e}")
            traceback.print_exc()
            update_researcher_status("BLOCKED", f"Error on #{business['id']}: {str(e)[:50]}")
            break

        update_last_updated()
        
        # Check if there are more businesses before sleeping
        next_biz = get_pending_business()
        if next_biz:
            print(f"   [Pause 65s to stay under OpenAI Tier 0 limits...]")
            time.sleep(65)
        else:
            print("✅ Queue finished.")
            update_researcher_status("IDLE", "Full batch complete.")
            break

    print("\nBatch audit complete. Check data/research_data.md for full results.")


if __name__ == "__main__":
    main()

