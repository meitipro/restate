#!/usr/bin/env python3
"""
Seed the deployed contract with realistic threads and keep the record.

    python scripts/seed.py            # a thread with a distorted try then a fair one, a confirmed one, an open one, a forfeit by tries
    python scripts/seed.py --report   # rewrite docs/seed.studio-next.md from the record

Every label comes from the deployed judge through real consensus; nothing here
decides one. After each judge the script reads the turn back and records what
the contract said, not what was hoped, and the next step follows what the label
was. The accounts are test accounts and the people are fictional (docs/seed.md
says so).

The windows cannot be waited out in one sitting (the shortest is 12 hours), so
no thread here ends by a missed window. A forfeit is shown by a restater who
runs out of tries, and an unjoined thread is left open.

Every step is written to docs/seed.studio-next.json before anything is
printed, so a crash never loses a transaction that exists on chain, and a
rerun resumes where the last one stopped. Accounts live in ~/.restate/accounts.json;
only addresses are printed.
"""

from __future__ import annotations

import datetime
import json
import sys

import chain as C

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

RECORD = C.ROOT / "docs" / "seed.studio-next.json"
GEN = 10**18
DEPOSIT = 5 * GEN
WINDOW = 24
ACCOUNTS = ["seed_ana", "seed_ben", "seed_cam", "seed_dee"]

PAY = (
    "Quarterly stablecoin pay beats token pay for contributors. Token pay ties wages to the price and hides what the work "
    "really costs, and stable pay makes budgets simple. Alignment can come from a separate vesting grant."
)
PAY_STRAWMAN = "They think tokens are bad and want everyone paid in dollars."
PAY_FAIR = (
    "They argue for paying contributors quarterly in stablecoins instead of tokens. Their reasons are that token pay ties "
    "wages to the token price and hides what the work really costs, and that stable pay makes budgets simple. They say "
    "alignment can come from a separate vesting grant rather than from the pay itself."
)
PAY_REPLY = (
    "A vesting grant only aligns people who stay long enough to vest, so it rewards tenure over contribution. Stable pay "
    "keeps budgets simple, but it moves all the price risk onto the treasury."
)
PAY_REPLY_FAIR = (
    "They say a vesting grant only aligns people who stay long enough to vest, so it rewards tenure over contribution, and "
    "that stable pay makes budgets simple but moves all the price risk onto the treasury."
)

REVIEW = (
    "Every protocol change should go through a seven day public review before a vote. A review window lets people who "
    "were not in the room read the change, and it catches mistakes that a fast vote would not. Emergencies can use a "
    "separate, narrower fast path."
)
REVIEW_FAIR = (
    "They say every protocol change should have a seven day public review before it is voted on, because the window lets "
    "people who were not in the room read the change and catches mistakes a fast vote would miss, with emergencies handled "
    "by a separate, narrower fast path."
)

OFFSITE = "Teams that are fully remote should still meet in person twice a year. Trust built face to face makes later async work faster, and it is cheaper than the cost of one bad hire."
OFFSITE_BAD_1 = "They want to force everyone to fly to expensive retreats."
OFFSITE_BAD_2 = "They believe remote work is a failure and that offices are better."


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load() -> dict:
    if RECORD.exists():
        return json.loads(RECORD.read_text(encoding="utf-8"))
    return {"network": C.NETWORK, "contract": C.address(), "steps": [], "threads": {}}


def save(record: dict) -> None:
    RECORD.parent.mkdir(parents=True, exist_ok=True)
    RECORD.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def done(record: dict, key: str) -> dict | None:
    return next((s for s in record["steps"] if s["key"] == key and s.get("ok")), None)


def step(record: dict, key: str, chain: C.Chain, method: str, args: list, value: int = 0, note: str = "") -> dict:
    """Send once, record the outcome before printing, and never send a finished step again."""
    known = done(record, key)
    if known:
        print(f"{key}: already done {known['hash']}")
        return known
    outcome = chain.send(C.address(), method, args, value)
    row = {
        "key": key,
        "method": method,
        "from": chain.account.address,
        "ok": outcome["ok"],
        "hash": outcome["hash"],
        "returned": outcome["result"] if isinstance(outcome["result"], (int, str, type(None))) else None,
        "refusal": outcome["refusal"],
        "detail": outcome["detail"],
        "at": now_iso(),
        "note": note,
    }
    record["steps"].append(row)
    save(record)
    print(f"{key}: {'ok' if outcome['ok'] else 'FAILED ' + outcome['detail']} {C.EXPLORER}/tx/{outcome['hash']}")
    if not outcome["ok"]:
        raise SystemExit(f"{key} did not succeed: {outcome['detail']}")
    return row


def snapshot(record: dict, tag: str, reader: C.Chain, tid: int) -> dict:
    got = reader.read_json(C.address(), "get_thread", [tid])
    turns = [{"n": t["n"], "status": t["status"], "label": t["label"], "failures": t["failures"], "tries_left": t["tries_left"]} for t in got["turns"]]
    record["threads"][tag] = {"id": tid, "topic": got["topic"], "status": got["status"], "phase": got["phase"], "turn": got["turn"], "reason": got["reason"], "turns": turns}
    save(record)
    print(f"  {tag}: thread {tid} {got['status']}/{got['phase']} turn {got['turn']} {[(t['status'], t['label']) for t in turns]}")
    return got


def open_and_join(record, tag, topic, position, author, joiner):
    opened = step(record, f"{tag}:open", author, "open_thread", [topic, position, WINDOW], DEPOSIT)
    tid = int(opened["returned"])
    record["threads"].setdefault(tag, {})["id"] = tid
    save(record)
    return tid


