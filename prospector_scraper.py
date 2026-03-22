#!/usr/bin/env python3
"""
GEO Prospector V3 — Overpass API (OpenStreetMap) powered ($0 budget)
Replaces Pagine Gialle scraper entirely.

PRIMARY SOURCE: Overpass API — free, structured JSON, zero bot detection.
FALLBACK: Playwright on Google Maps — if Overpass returns < 2 results.

Usage:
  python prospector_scraper.py --zone "Parioli" --count 5
  python prospector_scraper.py --zone "Prati" --count 3 --dry-run
  python prospector_scraper.py --zone "Parioli" --category notaio --count 5

Supported Zones:
  parioli, prati, centro, flaminio, trieste

Supported Categories:
  notaio, avvocato, medico, dentista, chirurgo-estetico, commercialista

Requirements (all free):
  pip install requests beautifulsoup4
  pip install playwright && playwright install chromium  ← for fallback only
"""

import re
import sys
import time
import json
import random
import argparse
import datetime
import requests
from pathlib import Path

# Force UTF-8 on Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# ── Paths ──────────────────────────────────────────────────────────────────────
RESEARCH_DATA = Path(__file__).parent / "data" / "research_data.md"
TODAY         = datetime.date.today().isoformat()
OVERPASS_URL  = "https://overpass-api.de/api/interpreter"

# ── Zone bounding boxes (lat_min, lon_min, lat_max, lon_max) ──────────────────
ZONE_MAP = {
    "parioli":  {"bbox": (41.908, 12.483, 41.930, 12.510), "district": "Parioli"},
    "prati":    {"bbox": (41.900, 12.455, 41.918, 12.480), "district": "Prati"},
    "centro":   {"bbox": (41.887, 12.465, 41.905, 12.495), "district": "Centro"},
    "flaminio": {"bbox": (41.915, 12.470, 41.940, 12.498), "district": "Flaminio"},
    "trieste":  {"bbox": (41.910, 12.510, 41.930, 12.540), "district": "Trieste"},
}

# ── Category → OSM tag mapping ────────────────────────────────────────────────
# Overpass uses OSM key=value tags; multiple tags per category via union queries
CATEGORY_MAP = {
    "notaio": {
        "label": "Notaio",
        "osm_tags": ['"office"="notary"'],
    },
    "avvocato": {
        "label": "Studio Legale",
        "osm_tags": ['"office"="lawyer"', '"amenity"="lawyers"'],
    },
    "medico": {
        "label": "Medico",
        "osm_tags": ['"amenity"="doctors"', '"healthcare"="doctor"'],
    },
    "dentista": {
        "label": "Dentista",
        "osm_tags": ['"amenity"="dentist"', '"healthcare"="dentist"'],
    },
    "chirurgo-estetico": {
        "label": "Chirurgo Estetico",
        "osm_tags": ['"healthcare"="hospital"', '"amenity"="clinic"'],
    },
    "commercialista": {
        "label": "Commercialista",
        "osm_tags": ['"office"="accountant"', '"office"="tax_advisor"'],
    },
}

DEFAULT_CATEGORIES = ["notaio", "avvocato", "medico", "dentista", "commercialista"]

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


# ─────────────────────────────────────────────────────────────────────────────
# Name Validation (Fix 3)
# ─────────────────────────────────────────────────────────────────────────────

def is_valid_business_name(name: str) -> bool:
    """
    Return True only if the name looks like a real business.
    Rejects navigation headings, generic Italian words, and obvious junk.
    """
    if not name or len(name.strip()) < 4:
        return False

    stripped = name.strip()

    # Reject if all-caps AND consists only of garbage words
    words = re.findall(r"[a-zA-ZÀ-ÿ]+", stripped.lower())
    if not words:
        return False

    garbage_hit = sum(1 for w in words if w in GARBAGE_WORDS)
    if garbage_hit >= len(words):
        return False  # Every word is a garbage word

    # Reject if it is a single generic all-caps word (likely a nav heading)
    if stripped.isupper() and len(words) == 1 and words[0] in GARBAGE_WORDS:
        return False

    # Reject overly short all-caps multi-word nav phrases
    if stripped.isupper() and len(words) <= 3 and garbage_hit > 0:
        return False

    # Must have at least one word with length > 2
    if not any(len(w) > 2 for w in words):
        return False

    return True


