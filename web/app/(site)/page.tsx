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
  ['03', 'Validators check', 'The author confirms, or contests, and validators read it against the original.'],
  ['04', 'You answer', 'Locked until a FAIR restatement. It is empty on purpose.'],
  ['05', 'They restate you', 'Now the author must restate the reply, in turn.'],
];

/** Threads made to score the judge or to test the contract. They stay readable, but they are not the examples. */
const HIDDEN = new Set<number>(generated.evalThreads);
const isTest = (t: Thread) => HIDDEN.has(t.id) || /reviewer path/i.test(t.topic);

/** The split screen: a real thread whose first restatement came back FAIR, read from the contract. */
function pickExample(threads: Thread[]): { thread: Thread; restatement: string; tries: number } | null {
  for (const t of threads) {
    if (isTest(t)) continue;
    const u = t.turns[0];
    if (u && u.status === 'FAIR' && u.label === 'FAIR') {
      const text = u.restatement || '';
      if (text) return { thread: t, restatement: text, tries: u.history.length + 1 };
    }
  }
  return null;
}

function Tick() {
  return (
    <span className="c-tick">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#14143a" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 12l5 5 9-10" />
      </svg>
    </span>
  );
}

function LockIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="locked">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
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
  const kept = aid ? aid.points.filter((p) => p.kept).length : 0;

  return (
    <>
      <section className="c-hero">
        <div className="c-wrap pb-14 pt-16 text-center md:pb-20 md:pt-24">
          <span className="c-tag">Fair restatement · judged on GenLayer</span>
          <h1 className="c-display mx-auto mt-8 max-w-[11em]">
            Say their side so well <span className="acc">they would sign it.</span>
          </h1>
          <p className="c-lead mx-auto mt-7 max-w-[34em] text-[19px] md:text-[22px]">
            You cannot answer until you have restated them fairly. GenLayer validators check the restatement against what they actually said, and never who is right.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/new" className="c-btn solid big">
              Open a thread
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
            {real[0] ? (
              <Link href={`/t/${real[0].id}`} className="c-btn big ghost">
                Read a real thread
              </Link>
            ) : null}
          </div>

          <div className="mt-16 md:mt-[72px]">
            {error ? (
              <ReadError message={error} />
            ) : example && aid ? (
              <>
                <div className="c-split">
                  <div className="c-split-card">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="c-eyebrow">They said · thread {example.thread.id}</span>
                      <span className="c-chip" style={{ cursor: 'default', borderStyle: 'solid' }}>author</span>
                    </div>
                    <p>
                      {aid.points.map((p, i) => (
                        <span key={i}>
                          <span className="c-hl">{p.text.replace(/[.!?]+$/, '')}</span>
                          {i < aid.points.length - 1 ? '. ' : '.'}
                        </span>
                      ))}
                    </p>
                    <div className="c-faint mono mt-auto flex items-center gap-3 text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
                      <span style={{ width: 22, borderTop: '2px solid var(--violet)', display: 'inline-block' }} />
                      {aid.points.length} main points, underlined
                    </div>
                  </div>

                  <div className="c-split-mid">
                    <div className="wire" />
                    <div className="c-seal">
                      <b>FAIR</b>
                      <span>VALIDATORS AGREE</span>
                    </div>
                    <div className="seal-note mono mt-3 text-center text-[12px] leading-snug" style={{ color: 'var(--ink-2)' }}>
                      reply
                      <br />
                      unlocked
                    </div>
                    <div className="wire seal-note mt-3" />
                    <div className="wire wire-end" />
                  </div>

                  <div className="c-split-card mine">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="c-eyebrow" style={{ color: 'var(--violet)' }}>You restated · try {example.tries}</span>
                      <span className="c-chip" style={{ cursor: 'default', borderStyle: 'solid' }}>joiner</span>
                    </div>
                    <p>{example.restatement}</p>
                    <div className="mono mt-auto flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
                      {aid.points.map((p, i) => (p.kept ? <Tick key={i} /> : null))}
                      <span className="ml-1.5">
                        {kept} of {aid.points.length} points kept{aid.added.length === 0 ? ', nothing added' : ''}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="mono mt-5 text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
                  read from the chain · thread {example.thread.id}
                  {example.tries > 1 ? ` · its earlier ${example.tries - 1 === 1 ? 'try was' : 'tries were'} labelled DISTORTED or INCOMPLETE` : ''}
                </p>
              </>
            ) : (
              <Empty>The first fair restatement on chain will appear here, beside what it restated.</Empty>
            )}
          </div>
        </div>
      </section>

      <section className="c-section" id="how" style={{ borderTop: 0, padding: '88px 0' }}>
        <div className="c-wrap">
          <p className="c-eyebrow" style={{ color: 'var(--violet)' }}>The rule</p>
          <h2 className="c-h2x mt-4 max-w-[13em]">The reply box starts locked, and one label opens it.</h2>
          <div className="c-rail5 mt-12">
            {RAIL.map(([n, t, d]) => {
              const cls = n === '03' ? 'on' : n === '04' ? 'lock' : '';
              return (
                <div key={n} className={cls}>
                  <div className="flex items-center justify-between">
                    <span className="mono text-[13px]" style={{ color: n === '03' ? 'var(--violet)' : 'var(--ink-3)' }}>{n}</span>
                    {n === '04' ? <LockIcon /> : null}
                  </div>
                  <p className="mt-3.5 text-[21px] font-semibold" style={n === '04' ? { color: 'var(--ink-2)' } : undefined}>{t}</p>
                  <p className="c-muted mt-2 text-[15px] leading-relaxed">{d}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="c-section" style={{ background: '#0e0e12', padding: '88px 0' }}>
        <div className="c-wrap">
          <p className="c-eyebrow" style={{ color: 'var(--violet)' }}>Three labels</p>
          <h2 className="c-h2x mt-4 max-w-[14em]">Validators answer one word. Nothing else is stored.</h2>
          <div className="mt-12 flex flex-wrap gap-5">
            <div className="c-labcard fair">
              <LabelBadge label="FAIR" />
              <p className="text-[26px] font-semibold tracking-tight">It says what they said.</p>
              <p className="c-muted text-[16px] leading-relaxed">Every main point is there, in your words, and nothing is added.</p>
              <blockquote style={{ color: 'var(--violet)' }}>
                <span style={{ color: 'var(--ink)' }}>“They say token pay ties wages to the price and hides what the work really costs…”</span>
              </blockquote>
              <p className="mono text-[12.5px]" style={{ color: 'var(--ink-2)' }}>The reply unlocks. Both deposits come back at the end.</p>
            </div>
            <div className="c-labcard inc">
              <LabelBadge label="INCOMPLETE" />
              <p className="text-[26px] font-semibold tracking-tight">A main point is missing.</p>
              <p className="c-muted text-[16px] leading-relaxed">Accurate as far as it goes, but it leaves something out.</p>
              <blockquote style={{ color: 'var(--amber)' }}>
                <span style={{ color: 'var(--ink)' }}>“Pay should be quarterly and in stablecoins.”</span>
              </blockquote>
              <p className="mono text-[12.5px]" style={{ color: 'var(--ink-2)' }}>One try spent, one left. The reply stays locked.</p>
            </div>
            <div className="c-labcard dis">
              <LabelBadge label="DISTORTED" />
              <p className="text-[26px] font-semibold tracking-tight">It stopped being a restatement.</p>
              <p className="c-muted text-[16px] leading-relaxed">It adds, reverses, exaggerates, mocks, or argues back.</p>
              <blockquote style={{ color: 'var(--coral)' }}>
                <span className="c-struck">“They think tokens are bad and want everyone paid in dollars.”</span>
              </blockquote>
              <p className="mono text-[12.5px]" style={{ color: 'var(--ink-2)' }}>One try spent. A second failure forfeits the deposit.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="c-section" style={{ padding: '88px 0' }}>
        <div className="c-wrap flex flex-wrap items-start gap-14">
          <div className="min-w-0 flex-[1_1_440px]">
            <p className="c-eyebrow" style={{ color: 'var(--violet)' }}>Skin in the game</p>
            <h2 className="c-h2x mt-4">Two tries. Real deposits.</h2>
            <p className="c-lead mt-5 text-[19px]">
              Both sides put in the same deposit. If both restatements end FAIR, both come back. If one side runs out of tries or walks away, the other takes both.
            </p>
            <div className="c-stats mt-10">
              <div>
                <b style={{ color: 'var(--violet)' }}>2</b>
                <span>TRIES PER RESTATEMENT</span>
              </div>
              <div>
                <b style={{ color: 'var(--violet)' }}>2</b>
                <span>TURNS, ONE EXCHANGE</span>
              </div>
              <div>
                <b>5–1000</b>
                <span>GEN EACH SIDE</span>
              </div>
              <div>
                <b>12–96h</b>
                <span>WINDOW PER STEP</span>
              </div>
            </div>
          </div>
          <div className="c-card min-w-0 flex-[1_1_440px] px-7 pb-3 pt-2">
            <p className="c-eyebrow py-5" style={{ borderBottom: '1px solid var(--line-strong)' }}>Where the money goes</p>
            <div className="c-ledger-row">
              <div>
                <p className="text-[19px] font-semibold">Both restatements FAIR</p>
                <p className="c-muted mt-1 text-[14.5px]">Thread done</p>
              </div>
              <p className="mono text-right text-[15px]" style={{ color: 'var(--violet)' }}>5 GEN back<br />to each side</p>
            </div>
            <div className="c-ledger-row">
              <div>
                <p className="text-[19px] font-semibold">Nobody joins in time</p>
                <p className="c-muted mt-1 text-[14.5px]">Thread closed</p>
              </div>
              <p className="mono text-right text-[15px]" style={{ color: 'var(--violet)' }}>5 GEN back<br />to the author</p>
            </div>
            <div className="c-ledger-row">
              <div>
                <p className="text-[19px] font-semibold">A restater runs out of tries</p>
                <p className="c-muted mt-1 text-[14.5px]">Forfeit</p>
              </div>
              <p className="mono text-right text-[15px]" style={{ color: 'var(--coral)' }}>10 GEN to<br />the other side</p>
            </div>
            <div className="c-ledger-row">
              <div>
                <p className="text-[19px] font-semibold">A side misses a window</p>
                <p className="c-muted mt-1 text-[14.5px]">Forfeit, called by anyone</p>
              </div>
              <p className="mono text-right text-[15px]" style={{ color: 'var(--coral)' }}>10 GEN to<br />the other side</p>
            </div>
          </div>
        </div>
      </section>

      <section className="c-section" id="threads" style={{ background: '#0e0e12', padding: '88px 0' }}>
        <div className="c-wrap">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="c-eyebrow" style={{ color: 'var(--violet)' }}>On the chain now</p>
              <h2 className="c-h2x mt-4">Failed tries stay on the page.</h2>
            </div>
            <p className="c-muted max-w-[22em] text-[15.5px] leading-relaxed">Distorted and incomplete restatements sit next to the fair ones, because readers learn from both.</p>
          </div>
          <div className="c-card mt-10 divide-y divide-[var(--line)]">
            {feed.length ? feed.map((k) => <ThreadRow key={k.id} k={k} />) : <div className="p-4">{error ? error : 'No threads yet.'}</div>}
          </div>
        </div>
      </section>

      <section className="c-section" id="daos" style={{ padding: '104px 0' }}>
        <div className="c-wrap text-center">
          <h2 className="c-display mx-auto max-w-[12em]" style={{ fontSize: 'clamp(38px, 6vw, 72px)', lineHeight: 1 }}>
            Win the argument you can <span className="acc">restate.</span>
          </h2>
          <p className="c-lead mx-auto mt-6 max-w-[34em] text-[20px]">
            For DAOs: a thread beside a contested proposal, with both views on the record at their strongest before the vote.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/new" className="c-btn solid big">Open a thread</Link>
            <Link href="/docs/quickstart" className="c-btn big ghost">Read the docs</Link>
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
