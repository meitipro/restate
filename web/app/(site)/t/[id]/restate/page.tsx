import Link from 'next/link';
import { notFound } from 'next/navigation';

import { RestateForm } from '@/components/RestateForm';
import { ReadError } from '@/components/ui';
import { getThread, readError } from '@/lib/read';
import type { Thread } from '@/lib/types';

export const metadata = { title: 'Restate' };

export default async function RestatePage(props: PageProps<'/t/[id]/restate'>) {
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
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">
        <Link href={`/t/${k.id}`} className="c-link">Thread {k.id} · {k.topic}</Link> · restate
      </p>
      <h1 className="c-h1 mt-3" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>
        Say their side.
      </h1>
      <div className="mt-8">
        <RestateForm thread={k} />
      </div>
    </div>
  );
}
