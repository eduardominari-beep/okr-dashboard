from __future__ import annotations

import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

import pandas as pd

from .config import TARGET_MUNICIPALITIES, YEARS


INTERNAL_COLUMNS = [
    "ano",
    "id_escola",
    "nome_escola",
    "sigla_uf",
    "id_municipio",
    "municipio",
    "rede",
    "dependencia_administrativa",
    "tipo_categoria_escola_privada",
    "tipo_localizacao",
    "situacao_funcionamento",
    "endereco",
    "numero_endereco",
    "complemento",
    "bairro",
    "cep",
    "ddd",
    "telefone_inep",
    "latitude",
    "longitude",
    "cnpj_escola_privada",
    "cnpj_mantenedora",
    "alunos_total",
    "alunos_infantil",
    "alunos_fundamental",
    "alunos_fund1",
    "alunos_fund2",
    "alunos_medio",
]

FIELD_MAP = {
    "ano": ["NU_ANO_CENSO"],
    "id_escola": ["CO_ENTIDADE"],
    "nome_escola": ["NO_ENTIDADE"],
    "sigla_uf": ["SG_UF"],
    "id_municipio": ["CO_MUNICIPIO"],
    "municipio": ["NO_MUNICIPIO"],
    "rede": ["TP_DEPENDENCIA"],
    "dependencia_administrativa": ["TP_DEPENDENCIA"],
    "tipo_categoria_escola_privada": ["TP_CATEGORIA_ESCOLA_PRIVADA"],
    "tipo_localizacao": ["TP_LOCALIZACAO"],
    "situacao_funcionamento": ["TP_SITUACAO_FUNCIONAMENTO"],
    "endereco": ["DS_ENDERECO"],
    "numero_endereco": ["NU_ENDERECO"],
    "complemento": ["DS_COMPLEMENTO"],
    "bairro": ["NO_BAIRRO"],
    "cep": ["CO_CEP"],
    "ddd": ["NU_DDD"],
    "telefone_inep": ["NU_TELEFONE"],
    "latitude": ["LATITUDE"],
    "longitude": ["LONGITUDE"],
    "cnpj_escola_privada": ["NU_CNPJ_ESCOLA_PRIVADA"],
    "cnpj_mantenedora": ["NU_CNPJ_MANTENEDORA"],
    "alunos_total": ["QT_MAT_BAS"],
    "alunos_infantil": ["QT_MAT_INF"],
    "alunos_fundamental": ["QT_MAT_FUND"],
    "alunos_fund1": ["QT_MAT_FUND_AI"],
    "alunos_fund2": ["QT_MAT_FUND_AF"],
    "alunos_medio": ["QT_MAT_MED"],
}

RAW_COLUMNS = sorted({raw for alternatives in FIELD_MAP.values() for raw in alternatives})
STRING_COLUMNS = [
    "id_escola",
    "nome_escola",
    "sigla_uf",
    "id_municipio",
    "municipio",
    "endereco",
    "numero_endereco",
    "complemento",
    "bairro",
    "cep",
    "ddd",
    "telefone_inep",
    "latitude",
    "longitude",
    "cnpj_escola_privada",
    "cnpj_mantenedora",
]
NUMERIC_COLUMNS = [column for column in INTERNAL_COLUMNS if column not in STRING_COLUMNS]
CSV_CHUNKSIZE = 200_000


@dataclass(frozen=True)
class GeoFilter:
    scope: str = "grande-sp"
    uf: str = "SP"
    municipalities: tuple[str, ...] = ()
    municipality_codes: tuple[str, ...] = ()


def build_offline_base(
    raw_dir: Path,
    processed_dir: Path,
    years: list[int] | None = None,
    scope: str = "grande-sp",
    uf: str = "SP",
    municipalities: list[str] | None = None,
    municipality_codes: list[str] | None = None,
) -> tuple[Path, pd.DataFrame, dict]:
    years = years or YEARS
    geo_filter = make_geo_filter(scope, uf, municipalities, municipality_codes)
    processed_dir.mkdir(parents=True, exist_ok=True)
    reports = []
    frames = []
    for year in years:
        frame, report = read_year_from_zip(raw_dir, year, geo_filter)
        reports.append(report)
        if frame is not None and not frame.empty:
            frames.append(frame)
    if frames:
        long_df = pd.concat(frames, ignore_index=True)
        filtered = filter_school_rows(long_df, geo_filter)
        wide = to_wide_school_base(filtered)
    else:
        wide = empty_wide_dataframe()
    output_path = processed_dir / "censo_escolar_2020_2025.parquet"
    wide.to_parquet(output_path, index=False)
    return output_path, wide, {
        "name": "offline-inep-zips",
        "ok": bool(frames),
        "records": int(len(wide)),
        "years_requested": years,
        "years_loaded": [report["year"] for report in reports if report.get("ok")],
        "geo_filter": {
            "scope": geo_filter.scope,
            "uf": geo_filter.uf,
            "municipalities": list(geo_filter.municipalities),
            "municipality_codes": list(geo_filter.municipality_codes),
        },
        "reports": reports,
    }


