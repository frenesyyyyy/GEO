#!/usr/bin/env python3
"""
GEO Learner — Ollama-powered self-learning agent ($0 budget)
Reads completed audit reports from data/research_data.md and brain/brain.md,
then uses Ollama to identify new hallucination patterns and update confidence scores.

Usage:
  python learner_update.py            # Run full learning cycle
  python learner_update.py --dry-run  # Print proposed changes without writing
  python learner_update.py --force    # Ignore 7-day cooldown
  python learner_update.py --model gemma3:4b  # Specify model
"""

import re
import sys
import json
import time
import argparse
import datetime
from pathlib import Path

try:
    import requests
except ImportError:
    print("❌ requests not installed. Run: pip install requests")
    sys.exit(1)

# Force UTF-8 output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# ── Paths ──────────────────────────────────────────────────────────────────────
RESEARCH_DATA  = Path(__file__).parent / "data" / "research_data.md"
BRAIN_FILE     = Path(__file__).parent / "brain" / "brain.md"
TODAY          = datetime.date.today().isoformat()
OLLAMA_BASE    = "http://localhost:11434"
DEFAULT_MODEL  = "gemma3:4b"


# ─────────────────────────────────────────────────────────────────────────────
# Ollama helper
# ─────────────────────────────────────────────────────────────────────────────

def query_ollama(prompt: str, model: str, expect_json: bool = True) -> str | dict:
    """Send a prompt to Ollama and return the response (string or parsed dict)."""
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.15, "num_predict": 600},
    }
    try:
        r = requests.post(f"{OLLAMA_BASE}/api/generate", json=payload, timeout=120)
        r.raise_for_status()
        raw = r.json().get("response", "").strip()

        if expect_json:
            json_text = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.MULTILINE).strip()
            try:
                return json.loads(json_text)
            except json.JSONDecodeError:
                return raw  # Return raw string if JSON fails

        return raw
    except Exception as e:
        return f"OLLAMA_ERROR: {e}"


def check_ollama(model: str) -> bool:
    try:
        r = requests.get(f"{OLLAMA_BASE}/api/tags", timeout=5)
        models_full = [m["name"] for m in r.json().get("models", [])]
        models_base = [m["name"].split(":")[0] for m in r.json().get("models", [])]
        return model in models_full or model in models_base or model.split(":")[0] in models_base
    except Exception:
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Read helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_brain_content() -> str:
    return BRAIN_FILE.read_text(encoding="utf-8")


def get_new_audit_reports() -> list[dict]:
    """
    Extract all completed audit reports since the last Learner run.
    Returns list of dicts: {business, score, hallucinations, date, raw_text}
    """
    text = RESEARCH_DATA.read_text(encoding="utf-8")
    # Find all ### Audit: blocks
    pattern = re.compile(
        r"### Audit: (.+?) — (\d{4}-\d{2}-\d{2})\n(.*?)(?=### Audit:|### Report Template:)",
        re.DOTALL,
    )
    reports = []
    for m in pattern.finditer(text):
        business = m.group(1).strip()
        date     = m.group(2).strip()
        body     = m.group(3).strip()

        score_m = re.search(r"\*\*AI Accuracy Score:\*\*\s*(\d+)", body)
        hall_m  = re.search(r"\*\*Hallucinations Found:\*\*\s*(\d+)", body)

        reports.append({
            "business":     business,
            "date":         date,
            "score":        int(score_m.group(1)) if score_m else None,
            "hallucinations": int(hall_m.group(1)) if hall_m else 0,
            "raw_text":     body,
        })
    return reports


def days_since_last_update() -> int:
    """Return number of days since brain.md was last updated."""
    text = BRAIN_FILE.read_text(encoding="utf-8")
    m = re.search(r"\*\*Last Updated:\*\*\s*(\d{4}-\d{2}-\d{2})", text)
    if not m:
        return 999
    last = datetime.date.fromisoformat(m.group(1))
    return (datetime.date.today() - last).days


def has_needs_review_flag() -> bool:
    text = BRAIN_FILE.read_text(encoding="utf-8")
    return "NEEDS_REVIEW: [NONE]" not in text and "NEEDS_REVIEW:" in text


