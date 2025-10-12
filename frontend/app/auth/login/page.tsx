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
import OAuthButtons from '../../../src/components/ui/OAuthButtons';
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
    const baseUrl = apiUrl.replace(/\/+$/, '');
    const redirectParam = encodeURIComponent('/dashboard');
    window.location.href = `${baseUrl}/auth/oauth/${provider}/login?redirect=${redirectParam}`;
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

        <OAuthButtons loading={loading} onSelect={handleOAuthLogin} />

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
