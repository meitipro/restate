# Handoff

## Needs you

- **Send the portal entry.** `submission/portal.md` and `submission/form-fields.json`, with the logo at `submission/restate-icon-512.png`.

## Already done

- Contract deployed and frozen on Studio Next; do not redeploy or change `contracts/restate.py` without deciding to. A redeploy loses every thread.
- Test accounts live in `~/.restate/accounts.json` on the build machine only.
- If Studio Next changes its runner again, the contract stops answering reads (`execution failed`), as the v0.3 contracts did. The fix is a redeploy with the new header and a new `deployment.json`.