def read_processed_base(processed_path: Path) -> pd.DataFrame:
    if not processed_path.exists():
        raise FileNotFoundError(f"Base parquet not found: {processed_path}")
    return pd.read_parquet(processed_path)


def school_records_from_wide(df: pd.DataFrame) -> list[dict]:
    records = []
    for row in df.to_dict(orient="records"):
        enrollments = {}
        for year in YEARS:
            enrollments[str(year)] = {
                "total": none_if_nan(row.get(f"alunos_total_{year}")),
                "fundamental_ii": none_if_nan(row.get(f"fund2_{year}")),
                "ensino_medio": none_if_nan(row.get(f"medio_{year}")),
            }
        clean_row = {key: serialize_cell(value) for key, value in row.items()}
        records.append(
            {
                **clean_row,
                "inep_code": str(row.get("id_escola") or ""),
                "school": row.get("nome_escola") or "",
                "municipality": row.get("municipio") or "",
                "region": "Grande Sao Paulo",
                "site": "",
                "phone": format_phone(row.get("ddd"), row.get("telefone_inep")),
                "email": "",
                "source_kind": "offline_inep",
                "inep_status": "found",
                "enrollments": enrollments,
                "offline_base": row,
            }
        )
    return records


def read_year_from_zip(raw_dir: Path, year: int, geo_filter: GeoFilter | None = None) -> tuple[pd.DataFrame | None, dict]:
    geo_filter = geo_filter or make_geo_filter()
    zip_path = find_zip_for_year(raw_dir, year)
    if not zip_path:
        return None, {"year": year, "ok": False, "error": f"zip_not_found_for_{year}"}
    try:
        with zipfile.ZipFile(zip_path) as zf:
            members = [name for name in zf.namelist() if name.lower().endswith(".csv")]
            school_member = detect_school_member(zf, members)
            enrollment_member = detect_enrollment_member(zf, members)
            if not school_member:
                return None, {"year": year, "ok": False, "zip": str(zip_path), "error": "school_csv_not_found"}
            school = read_csv_member(zf, school_member, RAW_COLUMNS, lambda chunk: filter_raw_geo(chunk, geo_filter))
            if enrollment_member and enrollment_member != school_member:
                enrollment_cols = ["NU_ANO_CENSO", "CO_ENTIDADE", "QT_MAT_BAS", "QT_MAT_INF", "QT_MAT_FUND", "QT_MAT_FUND_AI", "QT_MAT_FUND_AF", "QT_MAT_MED"]
                entity_ids = set(school.get("CO_ENTIDADE", pd.Series(dtype=str)).dropna().astype(str))
                enrollment = read_csv_member(zf, enrollment_member, enrollment_cols, lambda chunk: filter_raw_entities(chunk, entity_ids))
                school = school.drop(columns=[col for col in enrollment_cols if col in school.columns and col not in {"NU_ANO_CENSO", "CO_ENTIDADE"}], errors="ignore")
                school = school.merge(enrollment, on=["NU_ANO_CENSO", "CO_ENTIDADE"], how="left")
            standardized, missing = standardize_year_frame(school, year)
            return standardized, {
                "year": year,
                "ok": True,
                "zip": str(zip_path),
                "school_csv": school_member,
                "enrollment_csv": enrollment_member or school_member,
                "rows": int(len(standardized)),
                "geo_scope": geo_filter.scope,
                "missing_columns": missing,
            }
    except Exception as exc:
        return None, {"year": year, "ok": False, "zip": str(zip_path), "error": str(exc)}


