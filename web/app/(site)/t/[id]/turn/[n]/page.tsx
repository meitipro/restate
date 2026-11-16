import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Addr, LabelBadge, ReadError } from '@/components/ui';
import { dayTime, gen, readingAid } from '@/lib/format';
import { getThread, readError } from '@/lib/read';
import type { Thread, Turn } from '@/lib/types';

export const revalidate = 20;

export async function generateMetadata(props: PageProps<'/t/[id]/turn/[n]'>) {
  const { id, n } = await props.params;
  return { title: `Thread ${id}, turn ${n}` };
}

const HEADLINE = {
  FAIR: 'It says what they said.',
  INCOMPLETE: 'The restatement left out a point.',
  DISTORTED: 'The restatement added or bent something.',
} as const;

const NEXT = {
  FAIR: 'The reply unlocks.',
  INCOMPLETE: 'The reply stays locked. Restate again.',
  DISTORTED: 'The reply stays locked. Restate again.',
} as const;

export default async function TurnPage(props: PageProps<'/t/[id]/turn/[n]'>) {
  const { id, n } = await props.params;
  const tid = Number(id);
  const tn = Number(n);
  if (!Number.isInteger(tid) || tid < 1 || !Number.isInteger(tn) || tn < 1) notFound();
  let k: Thread;
  let t: Turn;
  try {
    const out = await getThread(tid);
    if (!out.found || !out.turns[tn - 1]) notFound();
    k = out;
    t = out.turns[tn - 1];
  } catch (e) {
    if ((e as { digest?: string })?.digest?.startsWith('NEXT_')) throw e;
    return (
      <div className="c-wrap py-14">
        <ReadError message={readError(e)} />
      </div>
    );
  }
  // Every try on the turn, oldest first: the failed ones, then the one in play.
  const tries = [...t.history.map((h) => ({ text: h.text, label: h.label as '' | typeof h.label })), ...(t.restatement ? [{ text: t.restatement, label: t.label }] : [])];
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">
        <Link href={`/t/${k.id}`} className="c-link">Thread {k.id} · {k.topic}</Link> · turn {t.n} · {tries.length} of {k.max_tries} tries read
      </p>
      <h1 className="c-h1 mt-3" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>
        {t.label ? HEADLINE[t.label] : 'Not read yet.'}
      </h1>
      {t.label && <p className="c-lead mt-3">{NEXT[t.label]}</p>}

      {tries.map((tr, i) => {
        const aid = readingAid(t.original, tr.text);
        return (
          <section key={i} className="mt-10">
            <div className="flex flex-wrap items-center gap-3">
              <p className="c-eyebrow">Try {i + 1}</p>
              {tr.label ? <LabelBadge label={tr.label} /> : <span className="c-verdict">{t.status === 'CONTESTED' ? 'CONTESTED' : 'WAITING'}</span>}
            </div>
            <div className="mt-3 grid gap-6 lg:grid-cols-2">
              <div>
                <p className="c-eyebrow">What they said</p>
                <div className="c-card pad mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">{t.original}</div>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {aid.points.map((p, j) => (
                    <li key={j} className="flex gap-3 text-[13.5px]">
                      <span className={`c-verdict ${p.kept ? 'yes' : ''}`} style={{ height: 20, fontSize: 10 }}>{p.kept ? 'KEPT' : 'MISSING'}</span>
                      <span className="c-muted">{p.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="c-eyebrow">What was written</p>
                <div className="c-card pad mt-2 whitespace-pre-wrap text-[15px] leading-relaxed" style={tr.label === 'DISTORTED' ? { textDecoration: 'line-through' } : undefined}>{tr.text}</div>
                {aid.added.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {aid.added.map((a, j) => (
                      <li key={j} className="flex gap-3 text-[13.5px]">
                        <span className="c-verdict retry" style={{ height: 20, fontSize: 10 }}>ADDED?</span>
                        <span className="c-muted">{a}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <p className="c-faint mt-2 text-[12px]">KEPT, MISSING and ADDED? are a word-overlap guess from your browser, a reading aid that is never part of the record. The label is the validators’.</p>
          </section>
        );
      })}

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        <div className="c-card pad">
          <p className="c-eyebrow">Written by</p>
          <p className="mt-2"><Addr address={t.restater} /></p>
        </div>
        <div className="c-card pad">
          <p className="c-eyebrow">Read</p>
          <p className="mt-2 text-[14px]">{t.judged_at ? dayTime(t.judged_at) : t.answered === 'confirmed' ? 'Confirmed by the author, no validator call' : 'not yet'}</p>
          {t.judged_by && <p className="mt-1"><Addr address={t.judged_by} /></p>}
        </div>
        <div className="c-card pad">
          <p className="c-eyebrow">What running out of tries costs</p>
          <p className="mt-2 text-[14px]">{t.tries_left > 0 || t.status === 'FAIR' ? `${t.tries_left} ${t.tries_left === 1 ? 'try' : 'tries'} left. Running out forfeits ${gen(k.deposit)}.` : `The restater forfeited ${gen(k.deposit)}.`}</p>
        </div>
      </div>
    </div>
  );
}
