from __future__ import annotations

from .config import GROUP_PATTERNS, YEARS
from .enrich_public_sources import normalize


def score_school(record: dict) -> dict:
    enrollment = enrollment_summary(record)
    decision = infer_decision(record)
    has_existing_product = bool(record.get("has_ib") or record.get("has_ap") or record.get("has_dual_diploma"))
    has_bilingual = bool(record.get("has_bilingual_program"))
    centralized = bool(record.get("is_centralized_network") or decision["school_type"] in {"grupo grande", "franquia/rede centralizada"})

    score = 0
    score += stage_points(enrollment)
    score += trend_points(enrollment["trend"])
    score += 20 if has_bilingual else 6 if record.get("reputation_evidence") != "nao encontrado" else 0
    score += 0 if has_existing_product else 15
    score += decision_points(decision["probable_decision"])
    score += reputation_points(record, enrollment)
    score = max(0, min(100, score))

    layer = commercial_layer(score, record, enrollment, decision)
    return {
        **enrollment,
        **decision,
        "score": score,
        "commercial_layer": layer,
        "commercial_fit": commercial_fit(layer, score),
        "classification_reason": classification_reason(score, record, enrollment, decision, layer),
        "recommended_approach": recommended_approach(record, layer, decision),
    }


def enrollment_summary(record: dict) -> dict:
    enrollments = record.get("enrollments") or {}
    totals = {year: value_for(enrollments, year, "total") for year in YEARS}
    fundamental_ii = {year: value_for(enrollments, year, "fundamental_ii") for year in YEARS}
    high_school = {year: value_for(enrollments, year, "ensino_medio") for year in YEARS}

    first_year, first_value = first_available(totals)
    last_year, last_value = last_available(totals)
    if first_value is None or last_value is None or first_year == last_year:
        delta_abs = None
        delta_pct = None
        trend = "sem dados"
    else:
        delta_abs = last_value - first_value
        delta_pct = round((delta_abs / first_value) * 100, 1) if first_value else None
        if delta_pct is None:
            trend = "sem dados"
        elif delta_pct >= 5:
            trend = "crescendo"
        elif delta_pct <= -5:
            trend = "caindo"
        else:
            trend = "estavel"

    latest_f2 = last_available(fundamental_ii)[1] or 0
    latest_em = last_available(high_school)[1] or 0
    return {
        "enrollment_totals": totals,
        "enrollment_fundamental_ii": fundamental_ii,
        "enrollment_high_school": high_school,
        "students_total_2020": totals[2020],
        "students_total_2021": totals[2021],
        "students_total_2022": totals[2022],
        "students_total_2023": totals[2023],
        "students_total_2024": totals[2024],
        "students_total_2025": totals[2025],
        "students_fundamental_ii_2020": fundamental_ii[2020],
        "students_fundamental_ii_2021": fundamental_ii[2021],
        "students_fundamental_ii_2022": fundamental_ii[2022],
        "students_fundamental_ii_2023": fundamental_ii[2023],
        "students_fundamental_ii_2024": fundamental_ii[2024],
        "students_fundamental_ii_2025": fundamental_ii[2025],
        "students_high_school_2020": high_school[2020],
        "students_high_school_2021": high_school[2021],
        "students_high_school_2022": high_school[2022],
        "students_high_school_2023": high_school[2023],
        "students_high_school_2024": high_school[2024],
        "students_high_school_2025": high_school[2025],
        "alunos_total_2020": totals[2020],
        "alunos_total_2021": totals[2021],
        "alunos_total_2022": totals[2022],
        "alunos_total_2023": totals[2023],
        "alunos_total_2024": totals[2024],
        "alunos_total_2025": totals[2025],
        "fund2_2020": fundamental_ii[2020],
        "fund2_2021": fundamental_ii[2021],
        "fund2_2022": fundamental_ii[2022],
        "fund2_2023": fundamental_ii[2023],
        "fund2_2024": fundamental_ii[2024],
        "fund2_2025": fundamental_ii[2025],
        "medio_2020": high_school[2020],
        "medio_2021": high_school[2021],
        "medio_2022": high_school[2022],
        "medio_2023": high_school[2023],
        "medio_2024": high_school[2024],
        "medio_2025": high_school[2025],
        "student_delta_abs_2020_2025": delta_abs,
        "student_delta_pct_2020_2025": delta_pct,
        "variacao_total_abs_2020_2025": delta_abs,
        "variacao_total_pct_2020_2025": delta_pct,
        "variacao_fund2_abs_2020_2025": variation_abs(fundamental_ii),
        "variacao_fund2_pct_2020_2025": variation_pct(fundamental_ii),
        "variacao_medio_abs_2020_2025": variation_abs(high_school),
        "variacao_medio_pct_2020_2025": variation_pct(high_school),
        "trend": trend,
        "tendencia_total": trend,
        "latest_relevant_students": latest_f2 + latest_em,
    }


def infer_decision(record: dict) -> dict:
    text = normalize(" ".join([record.get("school", ""), record.get("site", ""), record.get("network_evidence", "")]))
    if record.get("is_centralized_network") or any(pattern in text for pattern in GROUP_PATTERNS):
        school_type = "franquia/rede centralizada" if record.get("is_centralized_network") else "grupo grande"
        decision = "escritorio central/franqueadora" if record.get("is_centralized_network") else "diretoria do grupo"
    elif "rede" in text or "grupo" in text:
        school_type = "rede pequena/media"
        decision = "mantenedor local ou diretoria do grupo"
    else:
        school_type = "independente"
        decision = "local/mantenedor local"
    return {"school_type": school_type, "probable_decision": decision}


