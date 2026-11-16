# Progress

- Read the Restate spec; reused the Ratecard scaffold (test double, chain scripts, site, docs generator).
- Wrote `contracts/restate.py` with the turn machine: the lock, two tries, silence counting as contest, forfeits and balances.
- 96 direct tests, then static tests; mutation testing 65 of 65 once the window tests were added.
- The live network dropped the v0.3 runner headers; moved the contract to the GenVM v0.4 header and the `emit_transfer` payout form, and proved a payout on chain.
- Deployed to Studio Next; a live smoke thread went open, join, a failed try, a fair one, the reply, and a withdrawal.
- Golden set locked and run: 8 of 10, held-out H1 DISTORTED, H2 FAIR, H3 INCOMPLETE. A second runner started by mistake is recorded in `eval/results.md`.
- Site, docs (generated reference, evaluation and judge prompt), seed script, reviewer-path script.
