# Restate

**You cannot answer until you have restated them fairly.** A fair-restatement debate tool on GenLayer.

One side posts a position with a deposit. The other must restate it in their own words before they may answer. The author confirms the restatement or contests it, and validators label a contested restatement `FAIR`, `INCOMPLETE` or `DISTORTED` against the original, without ever judging who is right. Only a fair one unlocks the reply. The contract applies the lock, the tries and the deposits from that label.

- **Network:** GenLayer Studio Next, chain 61997 (`0xF22D`)
- **Contract:** [`0xC7B813381315Dd77842597e68817F5d4704AbA44`](https://explorer-studio-dev.genlayer.com/address/0xC7B813381315Dd77842597e68817F5d4704AbA44), deployed in [`0xac1222ba…03b2`](https://explorer-studio-dev.genlayer.com/tx/0xac1222ba0279aead0d8f454bfebe02d2f3bfdb9a927cd1151af4b5a8a70703b2)
- **Source:** `contracts/restate.py`, sha256 in `contracts/FROZEN.json`, held to the deployed bytes by `scripts/verify.py`

## How it works

| Result | Meaning | What happens |
|---|---|---|
| `FAIR` | every main point is there, nothing is added | the turn is done and the reply unlocks (after turn 2, both deposits come back) |
| `INCOMPLETE` | accurate, but a main point is missing | one try is spent |
| `DISTORTED` | it adds, reverses, exaggerates, mocks or argues | one try is spent |
| forfeit | a restater runs out of tries, or a side misses a window | the other side gets both deposits |

- A thread is a topic of at most 80 characters, a position of at most 800, a window of 12 to 96 hours per step and a deposit of 5 to 1000 GEN. The joiner puts in the same deposit.
- Two turns: the joiner restates the position, then replies, and the author restates the reply.
- A restatement gets two tries. The second failure forfeits.
- The author may `confirm` a restatement, which counts as FAIR with no validator call, or `contest` it. An author who is silent past the window counts as contesting, never as accepting.
- `judge` and `claim_forfeit` are open to anyone, on purpose, and the caller is recorded. An unjoined thread is closed after its window and the author's deposit comes back.
- The judge is never told which side is which, and never asked who is right. Validators compare one label and nothing else.
- Money moves in one place: `open_thread` and `join` take value in, everything else moves balances, `withdraw` is the only payout.

One contract, ten methods: `open_thread`, `join`, `restate`, `rebut`, `confirm`, `contest`, `judge`, `claim_forfeit`, `withdraw` and the view `get_thread`.

## What was measured

Every number below was read from a file in this repository or from the chain.

| | |
|---|---|
| Offline tests | 144 passed (96 direct, 48 static), 5 live read-only tests skipped without `RESTATE_INTEGRATION=1` (`pytest`) |
| Mutation testing | 65 of 65 defences broken one at a time and caught, each naming its test (`docs/MUTATIONS.md`) |
| Golden restatements | **8 of 10** matched the expected label through real consensus (`eval/results.md`) |
| Held-out restatements | H1 `DISTORTED`, H2 `FAIR`, H3 `INCOMPLETE`, judged once, reported as they came out, no expected label |
| Deployed source vs repository | identical (`python scripts/verify.py`) |

The two misses are the two English restatements expected to be `FAIR` (cases 1 and 3): both came back `INCOMPLETE`. The Persian restatement of the same four points (case 2) came back `FAIR`. Everything expected to be `INCOMPLETE` or `DISTORTED` was, including the one that tells the judge to label it FAIR. Nothing was tuned: the prompt is the spec's, word for word, and `eval/golden.json` was hashed before the first run (`eval/golden.lock.json`). Two threads on the contract are not scored and `eval/results.md` says which and why.

## Where the spec contradicts itself

- **Tries.** The spec says a restatement gets "2 tries" and also that the "third failure" forfeits. This contract takes the first: two tries, the second failure forfeits.
- **Unjoined threads.** No method of the ten closes a thread nobody joined, so `claim_forfeit` does it after the window and the author's deposit goes back to their balance.
- **The point list.** The spec's reading aid beside a verdict is "never compared and never stored", so the contract does not produce it. The site shows a word-overlap guess made in the browser, labelled as such.

They are documented in `/docs/more/limitations`.

## A note about the runtime

This contract uses the GenVM v0.4 runner header `py-genlayer:kzybg95x…`. The `babwp9t3…` and `5jycge4q…` headers that earlier projects used are rejected by the live network (`invalid_contract runner malformed`), and payouts use `gl.chain.Account(address).emit_transfer(value)`, the v0.4 form. The local linter does not know the new runner yet, so it reads a copy of the file with an old header swapped in; only the header differs. The authority on the real header is `gen_getContractSchemaForCode`, which `scripts/deploy.py` calls before every deploy.

## Layout

```text
contracts/restate.py        one contract, the judge prompt pinned inside
contracts/FROZEN.json       address, deploy transaction, sha256 of the deployed bytes
tests/                      direct tests, static tests over the parsed source, live read-only tests
eval/                       golden.json (locked), run_golden.py, results.md
scripts/                    deploy, verify, mutate, seed, gen_docs, chain
web/                        Next.js site and /docs (Fumadocs), writes signed in the visitor's wallet
docs/                       mutation table, seed record, reviewer-path record
submission/                 portal text, form fields, evidence links, X post, demo script, 512 px icon
```

## Run it

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt     # Windows; use bin/ elsewhere
.venv/Scripts/python -m pytest                                            # offline, a few seconds
.venv/Scripts/python scripts/mutate.py --table docs/MUTATIONS.md          # break every defence, name its test
RESTATE_INTEGRATION=1 .venv/Scripts/python -m pytest tests/test_integration.py   # read the live network
cd web && npm ci && npm run dev                                           # the site on http://localhost:3210
```

## Keys

No private key is on any server or in this repository. Test accounts live in `~/.restate/accounts.json` on the build machine, and the scripts print only addresses. The site signs in the visitor's wallet. The site has no server secret.

## Honest limits

Restate checks that a restatement is fair, not that a position is right. The judge is a model, the reasons are not stored, and a side that misreads the other twice loses its deposit even in good faith, which is the price of making the lock real. Threads are public text on a test network. See `/docs/more/limitations`.
