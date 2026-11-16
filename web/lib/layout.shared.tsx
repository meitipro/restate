import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

import { gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="inline-flex items-center gap-2 font-semibold">
          <svg width={22} height={22} viewBox="106 106 300 300" aria-hidden>
            <rect x="106" y="106" width="300" height="300" rx="46" fill="#818cf8" />
            <rect x="146" y="158" width="150" height="86" rx="22" fill="#14143a" />
            <rect x="216" y="268" width="150" height="86" rx="22" fill="#14143a" />
          </svg>
          Restate
          <span className="c-pill ml-1" style={{ height: 22, fontSize: 10.5 }}>
            <span className="dot" />
            Studio Next
          </span>
        </span>
      ),
      url: '/',
    },
    links: [
      { text: 'Threads', url: '/#threads' },
      { text: 'Open a thread', url: '/new' },
      { text: 'How it works', url: '/#how' },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
