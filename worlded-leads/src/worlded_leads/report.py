from __future__ import annotations

import csv
import html
import json
from pathlib import Path


CSV_COLUMNS = [
    "school",
    "inep_code",
    "municipality",
    "region",
    "endereco",
    "numero_endereco",
    "complemento",
    "bairro",
    "cep",
    "latitude",
    "longitude",
    "site",
    "phone",
    "email",
    "decision_maker_name",
    "decision_maker_role",
    "decision_maker_url",
    "school_type",
    "probable_decision",
    "has_bilingual_program",
    "bilingual_program_type",
    "bilingual_evidence",
    "has_ib",
    "ib_evidence",
    "has_ap",
    "ap_evidence",
    "has_dual_diploma",
    "dual_diploma_evidence",
    "alunos_total_2020",
    "alunos_total_2021",
    "alunos_total_2022",
    "alunos_total_2023",
    "alunos_total_2024",
    "alunos_total_2025",
    "fund2_2020",
    "fund2_2021",
    "fund2_2022",
    "fund2_2023",
    "fund2_2024",
    "fund2_2025",
    "medio_2020",
    "medio_2021",
    "medio_2022",
    "medio_2023",
    "medio_2024",
    "medio_2025",
    "variacao_total_abs_2020_2025",
    "variacao_total_pct_2020_2025",
    "variacao_fund2_abs_2020_2025",
    "variacao_fund2_pct_2020_2025",
    "variacao_medio_abs_2020_2025",
    "variacao_medio_pct_2020_2025",
    "tendencia_total",
    "enrichment_priority_score",
    "enrichment_priority_reason",
    "fit_comercial",
    "camada_comercial",
    "score",
    "motivo_classificacao",
    "sugestao_abordagem_comercial",
    "sources_consulted",
    "last_updated_at",
    "is_new",
    "first_seen_at",
    "last_seen_at",
]


def write_outputs(run_dir: Path, result: dict) -> None:
    run_dir.mkdir(parents=True, exist_ok=True)
    leads = result["leads"]
    new_leads = result["new_leads"]
    long_list = result["long_list"]
    write_json(run_dir / "worlded_leads.json", leads)
    write_json(run_dir / "new-leads.json", new_leads)
    write_json(run_dir / "long-list.json", long_list)
    write_json(run_dir / "raw-inep.json", result["raw_inep"])
    write_json(run_dir / "enriched-schools.json", result["enriched"])
    write_json(run_dir / "operational-status.json", result["status"])
    write_json(run_dir / "run-metadata.json", result["metadata"])
    write_csv(run_dir / "worlded_leads.csv", leads)
    write_csv(run_dir / "new-leads.csv", new_leads)
    write_csv(run_dir / "long-list.csv", long_list)
    (run_dir / "worlded_leads.html").write_text(to_html(result), encoding="utf-8")
    summary = to_summary(result)
    (run_dir / "summary.md").write_text(summary, encoding="utf-8")
    (run_dir / "summary.txt").write_text(summary, encoding="utf-8")
    prepare_email_files(run_dir, result, summary)


