from __future__ import annotations

import re
import time
from html import unescape
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote_plus, unquote, urlparse
from urllib.request import Request, urlopen

from .config import (
    AP_TERMS,
    BILINGUAL_TERMS,
    CENTRALIZED_NETWORK_PATTERNS,
    DUAL_DIPLOMA_TERMS,
    IB_TERMS,
    PUBLIC_FETCH_TIMEOUT_SECONDS,
    PUBLIC_SEARCH_LIMIT,
    REPUTATION_HINTS,
)


USER_AGENT = "worlded-leads/0.1 (+https://github.com/eduardominari-beep/okr-dashboard)"


def enrich_schools(records: list[dict], mode: str = "live") -> tuple[list[dict], dict]:
    enriched = []
    errors = []
    for record in records:
        try:
            if mode == "fixture" or record.get("source_kind", "").startswith("seed"):
                enriched.append({**record, **fixture_or_seed_enrichment(record)})
            else:
                enriched.append({**record, **public_enrichment(record)})
        except Exception as exc:  # external pages should not break the weekly run
            errors.append({"school": record.get("school"), "error": str(exc)})
            enriched.append({**record, **empty_enrichment("error", str(exc))})
    return enriched, {
        "name": "public-enrichment",
        "ok": not errors,
        "records": len(enriched),
        "errors": errors[:20],
    }


def public_enrichment(record: dict) -> dict:
    school = record.get("school", "")
    municipality = record.get("municipality", "")
    site = record.get("site") or find_official_site(school, municipality)
    urls = candidate_urls(school, municipality, site)
    page_evidence = []
    collected_text = []
    for url in urls[:PUBLIC_SEARCH_LIMIT]:
        text = fetch_public_text(url)
        if not text:
            continue
        collected_text.append(text)
        page_evidence.extend(scan_evidence(text, url))
        time.sleep(0.15)
    text_blob = "\n".join(collected_text)
    contact = extract_contact(text_blob)
    decision = extract_decision_maker(text_blob)
    return {
        "site": site or record.get("site") or "",
        "phone": record.get("phone") or contact.get("phone", ""),
        "email": record.get("email") or contact.get("email", ""),
        "decision_maker_name": decision.get("name", ""),
        "decision_maker_role": decision.get("role", ""),
        "decision_maker_url": decision.get("url", ""),
        **summarize_evidence(page_evidence),
        "sources_consulted": sorted({e["url"] for e in page_evidence if e.get("url")}),
        "last_public_update_status": "found" if page_evidence else "not_found",
    }


def fixture_or_seed_enrichment(record: dict) -> dict:
    name = normalize(record.get("school", ""))
    if "magister" in name:
        return {
            **empty_enrichment("fixture", ""),
            "has_dual_diploma": True,
            "dual_diploma_evidence": "Fixture: evidencia de High School/Dual Diploma encontrada.",
            "sources_consulted": [record.get("site") or "fixture"],
            "last_public_update_status": "fixture",
        }
    if "maple bear" in name:
        return {
            **empty_enrichment("fixture", ""),
            "has_bilingual_program": True,
            "bilingual_program_type": "curricular",
            "bilingual_evidence": "Fixture: rede bilingue centralizada.",
            "is_centralized_network": True,
            "network_evidence": "Fixture: Maple Bear classificada como rede/franquia centralizada.",
            "sources_consulted": [record.get("site") or "fixture"],
            "last_public_update_status": "fixture",
        }
    if "horizonte" in name:
        return {
            **empty_enrichment("fixture", ""),
            "has_bilingual_program": True,
            "bilingual_program_type": "curricular",
            "bilingual_evidence": "Fixture: escola comunica programa bilingue e proposta internacional sem diploma detectado.",
            "reputation_evidence": "Fixture: escola com porte e reputacao regional.",
            "sources_consulted": [record.get("site") or "fixture"],
            "last_public_update_status": "fixture",
        }
    if "regional" in name:
        return {
            **empty_enrichment("fixture", ""),
            "has_bilingual_program": False,
            "bilingual_program_type": "not_found",
            "bilingual_evidence": "Fixture: programa bilingue nao encontrado.",
            "reputation_evidence": "Fixture: escola regional com Fundamental II e Ensino Medio relevantes.",
            "sources_consulted": [record.get("site") or "fixture"],
            "last_public_update_status": "fixture",
        }
    return empty_enrichment("fixture", "")