def find_zip_for_year(raw_dir: Path, year: int) -> Path | None:
    matches = sorted(raw_dir.glob(f"*{year}*.zip"), key=lambda path: zip_candidate_score(path, year), reverse=True)
    if not matches:
        return None
    return matches[0]


def zip_candidate_score(path: Path, year: int) -> int:
    name = path.name.lower()
    score = 0
    if str(year) in name:
        score += 10
    if "microdados" in name:
        score += 50
    if "censo" in name:
        score += 30
    if "escolar" in name or "ed_basica" in name:
        score += 30
    if name == f"microdados_censo_escolar_{year}.zip":
        score += 100
    if any(term in name for term in ["culturae", "foto", "backup", "drive"]):
        score -= 50
    return score


def make_geo_filter(
    scope: str = "grande-sp",
    uf: str = "SP",
    municipalities: list[str] | None = None,
    municipality_codes: list[str] | None = None,
) -> GeoFilter:
    parsed_names = tuple(normalize_municipality_list(municipalities or []))
    parsed_codes = tuple(normalize_code_list(municipality_codes or []))
    normalized_scope = (scope or "grande-sp").strip().lower()
    if normalized_scope in {"grande_sp", "grande-sao-paulo", "grande-sao-paulo", "rmsp"}:
        normalized_scope = "grande-sp"
    if normalized_scope in {"municipio", "municipios", "city", "cities"}:
        normalized_scope = "municipality"
    if normalized_scope in {"estado", "uf"}:
        normalized_scope = "state"
    if normalized_scope == "municipality" and not parsed_names and not parsed_codes:
        parsed_names = ("sao paulo",)
    return GeoFilter(
        scope=normalized_scope,
        uf=(uf or "SP").strip().upper(),
        municipalities=parsed_names,
        municipality_codes=parsed_codes,
    )


def normalize_municipality_list(values: list[str]) -> list[str]:
    out = []
    for value in values:
        for item in str(value).split(","):
            normalized = normalize_text(item)
            if normalized:
                out.append(normalized)
    return out


def normalize_code_list(values: list[str]) -> list[str]:
    out = []
    for value in values:
        for item in str(value).split(","):
            cleaned = clean_string(item)
            if cleaned:
                out.append(cleaned)
    return out


def filter_raw_geo(df: pd.DataFrame, geo_filter: GeoFilter) -> pd.DataFrame:
    if df.empty or geo_filter.scope == "all":
        return df
    if geo_filter.scope == "grande-sp":
        if "CO_MUNICIPIO" not in df.columns:
            return df.iloc[0:0]
        return df[df["CO_MUNICIPIO"].astype(str).isin(set(TARGET_MUNICIPALITIES))]
    if geo_filter.scope == "state":
        if "SG_UF" not in df.columns:
            return df.iloc[0:0]
        return df[df["SG_UF"].astype(str).str.upper() == geo_filter.uf]
    if geo_filter.scope == "municipality":
        mask = pd.Series(False, index=df.index)
        if geo_filter.municipality_codes and "CO_MUNICIPIO" in df.columns:
            mask = mask | df["CO_MUNICIPIO"].astype(str).isin(set(geo_filter.municipality_codes))
        if geo_filter.municipalities and "NO_MUNICIPIO" in df.columns:
            normalized_names = df["NO_MUNICIPIO"].map(normalize_text)
            mask = mask | normalized_names.isin(set(geo_filter.municipalities))
        return df[mask]
    return df


def filter_raw_entities(df: pd.DataFrame, entity_ids: set[str]) -> pd.DataFrame:
    if not entity_ids or "CO_ENTIDADE" not in df.columns:
        return df.iloc[0:0]
    return df[df["CO_ENTIDADE"].astype(str).isin(entity_ids)]


def detect_school_member(zf: zipfile.ZipFile, members: list[str]) -> str | None:
    scored = []
    for member in members:
        lower = member.lower()
        score = 0
        if "tabela_escola" in lower:
            score += 40
        if "microdados_ed_basica" in lower:
            score += 35
        if "/dados/" in lower or "\\dados\\" in lower:
            score += 5
        if any(skip in lower for skip in ["matricula", "docente", "turma", "gestor", "curso", "suplemento"]):
            score -= 50
        header = read_header(zf, member)
        if {"CO_ENTIDADE", "NO_ENTIDADE"}.issubset(header):
            score += 50
        if "QT_MAT_BAS" in header:
            score += 5
        scored.append((score, member))
    scored.sort(reverse=True)
    return scored[0][1] if scored and scored[0][0] > 0 else None


