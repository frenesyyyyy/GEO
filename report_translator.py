#!/usr/bin/env python3
"""
GEO Report Translator — Human-readable audit summaries ($0 budget)
Reads every audit in data/research_data.md and writes a plain-language
explanation to data/client_fixes/<business>_report.md

This makes the research data understandable without needing to read raw
markdown tables. It covers:
  - What the AI/internet says about this business (right or wrong)
  - Exactly which fields are hallucinated and how
  - A plain-language recommendation for the client
  - The JSON-LD code if a fix file already exists

Usage:
  python report_translator.py                   # Translate all audited businesses
  python report_translator.py --business "Name" # Translate a specific one
  python report_translator.py --dry-run         # Print to console, don't save
"""

import re
import sys
import argparse
import datetime
from pathlib import Path

# Force UTF-8 output on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

RESEARCH_DATA = Path(__file__).parent / "data" / "research_data.md"
CLIENT_FIXES  = Path(__file__).parent / "data" / "client_fixes"
TODAY         = datetime.date.today().isoformat()


# ─────────────────────────────────────────────────────────────────────────────
# Parsing helpers
# ─────────────────────────────────────────────────────────────────────────────

def parse_all_audits(text: str) -> list[dict]:
    """Extract every audit block from research_data.md."""
    # Split on each ### Audit: header
    blocks = re.split(r"(?=### Audit: )", text)
    audits = []
    for block in blocks:
        if not block.strip().startswith("### Audit:"):
            continue
        audit = parse_single_audit(block)
        if audit:
            audits.append(audit)
    return audits


def parse_single_audit(block: str) -> dict | None:
    """Parse one ### Audit: block into a structured dict."""
    try:
        name_match = re.search(r"### Audit: (.+?) —", block)
        if not name_match:
            return None
        name = name_match.group(1).strip()

        score_match      = re.search(r"\*\*AI Accuracy Score:\*\* (\d+)/100", block)
        halluc_match     = re.search(r"\*\*Hallucinations Found:\*\* (\d+)", block)
        offender_match   = re.search(r"\*\*Worst Offender:\*\* (.+)", block)
        category_match   = re.search(r"\*\*Category:\*\* ([^|]+) \| \*\*District:\*\* (.+)", block)
        model_match      = re.search(r"\*\*Model Used:\*\* (.+)", block)

        score      = int(score_match.group(1))     if score_match    else 0
        halluc     = int(halluc_match.group(1))    if halluc_match   else 0
        offender   = offender_match.group(1).strip()  if offender_match else "—"
        category   = category_match.group(1).strip()  if category_match else "—"
        district   = category_match.group(2).strip()  if category_match else "—"
        model      = model_match.group(1).strip()      if model_match    else "—"

        # Parse Delta Table
        fields = {}
        table_match = re.search(r"#### Delta Table\n\|.+?\n\|[-|]+\n(.+?)(?=\n\n|\Z)", block, re.DOTALL)
        if table_match:
            for row in table_match.group(1).splitlines():
                cols = [c.strip() for c in row.strip("|").split("|")]
                if len(cols) >= 3:
                    field_name  = cols[0].strip()
                    official    = cols[1].strip()
                    ai_raw      = cols[2].strip()
                    # Separate value from [icon]
                    icon_match  = re.search(r"\[(✅|❌|⚠️|—)\]", ai_raw)
                    icon        = icon_match.group(1) if icon_match else "—"
                    ai_val      = re.sub(r"\s*\[(✅|❌|⚠️|—)\]", "", ai_raw).strip()
                    fields[field_name] = {
                        "official": official,
                        "ai":       ai_val,
                        "status":   icon,
                    }

        return {
            "name":     name,
            "score":    score,
            "halluc":   halluc,
            "offender": offender,
            "category": category,
            "district": district,
            "model":    model,
            "fields":   fields,
        }
    except Exception as e:
        print(f"   [!] Failed to parse audit block: {e}")
        return None


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def load_existing_json_ld(name: str) -> str | None:
    """Load the JSON-LD from the existing fix file if it exists."""
    fix_file = CLIENT_FIXES / f"{slugify(name)}_geo_fix.md"
    if not fix_file.exists():
        return None
    text = fix_file.read_text(encoding="utf-8")
    match = re.search(r"```html\n(.+?)\n```", text, re.DOTALL)
    return match.group(1).strip() if match else None


