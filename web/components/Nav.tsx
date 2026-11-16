import Link from 'next/link';

import { WalletButton } from './Wallet';

/** The site's mark: two speech bubbles facing each other, one restating the other, on an indigo ground. The same drawing as docs/brand/restate-icon.svg. */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden style={{ flexShrink: 0 }}>
      <rect x="106" y="106" width="300" height="300" rx="46" fill="#818cf8" />
      <rect x="146" y="158" width="150" height="86" rx="22" fill="#14143a" />
      <path d="M176 244 L176 276 L208 244 Z" fill="#14143a" />
      <rect x="216" y="268" width="150" height="86" rx="22" fill="#14143a" />
      <path d="M336 354 L336 386 L304 354 Z" fill="#14143a" />
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
