import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import { ChatbotAssistant } from '@/components/workshield/chatbot-assistant';
import './globals.css';

export const metadata: Metadata = {
  title: 'WorkShield AI — Parametric Insurance for Gig Workers',
  description:
    'Instant income protection for Swiggy, Zomato, Blinkit, and Dunzo delivery workers in India. Auto-pay on rainfall, severe congestion, accidents, platform outages, and hospitalization.',
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
      <body className="min-h-screen bg-background antialiased">
        {children}
        <ChatbotAssistant />
        <Toaster position="top-center" toastOptions={{ duration: 4000 }} />
      </body>
    </html>
  );
}
