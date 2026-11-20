"""Recherche de lieux publics Adresse GN par nom (lecture seule).

Utilise uniquement les tables existantes (addresses, beacons, establishments, communes).
Aucune ecriture, aucune extension SQL requise (pas de unaccent/pg_trgm).
Les habitations ne sont jamais renvoyees (vie privee).
"""
from __future__ import annotations

import math
import unicodedata

from django.db import connection

PLACE_CATEGORIES = (
    "restaurant", "hotel", "bar", "commerce", "entreprise", "administration",
    "ecole", "sante", "pharmacie", "banque", "tourisme", "other",
)

# Mots courants -> categorie (recherche "pharmacie", "hotel", "ecole"...).
CATEGORY_WORDS = {
    "restaurant": "restaurant", "resto": "restaurant", "maquis": "restaurant",
    "hotel": "hotel", "auberge": "hotel", "bar": "bar", "boite": "bar",
    "commerce": "commerce", "boutique": "commerce", "magasin": "commerce", "supermarche": "commerce",
    "entreprise": "entreprise", "societe": "entreprise",
    "administration": "administration", "mairie": "administration", "ministere": "administration",
    "ecole": "ecole", "lycee": "ecole", "universite": "ecole", "college": "ecole",
    "sante": "sante", "hopital": "sante", "clinique": "sante", "centre de sante": "sante",
    "pharmacie": "pharmacie", "banque": "banque", "tourisme": "tourisme",
}

_FOLD_FROM = "àâäáãçéèêëíìîïñóòôöõúùûüýÿœ"
_FOLD_TO = "aaaaaceeeeiiiinooooouuuuyyo"


def fold(text: str) -> str:
    """Minuscules sans accents (meme transformation que le SQL translate())."""
    text = unicodedata.normalize("NFC", text or "").lower()
    return text.translate(str.maketrans(_FOLD_FROM, _FOLD_TO)).strip()


SEARCH_SQL = f"""
SELECT
    b.public_number,
    a.name,
    a.category,
    e.business_name,
    e.phone,
    ST_Y(a.location::geometry) AS lat,
    ST_X(a.location::geometry) AS lng,
    c.name AS commune,
    a.verification_level
FROM public.addresses a
JOIN public.beacons b ON b.id = a.beacon_id AND b.status = 'active'
LEFT JOIN public.establishments e ON e.address_id = a.id
LEFT JOIN public.communes c ON c.id = a.commune_id
WHERE a.status = 'active'
  AND a.visibility = 'public'
  AND a.category <> 'habitation'
  AND a.location IS NOT NULL
  AND (
        translate(lower(coalesce(a.name, '')), '{_FOLD_FROM}', '{_FOLD_TO}') LIKE %(like)s
     OR translate(lower(coalesce(e.business_name, '')), '{_FOLD_FROM}', '{_FOLD_TO}') LIKE %(like)s
     OR (%(category)s <> '' AND a.category = %(category)s)
  )
LIMIT 200
"""


def _distance_m(lat1, lng1, lat2, lng2) -> float:
    p = math.pi / 180
    dlat, dlng = (lat2 - lat1) * p, (lng2 - lng1) * p
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin(dlng / 2) ** 2
    return 12742000 * math.asin(min(1.0, math.sqrt(h)))


def search_places(q: str, lat: float | None = None, lng: float | None = None, limit: int = 8) -> list[dict]:
    needle = fold(q)
    if len(needle) < 2 or len(needle) > 60:
        return []
    escaped = needle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    category = CATEGORY_WORDS.get(needle, "")
    with connection.cursor() as cursor:
        cursor.execute(SEARCH_SQL, {"like": f"%{escaped}%", "category": category})
        columns = [c[0] for c in cursor.description]
        rows = [dict(zip(columns, r)) for r in cursor.fetchall()]

    results = []
    for r in rows:
        label = r["business_name"] or r["name"] or ""
        if not label:
            continue
        folded = fold(label)
        if folded == needle:
            rank = 0
        elif folded.startswith(needle):
            rank = 1
        elif any(w.startswith(needle) for w in folded.split()):
            rank = 2
        elif needle in folded:
            rank = 3
        else:
            rank = 4  # correspondance par categorie uniquement
        dist = None
        if lat is not None and lng is not None:
            dist = round(_distance_m(lat, lng, r["lat"], r["lng"]))
        results.append({
            "public_number": r["public_number"],
            "name": label,
            "category": r["category"],
            "commune": r["commune"],
            "phone": r["phone"],
            "lat": r["lat"],
            "lng": r["lng"],
            "verified": r["verification_level"],
            "distance_m": dist,
            "_rank": rank,
        })
    results.sort(key=lambda x: (x["_rank"], x["distance_m"] if x["distance_m"] is not None else 10**9, x["name"]))
    for x in results:
        x.pop("_rank", None)
    return results[:max(1, min(limit, 15))]
