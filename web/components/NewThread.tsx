'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { gen, toWei } from '@/lib/format';
import { refreshReads, send, type TxState } from '@/lib/write';

import { Tx } from './ui';
import { WalletGate, useWallet } from './Wallet';

const MAX_TOPIC = 80;
const MAX_TEXT = 800;
const MIN_DEPOSIT = 5n * 10n ** 18n;
const MAX_DEPOSIT = 1000n * 10n ** 18n;
const WINDOWS = [12, 24, 48, 96];

/** The form that opens a thread: topic, position, window, deposit. The contract re-checks every limit. */
export function NewThread() {
  const w = useWallet();
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [position, setPosition] = useState('');
  const [hours, setHours] = useState(48);
  const [deposit, setDeposit] = useState('10');
  const [tx, setTx] = useState<TxState>({ phase: 'idle' });
  const busy = tx.phase === 'signing' || tx.phase === 'deciding';
  const wei = toWei(deposit);
  const depositOk = wei !== null && wei >= MIN_DEPOSIT && wei <= MAX_DEPOSIT;
  const ready = topic.trim().length > 0 && position.trim().length > 0 && depositOk;

  async function submit() {
    if (!wei) return;
    const out = await send(w.account, 'open_thread', [topic.trim(), position.trim(), hours], wei, setTx);
    if (out.phase === 'done') {
      await refreshReads(['threads']);
      w.refreshBalance();
      const id = Number(out.returned);
      router.push(Number.isInteger(id) && id > 0 ? `/t/${id}` : '/me');
      router.refresh();
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <section className="flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="c-eyebrow">Topic</span>
          <input className="c-input" maxLength={MAX_TOPIC} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="One line a reader can scan" />
          <span className="c-faint mono text-right text-[11.5px]">{topic.length} / {MAX_TOPIC}</span>
        </label>
        <label className="flex flex-col gap-2">
          <span className="c-eyebrow">Your position</span>
          <textarea
            className="c-textarea"
            style={{ minHeight: 190 }}
            maxLength={MAX_TEXT}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="State your side as you mean it, with its main points. The other person has to restate it fairly before they may answer."
          />
          <span className="c-faint mono text-right text-[11.5px]">{position.length} / {MAX_TEXT}</span>
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="c-eyebrow">Window per step</span>
            <select className="c-input" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
              {WINDOWS.map((h) => (
                <option key={h} value={h}>{h} hours</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="c-eyebrow">Deposit each side (GEN)</span>
            <input className="c-input" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            {!depositOk && <span className="text-[12.5px]" style={{ color: 'var(--danger)' }}>Between 5 and 1000 GEN.</span>}
          </label>
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="c-card pad">
          <p className="c-eyebrow">What happens next</p>
          <ol className="c-muted mt-3 list-decimal pl-5 text-[14px] leading-relaxed">
            <li>You post this with {depositOk && wei ? gen(wei) : 'your deposit'}.</li>
            <li>Someone joins with the same deposit and must restate you.</li>
            <li>You confirm it, or contest it and validators read it against what you wrote.</li>
            <li>A fair restatement unlocks their reply, and then you restate them.</li>
          </ol>
          <p className="c-faint mt-3 text-[12.5px]">If nobody joins in {hours} hours you can close it and take the deposit back. If both restatements are FAIR, both deposits come back. It is public text on chain, so keep to what you would post.</p>
        </div>
        <div>
          <WalletGate action="open a thread">
            <button className="c-btn solid" disabled={busy || !ready} onClick={submit}>
              {busy ? 'Opening…' : 'Open the thread'}
            </button>
          </WalletGate>
          {tx.hash && <p className="mt-2"><Tx hash={tx.hash} /></p>}
          {(tx.phase === 'refused' || tx.phase === 'error') && <p className="mt-2 text-[13.5px]" style={{ color: 'var(--danger)' }}>{tx.message}</p>}
        </div>
      </aside>
    </div>
  );
}
