import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const fontBody = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
});

const fontHeading = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['500', '600', '700'],
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'WorkShield AI — Parametric Insurance for Gig Workers',
  description:
    'Instant income protection for Swiggy, Zomato, Blinkit, and Dunzo delivery workers in India. Auto-pay on rainfall, accidents, platform outages, and hospitalization.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'WorkShield' },
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`min-h-screen bg-background antialiased ${fontBody.variable} ${fontHeading.variable} ${fontMono.variable}`}>
        {children}
        <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
      </body>
    </html>
  );
}
