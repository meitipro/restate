#!/usr/bin/env python3
"""
Break every defence in the contract, one at a time, and name the test that notices.

    python scripts/mutate.py                          # run, print the table
    python scripts/mutate.py --table docs/MUTATIONS.md

A passing count is a claim; a table of mutations, each named with the test that
killed it, is evidence. Each mutant is a copy of contracts/restate.py with one
defence removed or weakened. The direct and static tests run against it through
RESTATE_CONTRACT, and the first failing test is recorded as the kill.

A kill is read from pytest's own report of which test failed, never from an
exit code alone: a runner that scores exit codes reports a perfect run while
testing nothing. The generated-files test is left out, because it fails for
ANY edit and would kill every mutant without testing its defence.

If anything escapes, the table is not written and the escapes are printed. An
escape means a missing test, or a defence strict enough elsewhere that this one
can no longer fail, and either is a finding.
"""

from __future__ import annotations

import os
import pathlib
import re
import subprocess
import sys
import tempfile

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTRACT = ROOT / "contracts" / "restate.py"

#: (what the mutant does, text in the contract, what replaces it). Each text
#: must occur exactly once, so a mutant always changes exactly one place.
MUTANTS = [
    # who may write
    ("restate: any account may restate", 'raise gl.vm.UserError(E + "only the restater may restate")', "pass"),
    ("rebut: any account may reply", 'raise gl.vm.UserError(E + "only the side whose restatement was FAIR may reply")', "pass"),
    ("confirm: any account may confirm", 'raise gl.vm.UserError(E + "only the author of the original may confirm")', "pass"),
    ("contest: any account may contest", 'raise gl.vm.UserError(E + "only the author of the original may contest")', "pass"),
    ("open_thread: the thread is authored by a fixed address", "author=gl.message.sender_address,", "author=ZERO,"),
    ("join: the opponent is not recorded", "k.opponent = me", "pass"),
    ("join: the author may join their own thread", "if me == k.author:", "if False:"),
    ("withdraw: pays a fixed address", "gl.chain.Account(me).emit_transfer(amount)", "gl.chain.Account(ZERO).emit_transfer(amount)"),
    ("judge: the caller is not recorded", "u.judged_by = by", "pass"),
    (
        "fair: the closer is not recorded",
        '        k.status = DONE\n        k.phase = ""\n        k.deadline = u64(0)\n        k.closed_by = by',
        '        k.status = DONE\n        k.phase = ""\n        k.deadline = u64(0)',
    ),
    ("forfeit: the closer is not recorded", "        k.reason = why\n        k.closed_by = by", "        k.reason = why"),
    # money
    ("join: any deposit is accepted", "if value != int(k.deposit):", "if value < 0:"),
    ("open_thread: any deposit is accepted", "if deposit < MIN_DEPOSIT:", "if deposit < 0:"),
    ("open_thread: no deposit cap", "if deposit > MAX_DEPOSIT:", "if False:"),
    ("withdraw: the balance is not zeroed", "        self.balances[me] = u256(0)\n", ""),
    (
        "withdraw: an empty balance still sends",
        '        if amount <= 0:\n            raise gl.vm.UserError(E + "nothing to withdraw")',
        '        if amount < 0:\n            raise gl.vm.UserError(E + "nothing to withdraw")',
    ),
    (
        "credit: a balance is overwritten, not added to",
        "self.balances[who] = u256(int(self.balances.get(who, u256(0))) + amount)",
        "self.balances[who] = u256(amount)",
    ),
    (
        "done: the author's deposit does not come back",
        "        self._credit(k.author, int(k.deposit))\n        self._credit(k.opponent, int(k.deposit))",
        "        self._credit(k.opponent, int(k.deposit))",
    ),
    ("done: the joiner's deposit does not come back", "        self._credit(k.opponent, int(k.deposit))", "        pass"),
    ("forfeit: the winner takes only their own deposit", "self._credit(winner, 2 * int(k.deposit))", "self._credit(winner, int(k.deposit))"),
    ("forfeit: the loser's deposit goes to the loser", "winner = k.author if loser == k.opponent else k.opponent", "winner = k.opponent"),
    (
        "closed: the author's deposit does not come back",
        "            k.closed_at = u64(now)\n            self._credit(k.author, int(k.deposit))\n            return int(thread_id)",
        "            k.closed_at = u64(now)\n            return int(thread_id)",
    ),
    # the turn rule
    (
        "restate: allowed after the window",
        '        if now > int(k.deadline):\n            raise gl.vm.UserError(E + "the window has ended, anyone may call claim_forfeit")\n        clean = _block(text, "the restatement", MAX_TEXT)',
        '        clean = _block(text, "the restatement", MAX_TEXT)',
    ),
    (
        "rebut: allowed after the window",
        '        if now > int(k.deadline):\n            raise gl.vm.UserError(E + "the window has ended, anyone may call claim_forfeit")\n        clean = _block(text, "the rebuttal", MAX_TEXT)',
        '        clean = _block(text, "the rebuttal", MAX_TEXT)',
    ),
    (
        "restate: a second restatement while one waits",
        '        if u.status != STATED:\n            raise gl.vm.UserError(E + "this turn is not waiting for a restatement")',
        "        pass",
    ),
    (
        "restate: allowed while the reply is the move",
        '        if k.phase != RESTATE:\n            raise gl.vm.UserError(E + "nothing is waiting to be restated")',
        "        pass",
    ),
    (
        "rebut: the reply is unlocked without a FAIR restatement",
        '        if k.phase != REPLY:\n            raise gl.vm.UserError(E + "the reply is locked until a restatement is FAIR")',
        "        pass",
    ),
    (
        "confirm: confirms with nothing to confirm",
        '        if u.status != RESTATED:\n            raise gl.vm.UserError(E + "there is no restatement to confirm")',
        "        pass",
    ),
    (
        "contest: contests with nothing to contest",
        '        if u.status != RESTATED:\n            raise gl.vm.UserError(E + "there is no restatement to contest")',
        "        pass",
    ),
    ("judge: silence counts as accepting, never contesting", "silent = u.status == RESTATED and now > int(k.deadline)", "silent = False"),
    ("judge: silence counts before the window ends", "silent = u.status == RESTATED and now > int(k.deadline)", "silent = u.status == RESTATED"),
    ("judge: anything can be judged", "if u.status != CONTESTED and not silent:", "if False:"),
    (
        "judge: a FAIR label does not unlock the reply",
        "        if label == FAIR:\n            self._fair(k, u, now, by)\n            return int(u.n)",
        "        if False:\n            return int(u.n)",
    ),
    ("judge: a failure is not counted", "u.failures = u32(int(u.failures) + 1)", "pass"),
    ("rules: three tries", "MAX_TRIES = 2", "MAX_TRIES = 3"),
    ("judge: the first failure forfeits", "        if int(u.failures) >= MAX_TRIES:", "        if int(u.failures) >= 1:"),
    ("judge: a failed try is not kept", 'failed.append({"text": u.restatement, "label": label})', "pass"),
    (
        "judge: a failed try does not reset the window",
        "            u.status = STATED\n            k.deadline = u64(now + self._window(k))",
        "            u.status = STATED",
    ),
    ("restate: a try is not counted", "u.tries = u32(int(u.tries) + 1)", "pass"),
    (
        "restate: the answer window does not start",
        "        u.restated_at = u64(now)\n        k.deadline = u64(now + self._window(k))",
        "        u.restated_at = u64(now)",
    ),
    (
        "fair: the reply has no window",
        "            k.phase = REPLY\n            k.deadline = u64(now + self._window(k))",
        "            k.phase = REPLY",
    ),
    ("fair: the thread never ends", "        if int(u.n) < TURNS:", "        if True:"),
    ("rules: three turns", "TURNS = 2", "TURNS = 3"),
    ("rebut: the author does not restate the rebuttal", "restater=last.original_by,", "restater=last.restater,"),
    ("rebut: the 800-character cap is gone", 'clean = _block(text, "the rebuttal", MAX_TEXT)', 'clean = _block(text, "the rebuttal", 10**6)'),
    ("restate: the 800-character cap is gone", 'clean = _block(text, "the restatement", MAX_TEXT)', 'clean = _block(text, "the restatement", 10**6)'),
    # claim_forfeit
    (
        "claim_forfeit: a missed window is not checked",
        '        if now <= int(k.deadline):\n            raise gl.vm.UserError(E + "the window has not ended")\n        u = self._turn(',
        "        u = self._turn(",
    ),
    (
        "claim_forfeit: an unjoined thread closes at once",
        '            if now <= int(k.deadline):\n                raise gl.vm.UserError(E + "the window has not ended")',
        "            pass",
    ),
    ("claim_forfeit: a silent replier does not forfeit", 'if k.phase == REPLY:\n            self._forfeit(k, u.restater, "window", now, by)', 'if k.phase == REPLY:\n            self._forfeit(k, u.original_by, "window", now, by)'),
    (
        "claim_forfeit: a silent restater does not forfeit",
        '        if u.status == STATED:\n            u.status = TURN_FORFEIT\n            self._forfeit(k, u.restater, "window", now, by)',
        '        if u.status == STATED:\n            u.status = TURN_FORFEIT\n            self._forfeit(k, u.original_by, "window", now, by)',
    ),
    (
        "claim_forfeit: a restatement waiting for an answer forfeits",
        '        raise gl.vm.UserError(E + "no window has been missed: a restatement waiting for an answer goes to judge")',
        '        self._forfeit(k, u.original_by, "window", now, by)\n        return int(thread_id)',
    ),
    # join
    (
        "join: allowed after the window",
        '        if now > int(k.deadline):\n            raise gl.vm.UserError(E + "the window to join has ended")',
        "        pass",
    ),
    (
        "join: a thread can be joined twice",
        '        if k.status != OPEN:\n            raise gl.vm.UserError(E + "this thread is not open to join")',
        "        pass",
    ),
    ("join: the first turn goes to the wrong restater", "restater=me,", "restater=k.author,"),
    ("join: the thread does not become active", "        k.status = ACTIVE\n        k.phase = RESTATE\n        k.turn = u32(1)", "        k.phase = RESTATE\n        k.turn = u32(1)"),
    # rules
    ("open_thread: the 80-character topic cap is gone", 'clean_topic = _line(topic, "topic", MAX_TOPIC)', 'clean_topic = _line(topic, "topic", 10**6)'),
    ("open_thread: the 800-character position cap is gone", 'text = _block(position, "position", MAX_TEXT)', 'text = _block(position, "position", 10**6)'),
    (
        "open_thread: any window is accepted",
        "if int(window_hours) < MIN_WINDOW_H or int(window_hours) > MAX_WINDOW_H:",
        "if int(window_hours) < 0:",
    ),
    (
        "moves on a finished thread are accepted",
        '        if k.status != ACTIVE:\n            raise gl.vm.UserError(E + "this thread is not active")',
        "        pass",
    ),
    # the judge
    ("judge: the fence lets delimiters through", 'return str(raw).replace("<", "(").replace(">", ")")', "return str(raw)"),
    ("judge: the original is not fenced", "JUDGE.format(original=fence(original), restatement=fence(restatement))", "JUDGE.format(original=original, restatement=fence(restatement))"),
    ("judge: the restatement is not fenced", "JUDGE.format(original=fence(original), restatement=fence(restatement))", "JUDGE.format(original=fence(original), restatement=restatement)"),
    ("judge: validators agree with any answer", 'return mine["label"] == theirs["label"]', "return True"),
    (
        "judge: an unreadable label defaults to FAIR",
        '    if label not in LABELS:\n        raise gl.vm.UserError(L + "bad label")',
        "    if label not in LABELS:\n        label = FAIR",
    ),
    ("judge: a formatting slip is never retried", "        if not error_text(first).startswith(L):\n            raise", "        raise"),
]

