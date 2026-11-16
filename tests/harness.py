"""
Loads the REAL contract file against the doubles in genvm_double.py.

Nothing is copied or re-implemented here, so a change to contracts/restate.py
is a change to what these tests exercise. The runner comment on the first lines
of the contract is ignored by CPython, so the file imports as ordinary Python.
"""

from __future__ import annotations

import datetime
import importlib.util
import json
import os
import pathlib
import sys
import types

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
#: RESTATE_CONTRACT points the suite at a mutant; scripts/mutate.py sets it.
CONTRACT = pathlib.Path(os.environ.get("RESTATE_CONTRACT") or ROOT / "contracts" / "restate.py")

sys.path.insert(0, str(HERE))

import genvm_double as D  # noqa: E402

GEN = 10**18
HOUR = 3600
DAY = 86400

#: 2026-09-01T00:00:00Z. Every world starts here.
T0 = 1788220800


def _install(gl: D.GL) -> None:
    """
    Publish a `genlayer` package shaped like the Studio Next runtime: the star
    import brings Address and the integer types, `import genlayer as gl` is the
    package itself, and the storage names live in genlayer.storage. An import
    the contract left out fails here rather than on chain.
    """
    storage = types.ModuleType("genlayer.storage")
    storage.TreeMap = D.TreeMap
    storage.DynArray = D.DynArray
    storage.allow = D.allow_storage
    module = types.ModuleType("genlayer")
    module.Address = D.Address
    for name in ("u8", "u16", "u32", "u64", "u256"):
        setattr(module, name, getattr(D, name))
    for name in ("contract", "vm", "message", "public", "nondet", "evm", "chain"):
        setattr(module, name, getattr(gl, name))
    module.storage = storage
    module.__all__ = ["Address", "u8", "u16", "u32", "u64", "u256"]
    sys.modules["genlayer"] = module
    sys.modules["genlayer.storage"] = storage