def detect_enrollment_member(zf: zipfile.ZipFile, members: list[str]) -> str | None:
    scored = []
    for member in members:
        lower = member.lower()
        score = 0
        if "tabela_matricula" in lower or "matricula" in lower:
            score += 50
        if "microdados_ed_basica" in lower:
            score += 20
        header = read_header(zf, member)
        if {"CO_ENTIDADE", "QT_MAT_BAS"}.issubset(header):
            score += 50
        scored.append((score, member))
    scored.sort(reverse=True)
    return scored[0][1] if scored and scored[0][0] > 0 else None


def read_header(zf: zipfile.ZipFile, member: str) -> set[str]:
    with zf.open(member) as file:
        raw = file.readline()
    for encoding in ["latin1", "ISO-8859-1", "utf-8-sig", "utf-8"]:
        try:
            return set(raw.decode(encoding).strip().split(";"))
        except UnicodeDecodeError:
            continue
    return set()


def read_csv_member(
    zf: zipfile.ZipFile,
    member: str,
    columns: list[str],
    row_filter: Callable[[pd.DataFrame], pd.DataFrame] | None = None,
) -> pd.DataFrame:
    last_error: Exception | None = None
    for encoding in ["latin1", "ISO-8859-1", "utf-8-sig", "utf-8"]:
        try:
            with zf.open(member) as file:
                reader = pd.read_csv(
                    file,
                    sep=";",
                    encoding=encoding,
                    dtype=str,
                    low_memory=False,
                    usecols=lambda col: col in columns,
                    chunksize=CSV_CHUNKSIZE,
                )
                chunks = []
                for chunk in reader:
                    if row_filter:
                        chunk = row_filter(chunk)
                    if not chunk.empty:
                        chunks.append(chunk)
                if chunks:
                    return pd.concat(chunks, ignore_index=True)
                return pd.DataFrame(columns=columns)
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f"Could not read {member}: {last_error}")


def standardize_year_frame(raw: pd.DataFrame, year: int) -> tuple[pd.DataFrame, list[str]]:
    out = pd.DataFrame()
    missing = []
    for internal, alternatives in FIELD_MAP.items():
        source = next((column for column in alternatives if column in raw.columns), None)
        if source:
            out[internal] = raw[source]
        else:
            out[internal] = pd.NA
            missing.append(alternatives[0])
    out["ano"] = pd.to_numeric(out["ano"], errors="coerce").fillna(year).astype("Int64")
    for column in NUMERIC_COLUMNS:
        out[column] = pd.to_numeric(out[column], errors="coerce").astype("Int64")
    for column in STRING_COLUMNS:
        out[column] = out[column].map(clean_string)
    return out[INTERNAL_COLUMNS], missing


def filter_school_rows(df: pd.DataFrame, geo_filter: GeoFilter | None = None) -> pd.DataFrame:
    geo_filter = geo_filter or make_geo_filter()
    filtered = filter_internal_geo(df, geo_filter).copy()
    filtered = filtered[filtered["dependencia_administrativa"].astype(str) == "4"]
    if "situacao_funcionamento" in filtered.columns:
        status = filtered["situacao_funcionamento"]
        filtered = filtered[status.isna() | (status.astype(str) == "1")]
    enrollment_cols = ["alunos_total", "alunos_fund2", "alunos_medio"]
    for column in enrollment_cols:
        filtered[column] = pd.to_numeric(filtered[column], errors="coerce").fillna(0).astype("Int64")
    filtered = filtered[filtered["alunos_total"] > 0]
    filtered = filtered[(filtered["alunos_fund2"] > 0) | (filtered["alunos_medio"] > 0)]
    return filtered


def filter_internal_geo(df: pd.DataFrame, geo_filter: GeoFilter) -> pd.DataFrame:
    if df.empty or geo_filter.scope == "all":
        return df
    if geo_filter.scope == "grande-sp":
        return df[df["id_municipio"].astype(str).isin(set(TARGET_MUNICIPALITIES))]
    if geo_filter.scope == "state":
        return df[df["sigla_uf"].astype(str).str.upper() == geo_filter.uf]
    if geo_filter.scope == "municipality":
        mask = pd.Series(False, index=df.index)
        if geo_filter.municipality_codes:
            mask = mask | df["id_municipio"].astype(str).isin(set(geo_filter.municipality_codes))
        if geo_filter.municipalities:
            mask = mask | df["municipio"].map(normalize_text).isin(set(geo_filter.municipalities))
        return df[mask]
    return df


