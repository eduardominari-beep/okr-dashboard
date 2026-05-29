from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from .censo_offline import build_offline_base, read_processed_base, school_records_from_wide
from .classify_leads import classify_schools
from .email_sender import send_email
from .enrich_public_sources import enrich_schools
from .inep_bigquery import collect_inep_schools
from .prioritization import prioritize_records
from .report import write_outputs


DEFAULT_PROCESSED_PATH = Path("data/processed/censo_escolar_2020_2025.parquet")
DEFAULT_ENRICHED_PATH = Path("data/processed/worlded_enriched_leads.json")
DEFAULT_ENRICHMENT_CACHE_PATH = Path("data/processed/public-enrichment-cache.json")
ENRICHMENT_CACHE_FIELDS = {
    "site",
    "phone",
    "email",
    "decision_maker_name",
    "decision_maker_role",
    "decision_maker_url",
    "has_bilingual_program",
    "bilingual_program_type",
    "bilingual_evidence",
    "has_ib",
    "ib_evidence",
    "has_ap",
    "ap_evidence",
    "has_dual_diploma",
    "dual_diploma_evidence",
    "is_centralized_network",
    "network_evidence",
    "reputation_evidence",
    "sources_consulted",
    "last_public_update_status",
    "public_enrichment_error",
}


def build_base(args: argparse.Namespace) -> dict:
    raw_dir = Path(args.raw_dir)
    processed_dir = Path(args.processed_dir)
    use_bigquery = should_use_bigquery(args)
    if use_bigquery:
        records, report = collect_inep_schools("live", limit=args.limit)
        processed_dir.mkdir(parents=True, exist_ok=True)
        df = wide_dataframe_from_records(records)
        output_path = processed_dir / "censo_escolar_2020_2025.parquet"
        df.to_parquet(output_path, index=False)
    else:
        output_path, df, report = build_offline_base(
            raw_dir,
            processed_dir,
            scope=args.scope,
            uf=args.uf,
            municipalities=args.municipality,
            municipality_codes=args.municipality_code,
        )
    write_json(processed_dir / "build-base-status.json", report)
    print(f"Base parquet: {output_path}")
    print(f"Schools in base: {len(df)}")
    if not report.get("ok"):
        print("WARNING: base source did not fully load; see build-base-status.json")
    return {"path": str(output_path), "records": int(len(df)), "report": report}


def enrich(args: argparse.Namespace) -> dict:
    processed_path = Path(args.processed_path)
    processed_dir = Path(args.processed_dir)
    processed_dir.mkdir(parents=True, exist_ok=True)
    df = read_processed_base(processed_path)
    base_records = prioritize_records(school_records_from_wide(df), order=args.enrich_order)
    cache_path = Path(args.cache_file)
    cache_payload = {"version": 1, "items": {}} if args.refresh_cache else load_json(cache_path)
    cache = cache_payload.get("items", {}) if isinstance(cache_payload, dict) else {}
    pending = [record for record in base_records if school_cache_key(record) not in cache]
    start = max(0, int(args.enrich_offset or 0))
    end = start + int(args.enrich_limit) if args.enrich_limit else None
    to_process = pending[start:end]
    freshly_enriched, enrichment_report = enrich_schools(to_process, mode=args.mode)
    for enriched_record in freshly_enriched:
        cache[school_cache_key(enriched_record)] = public_enrichment_only(enriched_record)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    write_json(
        cache_path,
        {
            "version": 1,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "base_records": len(base_records),
            "cached_records": len(cache),
            "pending_records": max(0, len(base_records) - len(cache)),
            "items": cache,
        },
    )
    enriched = []
    for record in base_records:
        key = school_cache_key(record)
        if key in cache:
            enriched.append({**record, **cache[key]})
    classified = classify_schools(enriched)
    base_status = load_json(processed_dir / "build-base-status.json")
    metadata = run_metadata(args.run_id, args.mode)
    if base_status.get("geo_filter"):
        metadata["geo_filter"] = base_status["geo_filter"]
    metadata["enrichment_cache"] = {
        "cache_file": str(cache_path),
        "base_records": len(base_records),
        "cached_records": len(cache),
        "pending_records": max(0, len(base_records) - len(cache)),
        "processed_this_run": len(freshly_enriched),
        "enrich_order": args.enrich_order,
    }
    enrichment_report = {
        **enrichment_report,
        "base_records": len(base_records),
        "cached_records": len(cache),
        "pending_records": max(0, len(base_records) - len(cache)),
        "processed_this_run": len(freshly_enriched),
        "enrich_order": args.enrich_order,
    }
    payload = {
        "metadata": metadata,
        "base_records": base_records,
        "enriched": enriched,
        "leads": classified,
        "source_reports": [{"name": "offline-parquet", "ok": True, "records": len(base_records), "geo_filter": base_status.get("geo_filter")}, enrichment_report],
    }
    write_json(processed_dir / "worlded_enriched_leads.json", payload)
    write_json(processed_dir / "enrich-status.json", enrichment_report)
    print(f"Enriched leads: {len(classified)}")
    print(f"Pending enrichment: {max(0, len(base_records) - len(cache))}")
    print(f"Processed file: {processed_dir / 'worlded_enriched_leads.json'}")
    return payload


