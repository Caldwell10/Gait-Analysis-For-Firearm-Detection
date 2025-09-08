'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AuthLayout from '../../../../src/components/ui/AuthLayout';
import OtpField from '../../../../src/components/ui/OtpField';
import Button from '../../../../src/components/ui/Button';
import FormError from '../../../../src/components/ui/FormError';
import { api, ApiError } from '../../../../src/lib/api';
import { useSession } from '../../../../src/lib/session';

const totpSchema = z.object({
  code: z.string().length(6, 'Please enter all 6 digits'),
});

type TotpFormData = z.infer<typeof totpSchema>;

export default function TotpVerifyPage() {
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();
  const { refreshSession } = useSession();

  const {
    setValue,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<TotpFormData>({
    resolver: zodResolver(totpSchema),
    defaultValues: { code: '' },
  });

  const code = watch('code');

  const onSubmit = async (data: TotpFormData) => {
    try {
      setLoading(true);
      setServerError(null);
      
      const response = await api.totpVerify({ code: data.code });
      
      if (response.verified) {
        // Refresh session and redirect to dashboard
        await refreshSession();
        router.push('/dashboard');
      } else {
        setServerError('Invalid verification code. Please try again.');
        setValue('code', ''); // Clear the field
      }
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setServerError('Invalid verification code. Please try again.');
        } else if (error.status === 429) {
          setServerError('Too many attempts. Please try again later.');
        } else {
          setServerError(error.message);
        }
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
      setValue('code', ''); // Clear the field on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Two-Factor Authentication"
      description="Enter the verification code from your authenticator app"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormError error={serverError} />
        
        <OtpField
          label="Enter 6-digit verification code"
          value={code}
          onChange={(value) => setValue('code', value)}
          error={errors.code?.message}
          disabled={loading}
        />

        <Button
          type="submit"
          className="w-full"
          loading={loading}
          disabled={loading || code.length !== 6}
        >
          {loading ? 'Verifying...' : 'Verify'}
        </Button>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Having trouble?{' '}
            <a
              href="/login"
              className="font-medium text-indigo-600 hover:text-indigo-500"
            >
              Back to login
            </a>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}