import Link from 'next/link';

import { Empty, LabelBadge, ReadError, ThreadRow } from '@/components/ui';
import generated from '@/lib/contract.generated.json';
import { readingAid } from '@/lib/format';
import { readError, recentThreads } from '@/lib/read';
import type { Thread } from '@/lib/types';

export const revalidate = 20;

const FAQ = [
  {
    q: 'Who decides who is right?',
    a: 'Nobody, and Restate never tries. The validators are never told which side is which and never asked whether the original is right. They only say whether a restatement says what the original says, no more and no less.',
  },
  {
    q: 'Can I be silent?',
    a: 'Not usefully. An author who does not answer a restatement inside the window counts as contesting, so the validators decide. A joiner who does not restate, or a replier who does not reply, forfeits their deposit to the other side.',
  },
  {
    q: 'What if I disagree with the label?',
    a: 'A restatement gets two tries. After INCOMPLETE or DISTORTED you can restate again with the reasons in front of you. The author can also simply confirm a restatement, which counts as FAIR with no validator call, because it is their own view.',
  },
  {
    q: 'Does it ban or remove anyone?',
    a: 'No. There is no ban and no removal, only a locked reply box. The deposits keep it in proportion, and they come back when the thread is completed fairly.',
  },
  {
    q: 'Which network?',
    a: 'GenLayer Studio Next, chain 61997. Test GEN is free from the faucet in the site. Every write carries a small fee deposit, most of which is refunded when the transaction finalizes.',
  },
  {
    q: 'Is a thread private?',
    a: 'No. Positions, restatements and verdicts are public text on chain, so threads suit debates that can be public. Do not put anything in a position you would not post.',
  },
];

const RAIL = [
  ['01', 'They state', 'The author posts a position with a deposit.'],
  ['02', 'You restate', 'The joiner restates it in their own words, with the same deposit.'],
  ['03', 'Validators check', 'The author confirms it, or contests and validators read it against the original.'],
  ['04', 'You answer', 'A fair restatement unlocks the joiner’s rebuttal.'],
  ['05', 'They restate you', 'The author must now restate the rebuttal in turn.'],
];

/** Threads made to score the judge or to test the contract. They stay readable, but they are not the examples. */
const HIDDEN = new Set<number>(generated.evalThreads);
const isTest = (t: Thread) => HIDDEN.has(t.id) || /reviewer path/i.test(t.topic);

/** The split screen: a real thread whose first restatement came back FAIR, read from the contract. */
function pickExample(threads: Thread[]): { thread: Thread; restatement: string } | null {
  for (const t of threads) {
    if (isTest(t)) continue;
    const u = t.turns[0];
    if (u && u.status === 'FAIR' && u.label === 'FAIR') {
      const text = u.restatement || '';
      if (text) return { thread: t, restatement: text };
    }
  }
  return null;
}

