'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff } from 'lucide-react';
import { AuthService } from '@app/services/authService';
import { FormField } from '@app/components/FormField';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import { Capability } from '@club/shared-types/core/enums';
import { hasCapability } from '@app/lib/access/permissions';
import { navigateToDocument } from '@app/lib/navigation/documentNavigation';
import { Button } from '@app/components/ui/button';

export default function LoginForm({
  showPasswordRecovery,
}: {
  showPasswordRecovery: boolean;
}) {
  const t = useTranslations('common');
  const tLogin = useTranslations('login');
  const loginMutation = AuthService.useLogin();
  const params = useParams();
  const lang = (params?.lang as string) || 'en';
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const demoEmail = process.env.NEXT_PUBLIC_SHOWCASE_DEMO_EMAIL;
  const demoPassword = process.env.NEXT_PUBLIC_SHOWCASE_DEMO_PASSWORD;
  const loginErrorKey =
    loginMutation.error?.kind === 'invalid_credentials'
      ? 'error_invalid_credentials'
      : loginMutation.error?.kind === 'sign_in_denied'
        ? 'error_signin_denied'
        : 'error_generic';

  const handleFieldChange = (field: 'email' | 'password', value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFieldBlur = (field: string) => {
    setTouchedFields((prev) => new Set([...prev, field]));
  };

  const getFieldError = (field: string) => {
    if (!touchedFields.has(field)) return undefined;

    if (field === 'email' && formData.email && !isValidEmail(formData.email)) {
      return [t('validation.email')];
    }
    if ((field === 'email' || field === 'password') && !formData[field]) {
      return [t('validation.required')];
    }
    return undefined;
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched for validation
    setTouchedFields(new Set(['email', 'password']));

    // Validate form
    const emailError = getFieldError('email');
    const passwordError = getFieldError('password');

    if (emailError || passwordError || !formData.email || !formData.password) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { email, password } = formData;
      const response = await loginMutation.mutateAsync({
        email,
        password,
      });
      const destination =
        hasCapability(response.user, Capability.ADMINISTRATION) ||
        hasCapability(response.user, Capability.ACTIVE_PLAYER)
          ? `/${lang}/dashboard`
          : `/${lang}/account`;
      navigateToDocument(destination);
    } catch (_err: any) {
      // Error displayed via loginError from useAuth
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">{t('login')}</h2>

      {demoEmail && demoPassword && (
        <div className="mb-5 rounded-md border bg-muted/30 p-4 text-sm">
          <p className="font-medium">{tLogin('demo_title')}</p>
          <p className="mt-1 text-muted-foreground">
            {tLogin('demo_description')}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              handleFieldChange('email', demoEmail);
              handleFieldChange('password', demoPassword);
            }}
          >
            {tLogin('demo_fill')}
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {loginMutation.error && (
          <div
            role="alert"
            className="p-3 rounded-md bg-red-50 border border-red-200"
          >
            <p className="text-sm text-red-600">{tLogin(loginErrorKey)}</p>
          </div>
        )}

        <FormField
          label={tLogin('email')}
          type="email"
          value={formData.email}
          onChange={(value) => handleFieldChange('email', value)}
          onBlur={() => handleFieldBlur('email')}
          required
          error={getFieldError('email')}
          name="email"
        />

        {/* Custom Password Field with Show/Hide Toggle */}
        <div className="space-y-2 form-field">
          <Label htmlFor="password">
            {tLogin('password')}
            <span className="text-destructive ml-1">*</span>
          </Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleFieldChange('password', e.target.value)
              }
              onBlur={() => handleFieldBlur('password')}
              aria-invalid={!!getFieldError('password')}
              aria-describedby={
                getFieldError('password') ? 'password-error' : undefined
              }
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
              aria-label={
                showPassword ? tLogin('hide_password') : tLogin('show_password')
              }
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
          {getFieldError('password') && (
            <p className="text-sm text-destructive mt-1" id="password-error">
              {getFieldError('password')?.[0]}
            </p>
          )}
          {showPasswordRecovery && (
            <div className="text-right">
              <Link
                href={`/${lang}/forgot-password`}
                className="text-sm text-primary-700 underline-offset-4 hover:underline"
              >
                {tLogin('forgot_password')}
              </Link>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? tLogin('logging_in') : t('login')}
        </button>
      </form>
    </div>
  );
}