def report(args: argparse.Namespace) -> dict:
    run_id = args.run_id or f"{args.mode}-{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%SZ')}"
    run_dir = Path(args.out_dir or f"data/outputs/{run_id}")
    state_file = Path(args.state_file)
    payload = json.loads(Path(args.enriched_path).read_text(encoding="utf-8"))
    leads = payload["leads"]
    state = load_state(state_file)
    new_leads, long_list, updated_state = apply_incremental_state(leads, state)
    save_state(state_file, updated_state)
    metadata = {**run_metadata(run_id, args.mode), **payload.get("metadata", {})}
    metadata["run_id"] = run_id
    metadata["mode"] = args.mode
    status = operational_status(leads, new_leads, long_list, payload.get("source_reports", []))
    result = {
        "metadata": metadata,
        "raw_inep": payload.get("base_records", []),
        "enriched": payload.get("enriched", []),
        "leads": leads,
        "new_leads": new_leads,
        "long_list": long_list,
        "source_reports": payload.get("source_reports", []),
        "status": status,
    }
    write_outputs(run_dir, result)
    print(f"Report status: {status['state']}")
    print(f"Outputs: {run_dir}")
    if args.mode == "live" and status["state"] == "FAIL":
        raise SystemExit(1)
    return result


def run_all(args: argparse.Namespace) -> dict:
    run_id = args.run_id or f"{args.mode}-{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%SZ')}"
    build_base(
        argparse.Namespace(
            raw_dir=args.raw_dir,
            processed_dir=args.processed_dir,
            offline=args.offline,
            limit=args.limit,
            scope=args.scope,
            uf=args.uf,
            municipality=args.municipality,
            municipality_code=args.municipality_code,
        )
    )
    enrich(
        argparse.Namespace(
            processed_path=str(Path(args.processed_dir) / "censo_escolar_2020_2025.parquet"),
            processed_dir=args.processed_dir,
            mode=args.mode,
            run_id=run_id,
            cache_file=args.cache_file,
            enrich_limit=args.enrich_limit,
            enrich_offset=args.enrich_offset,
            refresh_cache=args.refresh_cache,
            enrich_order=args.enrich_order,
        )
    )
    result = report(
        argparse.Namespace(
            enriched_path=str(Path(args.processed_dir) / "worlded_enriched_leads.json"),
            out_dir=args.out_dir or f"data/outputs/{run_id}",
            state_file=args.state_file,
            mode=args.mode,
            run_id=run_id,
        )
    )
    send_email(Path(args.out_dir or f"data/outputs/{run_id}"))
    return result


def collect_compat(args: argparse.Namespace) -> dict:
    return run_all(
        argparse.Namespace(
            mode=args.mode,
            run_id=args.run_id,
            raw_dir=args.raw_dir,
            processed_dir=args.processed_dir,
            out_dir=args.out_dir,
            state_file=args.state_file,
            offline=args.offline,
            limit=args.limit,
            scope=args.scope,
            uf=args.uf,
            municipality=args.municipality,
            municipality_code=args.municipality_code,
            cache_file=args.cache_file,
            enrich_limit=args.enrich_limit,
            enrich_offset=args.enrich_offset,
            refresh_cache=args.refresh_cache,
            enrich_order=args.enrich_order,
        )
    )


