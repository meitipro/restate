/**
 * Walk the reviewer's path from fresh accounts, through the site's own code, to finality.
 *
 *   node scripts/reviewer-path.mjs https://<the site> [run-name]
 *
 * Three accounts made for this run, which have never touched the contract:
 *   1. faucet    the site's /api/faucet funds all three, sent the address in lower case
 *   2. open      the author opens a thread with a position and a 5 GEN deposit
 *   3. join      a second account joins with the same deposit and restates it, badly
 *   4. contest   the author contests; the validators label it
 *   5. try 2     a full restatement is posted and judged. If it is FAIR the reply unlocks,
 *                the reply is posted, the author restates it and the replier confirms
 *   6. money     after finality both sides withdraw; each wallet must have moved by exactly
 *                what the contract owed minus the fee the transaction's own accounting reports
 *   7. read      the site's thread and verdict pages show what the chain holds
 *
 * Every write goes through lib/genlayer-core.mjs with the stand-in wallet, the
 * code the browser runs. Each step is written to
 * ../docs/reviewer-path.studio-next.json before anything is printed about it.
 * Keys stay in ~/.restate/accounts.json and are never printed. The labels are
 * whatever the validators said: the script follows them and invents none.
 */

import fs from 'node:fs';
import path from 'node:path';

import { CONTRACT, outcomeOf, readClient, retried, submit, waitDecided, waitFinal, walletClient } from '../lib/genlayer-core.mjs';
import { balanceOf, ensureAccount, rpc, standinWallet } from './standin-wallet.mjs';

const site = (process.argv[2] ?? '').replace(/\/$/, '');
const run = process.argv[3] ?? 'rp1';
if (!site) {
  console.error('usage: node scripts/reviewer-path.mjs https://<site> [run-name]');
  process.exit(2);
}
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const root = path.join(here, '..', '..');
const RECORD = path.join(root, 'docs', 'reviewer-path.studio-next.json');
const record = fs.existsSync(RECORD) ? JSON.parse(fs.readFileSync(RECORD, 'utf8')) : { runs: {} };
const log = (record.runs[run] ??= { site, contract: CONTRACT, started: new Date().toISOString(), steps: [] });
const save = () => fs.writeFileSync(RECORD, JSON.stringify(record, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2) + '\n');
const GEN = 10n ** 18n;
const fmt = (wei) => `${Number(wei) / 1e18} GEN`;

const POSITION =
  'Quarterly stablecoin pay beats token pay for contributors. Token pay ties wages to the price and hides what the work really costs, and stable pay makes budgets simple. Alignment can come from a separate vesting grant.';
const STRAWMAN = 'They think tokens are bad and want everyone paid in dollars.';
const FAIR_TEXT =
  'They argue for paying contributors quarterly in stablecoins instead of tokens. Their reasons are that token pay ties wages to the token price and hides what the work really costs, and that stable pay makes budgets simple. They say alignment can come from a separate vesting grant rather than from the pay itself.';
const REPLY =
  'A vesting grant only aligns people who stay long enough to vest, so it rewards tenure over contribution. Stable pay keeps budgets simple, but it moves all the price risk onto the treasury.';
const REPLY_FAIR =
  'They say a vesting grant only aligns people who stay long enough to vest, so it rewards tenure over contribution, and that stable pay makes budgets simple but moves all the price risk onto the treasury.';

const stepDone = (key) => log.steps.find((s) => s.key === key && s.ok);
const recorded = (key) => log.steps.some((s) => s.key === key);
function note(entry) {
  log.steps.push({ at: new Date().toISOString(), ...entry });
  save();
}

const reader = readClient();
async function view(functionName, args) {
  return JSON.parse(String(await retried(() => reader.readContract({ address: CONTRACT, functionName, args }), 5)));
}

