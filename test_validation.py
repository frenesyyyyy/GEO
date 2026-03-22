import re

GARBAGE_WORDS = {
    "dormire", "mangiare", "bere", "fare", "spesa", "abitare",
    "arredare", "muoversi", "divertirsi", "lavorare", "studiare",
    "comprare", "vendere", "affittare", "curarsi", "risultati",
    "cerca", "ricerca", "pagine", "gialle", "annunci", "offerte",
    "scopri", "tutte", "tutte le categorie", "categorie", "home",
}

def is_valid_business_name(name: str) -> bool:
    if not name or len(name.strip()) < 4:
        return False
    stripped = name.strip()
    words = re.findall(r"[a-zA-ZÀ-ÿ]+", stripped.lower())
    if not words: return False
    garbage_hit = sum(1 for w in words if w in GARBAGE_WORDS)
    if garbage_hit >= len(words): return False
    if stripped.isupper() and len(words) == 1 and words[0] in GARBAGE_WORDS: return False
    if stripped.isupper() and len(words) <= 3 and garbage_hit > 0: return False
    if not any(len(w) > 2 for w in words): return False
    return True

test_names = [
    "Studio Legale Santiapichi",  # Should be True
    "ABITARE E ARREDARE",          # Should be False (nav heading)
    "DORMIRE",                     # Should be False (nav heading)
    "FARE LA SPESA",                # Should be False (nav heading)
    "Notaio Giovanni",             # Should be True
    "Dott. Rossi",                 # Should be True
    "Clinic Medical",              # Should be True
    "HOME",                        # Should be False
    "PAGINE GIALLE",               # Should be False
]

for name in test_names:
    print(f"{name:30} -> {is_valid_business_name(name)}")
