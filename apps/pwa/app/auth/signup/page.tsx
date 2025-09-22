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

const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(12, 'Password must be at least 12 characters long'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    try {
      setLoading(true);
      setServerError(null);
      
      await api.signup({
        email: data.email,
        password: data.password,
      });

      // Redirect to login after successful signup
      router.push('/login');
    } catch (error) {
      if (error instanceof ApiError) {
        setServerError(error.message);
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      description="Get started with thermal gait screening"
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
          autoComplete="new-password"
          required
          {...register('password')}
          error={errors.password?.message}
          helperText="Password must be at least 12 characters long"
        />

        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          required
          {...register('confirmPassword')}
          error={errors.confirmPassword?.message}
        />

        <Button
          type="submit"
          className="w-full"
          loading={loading}
          disabled={loading}
        >
          {loading ? 'Creating account...' : 'Create account'}
        </Button>

        <div className="text-center">
          <span className="text-sm text-gray-600">
            Already have an account?{' '}
            <a
              href="/login"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Sign in
            </a>
          </span>
        </div>
      </form>
    </AuthLayout>
  );
}