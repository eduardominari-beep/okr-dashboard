from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from .classify_leads import classify_schools
from .email_sender import send_email
from .enrich_public_sources import enrich_schools
from .inep_bigquery import collect_inep_schools
from .report import write_outputs


def collect(args: argparse.Namespace) -> dict:
    run_id = args.run_id or f"{args.mode}-{datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%SZ')}"
    run_dir = Path(args.out_dir or f"data/outputs/{run_id}")
    state_file = Path(args.state_file or ".lead-state/state.json")
    run_dir.mkdir(parents=True, exist_ok=True)
    state_file.parent.mkdir(parents=True, exist_ok=True)

    raw_inep, inep_report = collect_inep_schools(args.mode, limit=args.limit)
    enriched, enrichment_report = enrich_schools(raw_inep, mode=args.mode)
    classified = classify_schools(enriched)
    state = load_state(state_file)
    new_leads, long_list, updated_state = apply_incremental_state(classified, state)
    save_state(state_file, updated_state)

    metadata = {
        "run_id": run_id,
        "mode": args.mode,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "date": datetime.now().strftime("%Y-%m-%d"),
        "email_to": os.environ.get("LEADS_EMAIL_TO", "eduardo.minari@gmail.com"),
    }
    status = operational_status(classified, new_leads, long_list, [inep_report, enrichment_report])
    result = {
        "metadata": metadata,
        "raw_inep": raw_inep,
        "enriched": enriched,
        "leads": classified,
        "new_leads": new_leads,
        "long_list": long_list,
        "source_reports": [inep_report, enrichment_report],
        "status": status,
    }
    write_outputs(run_dir, result)
    print(f"Run: {run_id}")
    print(f"Status: {status['state']}")
    print(f"Schools analyzed: {status['counts']['schools_analyzed']}")
    print(f"Layer A: {status['counts']['layer_a']}")
    print(f"Layer B: {status['counts']['layer_b']}")
    print(f"New leads: {status['counts']['new_leads']}")
    print(f"Outputs: {run_dir}")
    if args.mode == "live" and status["state"] == "FAIL":
        raise SystemExit(1)
    return result


def operational_status(leads: list[dict], new_leads: list[dict], long_list: list[dict], source_reports: list[dict]) -> dict:
    warnings = []
    failures = []
    if not leads:
        failures.append("no_schools_analyzed")
    for report in source_reports:
        if not report.get("ok"):
            warnings.append(f"{report.get('name')}_not_ok")
    if not any(lead["camada_comercial"] in {"A", "B"} for lead in leads):
        warnings.append("no_layer_a_or_b_leads")
    if all(lead.get("students_total_2025") is None for lead in leads):
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


def load_state(path: Path) -> dict:
    if not path.exists():
        return {"version": 1, "seen": {}, "long_list": {}}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"version": 1, "seen": {}, "long_list": {}}


def save_state(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def layer_sort(layer: str) -> int:
    return {"A": 0, "B": 1, "D": 2, "C": 3, "E": 4}.get(layer, 9)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="WorldEd lead hunter")
    sub = parser.add_subparsers(dest="command", required=True)

    collect_parser = sub.add_parser("collect")
    collect_parser.add_argument("--mode", choices=["live", "fixture"], default="fixture")
    collect_parser.add_argument("--run-id", default="")
    collect_parser.add_argument("--out-dir", default="")
    collect_parser.add_argument("--state-file", default="")
    collect_parser.add_argument("--limit", type=int, default=0)

    email_parser = sub.add_parser("send-email")
    email_parser.add_argument("--run-dir", required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.command == "collect":
        if args.limit == 0:
            args.limit = None
        collect(args)
    elif args.command == "send-email":
        send_email(Path(args.run_dir))


if __name__ == "__main__":
    main()
