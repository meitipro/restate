import Link from 'next/link';

import { WalletButton } from './Wallet';

/** The site's mark: two speech bubbles, one restating the other, with a check. The same drawing as docs/brand/restate-icon.svg. */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden style={{ flexShrink: 0 }}>
      <rect x="64" y="92" width="260" height="190" rx="46" fill="#475569" />
      <polygon points="116,276 116,352 196,276" fill="#475569" />
      <rect x="196" y="196" width="260" height="190" rx="46" fill="#818cf8" stroke="#0b0b0e" strokeWidth="16" />
      <polygon points="404,378 404,454 324,378" fill="#818cf8" />
      <polyline points="276,288 322,334 396,238" fill="none" stroke="#0b0b0e" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Nav() {
  return (
    <header className="c-nav">
      <div className="c-wrap c-nav-row">
        <Link href="/" className="c-brand" aria-label="Restate home">
          <Mark />
          Restate
        </Link>
        <nav className="c-links" aria-label="Main">
          <Link href="/#threads">Threads</Link>
          <Link href="/new">Open a thread</Link>
          <Link href="/#how">How it works</Link>
          <Link href="/docs">Docs</Link>
        </nav>
        <div className="c-nav-right">
          <span className="c-pill hidden sm:inline-flex" title="GenLayer Studio Next, chain 61997">
            <span className="dot" />
            Studio Next
          </span>
          <WalletButton />
          <Link href="/new" className="c-btn small solid hidden sm:inline-flex">
            Open a thread
          </Link>
        </div>
      </div>
    </header>
  );
}
