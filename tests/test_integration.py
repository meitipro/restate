"""
Read-only checks against the deployed contract on Studio Next.

Skipped unless RESTATE_INTEGRATION=1, so the suite stays offline and green on
a reviewer's machine. Nothing here writes or spends: the writes were proven by
eval/run_golden.py, scripts/seed.py and the reviewer-path run in docs/.
"""

from __future__ import annotations

import json
import os
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

pytestmark = pytest.mark.skipif(os.environ.get("RESTATE_INTEGRATION") != "1", reason="set RESTATE_INTEGRATION=1 to read the live network")


@pytest.fixture(scope="module")
def live():
    import chain as C

    return C, C.Chain(), C.address()


def test_the_deployed_code_is_the_repository_s(live):
    import verify

    C, chain, address = live
    assert verify.deployed_source(chain, address) == C.CONTRACT_FILE.read_text(encoding="utf-8")


def test_the_live_schema_has_the_ten_methods(live):
    C, chain, address = live
    schema = C.retry("schema", chain.client.get_contract_schema, address)
    assert sorted(schema["methods"]) == sorted(
        ["open_thread", "join", "restate", "rebut", "confirm", "contest", "judge", "claim_forfeit", "withdraw", "get_thread"]
    )


def test_every_golden_label_reads_back_as_recorded(live):
    C, chain, address = live
    results = json.loads((ROOT / "eval" / "results.json").read_text(encoding="utf-8"))
    for cid, record in results["cases"].items():
        if not record.get("label"):
            continue
        stored = chain.read_json(address, "get_thread", [record["thread_id"]])
        assert stored["turns"][0]["label"] == record["label"], cid


def test_unknown_ids_read_as_not_found(live):
    C, chain, address = live
    assert chain.read_json(address, "get_thread", [10**6])["found"] is False


def test_thread_zero_answers_the_totals(live):
    C, chain, address = live
    got = chain.read_json(address, "get_thread", [0])
    assert got["found"] is False and got["totals"]["threads"] >= 1
