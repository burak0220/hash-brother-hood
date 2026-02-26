import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'HashBrotherHood - Hashrate Marketplace',
  description: 'Professional mining hashrate rental marketplace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for (var r of registrations) { r.unregister(); }
                });
              }
              if ('caches' in window) {
                caches.keys().then(function(names) {
                  for (var name of names) { caches.delete(name); }
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-dark-950 text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