def get_needs_review_content() -> str:
    text = BRAIN_FILE.read_text(encoding="utf-8")
    m = re.search(r"<!-- NEEDS_REVIEW: \[(.+?)\] -->", text)
    return m.group(1) if m else ""


# ─────────────────────────────────────────────────────────────────────────────
# Brain update writers
# ─────────────────────────────────────────────────────────────────────────────

def update_brain_timestamp():
    text = BRAIN_FILE.read_text(encoding="utf-8")
    updated = re.sub(r"\*\*Last Updated:\*\*.*", f"**Last Updated:** {TODAY}", text, count=1)
    BRAIN_FILE.write_text(updated, encoding="utf-8")


def clear_needs_review_flag():
    text = BRAIN_FILE.read_text(encoding="utf-8")
    updated = re.sub(
        r"<!-- NEEDS_REVIEW: \[.+?\] -->",
        "<!-- NEEDS_REVIEW: [NONE] -->",
        text,
    )
    BRAIN_FILE.write_text(updated, encoding="utf-8")


def append_learning_session(session_text: str):
    """Append a new learning session log to brain.md."""
    text = BRAIN_FILE.read_text(encoding="utf-8")
    anchor = "## 📚 Learning Session Log"
    if anchor in text:
        updated = text.replace(anchor, anchor + "\n\n" + session_text)
    else:
        updated = text + "\n\n" + session_text
    BRAIN_FILE.write_text(updated, encoding="utf-8")


def append_new_pattern(pattern_text: str):
    """Append a new hallucination pattern to brain.md (APPEND-ONLY)."""
    text = BRAIN_FILE.read_text(encoding="utf-8")
    # Insert before the Rome-Specific section
    anchor = "## 🏆 Rome-Specific Intelligence"
    if anchor in text:
        updated = text.replace(anchor, pattern_text + "\n" + anchor)
    else:
        updated = text + "\n" + pattern_text
    BRAIN_FILE.write_text(updated, encoding="utf-8")


def update_confidence_scores(updates: list[dict]):
    """
    Update confidence scores for existing factors in brain.md.
    Each update dict: {factor_name: str, new_confidence: int}
    """
    text = BRAIN_FILE.read_text(encoding="utf-8")
    for upd in updates:
        factor = upd.get("factor_name", "")
        new_conf = upd.get("new_confidence")
        if not factor or not new_conf:
            continue
        # Update the percentage in the table row for this factor
        pattern = re.compile(
            rf"(\|\s*{re.escape(factor)}\s*\|\s*)(\d+)(%)",
            re.IGNORECASE,
        )
        text = pattern.sub(rf"\g<1>{new_conf}\3", text)
    BRAIN_FILE.write_text(text, encoding="utf-8")


def update_learner_status(status: str, note: str = ""):
    text = RESEARCH_DATA.read_text(encoding="utf-8")
    pattern = re.compile(r"(\| Learner \|)[^|]+(\|)[^|]+(\|)[^|]+(\|)[^\n]+")
    replacement = f"| Learner | `{status}` | — | {TODAY} | {note} |"
    updated = pattern.sub(replacement, text)
    RESEARCH_DATA.write_text(updated, encoding="utf-8")


