import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Tender Zipper — Post once. Get verified quotes.', template: '%s · Tender Zipper' },
  description:
    'Post a tender for any work at your home, society or office. Verified vendors quote, you compare side by side and choose. Zero commission.',
  applicationName: 'Tender Zipper',
};

export const viewport: Viewport = { themeColor: '#1E3A8A', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