def empty_enrichment(status: str, error: str) -> dict:
    return {
        "decision_maker_name": "",
        "decision_maker_role": "",
        "decision_maker_url": "",
        "has_bilingual_program": False,
        "bilingual_program_type": "not_found",
        "bilingual_evidence": "nao encontrado",
        "has_ib": False,
        "ib_evidence": "nao encontrado",
        "has_ap": False,
        "ap_evidence": "nao encontrado",
        "has_dual_diploma": False,
        "dual_diploma_evidence": "nao encontrado",
        "is_centralized_network": False,
        "network_evidence": "nao encontrado",
        "reputation_evidence": "nao encontrado",
        "sources_consulted": [],
        "last_public_update_status": status,
        "public_enrichment_error": error,
    }


def find_official_site(school: str, municipality: str) -> str:
    query = f'"{school}" "{municipality}" escola site oficial'
    for url in duckduckgo_links(query, limit=5):
        host = urlparse(url).netloc.lower()
        if any(skip in host for skip in ["facebook", "instagram", "linkedin", "youtube", "wikipedia", "reclameaqui"]):
            continue
        return url
    return ""


def candidate_urls(school: str, municipality: str, site: str) -> list[str]:
    urls = []
    if site:
        urls.extend([site, join_url(site, "bilingue"), join_url(site, "internacional"), join_url(site, "high-school"), join_url(site, "equipe")])
    queries = [
        f'"{school}" "{municipality}" "programa bilíngue"',
        f'"{school}" "{municipality}" "international baccalaureate" OR "IB"',
        f'"{school}" "{municipality}" "dual diploma" OR "high school americano"',
        f'"{school}" direção mantenedor diretor geral',
    ]
    for query in queries:
        urls.extend(duckduckgo_links(query, limit=PUBLIC_SEARCH_LIMIT))
    return unique(urls)


def fetch_public_text(url: str) -> str:
    try:
        request = Request(url, headers={"User-Agent": USER_AGENT})
        with urlopen(request, timeout=PUBLIC_FETCH_TIMEOUT_SECONDS) as response:
            content_type = response.headers.get("content-type", "")
            if "text" not in content_type and "html" not in content_type:
                return ""
            raw = response.read(350_000).decode("utf-8", errors="ignore")
            return html_to_text(raw)
    except (HTTPError, URLError, TimeoutError, ValueError):
        return ""


def duckduckgo_links(query: str, limit: int = PUBLIC_SEARCH_LIMIT) -> list[str]:
    url = f"https://duckduckgo.com/html/?q={quote_plus(query)}"
    text = fetch_public_text(url)
    links = []
    for match in re.finditer(r"https?://[^\s\"'<>]+", text):
        candidate = unescape(match.group(0))
        if "duckduckgo.com/l/?" in candidate:
            parsed = parse_qs(urlparse(candidate).query)
            candidate = unquote(parsed.get("uddg", [""])[0])
        if candidate.startswith("http"):
            links.append(candidate)
    return unique(links)[:limit]


def scan_evidence(text: str, url: str) -> list[dict]:
    evidence = []
    categories = [
        ("bilingual", BILINGUAL_TERMS),
        ("ib", IB_TERMS),
        ("ap", AP_TERMS),
        ("dual_diploma", DUAL_DIPLOMA_TERMS),
        ("network", CENTRALIZED_NETWORK_PATTERNS),
        ("reputation", REPUTATION_HINTS),
    ]
    lowered = normalize(text)
    for category, terms in categories:
        for term in terms:
            normalized_term = normalize(term)
            if normalized_term and normalized_term in lowered:
                evidence.append({"category": category, "term": term, "url": url, "snippet": snippet(text, term)})
                break
    return evidence


