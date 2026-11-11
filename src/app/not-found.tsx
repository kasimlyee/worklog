import Link from 'next/link';

export default function NotFound(): React.JSX.Element {
  return (
    <main id="main" className="standalone">
      <h1>Not found</h1>
      <p>This page does not exist, or what it showed has been deleted.</p>
      <p>
        <Link href="/projects">Back to projects</Link>
      </p>
    </main>
  );
}
