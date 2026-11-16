import { unstable_cache } from 'next/cache';

import { CONTRACT, readClient, retried } from './genlayer-core.mjs';
import type { NotFound, Thread, Totals } from './types';

/**
 * Reads happen on the server, cached for a short while under tags.
 *
 * Studio Next rate-limits each IP, and every visitor's page view would
 * otherwise spend the server's budget. Shared reads are cached for 20 seconds;
 * after a decided write the page POSTs /api/refresh, which expires the tags it
 * touched, so the person who wrote sees their own result at once.
 */

const client = readClient();
const REVALIDATE = 20;

async function view<T>(method: string, args: (number | string)[]): Promise<T> {
  const raw = await retried(() => client.readContract({ address: CONTRACT, functionName: method, args }), 3);
  return JSON.parse(String(raw)) as T;
}

export const tags = {
  threads: 'threads',
  thread: (id: number) => `thread:${id}`,
};

export function getThread(id: number): Promise<Thread | NotFound> {
  return unstable_cache(() => view<Thread | NotFound>('get_thread', [id]), ['get_thread', String(id)], {
    revalidate: REVALIDATE,
    tags: [tags.threads, tags.thread(id)],
  })();
}

/** The contract's own totals: thread 0 is not a thread, it answers the counts. */
export async function getTotals(): Promise<Totals> {
  const out = await getThread(0);
  return out.totals ?? { threads: 0 };
}

/** Threads newest first. The contract has no list view, so this reads thread by thread; the cache keeps it to one pass per 20 seconds. */
export async function recentThreads(count = 12): Promise<Thread[]> {
  const { threads } = await getTotals();
  const out: Thread[] = [];
  for (let id = threads; id >= 1 && out.length < count; id--) {
    const t = await getThread(id);
    if (t.found) out.push(t);
  }
  return out;
}

/** A read failed: say so in one sentence rather than failing the page. */
export function readError(error: unknown): string {
  const text = String((error as Error)?.message ?? error);
  if (/-32029|rate limit/i.test(text)) return 'Studio Next is rate limiting reads right now. Wait a minute and reload.';
  return 'Studio Next did not answer this read. Reload in a moment.';
}