def append_learner_log(track: str, new_factors: str, patterns_updated: str):
    text = RESEARCH_DATA.read_text(encoding="utf-8")
    log_line = f"| {TODAY} | {track} | {new_factors} | {patterns_updated} | DONE |\n"
    anchor = "\n---\n\n## 🎨 Designer Log"
    if "## 🧭 Learner Log" in text:
        updated = text.replace(anchor, f"\n{log_line.rstrip()}{anchor}")
    else:
        updated = text + log_line
    RESEARCH_DATA.write_text(updated, encoding="utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# Core learning logic
# ─────────────────────────────────────────────────────────────────────────────

def run_pattern_analysis(reports: list[dict], brain: str, model: str) -> dict:
    """
    Ask Ollama to analyze new audit reports against existing patterns.
    Returns: {new_pattern: str|None, confidence_updates: list, summary: str}
    """
    if not reports:
        return {"new_pattern": None, "confidence_updates": [], "summary": "No new audits to analyze."}

    reports_text = "\n\n".join([
        f"Business: {r['business']}\nScore: {r['score']}/100\nHallucinations: {r['hallucinations']}\n{r['raw_text'][:600]}"
        for r in reports
    ])

    prompt = (
        f"You are a GEO (Generative Engine Optimization) research analyst.\n\n"
        f"=== EXISTING HALLUCINATION PATTERNS IN brain.md ===\n{brain[:3000]}\n\n"
        f"=== NEW AUDIT REPORTS ===\n{reports_text}\n\n"
        f"Task: Analyze the new audit reports and respond with ONLY a valid JSON object:\n"
        f"{{\n"
        f'  "new_pattern_found": true/false,\n'
        f'  "pattern_name": "Short name (e.g. Pattern-005: Name) or null",\n'
        f'  "pattern_description": "One sentence describing the hallucination pattern or null",\n'
        f'  "pattern_fix": "One sentence fix recommendation or null",\n'
        f'  "confidence_updates": [\n'
        f'    {{"factor_name": "Schema.org LocalBusiness markup", "new_confidence": 93}}\n'
        f'  ],\n'
        f'  "summary": "2-3 sentence summary of what you learned from these audits"\n'
        f"}}\n\n"
        f"Rules:\n"
        f"- Only propose a new pattern if the audit data shows a CLEAR pattern not already listed\n"
        f"- Confidence updates: only update if evidence from audit supports a change (±3% max)\n"
        f"- Output ONLY the JSON. No explanation, no markdown fences.\n"
    )

    print("   [Ollama] Analyzing patterns...", flush=True)
    t0 = time.time()
    result = query_ollama(prompt, model, expect_json=True)
    print(f"   [Ollama] Responded in {time.time() - t0:.1f}s", flush=True)

    if isinstance(result, str):
        # JSON parsing failed — extract what we can
        return {
            "new_pattern": None,
            "confidence_updates": [],
            "summary": result[:200] if result else "Ollama returned unparseable response.",
        }

    return result


def run_geo_research(model: str) -> str:
    """
    Ask Ollama to surface any new GEO best practices it knows about.
    Returns a markdown string to append to brain.md.
    """
    prompt = (
        f"You are a GEO (Generative Engine Optimization) research analyst.\n"
        f"Today is {TODAY}. List 3 specific, actionable GEO best practices for local businesses in Rome, Italy.\n"
        f"Focus on getting businesses cited by AI models like ChatGPT, Perplexity, and Google AI Overviews.\n\n"
        f"Format each as:\n"
        f"- Factor: [name] | Confidence: [50-95]% | Note: [one-line explanation]\n\n"
        f"Only list factors NOT already covered by the basics (schema markup, NAP consistency, GBP).\n"
        f"Be specific. Use 2026 context. No padding or filler text."
    )
    return query_ollama(prompt, model, expect_json=False)


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="GEO Learner — Ollama self-learning agent ($0)")
    parser.add_argument("--model",   default=DEFAULT_MODEL, help="Ollama model")
    parser.add_argument("--dry-run", action="store_true",   help="Print proposed changes without writing")
    parser.add_argument("--force",   action="store_true",   help="Ignore 7-day cooldown")
    args = parser.parse_args()

    print("=" * 60)
    print(f" GEO LEARNER — Self-Learning Cycle")
    print(f" Model: {args.model} | Date: {TODAY}")
    print("=" * 60 + "\n")

    # ── Ollama check ────────────────────────────────────────────────────────
    if not check_ollama(args.model):
        print(f"❌ Ollama not running or model '{args.model}' not found.")
        sys.exit(1)
    print(f"✅ Ollama ready.\n")

    # ── Anti-loop gate: 7-day cooldown (unless NEEDS_REVIEW or --force) ─────
    days = days_since_last_update()
    needs_review = has_needs_review_flag()
    review_content = get_needs_review_content()

    if days < 7 and not needs_review and not args.force:
        print(f"⏸  brain.md was updated {days} day(s) ago. Cooldown active (7-day cycle).")
        print("   → Use --force to override, or wait for a NEEDS_REVIEW flag from the Researcher.")
        update_learner_status("IDLE", f"Cooldown: {days}d since last update. Next: {7 - days}d.")
        sys.exit(0)

    trigger = "NEEDS_REVIEW" if needs_review else ("forced" if args.force else "7-day cycle")
    print(f"▶  Starting learning cycle. Trigger: {trigger}")
    if needs_review:
        print(f"   NEEDS_REVIEW content: {review_content}")

    update_learner_status("IN_PROGRESS", f"Cycle started: trigger={trigger}")

    # ── Track 1: Pattern analysis from audit reports ─────────────────────────
    print("\n[Track 1] Analyzing completed audit reports...", flush=True)
    brain_text = get_brain_content()
    reports    = get_new_audit_reports()

    print(f"   Found {len(reports)} audit report(s) to analyze.")
    analysis = run_pattern_analysis(reports, brain_text, args.model)

    # ── Track 2: GEO research (new factors from model knowledge) ─────────────
    print("\n[Track 2] Running GEO factor research...", flush=True)
    geo_insights = run_geo_research(args.model)

    # ── Build session summary ────────────────────────────────────────────────
    pattern_count = "0"
    conf_updates  = analysis.get("confidence_updates", [])
    summary_text  = analysis.get("summary", "No summary available.")

    new_pattern_md = ""
    if analysis.get("new_pattern_found") and analysis.get("pattern_name"):
        # Count existing patterns to get next ID
        existing_pattern_ids = re.findall(r"Pattern-(\d+):", brain_text)
        next_id = max([int(i) for i in existing_pattern_ids], default=0) + 1
        pattern_count = "1"
        new_pattern_md = (
            f"\n### Pattern-{next_id:03d}: {analysis.get('pattern_name', 'Unknown')}\n"
            f"- **Description:** {analysis.get('pattern_description', 'See audit report.')}\n"
            f"- **Fix:** {analysis.get('pattern_fix', 'See fix recommendations.')}\n"
            f"- **Frequency:** UNKNOWN (new — needs more audits to confirm)\n"
            f"- **Discovered:** Learner cycle — {TODAY}\n"
        )

    session_log = (
        f"### Session {datetime.datetime.now().strftime('%Y%m%d-%H%M')} — {TODAY}\n"
        f"- **Trigger:** {trigger}\n"
        f"- **Reports Analyzed:** {len(reports)}\n"
        f"- **New Patterns Found:** {pattern_count}\n"
        f"- **Confidence Updates:** {len(conf_updates)}\n"
        f"- **GEO Research Insights:** See below\n"
        f"- **Summary:** {summary_text}\n\n"
        f"#### GEO Research Findings (Track 2)\n{geo_insights}\n"
    )

    # ── Dry run: just print ──────────────────────────────────────────────────
    if args.dry_run:
        print("\n" + "─" * 60)
        print("DRY RUN — Proposed brain.md changes (NOT saved):")
        print("─" * 60)
        if new_pattern_md:
            print(f"\n[NEW PATTERN]\n{new_pattern_md}")
        if conf_updates:
            print(f"\n[CONFIDENCE UPDATES]\n{json.dumps(conf_updates, indent=2)}")
        print(f"\n[SESSION LOG]\n{session_log}")
        print("\n[GEO INSIGHTS]\n", geo_insights)
        sys.exit(0)

    # ── Write to brain.md ────────────────────────────────────────────────────
    print("\n[Write] Updating brain.md...", flush=True)

    if new_pattern_md:
        append_new_pattern(new_pattern_md)
        print(f"   [+] New pattern added: {analysis.get('pattern_name')}")

    if conf_updates:
        update_confidence_scores(conf_updates)
        print(f"   [+] Updated {len(conf_updates)} confidence score(s)")

    append_learning_session(session_log)
    update_brain_timestamp()

    if needs_review:
        clear_needs_review_flag()
        print("   [+] NEEDS_REVIEW flag cleared")

    # ── Update research_data.md ──────────────────────────────────────────────
    conf_str = f"{len(conf_updates)} scores updated" if conf_updates else "no changes"
    append_learner_log(
        track=f"All tracks ({trigger})",
        new_factors=f"{pattern_count} new pattern(s)",
        patterns_updated=conf_str,
    )
    update_learner_status("DONE", f"Cycle complete. {pattern_count} new pattern(s), {conf_str}.")

    print(f"\n✅ Learning cycle complete.")
    print(f"   brain.md updated. New patterns: {pattern_count}. Conf updates: {len(conf_updates)}.")


if __name__ == "__main__":
    main()
