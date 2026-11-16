/**
 * Open a thread from a script, signing with a local test account.
 *
 *   node examples/open-thread.mjs <account name> <thread.json> [--dry]
 *
 * thread.json holds { "topic", "position", "window_h", "deposit_gen" }, the shape of examples/thread.json.
 * With --dry nothing is sent: it prints the call and the fee deposit the SDK estimates for it.
 * The site's own signing code (lib/genlayer-core.mjs) does the work, through a stand-in EIP-1193 wallet.
 */
import fs from 'node:fs';

import { parseEther } from 'viem';

import { CONTRACT, feesFor, outcomeOf, submit, waitDecided, walletClient } from '../lib/genlayer-core.mjs';
import { ensureAccount, standinWallet } from '../scripts/standin-wallet.mjs';

const [name, file, ...flags] = process.argv.slice(2);
if (!name || !file) {
  console.error('usage: node examples/open-thread.mjs <account name> <thread.json> [--dry]');
  process.exit(2);
}
const thread = JSON.parse(fs.readFileSync(file, 'utf8'));
ensureAccount(name);
const { address, provider } = standinWallet(name);
const client = walletClient(address, provider);
const args = [thread.topic, thread.position, thread.window_h];
const value = parseEther(thread.deposit_gen);

if (flags.includes('--dry')) {
  const fees = await feesFor(client, 'open_thread', address);
  console.log(JSON.stringify({ contract: CONTRACT, method: 'open_thread', from: address, window_h: thread.window_h, deposit_gen: thread.deposit_gen, feeValue: String(fees.feeValue) }));
  await new Promise((r) => setTimeout(r, 200));
  process.exit(0);
}
const hash = await submit(client, { method: 'open_thread', args, value, sender: address });
const outcome = outcomeOf(await waitDecided(client, hash, 'open_thread'));
console.log(JSON.stringify({ hash, ok: outcome.ok, thread_id: outcome.returned ?? null, refusal: outcome.refusal || null }));
process.exit(outcome.ok ? 0 : 1);
