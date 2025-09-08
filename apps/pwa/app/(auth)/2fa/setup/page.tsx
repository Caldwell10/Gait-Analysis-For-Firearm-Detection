'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import AuthLayout from '../../../../src/components/ui/AuthLayout';
import OtpField from '../../../../src/components/ui/OtpField';
import Button from '../../../../src/components/ui/Button';
import FormError from '../../../../src/components/ui/FormError';
import { api, ApiError, TotpSetupResponse } from '../../../../src/lib/api';
import { useSession } from '../../../../src/lib/session';

const totpSchema = z.object({
  code: z.string().length(6, 'Please enter all 6 digits'),
});

type TotpFormData = z.infer<typeof totpSchema>;

export default function TotpSetupPage() {
  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<TotpSetupResponse | null>(null);
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

  useEffect(() => {
    const fetchSetupData = async () => {
      try {
        const data = await api.totpSetup();
        setSetupData(data);
      } catch (error) {
        if (error instanceof ApiError) {
          setServerError(error.message);
        } else {
          setServerError('Failed to setup 2FA. Please try again.');
        }
      } finally {
        setSetupLoading(false);
      }
    };

    fetchSetupData();
  }, []);

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
      }
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setServerError('Invalid verification code. Please try again.');
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

  if (setupLoading) {
    return (
      <AuthLayout title="Setting up 2FA...">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Setting up authentication...</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set up Two-Factor Authentication"
      description="Add this secret to your authenticator app"
    >
      <div className="space-y-6">
        <FormError error={serverError} />
        
        {setupData && (
          <>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-900 mb-2">
                Add this secret to your authenticator app (Google Authenticator, Authy, etc.):
              </p>
              <code className="block text-sm bg-white p-2 rounded border font-mono break-all">
                {setupData.secret}
              </code>
              <p className="text-xs text-gray-500 mt-2">
                Account: Your email | Issuer: Thermal Gait Screening
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <OtpField
                label="Enter verification code from your authenticator app"
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
                {loading ? 'Verifying...' : 'Verify and Complete Setup'}
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
}