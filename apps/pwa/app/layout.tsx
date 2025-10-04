import { Inter, Poppins } from 'next/font/google';
import './globals.css';
import { SessionProvider } from '../src/lib/session';
import AuthGuard from '../src/components/AuthGuard';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-heading' });

export const metadata = {
  title: 'Thermal Gait Surveillance',
  description: 'Thermal gait analysis for concealed threat detection',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable} h-full`}>
      <body className="min-h-screen bg-[var(--tg-color-bg)] text-[var(--tg-color-text)] body-font">
        <SessionProvider>
          <AuthGuard>{children}</AuthGuard>
        </SessionProvider>
      </body>
    </html>
  );
}