# ─────────────────────────────────────────────────────────────────────────────
# Plain-language report builder
# ─────────────────────────────────────────────────────────────────────────────

ICON_LABELS = {
    "✅": "✅ CORRECT — The internet matches the official site.",
    "❌": "❌ WRONG — This is a hallucination. The internet shows incorrect data.",
    "⚠️": "⚠️ PARTIAL — Roughly correct but missing important detail.",
    "—": "— MISSING — No data was found in either source for this field.",
}

SCORE_VERDICT = {
    range(0,  1):   "🚨 CRITICAL — The AI has zero correct information about this business.",
    range(1,  40):  "🔴 VERY BAD — Most AI knowledge about this business is wrong.",
    range(40, 60):  "🟠 POOR — Roughly half of the AI's data is incorrect.",
    range(60, 80):  "🟡 FAIR — Most things are right but there are notable errors.",
    range(80, 100): "🟢 GOOD — The AI is mostly accurate. Minor inconsistencies only.",
    range(100, 101):"🏆 PERFECT — Full match. No GEO intervention needed right now.",
}

def get_verdict(score: int) -> str:
    for r, label in SCORE_VERDICT.items():
        if score in r:
            return label
    return "Unknown"


def build_report(audit: dict) -> str:
    name     = audit["name"]
    score    = audit["score"]
    halluc   = audit["halluc"]
    offender = audit["offender"]
    category = audit["category"]
    district = audit["district"]
    fields   = audit["fields"]

    # ── Header ──
    lines = [
        f"# 📋 GEO Human Report — {name}",
        f"> Generated on {TODAY} by the GEO Report Translator Agent",
        "",
        "---",
        "",
        "## 🏢 Who Is This Business?",
        f"- **Name:** {name}",
        f"- **Type:** {category}",
        f"- **Neighbourhood:** {district}, Rome",
        "",
        "---",
        "",
        "## 🤖 What Does the AI Think About This Business?",
        "",
        f"**Overall AI Accuracy Score: {score}/100**",
        f"> {get_verdict(score)}",
        "",
    ]

    if halluc == 0:
        lines.append("The AI currently has no major factual errors about this business. However, if data is missing, it means the AI simply has no information — which is still a problem for visibility.")
    elif halluc == 1:
        lines.append(f"The AI has **{halluc} hallucination**. This means there is 1 field where the internet shows wrong information compared to what the business actually says on their website. This needs to be corrected urgently because AI chatbots and search engines will tell potential clients the wrong thing.")
    else:
        lines.append(f"The AI has **{halluc} hallucinations**. This means there are {halluc} fields where the internet shows wrong information. Every one of these is a potential client lost because AI chatbots will give incorrect information about this business.")

    lines += ["", f"**Main source of bad data:** {offender}", "", "---", ""]

    # ── Field by Field Breakdown ──
    lines += ["## 📊 Field by Field Breakdown", "", "This is what the AI/internet says about each piece of business information:", ""]

    for field, data in fields.items():
        official = data["official"]
        ai_val   = data["ai"]
        status   = data["status"]
        label    = ICON_LABELS.get(status, "—")

        lines.append(f"### {field}")
        lines.append(f"- **What the official website says:** `{official}`")
        lines.append(f"- **What the AI / internet says:** `{ai_val}`")
        lines.append(f"- **Result:** {label}")

        # Human explanation
        if status == "❌":
            lines.append(f"  > ⚠️ **Action needed:** If someone asks an AI assistant about this business's {field.lower()}, they will receive wrong information. This must be corrected with proper structured data on the website.")
        elif status == "✅":
            lines.append(f"  > ✅ **No action needed for this field.** The AI correctly knows the {field.lower()} of this business.")
        elif official == "Not mentioned":
            lines.append(f"  > ℹ️ **Opportunity:** The official website doesn't mention this field at all. This is a chance to add structured data so AI engines can surface this business more confidently.")
        lines.append("")

    lines += ["---", ""]

    # ── What to Tell the Client ──
    lines += ["## 💬 What to Tell the Client (Sales Script)", ""]

    if halluc == 0 and score == 100:
        lines += [
            f"*\"{name} is already well represented in AI search results. However, as AI search evolves rapidly, we recommend adding Schema.org markup as a preventive measure to ensure this stays accurate in the future.\"*",
        ]
    elif halluc == 0:
        lines += [
            f"*\"Our AI audit of {name} shows that while there are no direct hallucinations, there are {len([f for f, d in fields.items() if d['official'] == 'Not mentioned'])} fields where AI engines simply have no data about you — your {', '.join([f for f, d in fields.items() if d['official'] == 'Not mentioned']) or 'details'}. When someone asks an AI assistant about you, it will say nothing, meaning your competitor will win that query. We can fix that.\"*",
        ]
    else:
        wrong_fields = [f for f, d in fields.items() if d["status"] == "❌"]
        lines += [
            f"*\"Our audit found that AI search engines and aggregators are currently showing incorrect information about {name}. Specifically, your **{', '.join(wrong_fields)}** {'is' if len(wrong_fields) == 1 else 'are'} wrong. When a potential client asks ChatGPT or a Google AI Overview about your business, they receive this incorrect data. This is directly costing you clients. We can deploy a technical fix in 24 hours that corrects this at the source.\"*",
        ]

    lines += ["", "---", ""]

    # ── JSON-LD Fix ──
    json_ld = load_existing_json_ld(name)
    if json_ld:
        lines += [
            "## 🔧 Technical Fix (Ready to Deploy)",
            "",
            "The following Schema.org code should be inserted into the `<head>` section of the website.",
            "This acts as ground truth for all AI crawlers (OBot, Googlebot, PerplexityBot):",
            "",
            "```html",
            json_ld,
            "```",
            "",
            "> **Instructions for webmaster:** Copy this block and paste it inside the `<head>...</head>` tag on every page of the website. No plugin needed — it is plain HTML.",
        ]
    else:
        lines += [
            "## 🔧 Technical Fix",
            "",
            "> No JSON-LD fix file found yet. Run `py fix_generator.py` first to generate the Schema.org code for this business.",
        ]

    lines += [
        "",
        "---",
        f"*Confidential GEO Report — {name} — Created by GEO Consulting Roma*",
    ]

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="GEO Report Translator — Human-readable audit summaries")
    parser.add_argument("--business", default=None, help="Translate only a specific business name")
    parser.add_argument("--dry-run",  action="store_true", help="Print to console, don't save files")
    args = parser.parse_args()

    print("=" * 60)
    print(" GEO REPORT TRANSLATOR — Human Language Agent")
    print(f" Date: {TODAY}")
    print("=" * 60)

    if not RESEARCH_DATA.exists():
        print("❌ data/research_data.md not found.")
        sys.exit(1)

    text   = RESEARCH_DATA.read_text(encoding="utf-8")
    audits = parse_all_audits(text)

    if not audits:
        print("❌ No audits found in research_data.md.")
        sys.exit(1)

    # Filter if --business specified
    if args.business:
        audits = [a for a in audits if args.business.lower() in a["name"].lower()]
        if not audits:
            print(f"❌ No audit found for business matching '{args.business}'")
            sys.exit(1)

    print(f"\nFound {len(audits)} audit(s) to translate.\n")
    CLIENT_FIXES.mkdir(parents=True, exist_ok=True)

    for i, audit in enumerate(audits, 1):
        name = audit["name"]
        print(f"[{i}/{len(audits)}] Translating: {name}")

        report  = build_report(audit)
        outfile = CLIENT_FIXES / f"{slugify(name)}_report.md"

        if args.dry_run:
            print("\n" + "─" * 60)
            print(report[:1500] + "\n[... truncated for dry-run ...]")
            print("─" * 60 + "\n")
        else:
            outfile.write_text(report, encoding="utf-8")
            print(f"   ✅ Saved to: {outfile.name}")

    print(f"\n✅ Done. Reports saved to data/client_fixes/")
    print("   Open any *_report.md file to read a plain-language audit summary.")


if __name__ == "__main__":
    main()