# ─────────────────────────────────────────────────────────────────────────────
# Overpass API — Primary Source (Fix 2 + Fix 4)
# ─────────────────────────────────────────────────────────────────────────────

def build_overpass_query(osm_tags: list[str], bbox: tuple) -> str:
    """Build an Overpass QL query for multiple OSM tags in a bounding box."""
    lat_min, lon_min, lat_max, lon_max = bbox
    bb = f"{lat_min},{lon_min},{lat_max},{lon_max}"
    
    # Build a union of node + way queries for each tag
    queries = []
    for tag in osm_tags:
        queries.append(f'  node[{tag}]({bb});')
        queries.append(f'  way[{tag}]({bb});')
    
    return f"[out:json][timeout:25];\n(\n" + "\n".join(queries) + "\n);\nout center tags;"


def query_overpass(osm_tags: list[str], bbox: tuple) -> list[dict]:
    """
    Call the Overpass API and return a list of businesses with name, phone, website.
    Completely free, structured JSON, zero bot detection.
    """
    query = build_overpass_query(osm_tags, bbox)
    
    try:
        r = requests.post(
            OVERPASS_URL,
            data={"data": query},
            timeout=30,
            headers={"User-Agent": "GEO-Consulting-Roma/1.0 (business audit tool)"}
        )
        r.raise_for_status()
        elements = r.json().get("elements", [])
        
        results = []
        for el in elements:
            tags = el.get("tags", {})
            name = tags.get("name", "").strip()
            
            if not name or not is_valid_business_name(name):
                continue
            
            # Build website from OSM tags (often well-populated in OSM)
            website = tags.get("website", tags.get("contact:website", "—"))
            phone   = tags.get("phone", tags.get("contact:phone", ""))
            addr_street = tags.get("addr:street", "")
            addr_num    = tags.get("addr:housenumber", "")
            address     = f"{addr_street} {addr_num}".strip() or "—"
            
            # Normalise website URL
            if website and website != "—" and not website.startswith("http"):
                website = "https://" + website
            
            results.append({
                "name":    name,
                "website": website if website else "—",
                "phone":   phone,
                "address": address,
            })
        
        return results
        
    except Exception as e:
        print(f"   [!] Overpass API error: {e}", flush=True)
        return []


# ─────────────────────────────────────────────────────────────────────────────
# Google Maps Playwright Fallback
# ─────────────────────────────────────────────────────────────────────────────

