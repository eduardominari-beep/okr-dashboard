from __future__ import annotations

import json
import shutil
import sys
import tempfile
import unittest
import zipfile
from argparse import Namespace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from worlded_leads.censo_offline import build_offline_base
from worlded_leads.classify_leads import classify_schools
from worlded_leads.config import fixture_school_records
from worlded_leads.enrich_public_sources import enrich_schools
from worlded_leads.main import enrich, report
from worlded_leads.prioritization import prioritize_records


class WorldEdLeadTests(unittest.TestCase):
    def test_fixture_layers_respect_business_rules(self):
        enriched, _ = enrich_schools(fixture_school_records(), mode="fixture")
        leads = classify_schools(enriched)
        by_school = {lead["school"]: lead for lead in leads}

        self.assertEqual(by_school["Colegio Horizonte Bilingue"]["camada_comercial"], "A")
        self.assertEqual(by_school["Colegio Magister"]["camada_comercial"], "C")
        self.assertEqual(by_school["Maple Bear Alphaville"]["camada_comercial"], "D")
        self.assertEqual(by_school["Escola Infantil Pequenos Passos"]["camada_comercial"], "E")
        self.assertEqual(by_school["Colegio Regional Sao Caetano"]["trend"], "caindo")

    def test_offline_zip_schema_variation_trend_and_report(self):
        temp = Path(tempfile.mkdtemp(prefix="worlded-offline-test-"))
        try:
            raw = temp / "raw"
            processed = temp / "processed"
            outputs = temp / "outputs"
            state = temp / "state.json"
            raw.mkdir()
            write_fixture_zips(raw)

            parquet_path, wide, build_status = build_offline_base(raw, processed)
            self.assertTrue(parquet_path.exists())
            self.assertTrue(build_status["ok"])
            self.assertEqual(len(wide), 1)
            row = wide.iloc[0].to_dict()
            self.assertEqual(row["id_escola"], "35000010")
            self.assertEqual(row["bairro"], "Jardim Paulista")
            self.assertEqual(row["alunos_total_2020"], 1000)
            self.assertEqual(row["alunos_total_2025"], 1120)
            self.assertEqual(row["variacao_total_abs_2020_2025"], 120)
            self.assertAlmostEqual(row["variacao_total_pct_2020_2025"], 12.0)
            self.assertEqual(row["tendencia_total"], "crescendo")

            _, city_wide, city_status = build_offline_base(raw, temp / "processed-city", scope="municipality", municipalities=["Sao Paulo"])
            self.assertTrue(city_status["ok"])
            self.assertEqual(len(city_wide), 1)

            _, empty_city_wide, _ = build_offline_base(raw, temp / "processed-barueri", scope="municipality", municipalities=["Barueri"])
            self.assertEqual(len(empty_city_wide), 0)

            enrich(
                Namespace(
                    processed_path=str(parquet_path),
                    processed_dir=str(processed),
                    mode="fixture",
                    run_id="fixture-offline",
                    cache_file=str(processed / "public-enrichment-cache.json"),
                    enrich_limit=0,
                    enrich_offset=0,
                    refresh_cache=False,
                    enrich_order="priority",
                )
            )
            result = report(
                Namespace(
                    enriched_path=str(processed / "worlded_enriched_leads.json"),
                    out_dir=str(outputs),
                    state_file=str(state),
                    mode="fixture",
                    run_id="fixture-offline",
                )
            )
            self.assertTrue((outputs / "worlded_leads.csv").exists())
            self.assertTrue((outputs / "worlded_leads.json").exists())
            self.assertTrue((outputs / "worlded_leads.html").exists())
            self.assertTrue((outputs / "summary.txt").exists())
            self.assertEqual(result["status"]["counts"]["schools_analyzed"], 1)
            new_leads = json.loads((outputs / "new-leads.json").read_text(encoding="utf-8"))
            self.assertEqual(len(new_leads), 1)
            self.assertGreater(new_leads[0]["enrichment_priority_score"], 0)
        finally:
            shutil.rmtree(temp, ignore_errors=True)

    def test_enrichment_priority_orders_large_affluent_schools_first(self):
        records = [
            {
                "inep_code": "1",
                "school": "Escola Menor",
                "municipality": "Sao Paulo",
                "bairro": "Lapa",
                "enrollments": {"2025": {"total": 400, "fundamental_ii": 80, "ensino_medio": 50}},
            },
            {
                "inep_code": "2",
                "school": "Escola Maior Jardim Paulista",
                "municipality": "Sao Paulo",
                "bairro": "Jardim Paulista",
                "enrollments": {"2025": {"total": 1300, "fundamental_ii": 280, "ensino_medio": 220}},
            },
        ]
        ordered = prioritize_records(records)
        self.assertEqual(ordered[0]["inep_code"], "2")
        self.assertIn("bairro_nobre_prioritario", ordered[0]["enrichment_priority_reason"])