def to_wide_school_base(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return empty_wide_dataframe()
    base_cols = [
        "id_escola",
        "nome_escola",
        "sigla_uf",
        "id_municipio",
        "municipio",
        "rede",
        "dependencia_administrativa",
        "tipo_categoria_escola_privada",
        "tipo_localizacao",
        "situacao_funcionamento",
        "endereco",
        "numero_endereco",
        "complemento",
        "bairro",
        "cep",
        "ddd",
        "telefone_inep",
        "latitude",
        "longitude",
        "cnpj_escola_privada",
        "cnpj_mantenedora",
    ]
    latest = df.sort_values(["id_escola", "ano"]).groupby("id_escola", as_index=False).tail(1)[base_cols]
    wide = latest.set_index("id_escola")
    for year in YEARS:
        year_df = df[df["ano"] == year].set_index("id_escola")
        for source, target in [
            ("alunos_total", f"alunos_total_{year}"),
            ("alunos_fund2", f"fund2_{year}"),
            ("alunos_medio", f"medio_{year}"),
        ]:
            wide[target] = year_df[source]
    wide = wide.reset_index()
    add_variations(wide, "alunos_total", "variacao_total")
    add_variations(wide, "fund2", "variacao_fund2")
    add_variations(wide, "medio", "variacao_medio")
    wide["tendencia_total"] = wide["variacao_total_pct_2020_2025"].map(classify_trend)
    return wide


def add_variations(df: pd.DataFrame, prefix: str, output_prefix: str) -> None:
    first = pd.to_numeric(df.get(f"{prefix}_2020"), errors="coerce")
    last = pd.to_numeric(df.get(f"{prefix}_2025"), errors="coerce")
    delta = last - first
    pct = (delta / first.replace({0: pd.NA})) * 100
    df[f"{output_prefix}_abs_2020_2025"] = delta.astype("Float64")
    df[f"{output_prefix}_pct_2020_2025"] = pct.round(1).astype("Float64")


def classify_trend(value: Any) -> str:
    if value is None or pd.isna(value):
        return "sem dados"
    if value > 5:
        return "crescendo"
    if value < -5:
        return "caindo"
    return "estavel"


def empty_wide_dataframe() -> pd.DataFrame:
    base = [
        "id_escola",
        "nome_escola",
        "sigla_uf",
        "id_municipio",
        "municipio",
        "rede",
        "dependencia_administrativa",
        "tipo_categoria_escola_privada",
        "tipo_localizacao",
        "situacao_funcionamento",
        "endereco",
        "numero_endereco",
        "complemento",
        "bairro",
        "cep",
        "ddd",
        "telefone_inep",
        "latitude",
        "longitude",
        "cnpj_escola_privada",
        "cnpj_mantenedora",
    ]
    yearly = [f"{metric}_{year}" for metric in ["alunos_total", "fund2", "medio"] for year in YEARS]
    variations = [
        "variacao_total_abs_2020_2025",
        "variacao_total_pct_2020_2025",
        "variacao_fund2_abs_2020_2025",
        "variacao_fund2_pct_2020_2025",
        "variacao_medio_abs_2020_2025",
        "variacao_medio_pct_2020_2025",
        "tendencia_total",
    ]
    return pd.DataFrame(columns=base + yearly + variations)


def normalize_text(value: Any) -> str:
    text = clean_string(value) or ""
    table = str.maketrans("áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ", "aaaaeeiooouucAAAAEEIOOOUUC")
    return " ".join(text.translate(table).lower().split())


def clean_string(value: Any) -> str | None:
    if value is None or pd.isna(value):
        return None
    text = str(value).strip()
    if text.endswith(".0") and text[:-2].isdigit():
        text = text[:-2]
    return text or None


def none_if_nan(value: Any) -> int | None:
    if value is None or pd.isna(value):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def format_phone(ddd: Any, phone: Any) -> str:
    ddd_text = clean_string(ddd) or ""
    phone_text = clean_string(phone) or ""
    if not phone_text:
        return ""
    return f"({ddd_text}) {phone_text}" if ddd_text else phone_text


def serialize_cell(value: Any) -> Any:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value
