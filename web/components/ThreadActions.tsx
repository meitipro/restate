'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { gen, timeLeft } from '@/lib/format';
import type { Thread } from '@/lib/types';
import { refreshReads, send, type TxState } from '@/lib/write';

import { Tx } from './ui';
import { WalletGate, useWallet } from './Wallet';

const MAX_TEXT = 800;

/**
 * Whatever the connected wallet can do to this thread right now. The turn rule
 * is the contract's: this only offers the moves the contract would accept.
 * judge and claim_forfeit are open to anyone on purpose, and the caller is recorded.
 */
export function ThreadActions({ thread }: { thread: Thread }) {
  const w = useWallet();
  const router = useRouter();
  const [tx, setTx] = useState<TxState>({ phase: 'idle' });
  const [rebuttal, setRebuttal] = useState('');
  const busy = tx.phase === 'signing' || tx.phase === 'deciding';
  const me = w.account.toLowerCase();
  const is = (a: string) => me !== '' && a !== '' && me === a.toLowerCase();
  const now = Math.floor(Date.now() / 1000);
  const late = now > thread.deadline;
  const turn = thread.turns[thread.turns.length - 1];

  async function run(method: string, args: unknown[], value = 0n) {
    const out = await send(w.account, method, args, value, setTx);
    if (out.phase === 'done') {
      await refreshReads(['threads', `thread:${thread.id}`]);
      w.refreshBalance();
      router.refresh();
    }
    return out;
  }

  const blocks: React.ReactNode[] = [];
  const say = (key: string, body: React.ReactNode) =>
    blocks.push(
      <div key={key} className="c-card pad">
        {body}
      </div>,
    );

  if (thread.status === 'OPEN') {
    if (!late) {
      say(
        'join',
        <>
          <p className="text-[14.5px]">
            Nobody has joined yet. Joining costs the same deposit, <span className="mono">{gen(thread.deposit)}</span>, and you restate the position before you may answer it. It closes in {timeLeft(thread.deadline, now)}.
          </p>
          {is(thread.author) ? (
            <p className="c-faint mt-2 text-[13px]">You opened this thread. Someone else has to join it.</p>
          ) : (
            <div className="mt-3">
              <WalletGate action="join this thread">
                <button className="c-btn solid" disabled={busy} onClick={() => run('join', [thread.id], BigInt(thread.deposit))}>
                  {busy ? 'Joining…' : `Join with ${gen(thread.deposit)}`}
                </button>
              </WalletGate>
            </div>
          )}
        </>,
      );
    } else {
      say(
        'close',
        <>
          <p className="text-[14.5px]">Nobody joined inside the window. Anyone may close the thread, and the author&apos;s deposit comes back to them.</p>
          <button className="c-btn mt-3" disabled={busy} onClick={() => run('claim_forfeit', [thread.id])}>
            {busy ? 'Closing…' : 'Close the thread'}
          </button>
        </>,
      );
    }
  }

  if (thread.status === 'ACTIVE' && turn) {
    if (thread.phase === 'RESTATE') {
      if (turn.status === 'STATED') {
        say(
          'stated',
          <>
            <p className="text-[14.5px]">
              {is(turn.restater)
                ? `It is your turn to restate. ${turn.tries_left} of ${thread.max_tries} tries left, ${timeLeft(thread.deadline, now)} on the clock.`
                : `Waiting for ${turn.failures > 0 ? 'another restatement' : 'a restatement'}. ${timeLeft(thread.deadline, now)} on the clock.`}
            </p>
            {is(turn.restater) && !late && (
              <Link className="c-btn solid mt-3" href={`/t/${thread.id}/restate`}>
                Restate
              </Link>
            )}
            {late && (
              <>
                <p className="c-muted mt-2 text-[13.5px]">The window ended. Anyone may claim the forfeit: the restater loses their deposit to the other side.</p>
                <button className="c-btn mt-3" disabled={busy} onClick={() => run('claim_forfeit', [thread.id])}>
                  {busy ? 'Claiming…' : 'Claim the forfeit'}
                </button>
              </>
            )}
          </>,
        );
      } else if (turn.status === 'RESTATED') {
        say(
          'restated',
          <>
            <p className="text-[14.5px]">
              {is(turn.original_by)
                ? `You wrote the original. Would you say yes, that is what I mean? Confirm it, or contest it and the validators will read it. ${timeLeft(thread.deadline, now)} left; if you stay silent it counts as contesting.`
                : `Waiting for the author of the original to confirm or contest. Silence counts as contesting. ${timeLeft(thread.deadline, now)} left.`}
            </p>
            {is(turn.original_by) && !late && (
              <div className="mt-3 flex flex-wrap gap-3">
                <button className="c-btn solid" disabled={busy} onClick={() => run('confirm', [thread.id])}>
                  Confirm: that is what I mean
                </button>
                <button className="c-btn" disabled={busy} onClick={() => run('contest', [thread.id])}>
                  Contest it
                </button>
              </div>
            )}
            {late && (
              <>
                <p className="c-muted mt-2 text-[13.5px]">The author did not answer inside the window, so it counts as contesting. Anyone may send it to the validators.</p>
                <div className="mt-3">
                  <WalletGate action="start the validators">
                    <button className="c-btn solid" disabled={busy} onClick={() => run('judge', [thread.id])}>
                      {busy ? 'Validators are reading…' : 'Send it to the validators'}
                    </button>
                  </WalletGate>
                </div>
              </>
            )}
          </>,
        );
      } else if (turn.status === 'CONTESTED') {
        say(
          'contested',
          <>
            <p className="text-[14.5px]">The restatement was contested. Anyone may start the validators; you will be recorded as the caller.</p>
            <div className="mt-3">
              <WalletGate action="start the validators">
                <button className="c-btn solid" disabled={busy} onClick={() => run('judge', [thread.id])}>
                  {busy ? 'Validators are reading…' : 'Send it to the validators'}
                </button>
              </WalletGate>
            </div>
          </>,
        );
      }
    } else if (thread.phase === 'REPLY') {
      const replier = turn.restater;
      if (is(replier)) {
        say(
          'reply',
          <>
            <p className="c-eyebrow">Your reply is unlocked</p>
            <p className="c-muted mt-1 text-[14px]">The other side must now restate it before they answer. {timeLeft(thread.deadline, now)} left.</p>
            <textarea className="c-textarea mt-3" style={{ minHeight: 110 }} maxLength={MAX_TEXT} value={rebuttal} onChange={(e) => setRebuttal(e.target.value)} placeholder="Your rebuttal" />
            <p className="c-faint mono mt-1 text-right text-[11.5px]">{rebuttal.length} / {MAX_TEXT}</p>
            <button className="c-btn solid mt-2" disabled={busy || !rebuttal.trim() || late} onClick={() => run('rebut', [thread.id, rebuttal.trim()])}>
              {busy ? 'Posting…' : 'Post my rebuttal'}
            </button>
          </>,
        );
      } else {
        say('wait-reply', <p className="text-[14.5px]">The reply is unlocked for the side whose restatement was fair. {timeLeft(thread.deadline, now)} left for them to post it.</p>);
      }
      if (late) {
        say(
          'forfeit-reply',
          <>
            <p className="c-muted text-[13.5px]">The window ended with no reply. Anyone may claim the forfeit.</p>
            <button className="c-btn mt-3" disabled={busy} onClick={() => run('claim_forfeit', [thread.id])}>
              {busy ? 'Claiming…' : 'Claim the forfeit'}
            </button>
          </>,
        );
      }
    }
  }

  const mine = is(thread.author) ? BigInt(thread.author_balance) : is(thread.opponent) ? BigInt(thread.opponent_balance) : 0n;
  if (mine > 0n) {
    say(
      'withdraw',
      <>
        <p className="text-[14.5px]">
          You can withdraw <span className="mono">{gen(mine)}</span>.
        </p>
        <button className="c-btn solid mt-3" disabled={busy} onClick={() => run('withdraw', [])}>
          {busy ? 'Withdrawing…' : `Withdraw ${gen(mine)}`}
        </button>
      </>,
    );
  }

  if (blocks.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {blocks}
      {tx.hash && <p><Tx hash={tx.hash} /></p>}
      {tx.phase === 'deciding' && <p className="c-muted flex items-center gap-2 text-[13.5px]"><span className="c-spin" /> Validators are reading…</p>}
      {(tx.phase === 'refused' || tx.phase === 'error') && <p className="text-[13.5px]" style={{ color: 'var(--danger)' }}>{tx.message}</p>}
    </div>
  );
}