def scrape_google_maps_fallback(category_label: str, district: str, limit: int) -> list[dict]:
    """
    Playwright-based Google Maps scraper — used ONLY when Overpass returns < 2 results.
    Searches Google Maps for the category in the district and extracts NAP data.
    """
    try:
        from playwright.sync_api import sync_playwright, TimeoutError as PW_Timeout
    except ImportError:
        print("   [!] Playwright not installed — fallback unavailable. Run: pip install playwright && playwright install chromium")
        return []

    results = []
    search_query = f"{category_label} {district} Roma"
    url = f"https://www.google.com/maps/search/{requests.utils.quote(search_query)}"

    print(f"   [FALLBACK] Opening Google Maps: {search_query}", flush=True)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"],
            )
            ctx = browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                locale="it-IT",
            )
            ctx.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            page = ctx.new_page()

            page.goto(url, wait_until="networkidle", timeout=30000)
            time.sleep(random.uniform(2, 4))

            # Handle Google Consent Screen (if it appears)
            try:
                # Look for "Accetta tutto" or "Accept all"
                consent_button = page.query_selector('button:has-text("Accetta")') or \
                                 page.query_selector('button:has-text("Accept all")') or \
                                 page.get_by_role("button", name="Accetta tutto").first
                if consent_button:
                    print("   [GMAPS] Clicking consent button...", flush=True)
                    consent_button.click()
                    time.sleep(2)
            except Exception:
                pass

            # Scroll to load more results
            for _ in range(3):
                page.evaluate("window.scrollBy(0, 500)")
                time.sleep(random.uniform(1.0, 2.0))

            # Extract listing cards — .hfpxzc is the standard anchor for Google Maps results
            cards = page.query_selector_all('a.hfpxzc') or page.query_selector_all('[jsaction*="mouseover:pane"]')
            print(f"   [GMAPS] Found {len(cards)} result cards.", flush=True)

            for card in cards[:limit * 2]:
                try:
                    # Try aria-label on the card link first (very robust)
                    name = card.get_attribute("aria-label")
                    if not name:
                        # Fallback to internal div
                        name_el = card.query_selector("div.qBF1Pd") or card.query_selector("div[class*='fontHeadlineSmall']")
                        name = name_el.inner_text().strip() if name_el else ""
                    
                    if not name or not is_valid_business_name(name):
                        continue
                        
                    results.append({"name": name, "website": "—", "phone": "", "address": ""})
                    if len(results) >= limit:
                        break
                except Exception:
                    continue

            browser.close()
    except Exception as e:
        print(f"   [FALLBACK] Google Maps error: {e}", flush=True)

    return results


# ─────────────────────────────────────────────────────────────────────────────
# research_data.md helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_existing_names() -> set:
    """Return all business names already in the audit queue (for deduplication)."""
    if not RESEARCH_DATA.exists():
        return set()
    text = RESEARCH_DATA.read_text(encoding="utf-8")
    pattern = re.compile(r"\|\s*\d+\s*\|\s*([^|]+?)\s*\|")
    names = set()
    for m in pattern.finditer(text):
        name = m.group(1).strip()
        if name and not name.startswith("_") and name != "Business Name":
            names.add(name.lower())
    return names


def get_next_id() -> int:
    if not RESEARCH_DATA.exists():
        return 1
    text = RESEARCH_DATA.read_text(encoding="utf-8")
    ids = re.findall(r"\|\s*(\d+)\s*\|", text)
    numeric_ids = [int(i) for i in ids if i.isdigit()]
    return max(numeric_ids, default=0) + 1


def get_pending_count() -> int:
    if not RESEARCH_DATA.exists():
        return 0
    text = RESEARCH_DATA.read_text(encoding="utf-8")
    pending = len(re.findall(r"\|\s*PENDING\s*\|", text))
    in_progress = len(re.findall(r"\|\s*IN_PROGRESS\s*\|", text))
    return pending + in_progress


