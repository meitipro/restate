import { NextResponse } from 'next/server';

import { getTotals, getThread, readError } from '@/lib/read';
import type { Thread } from '@/lib/types';

/**
 * Which threads an address is in, and what it can withdraw. The contract has
 * no per-address index, so this scans the newest threads through the same
 * 20-second cache the pages use. It only reads public data.
 */
const SCAN = 60;

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get('address') ?? '';
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return NextResponse.json({ error: 'Send an address.' }, { status: 400 });
  const me = address.toLowerCase();
  try {
    const { threads } = await getTotals();
    const mine: Thread[] = [];
    let balance = '0';
    let scanned = 0;
    for (let id = threads; id >= 1 && scanned < SCAN; id--, scanned++) {
      const k = await getThread(id);
      if (!k.found) continue;
      const isAuthor = k.author.toLowerCase() === me;
      const isOpponent = k.opponent !== '' && k.opponent.toLowerCase() === me;
      if (!isAuthor && !isOpponent) continue;
      mine.push(k);
      // The balance is the address's own, the same on every thread it is in.
      balance = isAuthor ? k.author_balance : k.opponent_balance;
    }
    return NextResponse.json({ threads: mine, balance, scanned, total: threads });
  } catch (e) {
    return NextResponse.json({ error: readError(e) }, { status: 502 });
  }
}
