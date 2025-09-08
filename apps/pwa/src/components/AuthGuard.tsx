'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '../lib/session';

const PUBLIC_ROUTES = ['/login', '/signup', '/2fa/setup', '/2fa/verify', '/forgot-password', '/reset-password'];

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return; // Wait for session to load

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
    const isAuthenticated = !!user;

    if (!isAuthenticated && !isPublicRoute) {
      // Redirect unauthenticated users to login
      router.push('/login');
    } else if (isAuthenticated && (pathname === '/login' || pathname === '/signup')) {
      // Redirect authenticated users away from login/signup
      router.push('/dashboard');
    }
  }, [user, loading, pathname, router]);

  // Show loading spinner while checking session
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}