def write_businesses_to_queue(businesses: list, cat_label: str, district: str, dry_run: bool = False) -> int:
    existing = get_existing_names()
    new_rows = []
    next_id  = get_next_id()

    for biz in businesses:
        name = biz["name"].strip()
        if not name or not is_valid_business_name(name):
            print(f"   [SKIP — invalid name] {name}")
            continue
        if name.lower() in existing:
            print(f"   [SKIP — duplicate] {name}")
            continue
        row = (
            f"| {next_id:03d} | {name} | "
            f"{biz.get('website', '—')} | "
            f"{district} | "
            f"{cat_label} | "
            f"Overpass/OSM | PENDING |"
        )
        new_rows.append(row)
        existing.add(name.lower())
        next_id += 1

    if dry_run:
        print("\n[DRY RUN] Would write these rows to research_data.md:")
        for r in new_rows:
            print(" ", r)
        return len(new_rows)

    if not new_rows:
        return 0

    text   = RESEARCH_DATA.read_text(encoding="utf-8")
    anchor = "**Status Values:** `PENDING`"
    if anchor in text:
        insertion = "\n".join(new_rows) + "\n"
        text = text.replace(anchor, insertion + anchor)
    else:
        text += "\n" + "\n".join(new_rows) + "\n"

    RESEARCH_DATA.write_text(text, encoding="utf-8")
    return len(new_rows)


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="GEO Prospector V3 — Overpass API + Google Maps fallback ($0)")
    parser.add_argument("--zone",     required=True, help="Zone to scrape (e.g. Parioli, Prati)")
    parser.add_argument("--count",    type=int, default=5, help="Number of businesses to find (default 5)")
    parser.add_argument("--category", default=None, help="Category slug (notaio, avvocato, medico, ...)")
    parser.add_argument("--dry-run",  action="store_true", help="Print results without writing")
    args = parser.parse_args()

    zone_key = args.zone.lower().strip()
    if zone_key not in ZONE_MAP:
        print(f"❌ Unknown zone '{args.zone}'. Supported: {', '.join(ZONE_MAP)}")
        sys.exit(1)

    zone_info = ZONE_MAP[zone_key]
    bbox      = zone_info["bbox"]
    district  = zone_info["district"]

    # Anti-loop gate
    pending = get_pending_count()
    if pending >= 3 and not args.dry_run:
        print(f"⚠️  Queue already has {pending} PENDING businesses — no need to scrape.")
        print("   Run researcher_query.py to process them first.")
        sys.exit(0)

    # Determine categories to scrape
    if args.category:
        cat_key = args.category.lower()
        if cat_key not in CATEGORY_MAP:
            print(f"❌ Unknown category '{args.category}'. Supported: {', '.join(CATEGORY_MAP)}")
            sys.exit(1)
        categories = [cat_key]
    else:
        categories = DEFAULT_CATEGORIES

    print("=" * 60)
    print(f" GEO PROSPECTOR V3 — Overpass API (OpenStreetMap)")
    print(f" Zone: {district} | BBox: {bbox} | Target: {args.count}")
    print("=" * 60 + "\n")

    all_businesses = []
    existing = get_existing_names()

    for cat_key in categories:
        if len(all_businesses) >= args.count:
            break

        cat_info  = CATEGORY_MAP[cat_key]
        cat_label = cat_info["label"]
        osm_tags  = cat_info["osm_tags"]
        needed    = args.count - len(all_businesses)

        print(f"\n[Overpass] Querying {cat_label} in {district}...")
        raw = query_overpass(osm_tags, bbox)
        print(f"   → Overpass returned {len(raw)} valid result(s).")

        # Fallback if OSM result is thin
        if len(raw) < 2:
            print(f"   → Falling back to Google Maps (Playwright)...")
            raw = scrape_google_maps_fallback(cat_label, district, needed + 3)
            print(f"   → Fallback returned {len(raw)} result(s).")

        for biz in raw:
            name = biz["name"]
            if name.lower() in existing:
                print(f"   [SKIP — dup] {name}")
                continue
            biz["district"] = district
            biz["category"] = cat_label
            all_businesses.append(biz)
            existing.add(name.lower())
            print(f"   [+] {name} | {biz['website']}")
            if len(all_businesses) >= args.count:
                break

    # ── Output ────────────────────────────────────────────────────────────────
    print(f"\n{'─' * 60}")
    print(f"Found {len(all_businesses)} valid businesses (target: {args.count})")

    if not all_businesses:
        print("❌ No businesses found. Zone may have no OSM entries; try --dry-run or another zone.")
        sys.exit(0)

    # Determine the category label to write (use mixed if multiple cats used)
    cat_label_out = CATEGORY_MAP.get(categories[0], {}).get("label", "Varie") if len(categories) == 1 else "Varie"

    written = write_businesses_to_queue(all_businesses, cat_label_out, district, dry_run=args.dry_run)

    if not args.dry_run:
        print(f"\n✅ {written} businesses written to data/research_data.md")
        print("   Next: run  py researcher_query.py  to audit them.")
    else:
        print(f"\n[DRY RUN] {written} businesses would be written.")


if __name__ == "__main__":
    main()