EXCLUDED = [
    "tests/test_static.py::test_generated_files_are_what_the_generator_writes",
    "tests/test_static.py::test_the_site_reads_the_frozen_deployment",
    "tests/test_static.py::test_no_private_key_in_the_repository",
]


def first_failure(output: str) -> str | None:
    for line in output.splitlines():
        match = re.match(r"FAILED (\S+)", line.strip())
        if match:
            return match.group(1).split(" - ")[0]
    return None


def main() -> int:
    source = CONTRACT.read_text(encoding="utf-8")
    rows: list[tuple[int, str, str]] = []
    escapes: list[str] = []
    with tempfile.TemporaryDirectory() as folder:
        mutant = pathlib.Path(folder) / "restate.py"
        for index, (what, old, new) in enumerate(MUTANTS, 1):
            count = source.count(old)
            if count != 1:
                raise SystemExit(f"mutant {index} ({what}) matches {count} places; it must match exactly one")
            mutant.write_text(source.replace(old, new), encoding="utf-8", newline="\n")
            env = dict(os.environ, RESTATE_CONTRACT=str(mutant))
            command = [
                sys.executable, "-m", "pytest", "tests/test_direct.py", "tests/test_static.py",
                "-x", "-q", "--tb=no", "-rf", "-p", "no:cacheprovider",
            ] + [arg for test in EXCLUDED for arg in ("--deselect", test)]
            result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, encoding="utf-8")
            killer = first_failure(result.stdout)
            if result.returncode == 0 or killer is None:
                escapes.append(what)
                print(f"  {index:2} ESCAPED  {what}")
            else:
                rows.append((index, what, killer))
                print(f"  {index:2} killed   {what}  <- {killer}")
    if escapes:
        print(f"\n{len(escapes)} mutant(s) escaped; no table written:")
        for what in escapes:
            print(f"  - {what}")
        return 1
    if "--table" in sys.argv:
        target = ROOT / sys.argv[sys.argv.index("--table") + 1]
        lines = [
            "# Mutations",
            "",
            f"Written by `python scripts/mutate.py --table docs/MUTATIONS.md`. {len(rows)} defences in",
            "`contracts/restate.py` were each broken on their own, and every mutant was caught. Each row",
            "names the first test that failed against it, read from pytest's report rather than an exit code.",
            "The generated-files, frozen-deployment and private-key tests are excluded, because the first two",
            "fail for any edit at all and the last reads files, not the contract.",
            "",
            "One check is deliberately not mutated: the validator's test that the leader's payload is a dict",
            "with a label from the closed set. The label comparison right below it already refuses anything",
            "else, so no test can tell the two apart; it stays so the validator never depends on how the",
            "runtime treats an exception raised inside it.",
            "",
            "| # | defence broken | caught by |",
            "|---|---|---|",
        ] + [f"| {i} | {what} | `{killer}` |" for i, what, killer in rows]
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
        print(f"\nwrote {target.relative_to(ROOT).as_posix()}")
    print(f"\n{len(rows)} of {len(MUTANTS)} killed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
