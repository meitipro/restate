import { NewThread } from '@/components/NewThread';

export const metadata = { title: 'Open a thread' };

export default function NewPage() {
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">Open a thread</p>
      <h1 className="c-h1 mt-3" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>
        Say your side. They must say it back.
      </h1>
      <p className="c-lead mt-3 max-w-[40em]">Post a position and a deposit. Whoever joins has to restate it fairly before they can answer, and then you do the same for their reply.</p>
      <div className="mt-8">
        <NewThread />
      </div>
    </div>
  );
}
