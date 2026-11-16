#!/usr/bin/env python3
"""
Run the golden restatements through the deployed Restate contract on Studio
Next, through real consensus, and publish what came out.

    python eval/run_golden.py --lock          # hash and timestamp golden.json, once, before the first run
    python eval/run_golden.py                 # every golden case not yet labelled
    python eval/run_golden.py H1 H2 H3        # the held-out cases, once
    python eval/run_golden.py --report        # rewrite results.md from results.json

eval/golden.json was written, hashed and timestamped (eval/golden.lock.json)
before the first run, and this script refuses to run if it has changed since.
Each case is its own thread: the author opens it with the position P and a
deposit, the joiner joins with the same deposit and restates, the author
contests, and judge runs the real consensus. The label is read back from the
contract with get_thread, so every label below is the real judge on the real
contract. The threads are left as they ended; the deposits stay in them.

H1 to H3 are held out: run once, reported as they came out, never used to tune
the prompt. A case whose round produced no label (the committee timed out or
could not agree) may be judged again, and every try stays in the record. A case
that produced a label is never judged again, whatever the label was.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import chain as C  # noqa: E402

# A model's text can carry any character; the Windows console codepage cannot.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = pathlib.Path(__file__).resolve().parent
GOLDEN = HERE / "golden.json"
LOCK = HERE / "golden.lock.json"
RESULTS = HERE / "results.json"
REPORT = HERE / "results.md"
GEN = 10**18
DEPOSIT = 5 * GEN


def judge_sha() -> str:
    import ast

    tree = ast.parse(C.CONTRACT_FILE.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and ast.unparse(node.targets[0]) == "JUDGE":
            return hashlib.sha256(ast.literal_eval(node.value).encode("utf-8")).hexdigest()
    raise SystemExit("no JUDGE constant")


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_results() -> dict:
    if RESULTS.exists():
        return json.loads(RESULTS.read_text(encoding="utf-8"))
    return {"cases": {}}


def save(results: dict) -> None:
    RESULTS.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def lock() -> None:
    if LOCK.exists():
        raise SystemExit("already locked: " + LOCK.read_text(encoding="utf-8"))
    LOCK.write_text(
        json.dumps({"file": "eval/golden.json", "sha256": C.sha256_file(GOLDEN), "locked_at": now_iso()}, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print("locked", LOCK.read_text(encoding="utf-8"))


def step(record: dict, key: str, chain: C.Chain, method: str, args: list, value: int = 0) -> dict:
    """Send once, record the outcome before printing, and never send a finished step again."""
    known = record["steps"].get(key)
    if known and known.get("ok"):
        return known
    outcome = chain.send(C.address(), method, args, value)
    row = {"ok": outcome["ok"], "hash": outcome["hash"], "returned": outcome["result"] if isinstance(outcome["result"], (int, str, type(None))) else None, "detail": outcome["detail"], "at": now_iso()}
    record["steps"][key] = row
    return row


def run(ids: list[str]) -> None:
    lock_doc = json.loads(LOCK.read_text(encoding="utf-8"))
    if C.sha256_file(GOLDEN) != lock_doc["sha256"]:
        raise SystemExit("eval/golden.json changed after it was locked; the golden set is not edited after the first run")
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    address = C.address()
    people = C.accounts("golden_author", "golden_joiner")
    author = C.Chain(people["golden_author"])
    joiner = C.Chain(people["golden_joiner"])
    author.ensure(people["golden_author"].address, minimum_gen=200)
    joiner.ensure(people["golden_joiner"].address, minimum_gen=200)
    results = load_results()
    results.update(
        {
            "contract": address,
            "contract_sha256": C.deployment().get("restate_sha256"),
            "golden_sha256": lock_doc["sha256"],
            "golden_locked_at": lock_doc["locked_at"],
            "judge_sha256": judge_sha(),
            "network": C.NETWORK,
            "explorer": C.EXPLORER,
            "author": people["golden_author"].address,
            "joiner": people["golden_joiner"].address,
        }
    )
    save(results)
    wanted = ids or [c["id"] for c in golden["cases"] if not c.get("held_out")]
    for case in golden["cases"]:
        if case["id"] not in wanted:
            continue
        record = results["cases"].setdefault(case["id"], {"steps": {}, "tries": []})
        if record.get("label"):
            print(f"{case['id']}: already labelled, never sent again")
            continue
        steps = record["steps"]
        opened = step(record, "open", author, "open_thread", [golden["topic"], golden["position"], 96], DEPOSIT)
        save(results)
        if not opened["ok"] or not isinstance(opened["returned"], int):
            raise SystemExit(f"open_thread for case {case['id']} failed: {opened['detail']}")
        tid = int(opened["returned"])
        record["thread_id"] = tid
        for key, who, method, args, value in (
            ("join", joiner, "join", [tid], DEPOSIT),
            ("restate", joiner, "restate", [tid, case["restatement"]], 0),
            ("contest", author, "contest", [tid], 0),
        ):
            row = step(record, key, who, method, args, value)
            save(results)
            if not row["ok"]:
                raise SystemExit(f"{key} for case {case['id']} failed: {row['detail']}")
        # judge: sent again only while the turn still waits, never after a label exists
        outcome = joiner.send(address, "judge", [tid])
        record["tries"].append({"tx": outcome["hash"], "sent_at": now_iso(), "consensus": "decided" if outcome["ok"] else outcome["detail"]})
        if outcome["ok"]:
            stored = C.retry("get_thread", joiner.read_json, address, "get_thread", [tid])
            turn = stored["turns"][0]
            record.update({"label": turn["label"], "turn_status": turn["status"], "judge_tx": outcome["hash"], "thread_status": stored["status"]})
        # Saved before anything is printed: a result that exists on chain must
        # never be lost to a failure on this side of the wire.
        save(results)
        if record.get("label"):
            want = case["expected"]
            verdict = "held out" if want == "EITHER" else ("MATCH" if record["label"] == want else "MISS ")
            print(f"{case['id']:>3}: {verdict} got {record['label']}, expected {want}  (thread {tid})")
        else:
            print(f"{case['id']:>3}: no label: {record['tries'][-1]['consensus']}")
    report()


def retry_unlabelled() -> None:
    """Judge again every case whose thread is still waiting for a label. Never touches a labelled one."""
    results = load_results()
    address = C.address()
    people = C.accounts("golden_joiner")
    joiner = C.Chain(people["golden_joiner"])
    for cid, record in results["cases"].items():
        if record.get("label") or not record.get("thread_id"):
            continue
        outcome = joiner.send(address, "judge", [record["thread_id"]])
        record["tries"].append({"tx": outcome["hash"], "sent_at": now_iso(), "consensus": "decided" if outcome["ok"] else outcome["detail"]})
        if outcome["ok"]:
            stored = C.retry("get_thread", joiner.read_json, address, "get_thread", [record["thread_id"]])
            turn = stored["turns"][0]
            record.update({"label": turn["label"], "turn_status": turn["status"], "judge_tx": outcome["hash"], "thread_status": stored["status"]})
        save(results)
        print(cid, record.get("label") or record["tries"][-1]["consensus"])
    report()


def report() -> None:
    results = load_results()
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    explorer = results.get("explorer", C.EXPLORER)
    scored = [c for c in golden["cases"] if not c.get("held_out")]
    hits = sum(1 for c in scored if results["cases"].get(c["id"], {}).get("label") == c["expected"])
    done = sum(1 for c in scored if results["cases"].get(c["id"], {}).get("label"))
    contract = results.get("contract", "")
    lines = [
        "# Golden restatements, through real consensus",
        "",
        f"Contract [`{contract}`]({explorer}/address/{contract}) on Studio Next (chain 61997). Every row is a thread of its own on the deployed contract: "
        "`open_thread`, `join`, `restate`, `contest`, `judge`. The label is read back with `get_thread`, not from the script's memory.",
        "",
        f"- Golden restatements: **{hits} of {done}** labelled matched the expected label ({len(scored)} cases).",
        "- Held-out restatements: reported below exactly as they came out; they have no expected label and were run once.",
        f"- `eval/golden.json` sha256 `{results.get('golden_sha256', '')}`, locked at {results.get('golden_locked_at', '')}, before the first run.",
        f"- Judge prompt sha256 `{results.get('judge_sha256', '')}`.",
        "",
        "Nothing here was tuned. The prompt is the spec's, word for word, and no case was edited after the lock.",
        "",
        "The position every case restates:",
        "",
        f"> {golden['position']}",
        "",
        "| Case | Restatement | Expected | Got | Thread |",
        "|---|---|---|---|---|",
    ]
    for case in golden["cases"]:
        record = results["cases"].get(case["id"], {})
        text = case["restatement"].replace("|", "/").replace("\n", " ")
        if len(text) > 110:
            text = text[:107] + "..."
        if not record.get("label"):
            lines.append(f"| {case['id']}{' (held out)' if case.get('held_out') else ''} | {text} | {case['expected']} | not run | |")
            continue
        mark = "held out" if case["expected"] == "EITHER" else ("✓" if record["label"] == case["expected"] else "✗ miss")
        lines.append(
            f"| {case['id']}{' (held out)' if case.get('held_out') else ''} | {text} | {case['expected']} | **{record['label']}** {mark} | "
            f"[thread {record['thread_id']}]({explorer}/tx/{record['judge_tx']}) |"
        )
    tries = [(cid, t) for cid, r in results["cases"].items() for t in r["tries"] if t.get("consensus") != "decided"]
    lines += ["", "## Every try", ""]
    if tries:
        lines.append("Tries whose judge produced no label, each followed by another judge of the same turn:")
        lines.append("")
        for cid, t in tries:
            lines.append(f"- case {cid}: {t['consensus']} ([tx]({explorer}/tx/{t['tx']}))")
    else:
        lines.append("Every case produced a label on its first judge; nothing was sent twice.")
    stray = results.get("stray_threads", {})
    if stray or results.get("notes"):
        lines += ["", "## Threads on the contract that are not scored", ""]
        for tid, why in stray.items():
            lines.append(f"- thread {tid}: {why}")
        for text in results.get("notes", []):
            lines.append(f"- {text}")
    lines.append("")
    REPORT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"\nwrote {REPORT.relative_to(C.ROOT).as_posix()}: golden {hits}/{done}")


if __name__ == "__main__":
    if "--lock" in sys.argv:
        lock()
    elif "--report" in sys.argv:
        report()
    elif "--retry" in sys.argv:
        retry_unlabelled()
    else:
        run([a for a in sys.argv[1:] if not a.startswith("--")])
