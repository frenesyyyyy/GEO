#!/usr/bin/env python3
"""
GEO Fix Generator — V2 Product Deliverable Generator ($0 budget)
Reads AUDITED businesses from data/research_data.md and uses Ollama to generate
the exact JSON-LD Schema.org code and keyword recommendations the client needs.

Usage:
  python fix_generator.py                          # Process all AUDITED businesses
  python fix_generator.py --business "Name"        # Process a specific business
  python fix_generator.py --model mistral          # Use a different model
"""

import re
import sys
import argparse
import datetime
from pathlib import Path

try:
    import requests
except ImportError:
    print("requests not installed. Run: pip install requests")
    sys.exit(1)

# Force UTF-8 output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# Paths
BASE_DIR       = Path(__file__).parent
DATA_DIR       = BASE_DIR / "data"
RESEARCH_DATA  = DATA_DIR / "research_data.md"
FIXES_DIR      = DATA_DIR / "client_fixes"
TODAY          = datetime.date.today().isoformat()
OLLAMA_BASE    = "http://localhost:11434"
DEFAULT_MODEL  = "gemma3:4b"

FIXES_DIR.mkdir(parents=True, exist_ok=True)


# Ollama helper
def query_ollama(prompt: str, model: str) -> str:
    """Send a prompt to Ollama and return the raw string response."""
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.15, "num_predict": 1000},
    }
    for attempt in range(3):
        try:
            r = requests.post(f"{OLLAMA_BASE}/api/generate", json=payload, timeout=120)
            r.raise_for_status()
            return r.json().get("response", "").strip()
        except Exception as e:
            if attempt == 2:
                return f"OLLAMA_ERROR: {e}"


def check_ollama(model: str) -> bool:
    try:
        r = requests.get(f"{OLLAMA_BASE}/api/tags", timeout=5)
        if r.status_code != 200:
            return False
        models_full = [m["name"] for m in r.json().get("models", [])]
        models_base = [m["name"].split(":")[0] for m in r.json().get("models", [])]
        return model in models_full or model in models_base or model.split(":")[0] in models_base
    except Exception:
        return False


# Parsers
def get_audited_businesses() -> dict:
    """Returns {name: {score: int, hallucinations: int, delta_text: str}}"""
    if not RESEARCH_DATA.exists():
        return {}

    text = RESEARCH_DATA.read_text(encoding="utf-8")
    
    # Needs to match: ### Audit: Studio Legale Parioli — 2026-03-20
    pattern = re.compile(
        r"### Audit: (.+?) — ([\d-]+)\n(.*?)(?=### Audit:|### Report Template:|---)",
        re.DOTALL
    )
    
    audits = {}
    for m in pattern.finditer(text):
        name = m.group(1).strip()
        body = m.group(3).strip()
        
        score_m = re.search(r"\*\*AI Accuracy Score:\*\*\s*(\d+)", body)
        score = int(score_m.group(1)) if score_m else 100
        
        if score == 100:
            continue  # No fix needed if 100% accurate
            
        # Extract the Delta Table specifically to isolate official data
        table_m = re.search(r"(#### Delta Table.+)", body, re.DOTALL)
        delta_text = table_m.group(1) if table_m else body

        audits[name] = {"score": score, "delta_text": delta_text[:1500]}
        
    return audits


def get_queue_statuses() -> dict:
    """Returns {name: status} from the Business Audit Queue"""
    if not RESEARCH_DATA.exists():
        return {}
    text = RESEARCH_DATA.read_text(encoding="utf-8")
    pattern = re.compile(r"\|\s*\d+\s*\|\s*([^|]+?)\s*\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|\s*([A-Z_]+)\s*\|")
    return {m.group(1).strip(): m.group(2).strip() for m in pattern.finditer(text) if m.group(1).strip() != "Business Name"}


def mark_queue_fixed(business_name: str):
    """Update research_data.md queue status from AUDITED to FIX_GENERATED"""
    text = RESEARCH_DATA.read_text(encoding="utf-8")
    # Add FIX_GENERATED to allowed statuses if not present
    if "FIX_GENERATED" not in text and "**Status Values:**" in text:
        text = text.replace("**Status Values:** `PENDING`", "**Status Values:** `PENDING` | `FIX_GENERATED` | `AUDITED`")
        
    pattern = re.compile(rf"(\|\s*\d+\s*\|\s*{re.escape(business_name)}\s*\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|\s*)(AUDITED)(\s*\|)")
    updated = pattern.sub(r"\g<1>FIX_GENERATED\3", text)
    RESEARCH_DATA.write_text(updated, encoding="utf-8")