def write_json(path: Path, data) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_csv(path: Path, rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            output = {column: cell(row.get(column)) for column in CSV_COLUMNS}
            writer.writerow(output)


def to_summary(result: dict) -> str:
    status = result["status"]
    leads = result["leads"]
    territory = territory_label(result["metadata"].get("geo_filter"))
    top = [lead for lead in leads if lead["camada_comercial"] in {"A", "B"}][:10]
    declining = [lead for lead in leads if lead.get("tendencia_total") == "caindo"][:10]
    growing = [lead for lead in leads if lead.get("tendencia_total") == "crescendo"][:10]
    lines = [
        f"# Leads WorldEd - Dual Diploma | {territory} | {result['metadata']['run_id']}",
        "",
        f"Status: {status['state']}",
        f"Modo: {result['metadata']['mode']}",
        f"Territorio: {territory}",
        f"Gerado em: {result['metadata']['generated_at']}",
        "",
        "## Resumo executivo",
        "",
        f"- Escolas analisadas: {status['counts']['schools_analyzed']}",
        f"- Leads camada A: {status['counts']['layer_a']}",
        f"- Leads camada B: {status['counts']['layer_b']}",
        f"- Exclusoes por IB/AP/Dual/High School: {status['counts']['excluded_existing_international']}",
        f"- Redes/franquias para abordagem corporativa: {status['counts']['corporate_networks']}",
        f"- Novos registros nesta execucao: {status['counts']['new_leads']}",
        f"- Long list acumulada: {status['counts']['long_list']}",
        "",
        "## Top 10 leads prioritarios",
        "",
    ]
    lines.extend(render_lead_lines(top) or ["- Nenhum lead A/B nesta execucao."])
    lines.extend(["", "## Escolas em queda de matricula", ""])
    lines.extend(render_lead_lines(declining) or ["- Nenhuma queda detectada nos dados disponiveis."])
    lines.extend(["", "## Escolas crescendo", ""])
    lines.extend(render_lead_lines(growing) or ["- Nenhum crescimento detectado nos dados disponiveis."])
    if status["warnings"] or status["failures"]:
        lines.extend(["", "## Alertas de dados", ""])
        lines.extend([f"- WARNING: {warning}" for warning in status["warnings"]])
        lines.extend([f"- FAIL: {failure}" for failure in status["failures"]])
    return "\n".join(lines) + "\n"


def render_lead_lines(leads: list[dict]) -> list[str]:
    return [
        f"- {lead['score']} | Camada {lead['camada_comercial']} | {lead['school']} | {lead.get('municipality', '')} | {lead.get('tendencia_total', lead.get('trend', 'sem dados'))} | {lead.get('sugestao_abordagem_comercial', '')}"
        for lead in leads
    ]


def territory_label(geo_filter: dict | None) -> str:
    if not geo_filter:
        return "nao informado"
    scope = geo_filter.get("scope", "grande-sp")
    if scope == "state":
        return f"estado {geo_filter.get('uf', 'SP')}"
    if scope == "municipality":
        names = ", ".join(geo_filter.get("municipalities") or [])
        codes = ", ".join(geo_filter.get("municipality_codes") or [])
        return names or codes or "municipio Sao Paulo"
    if scope == "all":
        return "Brasil"
    return "Grande Sao Paulo"


def to_html(result: dict) -> str:
    rows = result["leads"]
    territory = territory_label(result["metadata"].get("geo_filter"))
    header = "".join(f"<th>{html.escape(column)}</th>" for column in CSV_COLUMNS)
    body = "\n".join(
        "<tr>" + "".join(f"<td>{html.escape(cell(row.get(column)))}</td>" for column in CSV_COLUMNS) + "</tr>"
        for row in rows
    )
    return f"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Leads WorldEd</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 24px; }}
    table {{ border-collapse: collapse; width: 100%; font-size: 12px; }}
    th, td {{ border: 1px solid #ddd; padding: 6px; vertical-align: top; }}
    th {{ background: #f5f7fa; position: sticky; top: 0; }}
    tr:nth-child(even) {{ background: #fafafa; }}
  </style>
</head>
<body>
  <h1>Leads WorldEd - Dual Diploma | {html.escape(territory)}</h1>
  <p>Gerado em {html.escape(result['metadata']['generated_at'])}</p>
  <table><thead><tr>{header}</tr></thead><tbody>{body}</tbody></table>
</body>
</html>
"""


def prepare_email_files(run_dir: Path, result: dict, summary: str) -> None:
    territory = territory_label(result["metadata"].get("geo_filter"))
    subject = f"Leads WorldEd - Dual Diploma | {territory} | {result['metadata']['date']}"
    body = "\n".join(
        [
            "Eduardo,",
            "",
            "Segue a rotina WorldEd para prospeccao de Dual Diploma / High School americano em escolas particulares da Grande Sao Paulo.",
            "",
            summary.strip(),
            "",
            "Anexos:",
            "- worlded_leads.csv",
            "- worlded_leads.html",
            "- worlded_leads.json",
            "- new-leads.csv",
            "- long-list.csv",
            "",
            "Observacao: campos sem evidencia publica sao marcados como nao encontrado/precisa qualificar. Numeros de matricula nao sao inventados.",
            "",
        ]
    )
    (run_dir / "email-subject.txt").write_text(subject + "\n", encoding="utf-8")
    (run_dir / "email-body.txt").write_text(body, encoding="utf-8")
    (run_dir / "email-to.txt").write_text(result["metadata"]["email_to"] + "\n", encoding="utf-8")


def cell(value) -> str:
    if isinstance(value, list):
        return " | ".join(str(item) for item in value)
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    if value is None:
        return "nao disponivel"
    if isinstance(value, bool):
        return "sim" if value else "nao"
    return str(value)
