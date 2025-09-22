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
import { api, ApiError } from '../../../src/lib/api';
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

  return (
    <AuthLayout
      title="Sign in to your account"
      description="Access thermal gait screening system"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormError error={serverError} />
        
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

        <Button
          type="submit"
          className="w-full"
          loading={loading}
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>

        <div className="text-center">
          <span className="text-sm text-gray-600">
            Don't have an account?{' '}
            <a
              href="/signup"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Sign up
            </a>
          </span>
        </div>
      </form>
    </AuthLayout>
  );
}