/** The net fee a decided transaction cost its sender, from its own fee accounting. */
async function netFee(hash) {
  const tx = await rpc('eth_getTransactionByHash', [hash]).catch(() => null);
  const gen = await rpc('gen_getTransactionByHash', [hash]).catch(() => null);
  const acct = gen?.data?.fee_accounting ?? tx?.data?.fee_accounting;
  if (!acct) return null;
  return BigInt(acct.paid_fee_value ?? 0) - BigInt(acct.total_refunded ?? 0);
}

async function write(key, account, method, args, value = 0n, { final = false } = {}) {
  const prior = stepDone(key);
  if (prior) return prior;
  const { address, provider } = standinWallet(account);
  const client = walletClient(address, provider);
  const started = Date.now();
  const hash = await submit(client, { method, args, value, sender: address });
  const decided = await waitDecided(client, hash, method);
  const outcome = outcomeOf(decided);
  const entry = {
    key,
    method,
    account,
    from: address,
    args: args.map((a) => (typeof a === 'string' && a.length > 60 ? a.slice(0, 57) + '...' : a)),
    value: value.toString(),
    hash,
    ok: outcome.ok,
    status: outcome.status,
    execution: outcome.execution,
    returned: outcome.returned ?? null,
    refusal: outcome.refusal || null,
    seconds_to_decision: Math.round((Date.now() - started) / 1000),
  };
  if (final && outcome.ok) {
    const done = await waitFinal(client, hash);
    entry.final_status = outcomeOf(done).status;
  }
  note(entry);
  console.log(`${key}: ${method} ${entry.ok ? 'ok' : 'NOT OK ' + (entry.refusal ?? entry.status)} in ${entry.seconds_to_decision} s  ${hash}`);
  if (!entry.ok) throw new Error(`${key} failed: ${entry.refusal ?? entry.status}`);
  return entry;
}

// -- accounts ---------------------------------------------------------------------------------
const names = { author: `review_author_${run}`, joiner: `review_joiner_${run}` };
const addr = Object.fromEntries(Object.entries(names).map(([k, n]) => [k, ensureAccount(n)]));
if (!log.accounts) {
  const nonces = {};
  for (const [k, a] of Object.entries(addr)) nonces[k] = Number(await rpc('eth_getTransactionCount', [a, 'latest']));
  log.accounts = { ...addr, nonces_at_start: nonces };
  save();
  console.log(`accounts: ${JSON.stringify(addr)} nonces at start ${JSON.stringify(nonces)}`);
}

