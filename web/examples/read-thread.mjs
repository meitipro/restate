/**
 * Read a thread, no wallet and nothing signed.
 *
 *   node examples/read-thread.mjs <thread id>
 *
 * get_thread answers JSON text: the position, every turn with its tries and labels, the deposits and the clock.
 */
import { CONTRACT, readClient, retried } from '../lib/genlayer-core.mjs';

const [id] = process.argv.slice(2);
if (!id) {
  console.error('usage: node examples/read-thread.mjs <thread id>');
  process.exit(2);
}
const client = readClient();
const raw = await retried(() => client.readContract({ address: CONTRACT, functionName: 'get_thread', args: [Number(id)] }));
const thread = JSON.parse(String(raw));
console.log(
  JSON.stringify({
    found: thread.found,
    status: thread.status,
    phase: thread.phase,
    turn: thread.turn,
    labels: (thread.turns ?? []).map((t) => ({ turn: t.n, status: t.status, label: t.label, tries_left: t.tries_left })),
  }),
);