# Generators
def generate_json_ld(business_name: str, delta_table: str, model: str) -> str:
    prompt = (
        f"You are a strict technical SEO expert.\n"
        f"Below is a comparison table showing the OFFICIAL data for '{business_name}'.\n\n"
        f"=== Audit Data ===\n{delta_table}\n\n"
        f"Task:\n"
        f"1. Extract ONLY the 'Official (Website)' values.\n"
        f"2. Write a valid Schema.org JSON-LD LocalBusiness block using ONLY the Official data.\n"
        f"3. CRITICAL RULES:\n"
        f"   - NEVER MAKE UP DATA. If a field (like phone, hours, or street address) is listed as 'Not mentioned' or is simply missing, YOU MUST OMIT that property from the JSON. Do not invent filler data.\n"
        f"   - If Address is just 'Roma', only output addressLocality: 'Roma', do not invent a street.\n"
        f"4. Output ONLY the JSON code inside ```json ... ``` tags. No introduction, no other text."
    )
    res = query_ollama(prompt, model)
    # Extract just the JSON if wrapped in markdown
    m = re.search(r"```json\s*(.*?)\s*```", res, re.DOTALL)
    if m:
        return m.group(1).strip()
    return res


def generate_seo_keywords(business_name: str, delta_table: str, model: str) -> str:
    prompt = (
        f"You are a GEO consultant. Based on the services listed in the Official data below for '{business_name}', "
        f"provide 5 highly specific, long-tail search queries (in Italian) that potential clients would ask ChatGPT "
        f"or Google AI to find this exact business in Rome.\n\n"
        f"=== Audit Data ===\n{delta_table}\n\n"
        f"Output ONLY a bulleted list of the 5 queries. No intro text."
    )
    return query_ollama(prompt, model)


# Main
def main():
    parser = argparse.ArgumentParser(description="GEO Fix Generator")
    parser.add_argument("--model",    default=DEFAULT_MODEL, help="Ollama model to use")
    parser.add_argument("--business", default=None, help="Target a specific business name")
    args = parser.parse_args()

    print("=" * 60)
    print(" GEO FIX GENERATOR — Sellable Assets")
    print(f" Model: {args.model}")
    print("=" * 60 + "\n")

    if not check_ollama(args.model):
        print(f"Ollama not running or model '{args.model}' not found.")
        sys.exit(1)

    audits = get_audited_businesses()
    queue = get_queue_statuses()

    if not audits:
        print("No completed audits found in research_data.md.")
        sys.exit(0)

    # Filter targets
    targets = []
    for name, data in audits.items():
        if args.business and args.business.lower() not in name.lower():
            continue
        # Only process if status is AUDITED (not already FIX_GENERATED)
        status = queue.get(name, "UNKNOWN")
        if status == "AUDITED" or args.business:
             targets.append((name, data))

    if not targets:
        print("No new AUDITED businesses need fixes. All caught up!")
        sys.exit(0)

    print(f"Found {len(targets)} business(es) requiring fix generation.")

    for idx, (name, data) in enumerate(targets, 1):
        print(f"\n[{idx}/{len(targets)}] Generating assets for: {name}")
        
        safe_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', name.replace(' ', '_')).lower()
        outfile = FIXES_DIR / f"{safe_name}_geo_fix.md"
        
        # 1. Generate JSON-LD
        print("   -> Writing JSON-LD Schema.org code...", flush=True)
        json_ld = generate_json_ld(name, data["delta_text"], args.model)
        
        # 2. Generate Keywords
        print("   -> Predicting AI search queries...", flush=True)
        keywords = generate_seo_keywords(name, data["delta_text"], args.model)
        
        # 3. Assemble document
        content = (
            f"# GEO Audit Fix Package — {name}\n"
            f"> Generated on {TODAY} | Score: {data['score']}/100\n\n"
            f"## 1. Technical Implementation (JSON-LD)\n"
            f"**Instructions for Webmaster:** Copy and paste this exact snippet directly into the <head> section of the homepage. "
            f"This acts as the 'ground truth' for AI scraping bots like OpenAI's OBot and Googlebot.\n\n"
            f"```html\n"
            f"<script type=\"application/ld+json\">\n"
            f"{json_ld}\n"
            f"</script>\n"
            f"```\n\n"
            f"## 2. Target AI Queries (Testing)\n"
            f"Once the markup is indexed (approx 3-7 days), verify your ranking on ChatGPT/Perplexity/Google AI Overviews using these exact user prompts:\n\n"
            f"{keywords}\n\n"
            f"---\n"
            f"*Confidential Deliverable — Created by GEO Consulting Roma*"
        )
        
        outfile.write_text(content, encoding="utf-8")
        print(f"   Saved to: data/client_fixes/{outfile.name}")
        
        mark_queue_fixed(name)

    print("\nAll target businesses processed.")

if __name__ == "__main__":
    main()
