import type { Label, Thread, Turn } from './types';

const GEN = 10n ** 18n;

/** Wei as GEN: 5 GEN, 0.5 GEN. Never through a float. */
export function gen(wei: string | bigint | number, unit = true): string {
  const value = BigInt(wei);
  const whole = value / GEN;
  const frac = value % GEN;
  let text = whole.toLocaleString('en-US');
  if (frac !== 0n) {
    const digits = frac.toString().padStart(18, '0').replace(/0+$/, '');
    text += '.' + digits.slice(0, 6);
  }
  return unit ? `${text} GEN` : text;
}

/** GEN typed by a person ("5", "0.5") to wei; null when it is not a number. */
export function toWei(text: string): bigint | null {
  const clean = text.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(clean)) return null;
  const [whole, frac = ''] = clean.split('.');
  return BigInt(whole) * GEN + BigInt((frac + '0'.repeat(18)).slice(0, 18));
}

export function short(address: string, head = 6, tail = 4): string {
  if (!address) return '';
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export function shortHash(hash: string): string {
  return hash ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : '';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Chain seconds as "Nov 17, 2026", in UTC so server and browser agree. */
export function day(seconds: number): string {
  if (!seconds) return '';
  const d = new Date(seconds * 1000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function dayTime(seconds: number): string {
  if (!seconds) return '';
  const d = new Date(seconds * 1000);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${day(seconds)}, ${hh}:${mm} UTC`;
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
}

/** Hours and minutes left until a deadline, "38 h", "12 min", or "ended". */
export function timeLeft(deadline: number, nowSeconds: number): string {
  const left = deadline - nowSeconds;
  if (left <= 0) return 'ended';
  if (left >= 3600) return `${Math.floor(left / 3600)} h`;
  return `${Math.max(1, Math.floor(left / 60))} min`;
}

/** Indigo for fair, hatched for incomplete, struck through for distorted, dotted for forfeit. */
export const LABEL_CLASS: Record<Label, string> = { FAIR: 'yes', INCOMPLETE: 'retry', DISTORTED: 'locked' };

/** What the turn is waiting for, in words. */
export function turnWaiting(t: Turn, thread: Pick<Thread, 'status' | 'phase'>): string {
  if (thread.status !== 'ACTIVE') return '';
  if (t.status === 'STATED') return t.failures > 0 ? 'Restate again' : 'Waiting for a restatement';
  if (t.status === 'RESTATED') return 'Waiting for the author to confirm or contest';
  if (t.status === 'CONTESTED') return 'Validators are reading';
  return '';
}

/** The headline state of a thread. */
export function threadState(k: Pick<Thread, 'status' | 'phase' | 'turn' | 'reason'>): string {
  if (k.status === 'OPEN') return 'OPEN';
  if (k.status === 'DONE') return 'COMPLETED';
  if (k.status === 'FORFEITED') return 'FORFEIT';
  if (k.status === 'CLOSED') return 'CLOSED';
  return k.phase === 'REPLY' ? 'REPLY UNLOCKED' : `TURN ${k.turn}`;
}

const STOP = new Set(['that', 'this', 'with', 'they', 'them', 'their', 'from', 'have', 'been', 'which', 'would', 'about', 'because', 'into', 'than', 'then', 'what', 'when', 'will', 'also', 'were', 'does', 'make', 'makes', 'want', 'wants']);

function stems(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of text.toLowerCase().match(/[\p{L}0-9]{4,}/gu) ?? []) {
    if (!STOP.has(w)) out.add(w.slice(0, 5));
  }
  return out;
}

function clauses(text: string): string[] {
  return text
    .split(/(?<=[.;!?])\s+|,\s+|\s+and\s+(?=[a-z])/i)
    .map((c) => c.trim())
    .filter((c) => c.split(/\s+/).length >= 3);
}

/**
 * A reading aid, never the verdict: the clauses of the original with whether
 * the restatement seems to carry them, and the clauses of the restatement that
 * seem to say something the original does not. A word-overlap guess computed in
 * the browser; the validators decide.
 */
export function readingAid(original: string, restatement: string): { points: { text: string; kept: boolean }[]; added: string[] } {
  const theirs = stems(restatement);
  const ours = stems(original);
  const points = clauses(original).map((text) => {
    const words = [...stems(text)];
    const hit = words.filter((w) => theirs.has(w)).length;
    return { text, kept: words.length === 0 || hit / words.length >= 0.5 };
  });
  const added = clauses(restatement).filter((text) => {
    const words = [...stems(text)];
    if (words.length === 0) return false;
    const hit = words.filter((w) => ours.has(w)).length;
    return hit / words.length < 0.34;
  });
  return { points, added };
}