def stage_points(enrollment: dict) -> int:
    relevant = enrollment["latest_relevant_students"]
    if relevant >= 220:
        return 25
    if relevant >= 120:
        return 21
    if relevant >= 60:
        return 16
    if relevant > 0:
        return 8
    return 0


def trend_points(trend: str) -> int:
    return {"crescendo": 20, "estavel": 16, "caindo": 8, "sem dados": 4}.get(trend, 4)


def decision_points(decision: str) -> int:
    if "local" in decision:
        return 15
    if "grupo" in decision:
        return 8
    if "central" in decision or "franqueadora" in decision:
        return 4
    return 6


def reputation_points(record: dict, enrollment: dict) -> int:
    if record.get("reputation_evidence") and record.get("reputation_evidence") != "nao encontrado":
        return 5
    latest_total = last_available(enrollment["enrollment_totals"])[1] or 0
    return 5 if latest_total >= 700 else 3 if latest_total >= 400 else 0


def commercial_layer(score: int, record: dict, enrollment: dict, decision: dict) -> str:
    if record.get("has_ib") or record.get("has_ap") or record.get("has_dual_diploma"):
        return "C"
    if decision["school_type"] in {"franquia/rede centralizada", "grupo grande"}:
        return "D"
    if enrollment["latest_relevant_students"] <= 0:
        return "E"
    if score >= 80 and record.get("has_bilingual_program"):
        return "A"
    if score >= 60:
        return "B"
    return "E"


def commercial_fit(layer: str, score: int) -> str:
    if layer == "A":
        return "alto"
    if layer == "B":
        return "medio"
    if layer in {"C", "D"}:
        return "excluir" if layer == "C" else "corporativo"
    return "baixo"


def classification_reason(score: int, record: dict, enrollment: dict, decision: dict, layer: str) -> str:
    facts = [
        f"score {score}",
        f"camada {layer}",
        f"decisao provavel: {decision['probable_decision']}",
        f"tendencia de matricula: {enrollment['trend']}",
        f"alunos relevantes Fundamental II/Medio: {enrollment['latest_relevant_students']}",
    ]
    if record.get("has_bilingual_program"):
        facts.append("programa bilingue/internacional encontrado")
    if record.get("has_ib"):
        facts.append("IB encontrado")
    if record.get("has_ap"):
        facts.append("AP encontrado")
    if record.get("has_dual_diploma"):
        facts.append("Dual Diploma/High School encontrado")
    return "Fatos: " + "; ".join(facts) + ". Inferencia: " + inference_for_layer(layer)


def inference_for_layer(layer: str) -> str:
    return {
        "A": "priorizar escola local/semi-local que ja comunica internacionalizacao e pode evoluir para diploma percebido pelas familias.",
        "B": "boa oportunidade, mas precisa qualificar decisor, etapa, bilingue ou ausencia de diploma internacional.",
        "C": "manter como benchmark/concorrente; nao priorizar venda principal porque ja ha diploma internacional forte detectado.",
        "D": "abordar franqueadora, escritorio central ou diretoria academica, nao unidade isolada.",
        "E": "baixo fit atual para Dual Diploma; nutrir apenas se surgir porte, etapa ou demanda internacional.",
    }[layer]


def recommended_approach(record: dict, layer: str, decision: dict) -> str:
    if layer == "C":
        return "Nao abordar como lead principal; usar como benchmark de posicionamento internacional."
    if layer == "D":
        return "Procurar diretoria academica, produto, expansao ou franqueadora para conversa corporativa."
    if record.get("has_bilingual_program"):
        return "Abordar mantenedor/direcao: escola ja tem proposta bilingue; proximo passo e certificacao internacional/Dual Diploma com valor percebido."
    return "Abordar mantenedor/direcao: implantar trilha internacional com programa bilingue, ingles academico e Dual Diploma como produto premium."


def value_for(enrollments: dict, year: int, field: str) -> int | None:
    data = enrollments.get(str(year)) or enrollments.get(year) or {}
    value = data.get(field)
    return int(value) if isinstance(value, (int, float)) else None


def variation_abs(values: dict[int, int | None]) -> int | None:
    first_year, first_value = first_available(values)
    last_year, last_value = last_available(values)
    if first_value is None or last_value is None or first_year == last_year:
        return None
    return last_value - first_value


def variation_pct(values: dict[int, int | None]) -> float | None:
    first_year, first_value = first_available(values)
    last_year, last_value = last_available(values)
    if first_value is None or last_value is None or first_year == last_year or first_value == 0:
        return None
    return round(((last_value - first_value) / first_value) * 100, 1)


def first_available(values: dict[int, int | None]) -> tuple[int | None, int | None]:
    for year in sorted(values):
        if values[year] is not None:
            return year, values[year]
    return None, None


def last_available(values: dict[int, int | None]) -> tuple[int | None, int | None]:
    for year in sorted(values, reverse=True):
        if values[year] is not None:
            return year, values[year]
    return None, None
