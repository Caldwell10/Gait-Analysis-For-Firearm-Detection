import { Inter } from 'next/font/google';
import './globals.css';
import { SessionProvider } from '../src/lib/session';
import AuthGuard from '../src/components/AuthGuard';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Thermal Gait Screening',
  description: 'Gait-driven concealed firearm detection using thermal video',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <AuthGuard>{children}</AuthGuard>
        </SessionProvider>
      </body>
    </html>
  );
}