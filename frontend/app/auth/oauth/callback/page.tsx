'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setAuthToken } from '../../../../src/lib/api';
import { useSession } from '../../../../src/lib/session';

export default function OAuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshSession } = useSession();
  const [statusMessage, setStatusMessage] = useState('Finishing sign-in...');

  useEffect(() => {
    const token = searchParams.get('token');
    const nextParam = searchParams.get('next');
    const destination = nextParam && nextParam.startsWith('/') ? nextParam : '/dashboard';

    async function finalizeLogin() {
      if (!token) {
        setStatusMessage('Missing login token. Redirecting to sign-in...');
        setTimeout(() => router.replace('/auth/login?error=oauth_callback'), 1500);
        return;
      }

      // Persist the access token for API requests
      setAuthToken(token);

      try {
        await refreshSession();
        router.replace(destination);
      } catch (error) {
        console.error('Failed to refresh session after OAuth login:', error);
        setStatusMessage('Could not load your session. Redirecting to sign-in...');
        setTimeout(() => router.replace('/auth/login?error=oauth_session'), 1500);
      }
    }

    finalizeLogin();
  }, [searchParams, refreshSession, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 text-sm">{statusMessage}</p>
      </div>
    </div>
  );
}