def load(gl: D.GL, path: pathlib.Path | None = None, name: str = "restate_contract") -> types.ModuleType:
    """Import the contract fresh against this gl."""
    _install(gl)
    spec = importlib.util.spec_from_file_location(name, path or CONTRACT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def label_answer(label: str) -> str:
    """A model answer, as the model would type it."""
    return json.dumps({"label": label})


class World:
    """
    One Restate contract and the accounts around it.

    Time is explicit: `at(seconds)` sets the transaction datetime the contract
    reads, because nothing on chain moves the clock on its own and the windows
    are the thing these tests most need to control. The accounts model value
    honestly: `sender(address, value)` sends value with the call, and `received`
    totals everything the contract was paid.
    """

    AUTHOR = "0x" + "a1" * 20
    JOINER = "0x" + "b2" * 20
    STRANGER = "0x" + "d4" * 20
    OTHER = "0x" + "e5" * 20

    TOPIC = "Pay contributors in stablecoins?"
    POSITION = (
        "Quarterly stablecoin pay beats token pay for contributors. Token pay ties wages to the price "
        "and hides what the work really costs, and stable pay makes budgets simple. Alignment can come "
        "from a separate vesting grant."
    )
    FAIR_TEXT = (
        "They want contributors paid in stablecoins every quarter. Paying in the token makes wages swing "
        "with the price, hides the true cost of work and makes a budget hard to plan. For alignment they "
        "would use a vesting grant instead."
    )
    STRAWMAN = "They think tokens are bad and want everyone paid in dollars."
    REBUTTAL = "A vesting grant is still paid in the token, so the cost it hides comes back through the grant."
    REBUTTAL_FAIR = "They say a vesting grant is paid in the token, so the hidden cost comes back through the grant."
    DEPOSIT = 5 * GEN
    WINDOW_H = 48

    def __init__(self) -> None:
        self.gl = D.GL()
        self.mod = load(self.gl)
        self.at(T0)
        self.sender(self.AUTHOR)
        self.c = self.mod.Restate()
        self.received = 0

    # -- controls ----------------------------------------------------------

    def at(self, seconds: int) -> "World":
        self.t = int(seconds)
        stamp = datetime.datetime.fromtimestamp(self.t, datetime.timezone.utc)
        self.gl.message.raw["datetime"] = stamp.strftime("%Y-%m-%dT%H:%M:%SZ")
        return self

    def advance(self, seconds: int) -> "World":
        return self.at(self.t + seconds)

    def sender(self, address: str, value: int = 0) -> "World":
        self.gl.message.sender_address = D.Address(address)
        self.gl.message.origin_address = D.Address(address)
        self.gl.message.value = int(value)
        return self

    @property
    def leader(self) -> D.NodeWorld:
        return self.gl.nondet.leader

    @property
    def validators(self) -> list[D.NodeWorld]:
        return self.gl.nondet.validators

    def nodes(self) -> list[D.NodeWorld]:
        return [self.leader, *self.validators]

    # -- shorthands --------------------------------------------------------

    def open(self, topic=None, position=None, window_h=None, deposit=None, who=None) -> int:
        pay = self.DEPOSIT if deposit is None else deposit
        self.sender(who or self.AUTHOR, pay)
        try:
            tid = int(
                self.c.open_thread(
                    topic if topic is not None else self.TOPIC,
                    position if position is not None else self.POSITION,
                    self.WINDOW_H if window_h is None else window_h,
                )
            )
        finally:
            self.sender(who or self.AUTHOR)
        self.received += pay
        return tid

    def join(self, tid: int = 1, who=None, value=None) -> int:
        pay = int(self.thread(tid)["deposit"]) if value is None else int(value)
        self.sender(who or self.JOINER, pay)
        try:
            out = int(self.c.join(tid))
        finally:
            self.sender(who or self.JOINER)
        self.received += pay
        return out

    def restate(self, text=None, tid: int = 1, who=None) -> int:
        self.sender(who or self.JOINER)
        return int(self.c.restate(tid, text if text is not None else self.FAIR_TEXT))

    def rebut(self, text=None, tid: int = 1, who=None) -> int:
        self.sender(who or self.JOINER)
        return int(self.c.rebut(tid, text if text is not None else self.REBUTTAL))

    def confirm(self, tid: int = 1, who=None) -> int:
        self.sender(who or self.AUTHOR)
        return int(self.c.confirm(tid))

    def contest(self, tid: int = 1, who=None) -> int:
        self.sender(who or self.AUTHOR)
        return int(self.c.contest(tid))

    def queue(self, label: str, validator=None) -> None:
        """One model answer for the leader and one for each validator."""
        self.leader.answers.append(label_answer(label))
        for world in self.validators:
            world.answers.append(label_answer(validator or label))

    def judge(self, label: str, tid: int = 1, validator=None, who=None) -> int:
        self.queue(label, validator=validator)
        self.sender(who or self.STRANGER)
        try:
            return int(self.c.judge(tid))
        except D.UserError:
            # A refused call never reached the model; its queued answers must not leak into the next call.
            for node in self.nodes():
                node.answers.clear()
            raise

    def forfeit(self, tid: int = 1, who=None) -> int:
        self.sender(who or self.STRANGER)
        return int(self.c.claim_forfeit(tid))

    def withdraw(self, who=None) -> int:
        self.sender(who or self.AUTHOR)
        return int(self.c.withdraw())

    def started(self, window_h=None) -> int:
        """A thread opened and joined."""
        tid = self.open(window_h=window_h)
        self.join(tid)
        return tid

    def first_fair(self, tid: int = 1) -> None:
        """Turn one restated and confirmed: the joiner's reply unlocks."""
        self.restate(tid=tid)
        self.confirm(tid)

    def finish(self, tid: int = 1) -> None:
        """Both turns restated and confirmed: the thread is DONE."""
        self.first_fair(tid)
        self.rebut(tid=tid)
        self.restate(self.REBUTTAL_FAIR, tid, who=self.AUTHOR)
        self.confirm(tid, who=self.JOINER)

    # -- reads -------------------------------------------------------------

    def thread(self, tid: int = 1) -> dict:
        return json.loads(self.c.get_thread(tid))

    def turn(self, tid: int = 1, n: int = 1) -> dict:
        return self.thread(tid)["turns"][n - 1]

    def balance(self, who: str) -> int:
        return int(self.c.balances.get(D.Address(who), 0))

    def paid_to(self, address: str) -> int:
        return sum(t.value for t in self.gl.bus.transfers if t.to.lower() == address.lower())

    def paid_out(self) -> int:
        return sum(t.value for t in self.gl.bus.transfers)

    def owed(self) -> int:
        """Everything the contract holds for someone: balances, plus the deposits of threads still running."""
        total = 0
        for balance in self.c.balances.values():
            total += int(balance)
        for thread in self.c.threads.values():
            if thread.status == self.mod.OPEN:
                total += int(thread.deposit)
            elif thread.status == self.mod.ACTIVE:
                total += 2 * int(thread.deposit)
        return total

    def balances_add_up(self) -> None:
        """Every wei the contract was paid is either still owed, or was paid out."""
        assert self.received == self.owed() + self.paid_out(), (self.received, self.owed(), self.paid_out())


def refused(prefix: str, fn, *args, **kwargs) -> str:
    """Assert the call is refused, and that the refusal is the sentence it should be."""
    try:
        fn(*args, **kwargs)
    except D.UserError as error:
        message = str(error)
        assert message.startswith("[EXPECTED] "), f"unprefixed refusal: {message}"
        assert prefix in message, f"expected {prefix!r}, got {message!r}"
        return message
    raise AssertionError(f"expected a refusal containing {prefix!r}, nothing was raised")
