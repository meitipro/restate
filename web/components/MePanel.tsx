'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { gen } from '@/lib/format';
import type { Thread } from '@/lib/types';
import { refreshReads, send, type TxState } from '@/lib/write';

import { StateBadge, Tx } from './ui';
import { WalletGate, useWallet } from './Wallet';

type Mine = { threads: Thread[]; balance: string; scanned: number; total: number };

/** What waits on this address: the threads it is in, whose move it is, and what it can withdraw. */
function yourMove(k: Thread, me: string): string {
  const is = (a: string) => a !== '' && a.toLowerCase() === me;
  const u = k.turns[k.turns.length - 1];
  if (k.status === 'OPEN') return is(k.author) ? 'Waiting for someone to join' : '';
  if (k.status !== 'ACTIVE' || !u) return '';
  if (k.phase === 'REPLY') return is(u.original_by) ? 'Waiting for the reply' : 'Your reply is open';
  if (u.status === 'STATED') return is(u.restater) ? 'Your restatement is due' : 'Waiting for their restatement';
  if (u.status === 'RESTATED') return is(u.original_by) ? 'Confirm or contest the restatement' : 'Waiting for the author';
  if (u.status === 'CONTESTED') return 'Waiting for validators (anyone may call judge)';
  return '';
}

export function MePanel() {
  const w = useWallet();
  const [data, setData] = useState<Mine | null>(null);
  const [error, setError] = useState('');
  const [tx, setTx] = useState<TxState>({ phase: 'idle' });
  const busy = tx.phase === 'signing' || tx.phase === 'deciding';

  const load = useCallback(async () => {
    if (!w.account) return;
    setError('');
    try {
      const response = await fetch(`/api/me?address=${w.account}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'The read failed.');
      setData(body as Mine);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }, [w.account]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  async function withdraw() {
    const out = await send(w.account, 'withdraw', [], 0n, setTx);
    if (out.phase === 'done') {
      await refreshReads(['threads']);
      w.refreshBalance();
      load();
    }
  }

  const me = w.account.toLowerCase();
  const owed = data ? BigInt(data.balance) : 0n;

  return (
    <WalletGate action="see your threads">
      <div className="flex flex-col gap-8">
        <section className="c-card pad flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="c-eyebrow">Withdrawable</p>
            <p className="mono mt-1 text-[22px]">{data ? gen(owed) : '…'}</p>
            <p className="c-faint mt-1 text-[12.5px]">Deposits come back here when a thread completes, are closed unjoined, or are won by a forfeit. Withdraw sends them to your wallet.</p>
          </div>
          <div>
            <button className="c-btn solid" disabled={busy || owed === 0n} onClick={withdraw}>
              {busy ? 'Withdrawing…' : 'Withdraw'}
            </button>
            {tx.hash && <p className="mt-2"><Tx hash={tx.hash} /></p>}
            {(tx.phase === 'refused' || tx.phase === 'error') && <p className="mt-2 text-[13.5px]" style={{ color: 'var(--danger)' }}>{tx.message}</p>}
          </div>
        </section>

        <section>
          <p className="c-eyebrow">Your threads</p>
          {error && <p className="mt-3 text-[14px]" style={{ color: 'var(--danger)' }}>{error}</p>}
          {data && data.threads.length === 0 && (
            <p className="c-muted mt-3 text-[14.5px]">
              You are not in a thread yet (the newest {data.scanned} were checked). <Link className="c-link" href="/new">Open one</Link>.
            </p>
          )}
          {data && data.threads.length > 0 && (
            <div className="c-card mt-3 divide-y divide-[var(--line)]">
              {data.threads.map((k) => {
                const move = yourMove(k, me);
                return (
                  <Link key={k.id} href={`/t/${k.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <span>
                      <span className="mono c-faint mr-2 text-[12px]">#{k.id}</span>
                      <span className="font-medium">{k.topic}</span>
                      {move && <span className="c-muted mt-0.5 block text-[13px]">{move}</span>}
                    </span>
                    <StateBadge k={k} />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </WalletGate>
  );
}