def summarize_evidence(evidence: list[dict]) -> dict:
    by_category = {category: [e for e in evidence if e["category"] == category] for category in ["bilingual", "ib", "ap", "dual_diploma", "network", "reputation"]}
    bilingual = by_category["bilingual"]
    return {
        "has_bilingual_program": bool(bilingual),
        "bilingual_program_type": infer_bilingual_type(bilingual),
        "bilingual_evidence": evidence_text(bilingual),
        "has_ib": bool(by_category["ib"]),
        "ib_evidence": evidence_text(by_category["ib"]),
        "has_ap": bool(by_category["ap"]),
        "ap_evidence": evidence_text(by_category["ap"]),
        "has_dual_diploma": bool(by_category["dual_diploma"]),
        "dual_diploma_evidence": evidence_text(by_category["dual_diploma"]),
        "is_centralized_network": bool(by_category["network"]),
        "network_evidence": evidence_text(by_category["network"]),
        "reputation_evidence": evidence_text(by_category["reputation"]),
    }


def infer_bilingual_type(evidence: list[dict]) -> str:
    text = normalize(" ".join(e.get("snippet", "") for e in evidence))
    if not evidence:
        return "not_found"
    if "contraturno" in text:
        return "contraturno"
    if "curricular" in text or "grade" in text or "curriculo" in text:
        return "curricular"
    if "parcial" in text:
        return "parcial"
    if "parceiro" in text or "terceir" in text:
        return "terceirizado"
    return "precisa qualificar"


def evidence_text(items: list[dict]) -> str:
    if not items:
        return "nao encontrado"
    first = items[0]
    return f"{first['term']} | {first['url']} | {first['snippet'][:220]}"


def extract_contact(text: str) -> dict:
    email = re.search(r"[\w.\-+]+@[\w.\-]+\.[a-zA-Z]{2,}", text)
    phone = re.search(r"(?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4}[-.\s]?\d{4}", text)
    return {"email": email.group(0) if email else "", "phone": phone.group(0) if phone else ""}


def extract_decision_maker(text: str) -> dict:
    pattern = re.compile(
        r"(?P<role>diretor(?:a)? geral|diretor(?:a)? pedagogic[ao]|mantenedor(?:a)?|head|coordenador(?:a)? internacional)\s*[:\-]?\s*(?P<name>[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÀ-ÿ' ]{4,70})",
        re.IGNORECASE,
    )
    match = pattern.search(text)
    if not match:
        return {"name": "", "role": "", "url": ""}
    return {"name": clean_space(match.group("name")), "role": clean_space(match.group("role")), "url": ""}


def html_to_text(html: str) -> str:
    html = re.sub(r"(?is)<script.*?>.*?</script>", " ", html)
    html = re.sub(r"(?is)<style.*?>.*?</style>", " ", html)
    return clean_space(unescape(re.sub(r"<[^>]+>", " ", html)))


def snippet(text: str, term: str) -> str:
    lowered = normalize(text)
    idx = lowered.find(normalize(term))
    if idx < 0:
        return clean_space(text[:220])
    start = max(0, idx - 120)
    end = min(len(text), idx + 180)
    return clean_space(text[start:end])


def join_url(base: str, path: str) -> str:
    parsed = urlparse(base)
    if not parsed.scheme or not parsed.netloc:
        return base
    return f"{parsed.scheme}://{parsed.netloc}/{path.strip('/')}"


def normalize(value: str) -> str:
    table = str.maketrans("áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ", "aaaaeeiooouucAAAAEEIOOOUUC")
    return clean_space(str(value).translate(table).lower())


def clean_space(value: str) -> str:
    return re.sub(r"\s+", " ", str(value)).strip()


def unique(values: list[str]) -> list[str]:
    seen = set()
    out = []
    for value in values:
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out
