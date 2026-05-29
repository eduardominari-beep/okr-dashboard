from __future__ import annotations

from typing import Any

from .config import YEARS
from .enrich_public_sources import normalize


AFFLUENT_NEIGHBORHOODS = {
    "alto de pinheiros",
    "alto da boa vista",
    "alphaville",
    "brooklin",
    "campo belo",
    "chacara flora",
    "cidade jardim",
    "higienopolis",
    "itaim bibi",
    "jardim america",
    "jardim europa",
    "jardim guedala",
    "jardim paulistano",
    "jardim paulista",
    "jardins",
    "moema",
    "morumbi",
    "pacaembu",
    "perdizes",
    "pinheiros",
    "santa cecilia",
    "sumare",
    "tambore",
    "vila clementino",
    "vila madalena",
    "vila mariana",
    "vila nova conceicao",
    "vila olimpia",
}

PREMIUM_MUNICIPALITY_POINTS = {
    "sao paulo": 10,
    "barueri": 10,
    "santana de parnaiba": 10,
    "sao caetano do sul": 9,
    "cotia": 8,
    "santo andre": 7,
    "sao bernardo do campo": 7,
    "osasco": 6,
}


def prioritize_records(records: list[dict], order: str = "priority") -> list[dict]:
    annotated = [{**record, **enrichment_priority(record)} for record in records]
    if order == "base":
        return annotated
    if order == "name":
        return sorted(annotated, key=lambda record: (record.get("school", ""), record.get("municipality", "")))
    return sorted(
        annotated,
        key=lambda record: (
            -int(record.get("enrichment_priority_score") or 0),
            -(latest_total_students(record) or 0),
            record.get("school", ""),
        ),
    )


def enrichment_priority(record: dict) -> dict:
    latest_total = latest_total_students(record) or 0
    latest_relevant = latest_relevant_students(record)
    bairro = normalize(record.get("bairro", ""))
    municipality = normalize(record.get("municipality") or record.get("municipio", ""))
    trend = record.get("tendencia_total") or record.get("trend") or "sem dados"

    total_points = min(45, int(latest_total / 35))
    relevant_points = min(25, int(latest_relevant / 15))
    neighborhood_points = 20 if is_affluent_neighborhood(bairro) else 0
    municipality_points = PREMIUM_MUNICIPALITY_POINTS.get(municipality, 3 if municipality else 0)
    trend_points = {"crescendo": 6, "estavel": 4, "caindo": 2}.get(trend, 0)
    score = total_points + relevant_points + neighborhood_points + municipality_points + trend_points

    reasons = [
        f"porte_total={latest_total}",
        f"fund2_medio={latest_relevant}",
        f"municipio={record.get('municipality') or record.get('municipio') or 'nao informado'}",
    ]
    if bairro:
        reasons.append(f"bairro={record.get('bairro')}")
    if neighborhood_points:
        reasons.append("bairro_nobre_prioritario")
    if trend != "sem dados":
        reasons.append(f"tendencia={trend}")
    return {
        "enrichment_priority_score": score,
        "enrichment_priority_reason": "; ".join(reasons),
    }


def is_affluent_neighborhood(bairro: str) -> bool:
    if not bairro:
        return False
    return any(name in bairro for name in AFFLUENT_NEIGHBORHOODS)


def latest_total_students(record: dict) -> int | None:
    return latest_metric(record, "total")


def latest_relevant_students(record: dict) -> int:
    return (latest_metric(record, "fundamental_ii") or 0) + (latest_metric(record, "ensino_medio") or 0)


def latest_metric(record: dict, metric: str) -> int | None:
    enrollments = record.get("enrollments") or {}
    for year in sorted(YEARS, reverse=True):
        data = enrollments.get(str(year)) or enrollments.get(year) or {}
        value = data.get(metric)
        parsed = safe_int(value)
        if parsed is not None:
            return parsed
    direct_prefix = {
        "total": "alunos_total",
        "fundamental_ii": "fund2",
        "ensino_medio": "medio",
    }[metric]
    for year in sorted(YEARS, reverse=True):
        parsed = safe_int(record.get(f"{direct_prefix}_{year}"))
        if parsed is not None:
            return parsed
    return None


def safe_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None
