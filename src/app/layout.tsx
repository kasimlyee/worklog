import type { Metadata, Viewport } from 'next';
import '#src/ui/styles/global.css';

export const metadata: Metadata = {
  title: { template: '%s · Worklog', default: 'Worklog' },
  description: 'Personal planning and reporting notebook.',
  // Personal data: never indexed.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#13141b' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0b0e' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>): React.JSX.Element {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
