import Link from 'next/link';

import { DEPLOYMENT } from '@/lib/genlayer-core.mjs';
import { LABEL_CLASS, gen, plural, short, shortHash, threadState } from '@/lib/format';
import type { Label, Thread } from '@/lib/types';

export const EXPLORER = DEPLOYMENT.explorer as string;
export const CONTRACT = DEPLOYMENT.restate as string;

export function txUrl(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}

/** Indigo for FAIR, hatched for INCOMPLETE, struck through for DISTORTED. */
export function LabelBadge({ label, children }: { label: Label; children?: React.ReactNode }) {
  return <span className={`c-verdict ${LABEL_CLASS[label]}`.trim()}>{children ?? label}</span>;
}

/** Forfeits are dotted, completed threads indigo, everything running is plain. */
export function StateBadge({ k }: { k: Pick<Thread, 'status' | 'phase' | 'turn' | 'reason'> }) {
  const cls = k.status === 'DONE' ? 'yes' : k.status === 'FORFEITED' ? 'expired' : k.phase === 'REPLY' ? 'yes' : '';
  return <span className={`c-verdict ${cls}`.trim()}>{threadState(k)}</span>;
}

export function Tx({ hash, label }: { hash: string; label?: string }) {
  if (!hash) return null;
  return (
    <a className="c-link mono text-[12.5px]" href={txUrl(hash)} target="_blank" rel="noreferrer">
      {label ? `${label} ` : ''}
      {shortHash(hash)} ↗
    </a>
  );
}

export function Addr({ address }: { address: string }) {
  if (!address) return null;
  return (
    <a className="c-link mono text-[12.5px]" href={addressUrl(address)} target="_blank" rel="noreferrer" title={address}>
      {short(address)}
    </a>
  );
}

/** The last verdict on a thread: the label of the newest turn that has one. */
export function lastLabel(k: Thread): { turn: number; label: Label } | null {
  for (let i = k.turns.length - 1; i >= 0; i--) {
    const t = k.turns[i];
    if (t.label) return { turn: t.n, label: t.label };
  }
  return null;
}

/** One row of the recent-threads feed: the topic, the state, the last verdict. */
export function ThreadRow({ k }: { k: Thread }) {
  const last = lastLabel(k);
  return (
    <Link href={`/t/${k.id}`} className="c-row-link px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {last ? <LabelBadge label={last.label} /> : <span className="c-verdict">{k.status === 'OPEN' ? 'OPEN' : 'NO VERDICT YET'}</span>}
        <span className="font-medium">{k.topic}</span>
        <span className="c-faint text-[13px]">
          {last ? `turn ${last.turn}` : ''} · {gen(k.deposit)} each · {plural(k.turns.reduce((n, t) => n + t.history.length + (t.restatement ? 1 : 0), 0), 'restatement')}
        </span>
        <span className="c-faint mono text-[11.5px]">thread #{k.id}</span>
      </div>
    </Link>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="c-note">{children}</div>;
}

export function ReadError({ message }: { message: string }) {
  return (
    <div className="c-card pad">
      <p className="font-medium">The chain did not answer.</p>
      <p className="c-muted mt-1 text-[14px]">{message}</p>
    </div>
  );
}
