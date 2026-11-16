'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { gen, readingAid, timeLeft } from '@/lib/format';
import type { Thread } from '@/lib/types';
import { refreshReads, send, type TxState } from '@/lib/write';

import { Tx } from './ui';
import { WalletGate, useWallet } from './Wallet';

const MAX_TEXT = 800;

/** The original beside a writing box, a point-by-point reading aid, and the tries left. */
export function RestateForm({ thread }: { thread: Thread }) {
  const w = useWallet();
  const router = useRouter();
  const turn = thread.turns[thread.turns.length - 1];
  const [text, setText] = useState('');
  const [tx, setTx] = useState<TxState>({ phase: 'idle' });
  const busy = tx.phase === 'signing' || tx.phase === 'deciding';
  const now = Math.floor(Date.now() / 1000);
  const aid = useMemo(() => readingAid(turn?.original ?? '', text), [turn?.original, text]);

  if (!turn) return <p className="c-muted">This thread has no turn yet.</p>;
  const yours = w.account !== '' && w.account.toLowerCase() === turn.restater.toLowerCase();
  const open = thread.status === 'ACTIVE' && thread.phase === 'RESTATE' && turn.status === 'STATED';

  async function submit() {
    const out = await send(w.account, 'restate', [thread.id, text.trim()], 0n, setTx);
    if (out.phase === 'done') {
      await refreshReads(['threads', `thread:${thread.id}`]);
      router.push(`/t/${thread.id}`);
      router.refresh();
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
      <section>
        <p className="c-eyebrow">What they said · turn {turn.n}</p>
        <div className="c-card pad mt-3 whitespace-pre-wrap text-[15.5px] leading-relaxed">{turn.original}</div>
        <p className="c-eyebrow mt-6">The points, as a reading aid</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {aid.points.map((p, i) => (
            <li key={i} className="flex gap-3 text-[14px]">
              <span className={`c-verdict ${text.trim() && p.kept ? 'yes' : ''}`} style={{ height: 20, fontSize: 10 }}>{text.trim() ? (p.kept ? 'KEPT' : 'MISSING') : 'POINT'}</span>
              <span className="c-muted">{p.text}</span>
            </li>
          ))}
        </ul>
        <p className="c-faint mt-3 text-[12px]">A word-overlap guess from your browser, never part of the record. The validators decide.</p>
      </section>

      <section>
        <p className="c-eyebrow">What you write</p>
        <textarea
          className="c-textarea mt-3"
          style={{ minHeight: 180 }}
          maxLength={MAX_TEXT}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say their side in your own words, so well they would sign it. No rebuttal here."
        />
        <p className="c-faint mono mt-1 text-right text-[11.5px]">{text.length} / {MAX_TEXT}</p>
        {text.trim() && aid.added.length > 0 && (
          <p className="c-muted mt-2 text-[13.5px]">
            These parts may say something the original did not: {aid.added.map((a) => `“${a}”`).join(', ')}. A restatement may not add, argue or mock.
          </p>
        )}
        <div className="c-card pad mt-4">
          <dl className="c-kv">
            <div><dt>Tries left</dt><dd>{turn.tries_left} of {thread.max_tries}</dd></div>
            <div><dt>Window</dt><dd>{timeLeft(thread.deadline, now)}</dd></div>
            <div><dt>A second failure forfeits</dt><dd>{gen(thread.deposit)}</dd></div>
          </dl>
          <p className="c-faint mt-3 text-[12.5px]">The author can confirm it, which counts as FAIR, or contest it and validators read it against the original. Only FAIR unlocks the reply.</p>
        </div>
        <div className="mt-4">
          {!open ? (
            <p className="c-muted text-[14px]">This turn is not waiting for a restatement. <Link className="c-link" href={`/t/${thread.id}`}>Back to the thread</Link></p>
          ) : !yours && w.account !== '' ? (
            <p className="c-muted text-[14px]">Only the side restating this turn can write here.</p>
          ) : (
            <WalletGate action="restate">
              <button className="c-btn solid" disabled={busy || !text.trim()} onClick={submit}>
                {busy ? 'Posting…' : 'Post my restatement'}
              </button>
            </WalletGate>
          )}
          {tx.hash && <p className="mt-2"><Tx hash={tx.hash} /></p>}
          {(tx.phase === 'refused' || tx.phase === 'error') && <p className="mt-2 text-[13.5px]" style={{ color: 'var(--danger)' }}>{tx.message}</p>}
        </div>
      </section>
    </div>
  );
}