export default async function Landing() {
  let threads: Thread[] = [];
  let error = '';
  try {
    threads = await recentThreads(16);
  } catch (e) {
    error = readError(e);
  }
  const real = threads.filter((t) => !isTest(t));
  const feed = real.slice(0, 4);
  const example = pickExample(threads);
  const aid = example ? readingAid(example.thread.turns[0].original, example.restatement) : null;

  return (
    <>
      <section className="c-wrap pb-12 pt-14 text-center md:pt-20">
        <p className="c-eyebrow">Fair restatement, judged on GenLayer</p>
        <h1 className="c-h1 mx-auto mt-5 max-w-[14em]">
          Say their side so well <em>they would sign it.</em>
        </h1>
        <p className="c-lead mx-auto mt-6 max-w-[38em]">
          You cannot answer until you have restated them fairly. GenLayer validators check the restatement against what they actually said.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/new" className="c-btn solid">
            Open a thread
          </Link>
          {real[0] ? (
            <Link href={`/t/${real[0].id}`} className="c-btn">
              Read a thread
            </Link>
          ) : null}
        </div>
      </section>

      <section className="c-wrap pb-16">
        {error ? (
          <ReadError message={error} />
        ) : example && aid ? (
          <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
            <div className="c-card pad text-left">
              <p className="c-eyebrow">They said · thread {example.thread.id}</p>
              <p className="mt-3 text-[15.5px] leading-relaxed">
                {aid.points.map((p, i) => (
                  <span key={i} className="underline decoration-[var(--violet-line)] underline-offset-4">
                    {p.text}
                    {i < aid.points.length - 1 ? '. ' : '.'}
                  </span>
                ))}
              </p>
              <p className="c-faint mt-3 text-[12.5px]">{aid.points.length} main points, underlined</p>
            </div>
            <div className="flex flex-col items-center justify-center gap-2 px-2">
              <LabelBadge label="FAIR" />
              <p className="c-faint text-[12px]">validators read both</p>
              <p className="c-faint text-[12px]">reply unlocked</p>
            </div>
            <div className="c-card pad text-left">
              <p className="c-eyebrow">You restated</p>
              <p className="mt-3 text-[15.5px] leading-relaxed">{example.restatement}</p>
              <p className="c-faint mt-3 text-[12.5px]">
                {aid.points.filter((p) => p.kept).length} of {aid.points.length} points kept{aid.added.length === 0 ? ', nothing added' : ''}
              </p>
            </div>
          </div>
        ) : (
          <Empty>The first fair restatement on chain will appear here, beside what it restated.</Empty>
        )}

        <div className="c-steps mt-10 text-left">
          {RAIL.map(([n, t, d], i) => (
            <div key={n} style={i === 1 ? { borderColor: 'var(--violet)' } : undefined}>
              <p className="mono c-faint text-[12px]">{n}</p>
              <p className="mt-2 text-[17px] font-semibold">{t}</p>
              <p className="c-muted mt-2 text-[14px] leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="c-section" id="threads">
        <div className="c-wrap">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="c-eyebrow">Recent threads</p>
              <h2 className="c-h2 mt-2">With the last verdict on each.</h2>
            </div>
            <p className="c-muted max-w-[30em] text-[14px]">Distorted and incomplete restatements stay on the page, next to the fair ones, because readers learn from them.</p>
          </div>
          <div className="c-card mt-6 divide-y divide-[var(--line)]">
            {feed.length ? feed.map((k) => <ThreadRow key={k.id} k={k} />) : <div className="p-4">{error ? error : 'No threads yet.'}</div>}
          </div>
        </div>
      </section>

      <section className="c-section" id="how">
        <div className="c-wrap">
          <p className="c-eyebrow">How it works</p>
          <h2 className="c-h2 mt-2">State, restate, check, answer, restate back.</h2>
          <div className="c-card mt-6 overflow-hidden">
            <table className="c-table">
              <thead>
                <tr>
                  <th>Verdict</th>
                  <th>Meaning</th>
                  <th>Money</th>
                </tr>
              </thead>
              <tbody>
                <tr><td><LabelBadge label="FAIR" /></td><td>Every main point of the original is there, nothing is added</td><td>deposits stay in; the reply unlocks</td></tr>
                <tr><td><LabelBadge label="INCOMPLETE" /></td><td>A main point is missing, nothing else is wrong</td><td>deposits stay in; one try used, up to 2</td></tr>
                <tr><td><LabelBadge label="DISTORTED" /></td><td>The restatement adds, reverses, exaggerates, mocks or argues</td><td>deposits stay in; one try used, up to 2</td></tr>
                <tr><td><span className="c-verdict expired">FORFEIT</span></td><td>Out of tries, or a window missed</td><td>the forfeiting side’s deposit goes to the other</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="c-section" id="daos">
        <div className="c-wrap">
          <p className="c-eyebrow">For DAOs</p>
          <h2 className="c-h2 mt-2">A thread beside a proposal.</h2>
          <p className="c-muted mt-4 max-w-[40em] text-[15px] leading-relaxed">
            Contested proposals where both views are on the record at their strongest, before the vote. Each side has shown it understood the other, so a reader sees the real disagreement, not two cartoons.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/new" className="c-btn solid">Open a thread</Link>
            <Link href="/docs/quickstart" className="c-btn">Quickstart</Link>
          </div>
        </div>
      </section>

      <section className="c-section" id="faq">
        <div className="c-wrap">
          <p className="c-eyebrow">FAQ</p>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {FAQ.map((f) => (
              <div key={f.q}>
                <p className="font-semibold">{f.q}</p>
                <p className="c-muted mt-1.5 text-[14.5px] leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
