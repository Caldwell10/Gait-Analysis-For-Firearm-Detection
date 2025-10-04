'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AuthLayout from '../../../src/components/ui/AuthLayout';
import TextField from '../../../src/components/ui/TextField';
import PasswordField from '../../../src/components/ui/PasswordField';
import Button from '../../../src/components/ui/Button';
import FormError from '../../../src/components/ui/FormError';
import { api, ApiError, setAuthToken } from '../../../src/lib/api';
import { useSession } from '../../../src/lib/session';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();
  const { refreshSession } = useSession();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setLoading(true);
      setServerError(null);

      const response = await api.login(data);

      // Store the token for future requests
      if (response.access_token) {
        setAuthToken(response.access_token);
      }

      // Small delay to ensure token is set before refreshing session
      await new Promise(resolve => setTimeout(resolve, 100));

      // Refresh session to get user data
      await refreshSession();

      // Skip 2FA - go directly to dashboard
      router.push('/dashboard');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setServerError('Invalid email or password');
        } else if (error.status === 429) {
          setServerError('Too many login attempts. Please try again later.');
        } else {
          setServerError(error.message);
        }
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = (provider: 'google' | 'github') => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    window.location.href = `${apiUrl}/auth/oauth/${provider}/login`;
  };

  return (
    <AuthLayout title="Sign in to your account" description="Access thermal gait screening system">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-7 body-font">
        <FormError error={serverError} />

        <div className="space-y-5">
          <TextField
            label="Email address"
            type="email"
            autoComplete="email"
            required
            {...register('email')}
            error={errors.email?.message}
          />

          <PasswordField
            label="Password"
            autoComplete="current-password"
            required
            {...register('password')}
            error={errors.password?.message}
          />
        </div>

        <Button type="submit" className="w-full" loading={loading} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center">
            <span className="rounded-full border border-white/10 bg-[var(--tg-color-bg)] px-4 py-1 text-xs uppercase tracking-[0.35em] text-slate-400 heading-font">
              Or continue with
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <OAuthButton provider="google" loading={loading} onClick={handleOAuthLogin} />
          <OAuthButton provider="github" loading={loading} onClick={handleOAuthLogin} />
        </div>

        <p className="text-center text-sm text-slate-400">
          Don&apos;t have an account?{' '}
          <a href="/auth/signup" className="font-semibold text-[#8b5cf6] hover:text-[#a855f7]">
            Sign up
          </a>
        </p>
      </form>
    </AuthLayout>
  );
}

function OAuthButton({
  provider,
  onClick,
  loading,
}: {
  provider: 'google' | 'github';
  onClick: (provider: 'google' | 'github') => void;
  loading: boolean;
}) {
  const isGoogle = provider === 'google';
  const label = isGoogle ? 'Google' : 'GitHub';

  return (
    <button
      type="button"
      onClick={() => onClick(provider)}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 heading-font"
    >
      {isGoogle ? (
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path
            fillRule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {label}
    </button>
  );
}
