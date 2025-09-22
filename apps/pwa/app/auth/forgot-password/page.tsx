'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AuthLayout from '../../../src/components/ui/AuthLayout';
import TextField from '../../../src/components/ui/TextField';
import Button from '../../../src/components/ui/Button';
import FormError from '../../../src/components/ui/FormError';
import { api, ApiError } from '../../../src/lib/api';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const email = watch('email');

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setLoading(true);
      setServerError(null);
      
      await api.forgotPassword(data);
      setSuccess(true);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 404) {
          // Don't reveal if email exists or not for security
          setSuccess(true);
        } else if (error.status === 429) {
          setServerError('Too many requests. Please try again later.');
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

  if (success) {
    return (
      <AuthLayout
        title="Check your email"
        description="We've sent password reset instructions"
      >
        <div className="text-center space-y-4">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">Email sent!</h3>
            <p className="mt-2 text-sm text-gray-600">
              We've sent password reset instructions to{' '}
              <span className="font-medium">{email}</span>
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Check your inbox and follow the link to reset your password.
            </p>
          </div>
          <div className="space-y-3">
            <Button
              onClick={() => window.location.href = '/login'}
              variant="secondary"
              className="w-full"
            >
              Back to login
            </Button>
            <p className="text-xs text-gray-500">
              Didn't receive an email? Check your spam folder or{' '}
              <button
                onClick={() => {
                  setSuccess(false);
                  setServerError(null);
                }}
                className="text-indigo-600 hover:text-indigo-500 underline"
              >
                try again
              </button>
            </p>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      description="Enter your email and we'll send you a reset link"
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
          placeholder="Enter your email address"
        />

        <Button
          type="submit"
          className="w-full"
          loading={loading}
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send reset instructions'}
        </Button>

        <div className="text-center">
          <span className="text-sm text-gray-600">
            Remember your password?{' '}
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