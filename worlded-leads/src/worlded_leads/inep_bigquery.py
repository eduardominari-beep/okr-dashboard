from __future__ import annotations

import json
import os
from typing import Any

from .config import TARGET_MUNICIPALITIES, YEARS, fixture_school_records


def collect_inep_schools(mode: str, limit: int | None = None) -> tuple[list[dict], dict]:
    if mode == "fixture":
        records = fixture_school_records()
        return records[:limit] if limit else records, {
            "name": "fixture-inep",
            "ok": True,
            "records": len(records[:limit] if limit else records),
            "mode": mode,
        }

    if not bigquery_configured():
        records = fixture_school_records()
        for record in records:
            record["inep_status"] = "not_configured"
            record["source_kind"] = "seed_without_inep_bigquery"
        return records[:limit] if limit else records, {
            "name": "inep-bigquery",
            "ok": False,
            "records": 0,
            "mode": mode,
            "error": "BIGQUERY_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS_JSON/GOOGLE_APPLICATION_CREDENTIALS are not configured",
            "fallback_records": len(records[:limit] if limit else records),
        }

    try:
        records = query_bigquery_private_schools(limit=limit)
        return records, {"name": "inep-bigquery", "ok": True, "records": len(records), "mode": mode}
    except Exception as exc:  # pragma: no cover - depends on external service
        records = fixture_school_records()
        for record in records:
            record["inep_status"] = "error"
            record["source_kind"] = "seed_after_inep_error"
        return records[:limit] if limit else records, {
            "name": "inep-bigquery",
            "ok": False,
            "records": 0,
            "mode": mode,
            "error": str(exc),
            "fallback_records": len(records[:limit] if limit else records),
        }


def bigquery_configured() -> bool:
    has_project = bool(os.environ.get("BIGQUERY_PROJECT_ID") or os.environ.get("GOOGLE_CLOUD_PROJECT"))
    has_credentials = bool(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON") or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"))
    return has_project and has_credentials


def query_bigquery_private_schools(limit: int | None = None) -> list[dict]:  # pragma: no cover - external
    from google.cloud import bigquery

    credentials = load_google_credentials()
    project_id = os.environ.get("BIGQUERY_PROJECT_ID") or os.environ.get("GOOGLE_CLOUD_PROJECT")
    client = bigquery.Client(project=project_id, credentials=credentials)
    query = build_school_query(limit)
    rows = list(client.query(query).result())
    grouped: dict[str, dict[str, Any]] = {}
    for row in rows:
        data = dict(row.items())
        school = grouped.setdefault(
            str(data["inep_code"]),
            {
                "inep_code": str(data["inep_code"]),
                "school": data.get("school") or "",
                "municipality": data.get("municipality") or "",
                "region": "Grande Sao Paulo",
                "site": data.get("site") or "",
                "phone": data.get("phone") or "",
                "email": data.get("email") or "",
                "source_kind": "inep_bigquery",
                "inep_status": "found",
                "enrollments": empty_years(),
            },
        )
        year = str(data["year"])
        if year in school["enrollments"]:
            school["enrollments"][year] = {
                "total": safe_int(data.get("total_students")),
                "fundamental_ii": safe_int(data.get("fundamental_ii_students")),
                "ensino_medio": safe_int(data.get("high_school_students")),
            }
    return list(grouped.values())


def build_school_query(limit: int | None = None) -> str:
    municipality_ids = ", ".join(f"'{code}'" for code in TARGET_MUNICIPALITIES)
    year_ids = ", ".join(str(year) for year in YEARS)
    limit_sql = f"\nLIMIT {int(limit)}" if limit else ""
    return f"""
WITH target_municipalities AS (
  SELECT id_municipio
  FROM UNNEST([{municipality_ids}]) AS id_municipio
),
school_year AS (
  SELECT
    CAST(t.id_escola AS STRING) AS inep_code,
    t.ano AS year,
    SUM(CAST(t.quantidade_matriculas AS INT64)) AS total_students,
    SUM(IF(REGEXP_CONTAINS(LOWER(COALESCE(t.etapa_ensino, '')), r'anos finais|fundamental.*finais|6.*ano|7.*ano|8.*ano|9.*ano'), CAST(t.quantidade_matriculas AS INT64), 0)) AS fundamental_ii_students,
    SUM(IF(REGEXP_CONTAINS(LOWER(COALESCE(t.etapa_ensino, '')), r'ensino medio|ensino médio|medio|médio'), CAST(t.quantidade_matriculas AS INT64), 0)) AS high_school_students
  FROM `basedosdados.br_inep_censo_escolar.turma` t
  JOIN target_municipalities m ON CAST(t.id_municipio AS STRING) = m.id_municipio
  WHERE t.ano IN ({year_ids})
    AND LOWER(COALESCE(t.rede, t.dependencia_administrativa, '')) LIKE '%priv%'
  GROUP BY inep_code, year
),
latest_school AS (
  SELECT
    CAST(e.id_escola AS STRING) AS inep_code,
    ANY_VALUE(e.nome) AS school,
    ANY_VALUE(e.site) AS site,
    ANY_VALUE(e.email) AS email,
    ANY_VALUE(e.telefone) AS phone,
    ANY_VALUE(m.nome) AS municipality
  FROM `basedosdados.br_bd_diretorios_brasil.escola` e
  LEFT JOIN `basedosdados.br_bd_diretorios_brasil.municipio` m
    ON CAST(e.id_municipio AS STRING) = CAST(m.id_municipio AS STRING)
  WHERE CAST(e.id_municipio AS STRING) IN ({municipality_ids})
  GROUP BY inep_code
)
SELECT
  sy.inep_code,
  sy.year,
  sy.total_students,
  sy.fundamental_ii_students,
  sy.high_school_students,
  ls.school,
  ls.site,
  ls.email,
  ls.phone,
  ls.municipality
FROM school_year sy
LEFT JOIN latest_school ls USING (inep_code)
WHERE sy.total_students > 0
ORDER BY sy.total_students DESC, sy.inep_code, sy.year{limit_sql}
"""


def load_google_credentials():  # pragma: no cover - external
    from google.oauth2 import service_account

    raw_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if raw_json:
        info = json.loads(raw_json)
        return service_account.Credentials.from_service_account_info(info)
    credentials_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not credentials_path:
        raise RuntimeError("Google credentials are not configured")
    return service_account.Credentials.from_service_account_file(credentials_path)


def empty_years() -> dict[str, dict[str, int | None]]:
    return {str(year): {"total": None, "fundamental_ii": None, "ensino_medio": None} for year in YEARS}


def safe_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