// -- 1. faucet, through the site --------------------------------------------------------------
for (const [who, address] of Object.entries(addr)) {
  const key = `faucet-${who}`;
  if (stepDone(key)) continue;
  const response = await fetch(`${site}/api/faucet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: address.toLowerCase() }),
  });
  const body = await response.json().catch(() => ({}));
  const after = await balanceOf(address);
  // 409 is the faucet saying the address already holds enough: what the first, timed-out call of an earlier try had paid.
  const ok = (response.ok && BigInt(body.after ?? 0) > BigInt(body.before ?? 0) && after > 0n) || (response.status === 409 && after >= 10n * GEN);
  note({ key, ok, http: response.status, sent_address: address.toLowerCase(), answered_address: body.address, before: body.before, after: body.after, read_after: after.toString(), error: body.error });
  console.log(`${key}: HTTP ${response.status} ${fmt(BigInt(body.before ?? 0))} -> ${fmt(after)} ${body.error ?? ''}`);
  if (!ok) throw new Error(`${key} did not fund ${address}`);
}

// -- 2. open, 3. join and a strawman restatement ------------------------------------------------------
const opened = await write('open-thread', names.author, 'open_thread', [`Reviewer path ${run}: stablecoin pay`, POSITION, 12], 5n * GEN);
const tid = Number(opened.returned);
await write('join', names.joiner, 'join', [tid], 5n * GEN);

async function tryRestate(n, text, why) {
  await write(`restate${n}`, names.joiner, 'restate', [tid, text]);
  await write(`contest${n}`, names.author, 'contest', [tid]);
  await write(`judge${n}`, names.joiner, 'judge', [tid]);
  const got = await view('get_thread', [tid]);
  const turn = got.turns[0];
  if (!recorded(`label${n}`)) note({ key: `label${n}`, ok: true, why, thread_id: tid, thread_status: got.status, phase: got.phase, turn_status: turn.status, label: turn.label, history: turn.history.map((h) => h.label) });
  console.log(`  -> try ${n}: turn ${turn.status}, last label ${turn.label || '(none)'}, thread ${got.status}/${got.phase}`);
  return got;
}

let thread = await tryRestate(1, STRAWMAN, 'a strawman: expected to cost a try and keep the reply locked');

// -- 5. a full restatement, then the reply, then the author restates it -----------------------------------
if (thread.status === 'ACTIVE' && thread.phase === 'RESTATE' && thread.turns[0].status === 'STATED') {
  thread = await tryRestate(2, FAIR_TEXT, 'a full restatement');
}
if (thread.status === 'ACTIVE' && thread.phase === 'REPLY') {
  await write('reply', names.joiner, 'rebut', [tid, REPLY]);
  await write('restate-reply', names.author, 'restate', [tid, REPLY_FAIR]);
  await write('confirm-reply', names.joiner, 'confirm', [tid]);
  thread = await view('get_thread', [tid]);
  if (!recorded('thread-end')) note({ key: 'thread-end', ok: true, thread_id: tid, thread_status: thread.status, turns: thread.turns.map((t) => ({ n: t.n, status: t.status, label: t.label })) });
  console.log(`  -> thread ${thread.status}`);
}

// -- 6. the money, to the wei, after finality ---------------------------------------------------------------
for (const [who, field] of [['author', 'author_balance'], ['joiner', 'opponent_balance']]) {
  const key = `balance-${who}`;
  if (recorded(key)) continue;
  const owed = BigInt((await view('get_thread', [tid]))[field]);
  if (owed === 0n) {
    note({ key, ok: true, owed: '0', why: 'nothing was owed, so there was nothing to withdraw' });
    continue;
  }
  const before = await balanceOf(addr[who]);
  const w = await write(`${who}-withdraw`, names[who], 'withdraw', [], 0n, { final: true });
  const after = await balanceOf(addr[who]);
  const fee = await netFee(w.hash);
  const expected = fee === null ? null : before + owed - fee;
  note({ key, ok: expected === after, owed: owed.toString(), before: before.toString(), after: after.toString(), net_fee: fee?.toString() ?? null, expected: expected?.toString() ?? null, difference: expected === null ? null : (after - expected).toString() });
  console.log(`  ${who}: ${fmt(before)} -> ${fmt(after)}; owed ${fmt(owed)}, fee ${fee === null ? '?' : fmt(fee)}; ${expected === after ? 'exact to the wei' : 'difference ' + (expected === null ? '?' : (after - expected).toString()) + ' wei'}`);
}

// -- 7. the site shows what the chain holds ----------------------------------------------------------------
const pages = [
  ['page-thread', `${site}/t/${tid}`, `Reviewer path ${run}`],
  ['page-turn', `${site}/t/${tid}/turn/1`, 'They think tokens are bad'],
];
for (const [key, url, needle] of pages) {
  if (recorded(key)) continue;
  let ok = false;
  let status = 0;
  for (let attempt = 0; attempt < 6 && !ok; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 10000));
    const response = await fetch(url, { cache: 'no-store' });
    status = response.status;
    const html = await response.text();
    ok = response.ok && html.includes(needle);
  }
  note({ key, ok, url, http: status });
  console.log(`${key}: HTTP ${status} ${ok ? 'shows it' : 'MISSING'}  ${url}`);
}

log.finished = new Date().toISOString();
save();
console.log(`\nrecorded in docs/reviewer-path.studio-next.json (run ${run})`);
process.exit(0);