def seed() -> None:
    record = load()
    people = C.accounts(*ACCOUNTS)
    chains = {name: C.Chain(people[name]) for name in ACCOUNTS}
    reader = C.Chain()
    for chain in chains.values():
        chain.ensure(chain.account.address, 60)
    ana, ben, cam, dee = (chains[n] for n in ACCOUNTS)

    # -- A: a distorted try, then a fair one, the reply, the author restates it, the other side confirms
    a = open_and_join(record, "pay", "Pay contributors in stablecoins?", PAY, ana, ben)
    step(record, "pay:join", ben, "join", [a], DEPOSIT)
    step(record, "pay:try1", ben, "restate", [a, PAY_STRAWMAN], note="a strawman")
    step(record, "pay:contest1", ana, "contest", [a], note="the author does not recognise it")
    step(record, "pay:judge1", ben, "judge", [a], note="validators read the strawman")
    got = snapshot(record, "pay", reader, a)
    if got["status"] == "ACTIVE" and got["turns"][0]["status"] == "STATED":
        step(record, "pay:try2", ben, "restate", [a, PAY_FAIR], note="a fair restatement")
        step(record, "pay:contest2", ana, "contest", [a])
        step(record, "pay:judge2", ben, "judge", [a])
        got = snapshot(record, "pay", reader, a)
    if got["status"] == "ACTIVE" and got["phase"] == "REPLY":
        step(record, "pay:reply", ben, "rebut", [a, PAY_REPLY], note="the reply the lock was holding")
        step(record, "pay:restate_reply", ana, "restate", [a, PAY_REPLY_FAIR], note="the author must restate the reply")
        step(record, "pay:confirm_reply", ben, "confirm", [a], note="the replier confirms: FAIR with no validator call")
        got = snapshot(record, "pay", reader, a)
    for who, chain in (("ana", ana), ("ben", ben)):
        if int(got["author_balance" if who == "ana" else "opponent_balance"]) > 0:
            step(record, f"pay:withdraw_{who}", chain, "withdraw", [], note="a completed thread returns both deposits")

    # -- B: the author confirms the first restatement, so the reply box is open and waiting
    b = open_and_join(record, "review", "Seven day review before every vote?", REVIEW, ben, cam)
    step(record, "review:join", cam, "join", [b], DEPOSIT)
    step(record, "review:try1", cam, "restate", [b, REVIEW_FAIR])
    step(record, "review:confirm1", ben, "confirm", [b], note="the author confirms: FAIR with no validator call")
    snapshot(record, "review", reader, b)

    # -- C: nobody has joined yet
    c = open_and_join(record, "offsite", "Meet in person twice a year?", OFFSITE, cam, dee)
    snapshot(record, "offsite", reader, c)

    # -- D: a restater who runs out of tries forfeits to the author
    d = open_and_join(record, "retreat", "Is the in-person retreat worth it?", OFFSITE, dee, ana)
    step(record, "retreat:join", ana, "join", [d], DEPOSIT)
    for n, text in ((1, OFFSITE_BAD_1), (2, OFFSITE_BAD_2)):
        got = reader.read_json(C.address(), "get_thread", [d])
        if got["status"] != "ACTIVE" or got["phase"] != "RESTATE":
            break
        step(record, f"retreat:try{n}", ana, "restate", [d, text], note="a restatement that argues instead of restating")
        step(record, f"retreat:contest{n}", dee, "contest", [d])
        step(record, f"retreat:judge{n}", ana, "judge", [d])
        snapshot(record, "retreat", reader, d)
    got = snapshot(record, "retreat", reader, d)
    if got["status"] == "FORFEITED" and int(got["author_balance"]) > 0:
        step(record, "retreat:withdraw_dee", dee, "withdraw", [], note="the winner takes both deposits")
    report()


def report() -> None:
    record = load()
    explorer = C.EXPLORER

    def link(h: str) -> str:
        return f"[{h[:10]}…]({explorer}/tx/{h})" if h else ""

    steps = {s["key"]: s for s in record["steps"]}
    lines = [
        "# Seed",
        "",
        f"Written by `python scripts/seed.py` against the Restate contract [`{record.get('contract', '')}`]({explorer}/address/{record.get('contract', '')}) on Studio Next. "
        "Every label below was produced by the deployed judge through real consensus, and the script recorded what the contract said, not what was hoped.",
        "",
        "The people and the debates are fictional and exist only for this demonstration. The accounts are test accounts.",
        "",
        "## Threads",
        "",
        "| Thread | Topic | Ended as | Labels, turn by turn |",
        "|---|---|---|---|",
    ]
    for tag, t in record.get("threads", {}).items():
        if "topic" not in t:
            continue
        labels = ", ".join(f"turn {u['n']}: {u['status']}{' (' + u['label'] + ')' if u['label'] else ''}" for u in t["turns"])
        lines.append(f"| {t['id']} | {t['topic']} | **{t['status']}**{' (' + t['reason'] + ')' if t.get('reason') else ''} | {labels} |")
    lines += ["", "## Money", ""]
    for s in record["steps"]:
        if s["method"] == "withdraw":
            lines.append(f"- {s['key']}: {link(s['hash'])} {'(' + s['note'] + ')' if s.get('note') else ''}")
    lines += ["", "## Every step", ""]
    for s in record["steps"]:
        lines.append(f"- `{s['key']}` {s['method']} {'ok' if s['ok'] else 'FAILED'} {link(s['hash'])} {s['at']}")
    lines.append("")
    out = C.ROOT / "docs" / "seed.studio-next.md"
    out.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print("wrote", out.relative_to(C.ROOT).as_posix())
    del steps


if __name__ == "__main__":
    if "--report" in sys.argv:
        report()
    else:
        seed()
