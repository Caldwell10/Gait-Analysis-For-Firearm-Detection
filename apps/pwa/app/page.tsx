'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '../src/lib/session';

export default function HomePage() {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (user) {
      router.push('/dashboard');
    } else {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}