def operational_status(leads: list[dict], new_leads: list[dict], long_list: list[dict], source_reports: list[dict]) -> dict:
    warnings = []
    failures = []
    if not leads:
        failures.append("no_schools_analyzed")
    for source_report in source_reports:
        if not source_report.get("ok"):
            warnings.append(f"{source_report.get('name')}_not_ok")
        if source_report.get("pending_records"):
            warnings.append(f"{source_report.get('name')}_pending_records_{source_report.get('pending_records')}")
    if not any(lead["camada_comercial"] in {"A", "B"} for lead in leads):
        warnings.append("no_layer_a_or_b_leads")
    if all(lead.get("alunos_total_2025") is None for lead in leads):
        warnings.append("students_2025_not_available_or_not_found")

    counts = {
        "schools_analyzed": len(leads),
        "layer_a": sum(1 for lead in leads if lead["camada_comercial"] == "A"),
        "layer_b": sum(1 for lead in leads if lead["camada_comercial"] == "B"),
        "layer_c": sum(1 for lead in leads if lead["camada_comercial"] == "C"),
        "layer_d": sum(1 for lead in leads if lead["camada_comercial"] == "D"),
        "layer_e": sum(1 for lead in leads if lead["camada_comercial"] == "E"),
        "excluded_existing_international": sum(1 for lead in leads if lead["camada_comercial"] == "C"),
        "corporate_networks": sum(1 for lead in leads if lead["camada_comercial"] == "D"),
        "new_leads": len(new_leads),
        "long_list": len(long_list),
    }
    state = "FAIL" if failures else "WARNING" if warnings else "SUCCESS"
    return {
        "state": state,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "counts": counts,
        "source_reports": source_reports,
        "warnings": warnings,
        "failures": failures,
    }


def apply_incremental_state(leads: list[dict], state: dict) -> tuple[list[dict], list[dict], dict]:
    now = datetime.now(timezone.utc).isoformat()
    seen = state.get("seen", {})
    long_map = state.get("long_list", {})
    new_leads = []
    for lead in leads:
        key = lead["lead_key"]
        existing_seen = seen.get(key)
        if existing_seen:
            lead["is_new"] = False
            lead["first_seen_at"] = existing_seen.get("first_seen_at", now)
        else:
            lead["is_new"] = True
            lead["first_seen_at"] = now
            new_leads.append(lead)
        lead["last_seen_at"] = now
        seen[key] = {
            "first_seen_at": lead["first_seen_at"],
            "last_seen_at": now,
            "school": lead.get("school", ""),
            "municipality": lead.get("municipality", ""),
            "camada_comercial": lead.get("camada_comercial", ""),
        }
        current = long_map.get(key)
        if not current or lead.get("score", 0) >= current.get("score", 0):
            long_map[key] = {**lead, "first_seen_at": lead["first_seen_at"], "last_seen_at": now}
        else:
            long_map[key]["last_seen_at"] = now
    long_list = sorted(long_map.values(), key=lambda item: (layer_sort(item.get("camada_comercial")), -item.get("score", 0), item.get("school", "")))
    return new_leads, long_list, {"version": 1, "updated_at": now, "seen": seen, "long_list": long_map}


def run_metadata(run_id: str, mode: str) -> dict:
    return {
        "run_id": run_id or f"{mode}-{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%SZ')}",
        "mode": mode,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "date": datetime.now().strftime("%Y-%m-%d"),
        "email_to": os.environ.get("LEADS_EMAIL_TO", "eduardo.minari@gmail.com"),
        "offline_first": not should_use_bigquery(argparse.Namespace(offline=False)),
    }


def load_state(path: Path) -> dict:
    if not path.exists():
        return {"version": 1, "seen": {}, "long_list": {}}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"version": 1, "seen": {}, "long_list": {}}


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def school_cache_key(record: dict) -> str:
    inep_code = record.get("inep_code") or record.get("id_escola")
    if inep_code:
        return f"inep:{inep_code}"
    return f"name:{record.get('school') or record.get('nome_escola', '')}|{record.get('municipality') or record.get('municipio', '')}".lower()


def public_enrichment_only(record: dict) -> dict:
    return {key: record.get(key) for key in ENRICHMENT_CACHE_FIELDS if key in record}


