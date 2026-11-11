import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isPreviewEnabled } from './enabled.ts';
import { screens } from './screens.tsx';

export default function PreviewIndex(): React.JSX.Element {
  if (!isPreviewEnabled(process.env.NODE_ENV)) {
    notFound();
  }
  return (
    <main id="main" className="standalone">
      <h1>Screen previews</h1>
      <ul>
        {Object.keys(screens).map((name) => (
          <li key={name}>
            <Link href={`/preview/${name}`}>{name}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
