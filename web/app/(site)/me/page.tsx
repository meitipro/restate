import { MePanel } from '@/components/MePanel';

export const metadata = { title: 'My threads' };

export default function MePage() {
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">My threads</p>
      <h1 className="c-h1 mt-3" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>
        Where it is your move.
      </h1>
      <div className="mt-8">
        <MePanel />
      </div>
    </div>
  );
}