def write_fixture_zips(raw: Path) -> None:
    base_header = [
        "NU_ANO_CENSO",
        "SG_UF",
        "NO_MUNICIPIO",
        "CO_MUNICIPIO",
        "CO_ENTIDADE",
        "NO_ENTIDADE",
        "TP_DEPENDENCIA",
        "TP_CATEGORIA_ESCOLA_PRIVADA",
        "TP_LOCALIZACAO",
        "TP_SITUACAO_FUNCIONAMENTO",
        "DS_ENDERECO",
        "NU_ENDERECO",
        "DS_COMPLEMENTO",
        "NO_BAIRRO",
        "CO_CEP",
        "NU_DDD",
        "NU_TELEFONE",
        "NU_CNPJ_ESCOLA_PRIVADA",
        "NU_CNPJ_MANTENEDORA",
        "QT_MAT_BAS",
        "QT_MAT_INF",
        "QT_MAT_FUND",
        "QT_MAT_FUND_AI",
        "QT_MAT_FUND_AF",
        "QT_MAT_MED",
    ]
    row_2020 = [
        "2020",
        "SP",
        "Sao Paulo",
        "3550308",
        "35000010",
        "Colegio Teste Bilingue",
        "4",
        "1",
        "1",
        "1",
        "Av Paulista",
        "1000",
        "",
        "Jardim Paulista",
        "01310000",
        "11",
        "30000000",
        "12345678000100",
        "12345678000100",
        "1000",
        "120",
        "620",
        "300",
        "320",
        "260",
    ]
    public_row = row_2020.copy()
    public_row[4] = "35000011"
    public_row[5] = "Escola Publica Fora"
    public_row[6] = "2"
    with zipfile.ZipFile(raw / "microdados_censo_escolar_2020.zip", "w") as zf:
        zf.writestr("dados/microdados_ed_basica_2020.csv", csv_text(base_header, [row_2020, public_row]))

    escola_header = [
        "NU_ANO_CENSO",
        "SG_UF",
        "NO_MUNICIPIO",
        "CO_MUNICIPIO",
        "NO_ENTIDADE",
        "CO_ENTIDADE",
        "TP_DEPENDENCIA",
        "TP_CATEGORIA_ESCOLA_PRIVADA",
        "TP_LOCALIZACAO",
        "TP_SITUACAO_FUNCIONAMENTO",
        "DS_ENDERECO",
        "NU_ENDERECO",
        "DS_COMPLEMENTO",
        "NO_BAIRRO",
        "CO_CEP",
        "NU_DDD",
        "NU_TELEFONE",
        "NU_CNPJ_ESCOLA_PRIVADA",
        "NU_CNPJ_MANTENEDORA",
    ]
    escola_row = ["2025", "SP", "Sao Paulo", "3550308", "Colegio Teste Bilingue", "35000010", "4", "1", "1", "1", "Av Paulista", "1000", "", "Jardim Paulista", "01310000", "11", "30000000", "12345678000100", "12345678000100"]
    matricula_header = ["NU_ANO_CENSO", "CO_ENTIDADE", "QT_MAT_BAS", "QT_MAT_INF", "QT_MAT_FUND", "QT_MAT_FUND_AI", "QT_MAT_FUND_AF", "QT_MAT_MED"]
    matricula_row = ["2025", "35000010", "1120", "130", "680", "330", "350", "310"]
    with zipfile.ZipFile(raw / "microdados_censo_escolar_2025.zip", "w") as zf:
        zf.writestr("dados/Tabela_Escola_2025.csv", csv_text(escola_header, [escola_row]))
        zf.writestr("dados/Tabela_Matricula_2025.csv", csv_text(matricula_header, [matricula_row]))


def csv_text(header: list[str], rows: list[list[str]]) -> str:
    return ";".join(header) + "\n" + "\n".join(";".join(row) for row in rows) + "\n"


if __name__ == "__main__":
    unittest.main()