def save_state(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def layer_sort(layer: str) -> int:
    return {"A": 0, "B": 1, "D": 2, "C": 3, "E": 4}.get(layer, 9)


def should_use_bigquery(args: argparse.Namespace) -> bool:
    if getattr(args, "offline", False):
        return False
    return os.environ.get("USE_BIGQUERY", "").lower() == "true"


def wide_dataframe_from_records(records: list[dict]):
    import pandas as pd

    rows = []
    for record in records:
        row = {
            "id_escola": record.get("inep_code"),
            "nome_escola": record.get("school"),
            "sigla_uf": "SP",
            "id_municipio": "",
            "municipio": record.get("municipality"),
            "rede": "4",
            "dependencia_administrativa": "4",
            "tipo_categoria_escola_privada": None,
            "tipo_localizacao": None,
            "situacao_funcionamento": None,
            "cnpj_escola_privada": None,
            "cnpj_mantenedora": None,
        }
        for year in [2020, 2021, 2022, 2023, 2024, 2025]:
            data = record.get("enrollments", {}).get(str(year), {})
            row[f"alunos_total_{year}"] = data.get("total")
            row[f"fund2_{year}"] = data.get("fundamental_ii")
            row[f"medio_{year}"] = data.get("ensino_medio")
        rows.append(row)
    return pd.DataFrame(rows)


def add_common_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--mode", choices=["live", "fixture"], default="live")
    parser.add_argument("--offline", action="store_true", default=False)
    parser.add_argument("--run-id", default="")
    parser.add_argument("--raw-dir", default="data/raw")
    parser.add_argument("--processed-dir", default="data/processed")
    parser.add_argument("--out-dir", default="")
    parser.add_argument("--state-file", default=".lead-state/state.json")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--cache-file", default=str(DEFAULT_ENRICHMENT_CACHE_PATH))
    parser.add_argument("--enrich-limit", type=int, default=0)
    parser.add_argument("--enrich-offset", type=int, default=0)
    parser.add_argument("--refresh-cache", action="store_true", default=False)
    parser.add_argument("--enrich-order", choices=["priority", "base", "name"], default="priority")
    add_geo_args(parser)


def add_geo_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--scope", choices=["grande-sp", "state", "municipality", "all"], default="grande-sp")
    parser.add_argument("--uf", default="SP")
    parser.add_argument("--municipality", action="append", default=[])
    parser.add_argument("--municipality-code", action="append", default=[])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="WorldEd lead hunter")
    sub = parser.add_subparsers(dest="command", required=True)

    build_parser = sub.add_parser("build-base")
    build_parser.add_argument("--raw-dir", default="data/raw")
    build_parser.add_argument("--processed-dir", default="data/processed")
    build_parser.add_argument("--offline", action="store_true", default=False)
    build_parser.add_argument("--limit", type=int, default=0)
    add_geo_args(build_parser)

    enrich_parser = sub.add_parser("enrich")
    enrich_parser.add_argument("--processed-path", default=str(DEFAULT_PROCESSED_PATH))
    enrich_parser.add_argument("--processed-dir", default="data/processed")
    enrich_parser.add_argument("--mode", choices=["live", "fixture"], default="live")
    enrich_parser.add_argument("--run-id", default="")
    enrich_parser.add_argument("--cache-file", default=str(DEFAULT_ENRICHMENT_CACHE_PATH))
    enrich_parser.add_argument("--enrich-limit", type=int, default=0)
    enrich_parser.add_argument("--enrich-offset", type=int, default=0)
    enrich_parser.add_argument("--refresh-cache", action="store_true", default=False)
    enrich_parser.add_argument("--enrich-order", choices=["priority", "base", "name"], default="priority")

    report_parser = sub.add_parser("report")
    report_parser.add_argument("--enriched-path", default=str(DEFAULT_ENRICHED_PATH))
    report_parser.add_argument("--out-dir", default="")
    report_parser.add_argument("--state-file", default=".lead-state/state.json")
    report_parser.add_argument("--mode", choices=["live", "fixture"], default="live")
    report_parser.add_argument("--run-id", default="")

    email_parser = sub.add_parser("send-email")
    email_parser.add_argument("--run-dir", required=True)

    run_all_parser = sub.add_parser("run-all")
    add_common_args(run_all_parser)

    collect_parser = sub.add_parser("collect")
    add_common_args(collect_parser)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if getattr(args, "limit", 0) == 0:
        args.limit = None
    if args.command == "build-base":
        build_base(args)
    elif args.command == "enrich":
        enrich(args)
    elif args.command == "report":
        report(args)
    elif args.command == "send-email":
        send_email(Path(args.run_dir))
    elif args.command == "run-all":
        run_all(args)
    elif args.command == "collect":
        collect_compat(args)


if __name__ == "__main__":
    main()
