import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ThreadActions } from '@/components/ThreadActions';
import { Addr, LabelBadge, ReadError, StateBadge } from '@/components/ui';
import { dayTime, gen, plural, timeLeft, turnWaiting } from '@/lib/format';
import { getThread, readError } from '@/lib/read';
import type { Thread, Turn } from '@/lib/types';

export const revalidate = 20;

export async function generateMetadata(props: PageProps<'/t/[id]'>) {
  const { id } = await props.params;
  const k = await getThread(Number(id)).catch(() => null);
  return { title: k && k.found ? `${k.topic} · thread #${k.id}` : `Thread #${id}` };
}

function Who({ k, address }: { k: Thread; address: string }) {
  return (
    <span className="c-faint text-[12.5px]">
      {address.toLowerCase() === k.author.toLowerCase() ? 'author' : 'joiner'} <Addr address={address} />
    </span>
  );
}

function TurnView({ k, t }: { k: Thread; t: Turn }) {
  const waiting = turnWaiting(t, k);
  return (
    <section className="flex flex-col gap-4">
      <p className="c-eyebrow">
        Turn {t.n} · {t.n === 1 ? 'the position' : 'the rebuttal'}
        {waiting ? ` · ${waiting}` : ''}
      </p>
      <div className="c-card pad">
        <Who k={k} address={t.original_by} />
        <p className="mt-2 whitespace-pre-wrap text-[15.5px] leading-relaxed">{t.original}</p>
      </div>
      {t.history.map((h, i) => (
        <div key={i} className={`c-try ${h.label === 'DISTORTED' ? 'dis' : 'inc'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Who k={k} address={t.restater} />
            <span className="flex items-center gap-2">
              <span className="c-faint text-[12px]">restatement, try {i + 1}</span>
              <LabelBadge label={h.label} />
            </span>
          </div>
          <p className={`mt-3 whitespace-pre-wrap text-[17px] leading-relaxed ${h.label === 'DISTORTED' ? 'c-struck' : 'c-muted'}`}>
            {h.text}
          </p>
        </div>
      ))}
      {t.restatement && (
        <div className={`c-try ${t.label === 'FAIR' ? 'fair' : ''}`} style={t.label === 'FAIR' ? undefined : { borderColor: 'var(--amber)' }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Who k={k} address={t.restater} />
            <span className="flex items-center gap-2">
              <span className="c-faint text-[12px]">restatement, try {t.tries}</span>
              {t.label === 'FAIR' ? <LabelBadge label="FAIR" /> : <span className="c-verdict">{t.status === 'CONTESTED' ? 'CONTESTED' : 'WAITING FOR THE AUTHOR'}</span>}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[18px] leading-relaxed">{t.restatement}</p>
          {t.answered === 'confirmed' && <p className="c-faint mt-2 text-[12.5px]">Confirmed by the author, which counts as FAIR with no validator call.</p>}
          {t.answered === 'silence' && <p className="c-faint mt-2 text-[12.5px]">The author did not answer inside the window, which counts as contesting.</p>}
          {t.judged_by && <p className="c-faint mt-1 text-[12.5px]">Read by the validators, called by <Addr address={t.judged_by} />. <Link className="c-link" href={`/t/${k.id}/turn/${t.n}`}>Open the verdict</Link></p>}
        </div>
      )}
    </section>
  );
}

export default async function ThreadPage(props: PageProps<'/t/[id]'>) {
  const { id } = await props.params;
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) notFound();
  let k: Thread;
  try {
    const out = await getThread(n);
    if (!out.found) notFound();
    k = out;
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith('NEXT_')) throw e;
    return (
      <div className="c-wrap py-14">
        <ReadError message={readError(e)} />
      </div>
    );
  }
  const now = Math.floor(Date.now() / 1000);
  const steps = [
    ['01', 'They state', k.status !== 'OPEN'],
    ['02', 'You restate', k.turns[0]?.status === 'FAIR'],
    ['03', 'You answer', k.turns.length >= 2],
    ['04', 'They restate you', k.turns[1]?.status === 'FAIR'],
  ] as const;
  const current = k.status === 'DONE' ? 5 : k.phase === 'REPLY' ? 2 : k.turn === 2 ? 3 : k.status === 'OPEN' ? 0 : 1;
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">Thread {k.id} · opened {dayTime(k.created_at)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="c-h1" style={{ fontSize: 'clamp(30px, 4.4vw, 56px)' }}>
          {k.topic}
        </h1>
        <StateBadge k={k} />
      </div>
      {k.status === 'FORFEITED' && (
        <div className="c-note mt-4">
          <p>
            <strong>Forfeit.</strong> <Addr address={k.loser} /> {k.reason === 'tries' ? 'ran out of tries' : 'missed a window'}, so their deposit went to <Addr address={k.winner} />.
          </p>
        </div>
      )}
      {k.status === 'DONE' && (
        <div className="c-note mt-4">
          <p><strong>Completed.</strong> Both restatements were FAIR, and both deposits came back.</p>
        </div>
      )}
      {k.status === 'CLOSED' && (
        <div className="c-note mt-4">
          <p><strong>Closed.</strong> Nobody joined inside the window, and the author&apos;s deposit came back.</p>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.7fr_1fr]">
        <div className="flex flex-col gap-8">
          {k.turns.length === 0 ? (
            <section>
              <p className="c-eyebrow">Turn 1 · the position</p>
              <div className="c-card pad mt-3">
                <Who k={k} address={k.author} />
                <p className="mt-2 whitespace-pre-wrap text-[15.5px] leading-relaxed">{k.position}</p>
              </div>
            </section>
          ) : (
            k.turns.map((t) => <TurnView key={t.n} k={k} t={t} />)
          )}
          <ThreadActions thread={k} />
          {k.phase === 'REPLY' && (
            <div className="c-card pad" style={{ borderColor: 'var(--violet)', background: '#101124' }}>
              <p className="c-eyebrow" style={{ color: 'var(--violet)' }}>The reply box is open</p>
              <p className="c-muted mt-1 text-[15px]">It opened because the restatement was FAIR. The other side must restate the reply before they answer.</p>
            </div>
          )}
          {k.status === 'ACTIVE' && k.phase === 'RESTATE' && k.turn === 1 && (
            <div className="c-lock flex flex-wrap items-center gap-5">
              <span className="grid h-[52px] w-[52px] place-items-center rounded-[4px] border border-[var(--line-strong)] bg-[var(--surface)]" style={{ color: 'var(--ink-2)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="locked">
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
              </span>
              <div className="min-w-0 flex-1" style={{ flexBasis: 260 }}>
                <p className="text-[20px] font-semibold">The reply box is locked</p>
                <p className="c-muted mt-1.5 text-[15.5px] leading-relaxed">It opens when the restatement is FAIR. It is empty on purpose.</p>
              </div>
            </div>
          )}
        </div>
        <aside className="flex flex-col gap-6">
          <section>
            <p className="c-eyebrow">The turn rail</p>
            <ol className="c-card mt-3 divide-y divide-[var(--line)]">
              {steps.map(([no, label], i) => (
                <li key={no} className="flex items-center gap-3 px-4 py-3" style={i + 1 === current ? { background: 'var(--violet-soft)' } : undefined}>
                  <span className="mono c-faint text-[12px]">{no}</span>
                  <span className={i + 1 <= current ? 'font-medium' : 'c-muted'}>{label}</span>
                  {i + 1 < current && <span className="c-verdict yes ml-auto" style={{ height: 20, fontSize: 10 }}>DONE</span>}
                </li>
              ))}
            </ol>
          </section>
          <section>
            <p className="c-eyebrow">Deposits and clock</p>
            <dl className="c-kv mt-3">
              <div><dt>Each side</dt><dd>{gen(k.deposit)}</dd></div>
              <div><dt>Author</dt><dd><Addr address={k.author} /></dd></div>
              <div><dt>Joiner</dt><dd>{k.opponent ? <Addr address={k.opponent} /> : 'nobody yet'}</dd></div>
              {k.turns[k.turns.length - 1] && k.status === 'ACTIVE' && (
                <>
                  <div><dt>Tries used</dt><dd>{k.turns[k.turns.length - 1].failures} of {k.max_tries}</dd></div>
                  <div><dt>Window left</dt><dd>{timeLeft(k.deadline, now)}</dd></div>
                </>
              )}
              <div><dt>Window</dt><dd>{plural(k.window_h, 'hour')} per step</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
