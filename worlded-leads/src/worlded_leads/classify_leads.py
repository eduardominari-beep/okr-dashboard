from __future__ import annotations

from datetime import datetime, timezone

from .scoring import score_school


def classify_schools(records: list[dict]) -> list[dict]:
    now = datetime.now(timezone.utc).isoformat()
    classified = []
    for record in records:
        score_data = score_school(record)
        classified.append(
            {
                **record,
                **score_data,
                "fit_comercial": score_data["commercial_fit"],
                "camada_comercial": score_data["commercial_layer"],
                "motivo_classificacao": score_data["classification_reason"],
                "sugestao_abordagem_comercial": score_data["recommended_approach"],
                "last_updated_at": now,
                "lead_key": lead_key(record),
            }
        )
    return sorted(classified, key=lambda item: (layer_rank(item["camada_comercial"]), -item["score"], item.get("school", "")))


def lead_key(record: dict) -> str:
    if record.get("inep_code"):
        return f"inep:{record['inep_code']}"
    return "school:" + "|".join([normalize_key(record.get("school", "")), normalize_key(record.get("municipality", ""))])


def layer_rank(layer: str) -> int:
    return {"A": 0, "B": 1, "D": 2, "C": 3, "E": 4}.get(layer, 9)


def normalize_key(value: str) -> str:
    table = str.maketrans("áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ", "aaaaeeiooouucAAAAEEIOOOUUC")
    return "".join(ch for ch in str(value).translate(table).lower() if ch.isalnum())
