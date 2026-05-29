from __future__ import annotations

import json
import shutil
import sys
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from worlded_leads.classify_leads import classify_schools
from worlded_leads.config import fixture_school_records
from worlded_leads.enrich_public_sources import enrich_schools
from worlded_leads.main import collect


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

    def test_collect_writes_outputs_and_incremental_state(self):
        temp = Path(tempfile.mkdtemp(prefix="worlded-test-"))
        try:
            state_file = temp / "state.json"
            first = temp / "run-1"
            second = temp / "run-2"
            collect(Namespace(command="collect", mode="fixture", run_id="fixture-1", out_dir=str(first), state_file=str(state_file), limit=None))
            status = json.loads((first / "operational-status.json").read_text(encoding="utf-8"))
            self.assertGreaterEqual(status["counts"]["layer_a"], 1)
            self.assertTrue((first / "worlded-leads.csv").exists())
            self.assertTrue((first / "worlded-leads.html").exists())
            first_new = json.loads((first / "new-leads.json").read_text(encoding="utf-8"))
            self.assertEqual(len(first_new), 5)

            collect(Namespace(command="collect", mode="fixture", run_id="fixture-2", out_dir=str(second), state_file=str(state_file), limit=None))
            second_new = json.loads((second / "new-leads.json").read_text(encoding="utf-8"))
            self.assertEqual(len(second_new), 0)
        finally:
            shutil.rmtree(temp, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
